import axios from 'axios';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';
import { localAIService } from './localAIService';

interface NaverNewsApiResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface ParsedNews {
  title: string;
  content: string;
  journalist?: string;
  mediaSource?: string;
  pubDate: Date;
  imageUrl?: string;
  videoUrl?: string;
}

class NewsCrawlerService {
  private _naverClientId: string | null = null;
  private _naverClientSecret: string | null = null;

  private get NAVER_CLIENT_ID(): string {
    if (this._naverClientId === null) {
      this._naverClientId = process.env.NAVER_CLIENT_ID || '';
      console.log('[CRAWLER DEBUG] NAVER_CLIENT_ID:', this._naverClientId ? '***PRESENT***' : 'MISSING');
    }
    return this._naverClientId;
  }

  private get NAVER_CLIENT_SECRET(): string {
    if (this._naverClientSecret === null) {
      this._naverClientSecret = process.env.NAVER_CLIENT_SECRET || '';
      console.log('[CRAWLER DEBUG] NAVER_CLIENT_SECRET:', this._naverClientSecret ? '***PRESENT***' : 'MISSING');
    }
    return this._naverClientSecret;
  }
  // 텍스트 정리 함수
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      // HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // CSS 스타일 제거
      .replace(/\{[^}]*\}/g, '')
      // CSS 선택자 패턴 제거
      .replace(/[a-zA-Z-]+:\s*[^;]+;/g, '')
      .replace(/\.[a-zA-Z-]+\s*\{[^}]*\}/g, '')
      .replace(/#[a-zA-Z-]+\s*\{[^}]*\}/g, '')
      // JavaScript 코드 제거
      .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/g, '')
      .replace(/var\s+[^;]+;/g, '')
      .replace(/\$\([^)]*\)[^;]*;/g, '')
      // 특수 문자 및 패턴 제거
      .replace(/margin-top:\s*\d+px/gi, '')
      .replace(/Item:not\([^)]*\)/gi, '')
      .replace(/\{[^}]*margin[^}]*\}/gi, '')
      // 연속된 공백, 탭, 줄바꿈 정리
      .replace(/\s+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/\n+/g, ' ')
      // 특수문자 정리
      .replace(/[^\w\s가-힣.,!?""''()\-]/g, '')
      // 앞뒤 공백 제거
      .trim();
  }

  private readonly categories = [
    { name: '정치', query: '정치' },
    { name: '경제', query: '경제' },
    { name: '사회', query: '사회' },
    { name: '생활/문화', query: '생활 문화' },
    { name: 'IT/과학', query: 'IT 과학 기술' },
    { name: '세계', query: '세계 국제' },
    { name: '스포츠', query: '스포츠' },
    { name: '연예', query: '연예' }
  ];

  async fetchNewsFromNaver(query: string, display: number = 20): Promise<NaverNewsItem[]> {
    try {
      // 한글 쿼리를 URL 인코딩
      const encodedQuery = encodeURIComponent(query);
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=${display}&start=1&sort=date`;

      const response = await axios.get(url, {
        headers: {
          'X-Naver-Client-Id': this.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': this.NAVER_CLIENT_SECRET,
        }
      });

      const data: NaverNewsApiResponse = response.data;
      return data.items;
    } catch (error) {
      console.error('네이버 뉴스 API 호출 실패:', error);
      return [];
    }
  }

  async parseNewsContent(url: string): Promise<ParsedNews | null> {
    try {
      console.log(`[DEBUG] 뉴스 파싱 시작: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate'
        },
        timeout: 10000,
        responseType: 'arraybuffer'
      });

      console.log(`[DEBUG] HTTP 응답 상태: ${response.status}`);

      // 인코딩 처리 - 한글 깨짐 방지
      let html = '';
      if (response.data instanceof Buffer || Buffer.isBuffer(response.data)) {
        const buffer = Buffer.from(response.data);

        console.log(`[DEBUG] 버퍼 크기: ${buffer.length} bytes`);

        // Content-Type 헤더에서 charset 확인
        const contentType = response.headers['content-type'] || '';
        console.log(`[DEBUG] Content-Type: ${contentType}`);

        let encoding = 'utf8';
        if (contentType.includes('charset=euc-kr') || contentType.includes('charset=ks_c_5601-1987')) {
          encoding = 'euc-kr';
        } else if (contentType.includes('charset=utf-8')) {
          encoding = 'utf8';
        }

        console.log(`[DEBUG] 감지된 인코딩: ${encoding}`);

        // iconv-lite로 디코딩
        try {
          if (encoding === 'euc-kr') {
            html = iconv.decode(buffer, 'euc-kr');
          } else {
            html = iconv.decode(buffer, 'utf8');
            // UTF-8이 깨졌다면 EUC-KR로 재시도
            if (html.includes('�') || html.includes('????')) {
              html = iconv.decode(buffer, 'euc-kr');
              console.log(`[DEBUG] EUC-KR로 재시도`);
            }
          }
        } catch (error) {
          console.log(`[DEBUG] 인코딩 실패, UTF-8 기본값 사용:`, error);
          html = buffer.toString('utf8');
        }
      } else {
        html = response.data;
      }

      const $ = cheerio.load(html, { decodeEntities: false });

      // 다양한 뉴스 사이트 구조에 맞게 파싱
      const titleSelectors = [
        'h2.media_end_head_headline',
        'h3.tit_view',
        '.article_header h3',
        '.article-header h1',
        '.article-title',
        '.news-title',
        '.post-title',
        '.entry-title',
        '.headline',
        '.subject',
        'title',
        'h1',
        'h2',
        'h3',
        '[class*="title"]',
        '[class*="headline"]'
      ];

      let title = '';
      for (const selector of titleSelectors) {
        const found = this.cleanText($(selector).first().text());
        console.log(`[DEBUG] 제목 셀렉터 ${selector}: "${found}"`);
        if (found && found.length > 5 && found.length < 200) {
          title = found;
          break;
        }
      }
      console.log(`[DEBUG] 최종 추출된 제목: ${title}`);

      // 본문 추출
      let content = '';
      const contentSelectors = [
        '#dic_area',
        '.news_end_body_container',
        '.article_body',
        '#articleBodyContents',
        '.article_view .article_body',
        '.article-content',
        '.article-body',
        '.post-content',
        '.entry-content',
        '.content',
        '.news-content',
        '.text-content',
        'article',
        '.story-body',
        '.article-text',
        '[class*="content"]',
        '[class*="article"]',
        'main p',
        'section p',
        'div p'
      ];

      console.log(`[DEBUG] 본문 추출 시도 중...`);
      for (const selector of contentSelectors) {
        let found = $(selector).text();
        found = this.cleanText(found);
        console.log(`[DEBUG] 셀렉터 ${selector}: ${found ? found.length : 0}자`);
        if (found && found.length > 50 && found.length < 10000) {  // 길이 제한 추가
          content = found;
          console.log(`[DEBUG] 본문 추출 완료: ${content.substring(0, 100)}...`);
          break;
        }
      }

      // 만약 위 방법으로 본문을 찾지 못했다면, 모든 p 태그 텍스트 결합
      if (!content) {
        console.log(`[DEBUG] 대체 방법으로 본문 추출 시도...`);
        const allParagraphs = $('p').map((i, el) => this.cleanText($(el).text())).get()
          .filter(text => text.length > 10)
          .join(' ');
        if (allParagraphs && allParagraphs.length > 50) {
          content = allParagraphs;
          console.log(`[DEBUG] 대체 방법으로 본문 추출 완료: ${content.substring(0, 100)}...`);
        }
      }

      // 기자 정보 추출
      const journalistSelectors = [
        '.media_end_head_journalist .name',
        '.article_reporter .reporter_name',
        '.reporter .name',
        '.byline_p'
      ];

      let journalist = '';
      for (const selector of journalistSelectors) {
        const found = $(selector).text().trim();
        if (found) {
          journalist = found.replace(/기자|reporter/gi, '').trim();
          break;
        }
      }

      // 언론사 정보 추출
      const mediaSelectors = [
        '.media_end_head_top .media_logo img',
        '.article_header .press_logo img',
        '.media_logo img',
        '.press_name'
      ];

      let mediaSource = '';
      for (const selector of mediaSelectors) {
        const element = $(selector);
        if (element.is('img')) {
          mediaSource = element.attr('alt') || element.attr('title') || '';
        } else {
          mediaSource = element.text().trim();
        }
        if (mediaSource) break;
      }

      // 이미지 URL 추출 - 본문 이미지 우선 (로고 제외)
      const imageSelectors = [
        '#articleBodyContents img',
        '.article_body img',
        '.news_end_body_container img',
        'div.article img',
        'div.content img',
        '.post-content img',
        'article p img',
        'article div img',
        '.news-article img',
        '.story-body img',
        '.entry-content img',
        'main img',
        'section img',
        'img[src*=".jpg"]',
        'img[src*=".jpeg"]',
        'img[src*=".png"]',
        'img[src*=".gif"]',
        'img[src*=".webp"]'
      ];

      let imageUrl = '';
      console.log(`[DEBUG] 이미지 추출 시도 중...`);
      for (const selector of imageSelectors) {
        const images = $(selector);
        for (let i = 0; i < images.length; i++) {
          const src = $(images[i]).attr('src');
          const alt = $(images[i]).attr('alt') || '';
          const className = $(images[i]).attr('class') || '';

          console.log(`[DEBUG] 이미지 셀렉터 ${selector}[${i}]: ${src} (alt: ${alt})`);

          // 로고나 아이콘 이미지 제외 (더 강화)
          const isLogo = alt.toLowerCase().includes('logo') ||
                        className.toLowerCase().includes('logo') ||
                        src.toLowerCase().includes('logo') ||
                        src.toLowerCase().includes('banner') ||
                        src.toLowerCase().includes('ad') ||
                        src.toLowerCase().includes('icon') ||
                        alt.toLowerCase().includes('아이콘') ||
                        alt.toLowerCase().includes('로고') ||
                        alt.toLowerCase().includes('배너') ||
                        src.includes('/logo/') ||
                        src.includes('/icon/') ||
                        src.includes('/banner/');

          // 이미지 크기도 확인 (너무 작은 이미지 제외)
          const width = parseInt($(images[i]).attr('width') || '0');
          const height = parseInt($(images[i]).attr('height') || '0');
          const isTooSmall = (width > 0 && width < 100) || (height > 0 && height < 100);

          if (src && (src.startsWith('http') || src.startsWith('//')) && !isLogo && !isTooSmall) {
            imageUrl = src.startsWith('//') ? 'https:' + src : src;
            console.log(`[DEBUG] 이미지 URL 발견: ${imageUrl} (크기: ${width}x${height})`);
            break;
          } else if (src) {
            console.log(`[DEBUG] 이미지 제외됨 - 로고: ${isLogo}, 작음: ${isTooSmall}, URL: ${src}`);
          }
        }
        if (imageUrl) break;
      }

      // 발행 시간 추출
      const timeSelectors = [
        '.media_end_head_info_datestamp_time',
        '.article_info .date',
        '.date_time'
      ];

      let pubDateString = '';
      for (const selector of timeSelectors) {
        const found = $(selector).text().trim();
        if (found) {
          pubDateString = found;
          break;
        }
      }

      const pubDate = pubDateString ? new Date(pubDateString) : new Date();

      if (!title || !content) {
        console.log('파싱 실패: 제목 또는 내용이 없음', { title: !!title, content: !!content });
        return null;
      }

      return {
        title,
        content,
        journalist: journalist || undefined,
        mediaSource: mediaSource || undefined,
        pubDate,
        imageUrl: imageUrl || undefined
      };

    } catch (error) {
      console.error('뉴스 파싱 실패:', error);
      return null;
    }
  }

  async saveNewsToDatabase(parsedNews: ParsedNews, categoryName: string, originalUrl: string): Promise<NewsArticle | null> {
    try {
      const newsRepo = AppDataSource.getRepository(NewsArticle);

      // 중복 체크
      const existingNews = await newsRepo.findOne({ where: { url: originalUrl } });
      if (existingNews) {
        console.log('이미 존재하는 뉴스:', originalUrl);
        return existingNews;
      }

      // 카테고리 ID 매핑
      const categoryIdMap: { [key: string]: number } = {
        '정치': 1,
        '경제': 2,
        '사회': 3,
        '연예': 4,
        '생활/문화': 5,
        'IT/과학': 6,
        '세계': 7,
        '스포츠': 8
      };

      // NewsArticle 생성 (새 스키마)
      const article = newsRepo.create({
        title: parsedNews.title,
        content: parsedNews.content,
        url: originalUrl,
        origin_url: originalUrl,
        image_url: parsedNews.imageUrl,
        video_url: parsedNews.videoUrl,
        media_source_id: 1, // 기본값: 네이버뉴스
        category_id: categoryIdMap[categoryName] || 1, // 기본값: 정치
        pub_date: parsedNews.pubDate
      });

      const savedArticle = await newsRepo.save(article);

      // AI 요약 생성 (비동기로 처리)
      if (parsedNews.content && parsedNews.content.length >= 50) {
        this.generateAISummaryAsync(savedArticle.id, parsedNews.content);
      }

      return savedArticle;

    } catch (error) {
      console.error('뉴스 저장 실패:', error);
      return null;
    }
  }

  private async generateAISummaryAsync(articleId: number, content: string): Promise<void> {
    try {
      const aiResult = await localAIService.summarizeText(content);
      const shortSummary = aiResult.summary.length > 50
        ? aiResult.summary.substring(0, 47) + '...'
        : aiResult.summary;

      const newsRepo = AppDataSource.getRepository(NewsArticle);
      await newsRepo.update(articleId, {
        ai_summary: aiResult.summary,
        short_ai_summary: shortSummary
      });

      console.log(`AI 요약 생성 완료 - Article ID: ${articleId}`);
    } catch (error) {
      console.error(`AI 요약 생성 실패 - Article ID: ${articleId}:`, error);
    }
  }

  async crawlNewsByCategory(categoryName: string, limit: number = 10): Promise<NewsArticle[]> {
    const category = this.categories.find(cat => cat.name === categoryName);
    if (!category) {
      throw new Error(`지원하지 않는 카테고리: ${categoryName}`);
    }

    console.log(`${categoryName} 카테고리 뉴스 수집 시작...`);

    const naverNews = await this.fetchNewsFromNaver(category.query, limit);
    const results: NewsArticle[] = [];

    for (const item of naverNews) {
      try {
        // HTML 태그 제거
        const title = item.title.replace(/<[^>]*>/g, '');
        console.log(`파싱 중: ${title}`);

        const parsed = await this.parseNewsContent(item.originallink || item.link);
        if (parsed) {
          const saved = await this.saveNewsToDatabase(parsed, categoryName, item.originallink || item.link);
          if (saved) {
            results.push(saved);
            console.log(`저장 완료: ${saved.title}`);
          }
        }

        // 🕒 개별 뉴스 기사 간 요청 간격 조절
        // 네이버 API 부하 방지를 위한 딜레이 (밀리초 단위)
        // 1000ms = 1초, 500ms = 0.5초, 2000ms = 2초
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`뉴스 처리 실패: ${item.title}`, error);
      }
    }

    console.log(`${categoryName} 카테고리 수집 완료: ${results.length}개`);
    return results;
  }

  async crawlAllCategories(limitPerCategory: number = 5): Promise<{ [category: string]: NewsArticle[] }> {
    const results: { [category: string]: NewsArticle[] } = {};

    for (const category of this.categories) {
      try {
        const articles = await this.crawlNewsByCategory(category.name, limitPerCategory);
        results[category.name] = articles;

        // 🕒 카테고리 간 요청 간격 조절
        // 각 카테고리 크롤링 완료 후 다음 카테고리로 넘어가기 전 대기 시간
        // 2000ms = 2초, 1000ms = 1초, 3000ms = 3초
        // 값을 줄이면 더 빠르게, 늘리면 더 안전하게 크롤링됩니다
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`${category.name} 카테고리 수집 실패:`, error);
        results[category.name] = [];
      }
    }

    return results;
  }

  getSupportedCategories(): string[] {
    return this.categories.map(cat => cat.name);
  }
}

export const newsCrawlerService = new NewsCrawlerService();