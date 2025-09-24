"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const newsCrawlerService_1 = require("./services/newsCrawlerService");
// 환경변수 로드
dotenv_1.default.config({ path: '../.env' });
const app = (0, express_1.default)();
const PORT = parseInt(process.env.API_CRAWLER_PORT || '4003', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        console.log('📰 API 크롤링 시작...');
        const results = await newsCrawlerService_1.newsCrawlerService.crawlAllCategories(1);
        let totalCollected = 0;
        const summary = [];
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
    }
    catch (error) {
        console.error('API 크롤링 실패:', error);
        res.status(500).json({ error: 'API 크롤링 실행 중 오류가 발생했습니다' });
    }
});
// 지원하는 카테고리 조회
app.get('/categories', (req, res) => {
    res.json({
        supportedCategories: newsCrawlerService_1.newsCrawlerService.getSupportedCategories(),
        timestamp: new Date().toISOString()
    });
});
// 크롤러 상태 조회
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        supportedCategories: newsCrawlerService_1.newsCrawlerService.getSupportedCategories(),
        endpoints: [
            'POST /crawl/start - API 크롤링 시작',
            'GET /categories - 지원하는 카테고리 목록',
            'GET /health - 헬스체크'
        ],
        timestamp: new Date().toISOString()
    });
});
async function startServer() {
    try {
        await database_1.AppDataSource.initialize();
        console.log('✅ Database connected successfully');
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 API Crawler Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📰 API crawl: POST http://localhost:${PORT}/crawl/start`);
            console.log(`📋 API categories: GET http://localhost:${PORT}/categories`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start API crawler service:', error);
        process.exit(1);
    }
}
startServer();
