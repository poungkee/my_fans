import { DataSource } from 'typeorm';
import { NewsArticle } from '../entities/NewsArticle';
import { Category } from '../entities/Category';
import { Source } from '../entities/Source';
import { BiasAnalysis } from '../entities/BiasAnalysis';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'fans_user',
  password: process.env.DB_PASSWORD || 'fans_password',
  database: process.env.DB_DATABASE || 'fans_db',
  synchronize: false, // production에서는 false
  logging: false,
  entities: [NewsArticle, Category, Source, BiasAnalysis],
  migrations: [],
  subscribers: [],
  extra: {
    connectionLimit: 10,
    client_encoding: 'UTF8',
  },
});