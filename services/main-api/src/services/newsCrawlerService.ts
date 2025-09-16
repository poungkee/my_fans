import axios from 'axios';
import * as cheerio from 'cheerio';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';
import { MediaSource } from '../entities/MediaSource';
import { Category } from '../entities/Category';
import { Journalist } from '../entities/Journalist';
import { aiService } from './aiService';

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
  private readonly categories = [
    { name: '정치', query: '정치' },
    { name: '경제', query: '경제' },
    { name: '기술', query: '기술 IT' },
    { name: '사회', query: '사회' },
    { name: '스포츠', query: '스포츠' },
    { name: '연예', query: '연예' },
    { name: '생활', query: '생활' },
    { name: '건강', query: '건강' },
    { name: '문화', query: '문화' },
    { name: '교육', query: '교육' }
  ];

  async fetchNewsFromNaver(query: string, display: number = 20): Promise<NaverNewsItem[]> {
    try {
      const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
        headers: {
          'X-Naver-Client-Id': this.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': this.NAVER_CLIENT_SECRET,
        },
        params: {
          query,
          display,
          start: 1,
          sort: 'date'
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
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);

      // 네이버 뉴스 구조에 맞게 파싱
      const title = $('h2.media_end_head_headline, h3.tit_view, .article_header h3').text().trim();

      // 본문 추출
      let content = '';
      const contentSelectors = [
        '#dic_area',
        '.news_end_body_container',
        '.article_body',
        '#articleBodyContents',
        '.article_view .article_body'
      ];

      for (const selector of contentSelectors) {
        const found = $(selector).text();
        if (found && found.length > 100) {
          content = found.trim();
          break;
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

      // 이미지 URL 추출
      const imageSelectors = [
        '.news_end_body_container img',
        '.article_body img',
        '#articleBodyContents img'
      ];

      let imageUrl = '';
      for (const selector of imageSelectors) {
        const src = $(selector).first().attr('src');
        if (src && src.startsWith('http')) {
          imageUrl = src;
          break;
        }
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
      const aiResult = await aiService.summarizeText(content);
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