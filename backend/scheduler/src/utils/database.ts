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
  logger.info('✅ PostgreSQL 연결 성공');
});

pool.on('error', (err) => {
  logger.error(`❌ PostgreSQL 연결 오류: ${err.message}`);
});

export default pool;
