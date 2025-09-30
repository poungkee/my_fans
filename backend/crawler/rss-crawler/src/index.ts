import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from '../shared/config/database';
import { rssCrawlerService } from './services/rssCrawlerService';
import logger from '../shared/config/logger';

// 환경변수 로드
dotenv.config({ path: '../.env' });

const app = express();
const PORT = parseInt(process.env.RSS_CRAWLER_PORT || '4002', 10);

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS RSS Crawler Service'
  });
});

// RSS 크롤링 시작
app.post('/crawl/start', async (req, res) => {
  try {
    logger.info('📰 RSS 크롤링 시작...');
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
    logger.error('RSS 크롤링 실패:', error);
    res.status(500).json({ error: 'RSS 크롤링 실행 중 오류가 발생했습니다' });
  }
});

// 지원하는 RSS 피드 조회
app.get('/feeds', (req, res) => {
  res.json({
    supportedFeeds: rssCrawlerService.getSupportedFeeds(),
    timestamp: new Date().toISOString()
  });
});

// 크롤러 상태 조회
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    supportedFeeds: rssCrawlerService.getSupportedFeeds(),
    endpoints: [
      'POST /crawl/start - RSS 크롤링 시작',
      'GET /feeds - 지원하는 RSS 피드 목록',
      'GET /health - 헬스체크'
    ],
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    await AppDataSource.initialize();
    logger.info('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 RSS Crawler Service running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📰 RSS crawl: POST http://localhost:${PORT}/crawl/start`);
      logger.info(`📋 RSS feeds: GET http://localhost:${PORT}/feeds`);
    });
  } catch (error) {
    logger.error('❌ Failed to start RSS crawler service:', error);
    process.exit(1);
  }
}

startServer();