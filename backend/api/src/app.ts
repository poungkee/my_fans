import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { AppDataSource } from './config/database';
import logger from './config/logger';
import aiRoutes from './routes/ai';
import newsRoutes from './routes/news';
import commonRoutes from './routes/common';
import marketSummaryRoutes from "./routes/marketSummary";
import authRoutes from './routes/auth';
import userInteractionsRoutes from './routes/userInteractions';
import subscriptionRoutes from './routes/subscription';
import commentsRoutes from './routes/comments';
import activityRoutes from './routes/activity';
import recommendationsRoutes from './routes/recommendations';
const envPath = path.resolve(__dirname, '../.env');
logger.debug(`Loading .env from: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });
logger.debug(`Dotenv result: ${dotenvResult.error ? dotenvResult.error.message : 'SUCCESS'}`);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ALB 뒤에 있으므로 프록시 신뢰 설정 (X-Forwarded-* 헤더 사용)
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // CSP 완전히 비활성화
  crossOriginResourcePolicy: false, // CORP 비활성화
}));
// CORS 설정 - 환경변수에서 허용 origin 가져오기
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Content-Length']
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis 클라이언트 설정
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis connection failed after 10 retries');
        return new Error('Redis connection failed');
      }
      return retries * 100;
    }
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('✅ Redis connected for session store'));
redisClient.on('ready', () => logger.info('✅ Redis ready'));

// Redis 연결
redisClient.connect().catch((err) => {
  logger.error('❌ Redis connection failed:', err);
});

// Redis 세션 스토어 설정
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'fans:sess:',
  ttl: 7 * 24 * 60 * 60 // 7일 (초 단위)
});

// 세션 설정 (Redis 사용)
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS에서만 쿠키 전송
    httpOnly: true, // JavaScript 접근 차단 (XSS 방어)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // OAuth 크로스사이트 허용
    maxAge: 30 * 60 * 1000, // 30분 (OAuth state는 짧게)
    domain: process.env.NODE_ENV === 'production' ? '.fans.ai.kr' : undefined // 서브도메인 공유
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
app.use('/api/user', subscriptionRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api', aiRoutes);
app.use('/api', commonRoutes);
app.use('/api', newsRoutes);
app.use("/api/market", marketSummaryRoutes);
app.use('/api', commentsRoutes);


async function startServer() {
  try {
    await AppDataSource.initialize();
    logger.info('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🌐 Local access: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;