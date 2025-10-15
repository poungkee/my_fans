import axios from 'axios';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import { AppDataSource } from '../../shared/config/database';
import { NewsArticle } from '../../shared/entities/NewsArticle';
import { RawNewsArticle } from '../../shared/entities/RawNewsArticle';
import logger from '../../shared/config/logger';
import { summarizeArticle, analyzeBias } from '../../shared/services/aiService';

interface DaumNewsItem {
  title: string;
  url: string;
  imageUrl?: string;
  source?: string;
}

interface ParsedNews {
  title: string;
  content: string;
  journalist?: string;
  mediaSource?: string;
  pubDate: Date;
  imageUrl?: string;
  videoUrl?: string;
  actualCategory?: string; // 기사 페이지에서 파싱한 실제 카테고리
}

class NewsCrawlerService {
  private readonly categories = [
    { name: '정치', sectionUrl: 'https://news.daum.net/politics' },
    { name: '경제', sectionUrl: 'https://news.daum.net/economy' },
    { name: '사회', sectionUrl: 'https://news.daum.net/society' },
    { name: '세계', sectionUrl: 'https://news.daum.net/world' },
    { name: 'IT/과학', sectionUrl: 'https://news.daum.net/tech' },
    { name: '생활/문화', sectionUrl: 'https://news.daum.net/culture' },
    { name: '스포츠', sectionUrl: 'https://sports.daum.net' },
    { name: '연예', sectionUrl: 'https://entertain.daum.net' }
  ];

