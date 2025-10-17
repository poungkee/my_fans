/**
 * Raw 뉴스 처리 작업
 * Airflow의 raw_news_processing_dag.py 대체
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { query } from '../utils/database';

const CLASSIFICATION_API_URL = process.env.CLASSIFICATION_API_URL || 'http://classification-api:5000';
const BATCH_SIZE = parseInt(process.env.RAW_NEWS_BATCH_SIZE || '100');

/**
 * Raw 뉴스 처리 메인 함수
 */
export async function processRawNews(): Promise<void> {
  try {
    // 1. 처리 대기 중인 원본 기사 확인
    const countResult = await query(
      'SELECT COUNT(*) FROM raw_news_articles WHERE processed = FALSE'
    );

    const pendingCount = parseInt(countResult.rows[0].count);

    if (pendingCount === 0) {
      logger.info('📭 처리할 원본 기사가 없습니다');
      return;
    }

    logger.info(`🔄 ${pendingCount}개 원본 기사 처리 시작...`);

    // 2. Classification API 호출
    const response = await axios.post(
      `${CLASSIFICATION_API_URL}/process-raw-news`,
      { limit: BATCH_SIZE },
      { timeout: 300000 } // 5분 타임아웃
    );

    if (response.data.success) {
      logger.info(
        `✅ 원본 기사 처리 완료: ${response.data.processed}개 성공, ${response.data.failed || 0}개 실패`
      );
    } else {
      throw new Error(response.data.error || '처리 실패');
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('❌ Classification API 연결 실패 (서비스가 실행중인지 확인하세요)');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      logger.error('⏰ Classification API 응답 시간 초과');
    } else {
      logger.error(`❌ Raw 뉴스 처리 실패: ${error.message}`);
    }
    throw error;
  }
}
