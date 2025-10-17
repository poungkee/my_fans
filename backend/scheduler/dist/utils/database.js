"use strict";
/**
 * PostgreSQL 데이터베이스 연결 유틸리티
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbClient = getDbClient;
exports.query = query;
const pg_1 = require("pg");
const logger_1 = require("./logger");
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'fans_user',
    password: process.env.POSTGRES_PASSWORD || 'fans_password',
    database: process.env.POSTGRES_DB || 'fans_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
async function getDbClient() {
    return pool.connect();
}
async function query(text, params) {
    const client = await getDbClient();
    try {
        return await client.query(text, params);
    }
    finally {
        client.release();
    }
}
// 연결 테스트
pool.on('connect', () => {
    logger_1.logger.info('✅ PostgreSQL 연결 성공');
});
pool.on('error', (err) => {
    logger_1.logger.error(`❌ PostgreSQL 연결 오류: ${err.message}`);
});
exports.default = pool;
