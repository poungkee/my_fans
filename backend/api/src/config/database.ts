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
  MarketSummary
} from '../entities';

const isTrue = (value: string | undefined) => value === '1' || value?.toLowerCase() === 'true';

const shouldSyncSchema = () => {
  if (process.env.TYPEORM_SYNC) return isTrue(process.env.TYPEORM_SYNC);
  // 기본값은 false. 운영/개발 모두에서 기존 뷰나 외부 생성 객체를 보호한다.
  return false;
};

const shouldLogQueries = () => {
  if (process.env.TYPEORM_LOGGING) return isTrue(process.env.TYPEORM_LOGGING);
  return process.env.NODE_ENV !== 'production';
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
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
    MarketSummary
  ],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts']
});
