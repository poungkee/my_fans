import { Page } from 'puppeteer';
import { SiteParser, ParsedArticle, ParserUtils } from './baseParser';
import logger from '../../../shared/config/logger';

export class DaumParser implements SiteParser {
  // 섹션 URL과 카테고리 매핑
  private sectionToCategoryMap: { [key: string]: string } = {
    'politics': '정치',
    'economic': '경제',
    'society': '사회',
    'foreign': '세계',
    'culture': '생활/문화',
    'digital': 'IT/과학',
    'entertain': '연예',
  };

  getSectionUrls(): string[] {
    return [
      'https://news.daum.net/politics', // 정치
      'https://news.daum.net/economic', // 경제
      'https://news.daum.net/society', // 사회
      'https://news.daum.net/foreign', // 국제(세계)
      'https://news.daum.net/culture', // 문화(생활/문화)
      'https://news.daum.net/digital', // IT(IT/과학)
      'https://news.daum.net/entertain', // 연예
    ];
  }

  // URL에서 카테고리명 추출
  private getCategoryFromUrl(url: string): string | undefined {
    for (const [section, category] of Object.entries(this.sectionToCategoryMap)) {
      if (url.includes(`/${section}`)) {
        return category;
      }
    }
    return undefined;
  }

  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      logger.info(`Daum 섹션 페이지 접속: ${sectionUrl}`);
      await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // 페이지 로딩 및 동적 콘텐츠 대기
      await page.waitForTimeout(3000);

      // 섹션 URL에서 카테고리 추출
      const categoryName = this.getCategoryFromUrl(sectionUrl);

