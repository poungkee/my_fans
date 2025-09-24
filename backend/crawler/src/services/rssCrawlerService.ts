import axios from 'axios';
import * as xml2js from 'xml2js';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';

interface RSSFeed {
  sourceName: string;
  feedUrl: string;
  sourceId: number;
}

interface RSSItem {
  title: string[];
  link: string[];
  description?: string[];
  pubDate?: string[];
  'dc:date'?: string[];
  'dc:creator'?: string[];
  author?: string[];
}

interface ParsedRSSNews {
  title: string;
  content: string;
  journalist?: string;
  mediaSource: string;
  pubDate: Date;
  imageUrl?: string;
  url: string;
  sourceId: number;
}

class RSSCrawlerService {

  private RSS_FEEDS: RSSFeed[] = [
    {
      sourceName: '경향신문',
      feedUrl: 'https://www.khan.co.kr/rss/rssdata/total_news.xml',
      sourceId: 1
    },
    {
      sourceName: '동아일보',
      feedUrl: 'https://rss.donga.com/total.xml',
      sourceId: 2
    },
    {
      sourceName: '한겨레',
      feedUrl: 'https://www.hani.co.kr/rss/',
      sourceId: 3
    },
    {
      sourceName: '조선일보',
      feedUrl: 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
      sourceId: 4
    },
    {
      sourceName: '국민일보',
      feedUrl: 'http://rss.kmib.co.kr/data/kmibRssAll.xml',
      sourceId: 5
    }
  ];

