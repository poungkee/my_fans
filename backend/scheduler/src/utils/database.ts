/**
 * PostgreSQL 데이터베이스 연결 유틸리티
 */

import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'fans_user',
  password: process.env.POSTGRES_PASSWORD || 'fans_password',
  database: process.env.POSTGRES_DB || 'fans_db',
  // ⭐ 스키마 설정 (search_path)
  options: process.env.DB_SCHEMA
    ? `-c search_path=${process.env.DB_SCHEMA},public`
    : undefined,
  // ⭐ SSL 설정 (RDS 연결용)
  ssl: process.env.PGSSLMODE === 'require'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function getDbClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function query(text: string, params?: any[]) {
  const client = await getDbClient();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// 연결 테스트
pool.on('connect', () => {
  const schema = process.env.DB_SCHEMA || 'public';
  logger.info(`✅ PostgreSQL 연결 성공 (schema: ${schema})`);
});

pool.on('error', (err: Error) => {
  logger.error(`❌ PostgreSQL 연결 오류: ${err.message}`);
});

export default pool;
