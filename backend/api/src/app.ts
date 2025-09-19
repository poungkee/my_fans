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

const envPath = path.resolve(__dirname, '../.env');
console.log('[DEBUG] Loading .env from:', envPath);
const dotenvResult = dotenv.config({ path: envPath });
console.log('[DEBUG] Dotenv result:', dotenvResult.error ? dotenvResult.error.message : 'SUCCESS');
console.log('[DEBUG] GEMINI_API_KEY from process.env:', process.env.GEMINI_API_KEY ? '***PRESENT***' : 'MISSING');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;