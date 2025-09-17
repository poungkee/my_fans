import axios from 'axios';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';
import { MediaSource } from '../entities/MediaSource';
import { Category } from '../entities/Category';
import { Journalist } from '../entities/Journalist';
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
  private readonly NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  private readonly NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  constructor() {
    console.log('[CRAWLER DEBUG] NAVER_CLIENT_ID:', this.NAVER_CLIENT_ID ? '***PRESENT***' : 'MISSING');
    console.log('[CRAWLER DEBUG] NAVER_CLIENT_SECRET:', this.NAVER_CLIENT_SECRET ? '***PRESENT***' : 'MISSING');
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
        'h1',
        '.article-title',
        '.news-title',
        '.title',
        'h2',
        'h3'
      ];

      let title = '';
      for (const selector of titleSelectors) {
        const found = $(selector).first().text().trim();
        console.log(`[DEBUG] 제목 셀렉터 ${selector}: "${found}"`);
        if (found && found.length > 5) {
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
        '.content',
        '.news-content',
        'article',
        '.post-content',
        'p'
      ];

      console.log(`[DEBUG] 본문 추출 시도 중...`);
      for (const selector of contentSelectors) {
        const found = $(selector).text();
        console.log(`[DEBUG] 셀렉터 ${selector}: ${found ? found.length : 0}자`);
        if (found && found.length > 50) {  // 조건 완화: 100자 → 50자
          content = found.trim();
          console.log(`[DEBUG] 본문 추출 완료: ${content.substring(0, 100)}...`);
          break;
        }
      }

      // 만약 위 방법으로 본문을 찾지 못했다면, 모든 p 태그 텍스트 결합
      if (!content) {
        console.log(`[DEBUG] 대체 방법으로 본문 추출 시도...`);
        const allParagraphs = $('p').map((i, el) => $(el).text().trim()).get().join(' ');
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
      const mediaRepo = AppDataSource.getRepository(MediaSource);
      const categoryRepo = AppDataSource.getRepository(Category);
      const journalistRepo = AppDataSource.getRepository(Journalist);

      // 중복 체크
      const existingNews = await newsRepo.findOne({ where: { url: originalUrl } });
      if (existingNews) {
        console.log('이미 존재하는 뉴스:', originalUrl);
        return existingNews;
      }

      // MediaSource 찾기 또는 생성
      let mediaSource = null;
      if (parsedNews.mediaSource) {
        mediaSource = await mediaRepo.findOne({ where: { name: parsedNews.mediaSource } });
        if (!mediaSource) {
          mediaSource = mediaRepo.create({
            name: parsedNews.mediaSource,
            domain: new URL(originalUrl).hostname,
            description: `${parsedNews.mediaSource} 언론사`
          });
          await mediaRepo.save(mediaSource);
        }
      }

      // Category 찾기 또는 생성
      let category = await categoryRepo.findOne({ where: { name: categoryName } });
      if (!category) {
        category = categoryRepo.create({
          name: categoryName,
          slug: categoryName.toLowerCase(),
          description: `${categoryName} 관련 뉴스`
        });
        await categoryRepo.save(category);
      }

      // Journalist 찾기 또는 생성
      let journalist = null;
      if (parsedNews.journalist && mediaSource) {
        journalist = await journalistRepo.findOne({
          where: {
            name: parsedNews.journalist,
            media_source: { id: mediaSource.id }
          }
        });
        if (!journalist) {
          journalist = journalistRepo.create({
            name: parsedNews.journalist,
            email: '',
            media_source: mediaSource
          });
          await journalistRepo.save(journalist);
        }
      }

      // NewsArticle 생성
      const article = newsRepo.create({
        title: parsedNews.title,
        content: parsedNews.content,
        url: originalUrl,
        image_url: parsedNews.imageUrl,
        video_url: parsedNews.videoUrl,
        media_source: mediaSource,
        category: category,
        journalist: journalist,
        pub_date: parsedNews.pubDate
      });

      const savedArticle = await newsRepo.save(article);

      // AI 요약 생성 (비동기로 처리)
      if (parsedNews.content.length >= 50) {
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

        // 요청 간격 조절 (1초 대기)
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

        // 카테고리 간 요청 간격 (2초 대기)
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