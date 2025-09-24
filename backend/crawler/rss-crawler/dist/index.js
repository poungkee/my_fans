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
const rssCrawlerService_1 = require("./services/rssCrawlerService");
// 환경변수 로드
dotenv_1.default.config({ path: '../.env' });
const app = (0, express_1.default)();
const PORT = parseInt(process.env.RSS_CRAWLER_PORT || '4002', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        console.log('📰 RSS 크롤링 시작...');
        const results = await rssCrawlerService_1.rssCrawlerService.crawlAllRSSFeeds(4);
        let totalSaved = 0;
        const summary = [];
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
    }
    catch (error) {
        console.error('RSS 크롤링 실패:', error);
        res.status(500).json({ error: 'RSS 크롤링 실행 중 오류가 발생했습니다' });
    }
});
// 지원하는 RSS 피드 조회
app.get('/feeds', (req, res) => {
    res.json({
        supportedFeeds: rssCrawlerService_1.rssCrawlerService.getSupportedFeeds(),
        timestamp: new Date().toISOString()
    });
});
// 크롤러 상태 조회
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        supportedFeeds: rssCrawlerService_1.rssCrawlerService.getSupportedFeeds(),
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
        await database_1.AppDataSource.initialize();
        console.log('✅ Database connected successfully');
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 RSS Crawler Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📰 RSS crawl: POST http://localhost:${PORT}/crawl/start`);
            console.log(`📋 RSS feeds: GET http://localhost:${PORT}/feeds`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start RSS crawler service:', error);
        process.exit(1);
    }
}
startServer();
