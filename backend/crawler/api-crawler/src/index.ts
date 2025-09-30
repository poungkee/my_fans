import 'reflect-metadata';
import dotenv from 'dotenv';

// 환경변수 먼저 로드 (docker-compose의 env_file이 우선, 없으면 로컬 .env)
dotenv.config();

import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import { newsCrawlerService } from './services/newsCrawlerService';

const app = express();
const PORT = parseInt(process.env.API_CRAWLER_PORT || '4003', 10);

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS API Crawler Service'
  });
});

// API 크롤링 시작
app.post('/crawl/start', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    const limit = Number(req.body?.limit) || 5; // 기본값 5
    console.log(`📰 API 크롤링 시작... (카테고리당 ${limit}개)`);
    const results = await newsCrawlerService.crawlAllCategories(limit);

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

// 지원하는 카테고리 조회
app.get('/categories', (req, res) => {
  res.json({
    supportedCategories: newsCrawlerService.getSupportedCategories(),
    timestamp: new Date().toISOString()
  });
});

// 기존 기사 편향성 분석 (분석 안된 기사들)
app.post('/analyze/backfill', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 100; // 기본값 100개씩
    console.log(`📊 기존 기사 편향성 분석 시작... (최대 ${limit}개)`);

    const result = await newsCrawlerService.analyzeExistingArticles(limit);

    res.json({
      message: '기존 기사 분석 완료',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('기존 기사 분석 실패:', error);
    res.status(500).json({ error: '기존 기사 분석 중 오류가 발생했습니다' });
  }
});

// 크롤러 상태 조회
app.get('/status', (_req, res) => {
  res.json({
    status: 'running',
    supportedCategories: newsCrawlerService.getSupportedCategories(),
    endpoints: [
      'POST /crawl/start - API 크롤링 시작',
      'POST /analyze/backfill - 기존 기사 편향성 분석',
      'GET /categories - 지원하는 카테고리 목록',
      'GET /health - 헬스체크'
    ],
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API Crawler Service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📰 API crawl: POST http://localhost:${PORT}/crawl/start`);
      console.log(`📋 API categories: GET http://localhost:${PORT}/categories`);
    });
  } catch (error) {
    console.error('❌ Failed to start API crawler service:', error);
    process.exit(1);
  }
}

startServer();