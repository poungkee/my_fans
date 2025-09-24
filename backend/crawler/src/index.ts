import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './config/database';
import { newsCrawlerService } from './services/newsCrawlerService';
import { rssCrawlerService } from './services/rssCrawlerService';

// 환경변수 로드
dotenv.config({ path: '../.env' });

const app = express();
const PORT = parseInt(process.env.CRAWLER_PORT || '4001', 10);

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS Crawler Service'
  });
});

// 수동 API 크롤링 시작
app.post('/crawl/api/start', async (req, res) => {
  try {
    console.log('📰 API 크롤링 시작...');
    const results = await newsCrawlerService.crawlAllCategories(1);

    let totalCollected = 0;
    const summary: string[] = [];

    for (const [category, articles] of Object.entries(results)) {
      totalCollected += articles.length;
      summary.push(`${category}: ${articles.length}개`);
    }

    res.json({
      message: 'API 크롤링 완료',
      totalCollected,
      results: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API 크롤링 실패:', error);
    res.status(500).json({ error: 'API 크롤링 실행 중 오류가 발생했습니다' });
  }
});

// 수동 RSS 크롤링 시작
app.post('/crawl/rss/start', async (req, res) => {
  try {
    console.log('📰 RSS 크롤링 시작...');
    const results = await rssCrawlerService.crawlAllRSSFeeds(4);

    let totalSaved = 0;
    const summary: string[] = [];

    for (const [sourceName, count] of Object.entries(results)) {
      totalSaved += count;
      summary.push(`${sourceName}: ${count}개 저장`);
    }

    res.json({
      message: 'RSS 크롤링 완료',
      totalSaved,
      results: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('RSS 크롤링 실패:', error);
    res.status(500).json({ error: 'RSS 크롤링 실행 중 오류가 발생했습니다' });
  }
});

// 통합 크롤링 (API + RSS)
app.post('/crawl/all/start', async (req, res) => {
  try {
    console.log('📰 통합 크롤링 시작...');

    // API 크롤링
    const apiResults = await newsCrawlerService.crawlAllCategories(1);
    let apiCollected = 0;
    for (const articles of Object.values(apiResults)) {
      apiCollected += articles.length;
    }

    // RSS 크롤링
    const rssResults = await rssCrawlerService.crawlAllRSSFeeds(4);
    let rssSaved = 0;
    for (const count of Object.values(rssResults)) {
      rssSaved += count;
    }

    res.json({
      message: '통합 크롤링 완료',
      api: {
        collected: apiCollected,
        results: apiResults
      },
      rss: {
        saved: rssSaved,
        results: rssResults
      },
      total: apiCollected + rssSaved,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('통합 크롤링 실패:', error);
    res.status(500).json({ error: '통합 크롤링 실행 중 오류가 발생했습니다' });
  }
});

// 크롤러 상태 조회
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    api: {
      supportedCategories: newsCrawlerService.getSupportedCategories()
    },
    rss: {
      supportedFeeds: rssCrawlerService.getSupportedFeeds()
    },
    endpoints: [
      'POST /crawl/api/start - API 크롤링',
      'POST /crawl/rss/start - RSS 크롤링',
      'POST /crawl/all/start - 통합 크롤링'
    ],
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Crawler Service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 API crawl: POST http://localhost:${PORT}/crawl/api/start`);
      console.log(`📰 RSS crawl: POST http://localhost:${PORT}/crawl/rss/start`);
      console.log(`🔄 All crawl: POST http://localhost:${PORT}/crawl/all/start`);
    });
  } catch (error) {
    console.error('❌ Failed to start crawler service:', error);
    process.exit(1);
  }
}

startServer();