  // RSS 피드에서 뉴스 가져오기
  private async fetchNewsFromRSS(feed: RSSFeed, limit: number = 10): Promise<ParsedRSSNews[]> {
    try {
      console.log(`[RSS DEBUG] ${feed.sourceName} RSS 크롤링 시작: ${feed.feedUrl}`);

      const response = await axios.get(feed.feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const parser = new xml2js.Parser({ trim: true, explicitArray: true });
      const result = await parser.parseStringPromise(response.data);

      const items: RSSItem[] = result.rss?.channel?.[0]?.item || [];
      console.log(`[RSS DEBUG] ${feed.sourceName}에서 ${items.length}개 아이템 발견`);

      const parsedNews: ParsedRSSNews[] = [];

      for (let i = 0; i < Math.min(items.length, limit); i++) {
        const item = items[i];

        try {
          const news = await this.parseRSSItem(item, feed);
          if (news) {
            parsedNews.push(news);
          }
        } catch (error) {
          console.log(`[RSS DEBUG] ${feed.sourceName} 아이템 파싱 실패:`, error);
        }
      }

      console.log(`[RSS DEBUG] ${feed.sourceName}에서 ${parsedNews.length}개 뉴스 파싱 완료`);
      return parsedNews;

    } catch (error) {
      console.error(`[RSS ERROR] ${feed.sourceName} RSS 크롤링 실패:`, error);
      return [];
    }
  }

  // RSS 아이템을 뉴스 객체로 파싱
  private async parseRSSItem(item: RSSItem, feed: RSSFeed): Promise<ParsedRSSNews | null> {
    try {
      const title = this.cleanText(item.title?.[0] || '');
      const link = item.link?.[0] || '';
      const description = this.cleanText(item.description?.[0] || '');

      if (!title || !link) {
        return null;
      }

      // 날짜 파싱
      let pubDate = new Date();
      const dateString = item.pubDate?.[0] || item['dc:date']?.[0];
      if (dateString) {
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
          pubDate = parsedDate;
        }
      }

      // 기자 이름 추출
      let journalist = item['dc:creator']?.[0] || item.author?.[0] || '';
      journalist = this.cleanJournalistName(journalist);

      // 이미지 URL 추출 (description에서)
      let imageUrl = '';
      const imgMatch = description.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }

      return {
        title,
        content: description,
        journalist: journalist || undefined,
        mediaSource: feed.sourceName,
        pubDate,
        imageUrl: imageUrl || undefined,
        url: link,
        sourceId: feed.sourceId
      };

    } catch (error) {
      console.log(`[RSS DEBUG] RSS 아이템 파싱 오류:`, error);
      return null;
    }
  }

  // 기자 이름 정리 (기존 로직 재사용)
  private cleanJournalistName(name: string): string {
    if (!name) return '';

    return name
      .replace(/[가-힣]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
      .replace(/\s*기자\s*/g, '') // '기자' 제거
      .replace(/\s*특파원\s*/g, '') // '특파원' 제거
      .replace(/\s*편집위원\s*/g, '') // '편집위원' 제거
      .replace(/\s*논설위원\s*/g, '') // '논설위원' 제거
      .replace(/\([^)]*\)/g, '') // 괄호 내용 제거
      .replace(/\[[^\]]*\]/g, '') // 대괄호 내용 제거
      .replace(/[^\w\s가-힣]/g, ' ') // 특수문자를 공백으로
      .replace(/\s+/g, ' ') // 연속 공백 정리
      .trim();
  }

  // 텍스트 정리 함수
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&nbsp;/g, ' ') // &nbsp; 처리
      .replace(/&quot;/g, '"') // &quot; 처리
      .replace(/&amp;/g, '&') // &amp; 처리
      .replace(/&lt;/g, '<') // &lt; 처리
      .replace(/&gt;/g, '>') // &gt; 처리
      .replace(/\s+/g, ' ') // 연속 공백 정리
      .trim();
  }

  // 뉴스를 데이터베이스에 저장
  private async saveNewsToDatabase(newsList: ParsedRSSNews[]): Promise<number> {
    if (newsList.length === 0) {
      return 0;
    }

    try {
      const repository = AppDataSource.getRepository(NewsArticle);
      let savedCount = 0;

      for (const news of newsList) {
        try {
          // 중복 확인 (URL 기준)
          const existing = await repository.findOne({
            where: { url: news.url }
          });

          if (existing) {
            console.log(`[RSS DEBUG] 중복 뉴스 스킵: ${news.title}`);
            continue;
          }

          // 카테고리 ID는 임시로 1 설정 (추후 개선)
          const article = repository.create({
            title: news.title,
            content: news.content,
            url: news.url,
            imageUrl: news.imageUrl,
            sourceId: news.sourceId,
            categoryId: 1,
            journalist: news.journalist,
            pubDate: news.pubDate
          });

          await repository.save(article);
          savedCount++;
          console.log(`[RSS DEBUG] 저장 완료: ${news.mediaSource} - ${news.title}`);

        } catch (error) {
          console.error(`[RSS ERROR] 뉴스 저장 실패:`, error);
        }
      }

      return savedCount;
    } catch (error) {
      console.error('[RSS ERROR] 데이터베이스 저장 중 오류:', error);
      return 0;
    }
  }

  // 모든 RSS 피드 크롤링
  public async crawlAllRSSFeeds(limitPerFeed: number = 4): Promise<{ [sourceName: string]: number }> {
    console.log('📰 RSS 크롤링 시작...');
    const results: { [sourceName: string]: number } = {};

    for (const feed of this.RSS_FEEDS) {
      try {
        const newsList = await this.fetchNewsFromRSS(feed, limitPerFeed);
        const savedCount = await this.saveNewsToDatabase(newsList);
        results[feed.sourceName] = savedCount;

        console.log(`✅ ${feed.sourceName}: ${savedCount}개 저장 완료`);

        // 각 피드 사이에 1초 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ ${feed.sourceName} 크롤링 실패:`, error);
        results[feed.sourceName] = 0;
      }
    }

    const totalSaved = Object.values(results).reduce((sum, count) => sum + count, 0);
    console.log(`📊 RSS 크롤링 완료 - 총 ${totalSaved}개 저장`);

    return results;
  }

  // 지원하는 RSS 피드 목록 반환
  public getSupportedFeeds(): string[] {
    return this.RSS_FEEDS.map(feed => feed.sourceName);
  }
}

export const rssCrawlerService = new RSSCrawlerService();