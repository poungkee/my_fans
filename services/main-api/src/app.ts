import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { AppDataSource } from './config/database';
import aiRoutes from './routes/ai';
import newsRoutes from './routes/news';
import crawlerRoutes from './routes/crawler';

const envPath = path.resolve(__dirname, '../.env');
console.log('[DEBUG] Loading .env from:', envPath);
const dotenvResult = dotenv.config({ path: envPath });
console.log('[DEBUG] Dotenv result:', dotenvResult.error ? dotenvResult.error.message : 'SUCCESS');
console.log('[DEBUG] GEMINI_API_KEY from process.env:', process.env.GEMINI_API_KEY ? '***PRESENT***' : 'MISSING');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS Main API'
  });
});

app.use('/api', aiRoutes);
app.use('/api', crawlerRoutes);
app.use('/', newsRoutes);

async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;