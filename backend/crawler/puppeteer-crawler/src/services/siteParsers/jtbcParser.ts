import { Page } from 'puppeteer';
import { SiteParser, ParsedArticle, ParserUtils } from './baseParser';
import logger from '../../../shared/config/logger';

export class JTBCParser implements SiteParser {
  getSectionUrls(): string[] {
    return [
      'https://news.jtbc.co.kr/sections/politics', // 정치
      'https://news.jtbc.co.kr/sections/economy', // 경제
      'https://news.jtbc.co.kr/sections/society', // 사회
      'https://news.jtbc.co.kr/sections/international', // 국제
      'https://news.jtbc.co.kr/sections/culture', // 문화
    ];
  }

  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      logger.info(`JTBC 섹션 페이지 접속: ${sectionUrl}`);
      await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // JavaScript 렌더링 대기
      await page.waitForTimeout(2000);

      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/article/"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && href.includes('jtbc.co.kr/article/') && !href.includes('javascript:'));
      });

      // 중복 제거
      const uniqueUrls = [...new Set(urls)];
      logger.info(`JTBC 섹션에서 ${uniqueUrls.length}개 기사 URL 발견`);

      return uniqueUrls;
    } catch (error) {
      logger.error(`JTBC URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  async parseArticle(page: Page, url: string): Promise<ParsedArticle | null> {
    try {
      logger.info(`JTBC 기사 파싱: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

      // React 렌더링 완료될 때까지 h1 태그 기다리기
      try {
        await page.waitForSelector('h1', { timeout: 10000 });
      } catch {
        logger.warn(`JTBC h1 태그 대기 타임아웃: ${url}`);
      }

      await page.waitForTimeout(3000); // 추가 렌더링 대기

      const article = await page.evaluate(() => {
        // 광고, 스크립트, 스타일 제거
        document.querySelectorAll('script, style, .ad, .advertisement, .share, .social, .related').forEach(el => el.remove());

        // 제목 - h1 태그 우선 (React SPA이므로 클래스 없음)
        let title = '';
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent && h1.textContent.trim().length > 10) {
          title = h1.textContent.trim();
        }

        // 본문 - React SPA이므로 p 태그들을 모아서 추출
        let content = '';

        // 먼저 article 태그 시도
        const articleTag = document.querySelector('article');
        if (articleTag) {
          articleTag.querySelectorAll('.ad, .advertisement, .related, .share, .social, nav, footer, header').forEach(e => e.remove());

          // article 안의 모든 p 태그 수집
          const paragraphs = Array.from(articleTag.querySelectorAll('p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 20); // 짧은 텍스트 제외

          if (paragraphs.length > 0) {
            content = paragraphs.join('\n\n');
          }
        }

        // article 태그 없으면 전체 p 태그에서 추출
        if (!content || content.length < 100) {
          const allParagraphs = Array.from(document.querySelectorAll('p'))
            .map(p => {
              // 광고/네비게이션 영역 제외
              const parent = p.closest('nav, footer, header, .ad, .advertisement, .menu, .sidebar');
              if (parent) return null;
              return p.textContent?.trim();
            })
            .filter(text => text && text.length > 20);

          if (allParagraphs.length > 0) {
            content = allParagraphs.join('\n\n');
          }
        }

        // 이미지
        const imageEl = document.querySelector('article img') || document.querySelector('meta[property="og:image"]');
        const imageUrl = imageEl
          ? (imageEl as HTMLImageElement).src || (imageEl as HTMLMetaElement).content
          : undefined;

        // 기자명
        const journalistSelectors = ['.article_reporter', '.reporter_name', '[class*="reporter"]', '[class*="journalist"]', '.byline'];
        let journalist = undefined;
        for (const selector of journalistSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent?.trim().replace(/기자|리포터|앵커/g, '').trim();
            if (text && text.length > 1 && text.length < 10) {
              journalist = text;
              break;
            }
          }
        }

        // 발행일
        const dateEl = document.querySelector('time') || document.querySelector('[class*="date"]');
        const dateStr = (dateEl as HTMLTimeElement)?.dateTime || dateEl?.textContent?.trim() || '';

        return {
          title,
          content,
          imageUrl,
          journalist,
          dateStr,
        };
      });

      if (!article.title || !article.content) {
        logger.warn(`JTBC 기사 파싱 실패 (제목/본문 없음): ${url}`);
        return null;
      }

      // 카테고리 추출 (URL에서)
      const categoryMatch = url.match(/sections\/(\w+)/);
      const categoryMap: { [key: string]: string } = {
        'politics': '정치',
        'economy': '경제',
        'society': '사회',
        'international': '세계',
        'culture': '생활/문화',
      };
      const categoryName = categoryMatch ? categoryMap[categoryMatch[1]] : undefined;

      return {
        title: ParserUtils.cleanText(article.title),
        content: ParserUtils.cleanText(article.content),
        url,
        imageUrl: article.imageUrl,
        journalist: article.journalist,
        pubDate: ParserUtils.parseDate(article.dateStr),
        categoryName,
      };
    } catch (error) {
      logger.error(`JTBC 기사 파싱 오류: ${url}`, error);
      return null;
    }
  }
}
