import { DataSource } from 'typeorm';
import { env } from './env';  // ⭐ 검증된 환경 변수 import
import {
  User,
  Source,
  Category,
  Keyword,
  NewsArticle,
  NewsKeyword,
  UserAction,
  Bookmark,
  ArticleStat,
  AIRecommendation,
  BiasAnalysis,
  UserPreference,
  MarketSummary,
  Comment
} from '../entities';

const isTrue = (value: string | undefined) => value === '1' || value?.toLowerCase() === 'true';

const shouldSyncSchema = () => {
  // 완전히 비활성화 - 데이터베이스 스키마 동기화 금지
  return false;
};

const shouldLogQueries = () => {
  if (process.env.TYPEORM_LOGGING) return isTrue(process.env.TYPEORM_LOGGING);
  return env.NODE_ENV !== 'production';
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  schema: env.DB_SCHEMA,  // ⭐ 스키마 분리 (development/production)
  synchronize: shouldSyncSchema(),
  logging: shouldLogQueries(),

  // RDS SSL 연결 설정
  ssl: env.DB_HOST.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false,

  // 연결 풀 설정 (환경별 차등)
  extra: {
    max: env.NODE_ENV === 'production' ? 20 : 5,  // 운영: 20개, 개발: 5개
    min: env.NODE_ENV === 'production' ? 5 : 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  },

  entities: [
    User,
    Source,
    Category,
    Keyword,
    NewsArticle,
    NewsKeyword,
    UserAction,
    Bookmark,
    ArticleStat,
    AIRecommendation,
    BiasAnalysis,
    UserPreference,
    MarketSummary,
    Comment
  ],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts']
});
