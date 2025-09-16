import { DataSource } from 'typeorm';
import {
  User,
  MediaSource,
  Category,
  Journalist,
  NewsArticle,
  Keyword,
  UserNewsInteraction,
  UserPreference,
  Comment
} from '../entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'fans_user',
  password: process.env.DB_PASSWORD || 'fans_password',
  database: process.env.DB_NAME || 'fans_db',
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  entities: [
    User,
    MediaSource,
    Category,
    Journalist,
    NewsArticle,
    Keyword,
    UserNewsInteraction,
    UserPreference,
    Comment
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts']
});