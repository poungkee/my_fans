import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { AppDataSource } from './config/database';
import aiRoutes from './routes/ai';
import newsRoutes from './routes/news';
import crawlerRoutes from './routes/crawler';
import commonRoutes from './routes/common';
import marketSummaryRoutes from "./routes/marketSummary";
import authRoutes from './routes/auth';
import userInteractionsRoutes from './routes/userInteractions';
import schedulerRoutes from './routes/scheduler';
import { newsSchedulerService } from './services/newsSchedulerService';

const envPath = path.resolve(__dirname, '../.env');
console.log('[DEBUG] Loading .env from:', envPath);
const dotenvResult = dotenv.config({ path: envPath });
console.log('[DEBUG] Dotenv result:', dotenvResult.error ? dotenvResult.error.message : 'SUCCESS');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet({
  contentSecurityPolicy: false, // CSP 완전히 비활성화
  crossOriginResourcePolicy: false, // CORP 비활성화
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Content-Length']
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// 이미지 파일에 CORS 헤더 추가
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({
    message: 'FANS API Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      news: '/news',
      api: '/api'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS Main API'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userInteractionsRoutes);
app.use('/api', aiRoutes);
app.use('/api', crawlerRoutes);
app.use('/api', commonRoutes);
app.use('/api', newsRoutes);
app.use("/api/market", marketSummaryRoutes);
app.use('/api', schedulerRoutes);


async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Local access: http://localhost:${PORT}/health`);

      // 뉴스 크롤링 스케줄러 자동 시작
      console.log('🔄 Starting news crawler scheduler...');
      newsSchedulerService.start({
        intervalMinutes: 0.5, // 30초마다 실행
        limitPerCategory: 1, // 카테고리당 1개씩 수집
        enabled: true
      });
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;