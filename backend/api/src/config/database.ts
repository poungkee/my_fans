import { DataSource } from 'typeorm';
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
  return process.env.NODE_ENV !== 'production';
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'fans_user',
  password: process.env.DB_PASSWORD || 'fans_password',
  database: process.env.DB_NAME || 'fans_db',
  synchronize: shouldSyncSchema(),
  logging: shouldLogQueries(),
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
