/**
 * AI 요약 생성 작업
 * Airflow의 summarize_articles 태스크 대체
 * Queue 기반으로 변경됨
 */

import { logger } from '../utils/logger';
import { getDbClient } from '../utils/database';
import { addBatchSummaryJobs } from '@fans/queue';

const BATCH_SIZE = parseInt(process.env.SUMMARY_BATCH_SIZE || '50');

interface Article {
  id: number;
  content: string;
}

/**
 * AI 요약 생성 메인 함수
 */
export async function generateAISummaries(): Promise<void> {
  const client = await getDbClient();

  try {
    // 1. AI 요약이 없는 기사 조회 (오늘 기사만 - 실시간 처리)
    const result = await client.query(`
      SELECT id, content
      FROM news_articles
      WHERE ai_summary IS NULL
        AND content IS NOT NULL
        AND LENGTH(content) >= 100
        AND created_at >= CURRENT_DATE  -- 오늘 기사만!
      ORDER BY created_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);

    const articles: Article[] = result.rows;

    if (articles.length === 0) {
      logger.info('📭 요약할 기사가 없습니다');
      return;
    }

    logger.info(`📚 ${articles.length}개 기사를 AI 요약 큐에 추가 중...`);

    // 2. 모든 기사를 Queue에 배치 추가
    try {
      const jobs = articles.map(article => ({
        articleId: article.id,
        content: article.content
      }));

      const jobIds = await addBatchSummaryJobs(jobs);
      logger.info(`✅ AI 요약 큐에 ${jobIds.length}개 작업 추가 완료`);
    } catch (error: any) {
      logger.error(`❌ AI 요약 큐 추가 실패: ${error.message}`);
      throw error;
    }
  } catch (error: any) {
    logger.error(`❌ AI 요약 생성 작업 실패: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}