      const urls = await page.evaluate(() => {
        // Daum 뉴스 URL 패턴: v.daum.net/v/XXXXXXXXXX
        const links = Array.from(document.querySelectorAll('a[href*="v.daum.net/v/"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && href.includes('v.daum.net/v/') && !href.includes('javascript:'));
      });

      // 중복 제거
      const uniqueUrls = [...new Set(urls)];

      // URL에 카테고리 정보 추가 (해시 파라미터로)
      const urlsWithCategory = uniqueUrls.map(url => `${url}#category=${encodeURIComponent(categoryName || '기타')}`);

      logger.info(`Daum 섹션에서 ${urlsWithCategory.length}개 기사 URL 발견 (카테고리: ${categoryName})`);

      return urlsWithCategory.slice(0, 20); // 최대 20개
    } catch (error) {
      logger.error(`Daum URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  async parseArticle(page: Page, url: string): Promise<ParsedArticle | null> {
    try {
      // URL에서 카테고리 추출 (해시 파라미터에서)
      let categoryName: string | undefined;
      if (url.includes('#category=')) {
        const match = url.match(/#category=([^&]+)/);
        if (match) {
          categoryName = decodeURIComponent(match[1]);
        }
      }

      // 해시 제거한 실제 URL
      const cleanUrl = url.split('#')[0];

      logger.info(`Daum 기사 파싱: ${cleanUrl} (카테고리: ${categoryName})`);
      await page.goto(cleanUrl, { waitUntil: 'networkidle0', timeout: 45000 });

      // 기사 제목과 언론사 로고가 로딩될 때까지 대기
      try {
        await page.waitForSelector('h3.tit_view', { timeout: 10000 });
        await page.waitForSelector('#kakaoServiceLogo', { timeout: 5000 });
      } catch {
        logger.warn(`Daum 필수 요소 대기 타임아웃: ${url}`);
      }

      // JavaScript 실행 완료 대기
      await page.waitForTimeout(2000);

      const article = await page.evaluate(() => {
        // 광고, 스크립트, 스타일 제거
        document.querySelectorAll('script, style, .ad, .advertisement, .aside_g, .cmt_fold').forEach(el => el.remove());

        // 제목: h3.tit_view
        let title = '';
        const titleEl = document.querySelector('h3.tit_view');
        if (titleEl && titleEl.textContent) {
          title = titleEl.textContent.trim();
        }

        // 본문: div.article_view
        let content = '';
        const contentEl = document.querySelector('div.article_view');
        if (contentEl) {
          // 불필요한 요소 제거
          contentEl.querySelectorAll('.ad, .advertisement, .link_figure, figure, .btn_fold, .alex_area, .layer_video').forEach(el => el.remove());

          // p 태그들을 수집하여 문단 분리
          const paragraphs = Array.from(contentEl.querySelectorAll('p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 30); // 30자 이상인 문단만

          if (paragraphs.length > 0) {
            content = paragraphs.join('\n\n');
          } else {
            // p 태그가 없으면 전체 텍스트 추출
            content = contentEl.textContent?.trim() || '';
          }
        }

        // 이미지: 여러 셀렉터로 시도
        let imageUrl = '';
        const imageSelectors = [
          'div.article_view img.thumb_g',
          'div.article_view .wrap_thumb img',
          'div.article_view figure img',
          'div.article_view img',
          'meta[property="og:image"]',
          'meta[name="twitter:image"]',
          'img.thumb_g',
        ];

        for (const selector of imageSelectors) {
          const imgEl = document.querySelector(selector);
          if (imgEl) {
            let src = '';

            // meta 태그인 경우
            if (selector.startsWith('meta')) {
              src = imgEl.getAttribute('content') || '';
            } else {
              // img 태그인 경우 여러 속성 확인
              src = imgEl.getAttribute('src') ||
                    imgEl.getAttribute('data-src') ||
                    imgEl.getAttribute('data-lazy-src') ||
                    imgEl.getAttribute('data-original') || '';
            }

            // 유효한 URL인지 확인
            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
              // 너무 작은 이미지 제외
              const width = imgEl.getAttribute('width');
              const height = imgEl.getAttribute('height');
              if (width && height && (parseInt(width) < 50 || parseInt(height) < 50)) {
                continue;
              }

              imageUrl = src;
              break;
            }
          }
        }

        // 원 언론사: #kakaoServiceLogo 링크 텍스트
        let originalSource = '';
        const sourceEl = document.querySelector('#kakaoServiceLogo');
        if (sourceEl && sourceEl.textContent) {
          originalSource = sourceEl.textContent.trim();
        }

        // 기자: .txt_info 안의 텍스트에서 추출
        let journalist = '';
        const infoEl = document.querySelector('.txt_info');
        if (infoEl && infoEl.textContent) {
          const match = infoEl.textContent.match(/([가-힣]{2,4})\s*기자/);
          if (match) {
            journalist = match[1];
          }
        }

        // 발행일: .num_date
        let pubDateStr = '';
        const dateEl = document.querySelector('.num_date');
        if (dateEl && dateEl.textContent) {
          pubDateStr = dateEl.textContent.trim();
        }

        return {
          title,
          content,
          imageUrl,
          originalSource,
          journalist,
          pubDateStr,
        };
      });

      // 유효성 검사
      if (!article.title || !article.content) {
        logger.warn(`Daum 기사 파싱 실패 (제목 또는 본문 없음): ${url}`);
        return null;
      }

      if (article.content.length < 100) {
        logger.warn(`Daum 기사 본문이 너무 짧음 (${article.content.length}자): ${url}`);
        return null;
      }

      // 날짜 파싱
      const pubDate = article.pubDateStr ? ParserUtils.parseDate(article.pubDateStr) : undefined;

      // 본문 정제
      const cleanedContent = article.content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      logger.info(`Daum 기사 파싱 성공: ${article.title.substring(0, 30)}... (원 언론사: ${article.originalSource}, 카테고리: ${categoryName})`);

      return {
        title: article.title,
        content: cleanedContent,
        url: cleanUrl, // 해시 제거한 URL 저장
        imageUrl: article.imageUrl || undefined,
        journalist: article.journalist || undefined,
        pubDate,
        originalSource: article.originalSource, // 원 언론사명 추가
        categoryName: categoryName, // 카테고리 추가
      } as any;
    } catch (error) {
      logger.error(`Daum 기사 파싱 실패: ${url}`, error);
      return null;
    }
  }
}
