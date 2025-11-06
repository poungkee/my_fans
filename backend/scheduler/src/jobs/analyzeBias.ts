/**
 * 편향 분석 작업
 * Queue 기반으로 변경됨
 */

import { logger } from '../utils/logger';
import { getDbClient } from '../utils/database';
import { addBatchBiasJobs } from '@fans/queue';

const BATCH_SIZE = parseInt(process.env.BIAS_BATCH_SIZE || '20000');

interface Article {
  id: number;
  title: string;
  content: string;
  category_id: number;
  category_name: string;
  source_name: string;
}

/**
 * 편향 분석 메인 함수
 */
export async function analyzeBias(): Promise<void> {
  const client = await getDbClient();

  try {
    // 1. 편향 분석이 없는 정치 기사 조회 (AI 분류 개선으로 정치 카테고리만 필터링)
    const result = await client.query(`
      SELECT na.id, na.title, na.content, na.category_id, c.name as category_name, s.name as source_name
      FROM news_articles na
      JOIN categories c ON na.category_id = c.id
      LEFT JOIN sources s ON na.source_id = s.id
      WHERE c.name = '정치'
        AND na.id NOT IN (SELECT DISTINCT article_id FROM bias_analysis)
        AND na.content IS NOT NULL
        AND LENGTH(na.content) >= 100
      ORDER BY na.created_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);

    const articles: Article[] = result.rows;

    if (articles.length === 0) {
      logger.info('⚖️  편향 분석할 정치 기사가 없습니다');
      return;
    }

    logger.info(`⚖️  ${articles.length}개 정치 기사를 편향 분석 큐에 추가 중...`);

    // 2. 모든 기사를 Queue에 배치 추가
    try {
      const jobs = articles.map(article => ({
        articleId: article.id,
        content: article.content,
        categoryId: article.category_id,
        categoryName: article.category_name,
        sourceName: article.source_name || '기타'
      }));

      const jobIds = await addBatchBiasJobs(jobs);
      logger.info(`✅ 편향 분석 큐에 ${jobIds.length}개 작업 추가 완료`);
    } catch (error: any) {
      logger.error(`❌ 편향 분석 큐 추가 실패: ${error.message}`);
      throw error;
    }
  } catch (error: any) {
    logger.error(`❌ 편향 분석 작업 실패: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}