  constructor() {
    logger.debug('[CRAWLER DEBUG] NewsCrawlerService constructor 실행됨 - Daum News 크롤러');
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/[a-zA-Z-]+:\s*[^;]+;/g, '')
      .replace(/\.[a-zA-Z-]+\s*\{[^}]*\}/g, '')
      .replace(/#[a-zA-Z-]+\s*\{[^}]*\}/g, '')
      .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/g, '')
      .replace(/var\s+[^;]+;/g, '')
      .replace(/\$\([^)]*\)[^;]*;/g, '')
      .replace(/margin-top:\s*\d+px/gi, '')
      .replace(/Item:not\([^)]*\)/gi, '')
      .replace(/\{[^}]*margin[^}]*\}/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/[^\w\s가-힣.,!?""''()\-]/g, '')
      .trim();
  }

  private cleanContent(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\.(news_primary|title|content)\s*\{[^}]*\}/g, '')
      .replace(/font-family:[^;]+;/g, '')
      .replace(/font-size:[^;]+;/g, '')
      .replace(/font-weight:[^;]+;/g, '')
      .replace(/\{[^}]*font[^}]*\}/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/doi\.org\/[^\s]+/g, '')
      .replace(/www\.[^\s]+/g, '')
      .replace(/로그인|회원가입|구독|공유하기|페이스북|트위터|카카오톡/g, '')
      .replace(/SNS 퍼가기|URL 복사|글자크기 설정/g, '')
      .replace(/뉴스 요약쏙|AI 요약은|OpenAI의 최신 기술을/g, '')
      .replace(/읽는 재미의 발견|새로워진|크롬브라우저만 가능/g, '')
      .replace(/웹 알림 동의|다양한 경제, 산업 현장의/g, '')
      .replace(/무단전재 및 재배포 금지|저작권자|ⓒ|Copyright|copyright/g, '')
      .replace(/기사입력|기사수정|최종수정|발행일|등록일|기사제보|보도자료/g, '')
      .replace(/관련기사|추천기사|인기기사|많이 본 뉴스|실시간 뉴스|HOT 클릭/g, '')
      .replace(/다른기사 보기|이 기사를|댓글|좋아요/g, '')
      .replace(/기자\s*구독\s*공유하기/g, '')
      .replace(/\s*기자\s*수정\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/등록\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\s*기자\s*[a-zA-Z0-9._%+-]+@[^\s]*/g, '')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .split('\n')
      .map(line => line.replace(/ +/g, ' ').trim())
      .join('\n')
      .replace(/\n\n\n+/g, '\n\n')
      .trim();
  }

  private isValidContent(text: string): boolean {
    if (!text || text.length < 50) return false;

    const emptyContentPatterns = [
      /실시간\s*(인기)?검색어/,
      /HOT\s*클릭/,
      /급상승\s*검색어/,
      /인기\s*검색어/,
      /^\d+위\s+/,
      /네이버\s*실시간/,
    ];

    for (const pattern of emptyContentPatterns) {
      if (pattern.test(text)) {
        logger.debug(`[DEBUG] 내용 없는 기사 패턴 감지: ${pattern}`);
        return false;
      }
    }

    const uiKeywords = [
      '로그인', '회원가입', '구독', '공유하기',
      '페이스북', '트위터', '카카오톡', 'SNS',
      '글자크기', '창 닫기', '웹 알림', '크롬브라우저',
      '읽는 재미의 발견', '새로워진'
    ];

    const uiKeywordCount = uiKeywords.reduce((count, keyword) => {
      return count + (text.includes(keyword) ? 1 : 0);
    }, 0);

    if (uiKeywordCount >= 5) return false;

    const koreanContent = text.match(/[가-힣]{5,}/g);
    if (!koreanContent || koreanContent.length === 0) return false;

    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const koreanRatio = koreanChars / text.length;

    logger.debug(`[DEBUG] 콘텐츠 유효성 검사: 길이=${text.length}, UI키워드=${uiKeywordCount}, 한글비율=${(koreanRatio*100).toFixed(1)}%`);

    return koreanRatio >= 0.3;
  }

  async fetchNewsFromDaum(sectionUrl: string, limit: number = 20): Promise<DaumNewsItem[]> {
    try {
      logger.debug(`[DAUM DEBUG] 섹션 페이지 요청: ${sectionUrl}`);

      const response = await axios.get(sectionUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const articles: DaumNewsItem[] = [];

      // Daum 뉴스 리스트 추출
      $('a[href*="v.daum.net/v/"]').each((_idx, el) => {
        const $el = $(el);
        const url = $el.attr('href');
        if (!url || !url.includes('v.daum.net/v/')) return;

        // 제목 추출
        const title = $el.text().trim() || $el.find('.tit_main').text().trim();
        if (!title || title.length < 10) return;

        // 이미지 추출 (있는 경우)
        const imageUrl = $el.find('img').attr('src') || '';

        articles.push({
          title: this.cleanText(title),
          url: url.split('#')[0], // 해시 제거
          imageUrl: imageUrl.startsWith('http') ? imageUrl : undefined
        });
      });

      // 중복 제거 (URL 기준)
      const uniqueArticles = Array.from(
        new Map(articles.map(item => [item.url, item])).values()
      );

      logger.debug(`[DAUM DEBUG] ${sectionUrl}에서 ${uniqueArticles.length}개 기사 발견`);

      return uniqueArticles.slice(0, limit);
    } catch (error) {
      logger.error('Daum 뉴스 목록 조회 실패:', error);
      return [];
    }
  }

  async parseNewsContent(url: string): Promise<ParsedNews | null> {
    try {
      logger.debug(`[DEBUG] 뉴스 파싱 시작: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
        timeout: 10000,
        responseType: 'arraybuffer'
      });

      logger.debug(`[DEBUG] HTTP 응답 상태: ${response.status}`);

      let html = '';
      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || '';

      let encoding = 'utf8';
      if (contentType.includes('charset=euc-kr') || contentType.includes('charset=ks_c_5601-1987')) {
        encoding = 'euc-kr';
      }

      html = iconv.decode(buffer, encoding);

      const $ = cheerio.load(html, { xmlMode: false });

      // 광고, 스크립트 제거 (이미지는 보존)
      $('script, style, .ad, .advertisement, .aside_g, .cmt_fold').remove();

      // 제목 추출
      let title = '';
      const titleEl = $('h3.tit_view');
      if (titleEl.length > 0) {
        title = this.cleanText(titleEl.text());
      }

      // 이미지 추출 (본문 요소 제거 전에 먼저 추출)
      let imageUrl = '';
      const imageSelectors = [
        '.thumb_g',                    // Daum 기사 메인 이미지
        '.wrap_thumb img',             // 이미지 래퍼 안의 이미지
        '.article_view img.thumb_g',   // 기사 본문 내 썸네일
        '.article_view figure img',    // figure 태그 안의 이미지
        '.article_view img'            // 기사 본문 내 모든 이미지
      ];

      for (const selector of imageSelectors) {
        const imgEl = $(selector).first();
        if (imgEl.length > 0) {
          const src = imgEl.attr('src') || imgEl.attr('data-src') || '';
          if (src && src.startsWith('http')) {
            imageUrl = src;
            logger.debug(`[이미지 추출] ${selector}에서 발견: ${src.substring(0, 80)}`);
            break;
          }
        }
      }

      // 본문 추출
      let content = '';
      const contentEl = $('.article_view');
      if (contentEl.length > 0) {
        // 불필요한 요소 제거
        contentEl.find('.ad, .advertisement, .link_figure, figure, .btn_fold, .alex_area, .layer_video').remove();

        // p 태그들을 수집
        const paragraphs: string[] = [];
        contentEl.find('p').each((_idx, p) => {
          const text = $(p).text().trim();
          if (text && text.length > 30) {
            paragraphs.push(text);
          }
        });

        if (paragraphs.length > 0) {
          content = paragraphs.join('\n\n');
        } else {
          content = contentEl.text();
        }

        content = this.cleanContent(content);
      }

      // 언론사 추출
      let mediaSource = '';
      const sourceEl = $('#kakaoServiceLogo');
      if (sourceEl.length > 0) {
        mediaSource = sourceEl.text().trim();
      }

      // 기자 추출
      let journalist = '';
      const infoEl = $('.txt_info');
      if (infoEl.length > 0) {
        const match = infoEl.text().match(/([가-힣]{2,4})\s*기자/);
        if (match) {
          journalist = match[1];
        }
      }

      // 발행일 추출
      let pubDate = new Date();
      const dateEl = $('.num_date');
      if (dateEl.length > 0) {
        const dateStr = dateEl.text().trim();
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          pubDate = parsedDate;
        }
      }

      // 실제 카테고리 추출 (기사 페이지에서)
      let actualCategory = '';

      // 방법 1: 상단 카테고리 링크에서 추출
      const categoryLinkSelectors = [
        'a.link_txt[href*="/news/"]',  // Daum 카테고리 링크
        '.head_view a[href*="news.daum.net"]',
        '.head_view a[href*="sports.daum.net"]',
        '.head_view a[href*="entertain.daum.net"]',
        'a[data-category]'
      ];

      for (const selector of categoryLinkSelectors) {
        const catLink = $(selector).first();
        if (catLink.length > 0) {
          const catText = catLink.text().trim();
          const catHref = catLink.attr('href') || '';

          // URL에서 카테고리 추출
          if (catHref.includes('/politics')) actualCategory = '정치';
          else if (catHref.includes('/economy') || catHref.includes('/economic')) actualCategory = '경제';
          else if (catHref.includes('/society')) actualCategory = '사회';
          else if (catHref.includes('/world') || catHref.includes('/foreign')) actualCategory = '세계';
          else if (catHref.includes('/tech') || catHref.includes('/digital')) actualCategory = 'IT/과학';
          else if (catHref.includes('/culture')) actualCategory = '생활/문화';
          else if (catHref.includes('sports.daum.net')) actualCategory = '스포츠';
          else if (catHref.includes('entertain.daum.net')) actualCategory = '연예';

          // 텍스트에서 카테고리 추출
          if (!actualCategory && catText) {
            if (catText.includes('정치')) actualCategory = '정치';
            else if (catText.includes('경제')) actualCategory = '경제';
            else if (catText.includes('사회')) actualCategory = '사회';
            else if (catText.includes('세계') || catText.includes('국제')) actualCategory = '세계';
            else if (catText.includes('IT') || catText.includes('과학') || catText.includes('기술')) actualCategory = 'IT/과학';
            else if (catText.includes('문화') || catText.includes('생활')) actualCategory = '생활/문화';
            else if (catText.includes('스포츠') || catText.includes('체육')) actualCategory = '스포츠';
            else if (catText.includes('연예')) actualCategory = '연예';
          }

          if (actualCategory) {
            logger.debug(`[카테고리 추출] ${selector}에서 발견: ${actualCategory} (텍스트: ${catText}, URL: ${catHref})`);
            break;
          }
        }
      }

      // 방법 2: meta 태그에서 추출
      if (!actualCategory) {
        const metaCategory = $('meta[property="daumNewsCategory"]').attr('content') ||
                            $('meta[name="category"]').attr('content');
        if (metaCategory) {
          actualCategory = metaCategory;
          logger.debug(`[카테고리 추출] meta 태그에서 발견: ${actualCategory}`);
        }
      }

      // 방법 3: URL 패턴 분석
      if (!actualCategory) {
        if (url.includes('sports.daum.net')) actualCategory = '스포츠';
        else if (url.includes('entertain.daum.net')) actualCategory = '연예';
      }

      if (actualCategory) {
        logger.info(`[실제 카테고리 파싱 성공] ${actualCategory}`);
      } else {
        logger.warn(`[실제 카테고리 파싱 실패] URL: ${url}`);
      }

      if (!title || !content) {
        logger.info('파싱 실패: 제목 또는 내용이 없음', { title: !!title, content: !!content });
        return null;
      }

      if (!this.isValidContent(content)) {
        logger.info('파싱 실패: 유효하지 않은 콘텐츠');
        return null;
      }

      return {
        title,
        content,
        journalist: journalist || undefined,
        mediaSource: mediaSource || undefined,
        pubDate,
        imageUrl: imageUrl || undefined,
        actualCategory: actualCategory || undefined
      };

    } catch (error) {
      logger.error('뉴스 파싱 실패:', error);
      return null;
    }
  }

  async saveNewsToDatabase(parsedNews: ParsedNews, categoryName: string, originalUrl: string): Promise<RawNewsArticle | null> {
    try {
      const rawNewsRepo = AppDataSource.getRepository(RawNewsArticle);

      // 중복 체크 (raw_news_articles에서)
      const existingRawNews = await rawNewsRepo.findOne({ where: { url: originalUrl } });
      if (existingRawNews) {
        logger.info('[RAW] 이미 존재하는 원본 기사:', originalUrl);
        return existingRawNews;
      }

      // 중복 체크 (news_articles에서도 확인 - 이미 처리된 기사인지)
      const newsRepo = AppDataSource.getRepository(NewsArticle);
      const existingNews = await newsRepo.findOne({ where: { url: originalUrl } });
      if (existingNews) {
        logger.info('[RAW] 이미 분류된 기사 (news_articles에 존재):', originalUrl);
        return null;
      }

      // raw_news_articles에 저장
      // actualCategory가 있으면 그것을 사용, 없으면 섹션 기반 categoryName 사용
      const finalCategory = parsedNews.actualCategory || categoryName;

      const rawArticle = rawNewsRepo.create({
        title: parsedNews.title,
        content: parsedNews.content,
        url: originalUrl,
        imageUrl: parsedNews.imageUrl,
        journalist: parsedNews.journalist,
        pubDate: parsedNews.pubDate,
        originalSource: parsedNews.mediaSource, // 텍스트로 저장
        originalCategory: finalCategory, // 기사 페이지에서 파싱한 실제 카테고리 또는 섹션 카테고리
        processed: false // 아직 분류되지 않음
      });

      const savedRawArticle = await rawNewsRepo.save(rawArticle);

      logger.info(`[RAW 저장 완료] "${savedRawArticle.title.substring(0, 50)}..." (카테고리: ${finalCategory})`);
      logger.debug(`[RAW] 원본 언론사: ${parsedNews.mediaSource}, 실제 카테고리: ${finalCategory}`);

      return savedRawArticle;

    } catch (error) {
      logger.error('[RAW] 원본 기사 저장 실패:', error);
      return null;
    }
  }

  async crawlNewsByCategory(categoryName: string, limit: number = 10): Promise<RawNewsArticle[]> {
    const category = this.categories.find(cat => cat.name === categoryName);
    if (!category) {
      throw new Error(`지원하지 않는 카테고리: ${categoryName}`);
    }

    logger.info(`${categoryName} 카테고리 뉴스 수집 시작...`);

    const daumNews = await this.fetchNewsFromDaum(category.sectionUrl, limit);
    const results: RawNewsArticle[] = [];

    for (const item of daumNews) {
      try {
        logger.info(`파싱 중: ${item.title}`);

        const parsed = await this.parseNewsContent(item.url);
        if (parsed) {
          const saved = await this.saveNewsToDatabase(parsed, categoryName, item.url);
          if (saved) {
            results.push(saved);
            logger.info(`[RAW 저장] ${saved.title}`);
          } else {
            logger.info(`[파싱 실패] 저장 실패: ${item.title}`);
          }
        } else {
          logger.info(`[파싱 실패] 내용 파싱 실패: ${item.title}`);
        }

        // 요청 간격 조절 (1초)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error(`뉴스 처리 실패: ${item.title}`, error);
      }
    }

    logger.info(`[RAW] ${categoryName} 카테고리 수집 완료: ${results.length}개 (분류 대기 중)`);
    return results;
  }

  async crawlAllCategories(limitPerCategory: number = 5): Promise<{ [category: string]: RawNewsArticle[] }> {
    const results: { [category: string]: RawNewsArticle[] } = {};

    for (const category of this.categories) {
      try {
        const articles = await this.crawlNewsByCategory(category.name, limitPerCategory);
        results[category.name] = articles;

        // 카테고리 간 요청 간격 조절 (2초)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`${category.name} 카테고리 수집 실패:`, error);
        results[category.name] = [];
      }
    }

    logger.info(`[RAW] 전체 카테고리 크롤링 완료. Spark 분류 대기 중...`);
    return results;
  }

  getSupportedCategories(): string[] {
    return this.categories.map(cat => cat.name);
  }

  // 기존 기사 중 분석되지 않은 기사들을 분석
  async analyzeExistingArticles(limit: number = 100): Promise<{
    total: number;
    analyzed: number;
    failed: number;
    skipped: number;
  }> {
    const newsRepo = AppDataSource.getRepository('NewsArticle');

    const articles = await newsRepo
      .createQueryBuilder('article')
      .leftJoin('bias_analysis', 'ba', 'ba.article_id = article.id')
      .where('ba.id IS NULL')
      .andWhere('article.content IS NOT NULL')
      .andWhere("LENGTH(article.content) >= 100")
      .limit(limit)
      .getMany();

    logger.info(`[기존 기사 분석] 총 ${articles.length}개 기사 분석 시작`);

    let analyzed = 0;
    let failed = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        if (!article.content || article.content.length < 100) {
          skipped++;
          continue;
        }

        await analyzeBias(article.id, article.content);
        analyzed++;

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`[기존 기사 분석 실패] 기사 ID ${article.id}:`, error);
        failed++;
      }
    }

    logger.info(`[기존 기사 분석 완료] 성공: ${analyzed}, 실패: ${failed}, 스킵: ${skipped}`);

    return {
      total: articles.length,
      analyzed,
      failed,
      skipped
    };
  }
}

export const newsCrawlerService = new NewsCrawlerService();
