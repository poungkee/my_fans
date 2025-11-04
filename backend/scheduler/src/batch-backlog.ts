/**
 * 배치 백로그 처리 스크립트
 * 과거 기사 중 요약되지 않은 기사를 배치로 처리
 * 매일 새벽 2시 CronJob으로 실행
 */

import { Pool } from 'pg';
import { addBatchSummaryJobs } from '@fans/queue';
import { logger } from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const BATCH_SIZE = parseInt(process.env.BATCH_BACKLOG_SIZE || '1000');

interface Article {
  id: number;
  content: string;
}

/**
 * 배치 백로그 처리 메인 함수
 */
async function processBatchBacklog(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'fans_db',
    user: process.env.POSTGRES_USER || 'fans_user',
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    logger.info('🔄 배치 백로그 처리 시작...');
    logger.info(`📦 배치 크기: ${BATCH_SIZE}개`);

    // 1. 과거 기사 중 요약이 없는 기사 조회
    const result = await pool.query<Article>(`
      SELECT id, content
      FROM news_articles
      WHERE ai_summary IS NULL
        AND content IS NOT NULL
        AND LENGTH(content) >= 100
        AND created_at < CURRENT_DATE  -- 과거 기사만!
      ORDER BY created_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);

    const articles = result.rows;

    if (articles.length === 0) {
      logger.info('✅ 처리할 백로그가 없습니다');
      await pool.end();
      process.exit(0);
      return;
    }

    logger.info(`📚 ${articles.length}개 과거 기사를 AI 요약 큐에 추가 중...`);

    // 2. 전체 백로그 개수 확인 (통계용)
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM news_articles
      WHERE ai_summary IS NULL
        AND content IS NOT NULL
        AND LENGTH(content) >= 100
        AND created_at < CURRENT_DATE
    `);
    const totalBacklog = parseInt(countResult.rows[0].total);

    logger.info(`📊 전체 백로그: ${totalBacklog}개`);

    // 3. 모든 기사를 Queue에 배치 추가
    const jobs = articles.map(article => ({
      articleId: article.id,
      content: article.content
    }));

    const jobIds = await addBatchSummaryJobs(jobs);

    logger.info(`✅ ${jobIds.length}개 배치 작업 큐 추가 완료`);
    logger.info(`📉 남은 백로그: 약 ${Math.max(0, totalBacklog - jobIds.length)}개`);

    const estimatedDays = Math.ceil((totalBacklog - jobIds.length) / BATCH_SIZE);
    if (estimatedDays > 0) {
      logger.info(`⏱️  예상 완료: 약 ${estimatedDays}일`);
    } else {
      logger.info('🎉 백로그 처리 완료!');
    }

    await pool.end();
    process.exit(0);

  } catch (error: any) {
    logger.error(`❌ 배치 백로그 처리 실패: ${error.message}`);
    logger.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

// 프로세스 시작
logger.info('========================================');
logger.info('  FANS 배치 백로그 처리 시작');
logger.info('========================================');

processBatchBacklog();
