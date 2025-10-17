/**
 * 편향 분석 작업
 * Bias Analysis AI의 정치 편향 분석 엔드포인트 호출
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { getDbClient } from '../utils/database';

const BIAS_ANALYSIS_AI_URL = process.env.BIAS_ANALYSIS_AI_URL || 'http://bias-analysis-ai:8002';
const BATCH_SIZE = parseInt(process.env.BIAS_BATCH_SIZE || '50');

interface Article {
  id: number;
  title: string;
  content: string;
  category_name: string;
}

/**
 * 편향 분석 메인 함수
 */
export async function analyzeBias(): Promise<void> {
  const client = await getDbClient();

  try {
    // 1. 편향 분석이 없는 정치 기사 조회 (AI 분류 개선으로 정치 카테고리만 필터링)
    const result = await client.query(`
      SELECT na.id, na.title, na.content, c.name as category_name
      FROM news_articles na
      JOIN categories c ON na.category_id = c.id
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

    logger.info(`⚖️  ${articles.length}개 정치 기사 편향 분석 중...`);

    let successCount = 0;
    let failCount = 0;

    // 2. 각 기사에 대해 편향 분석
    for (const article of articles) {
      try {
        // Bias Analysis AI 호출
        const response = await axios.post(
          `${BIAS_ANALYSIS_AI_URL}/analyze/political`,
          {
            text: `${article.title}\n\n${article.content}`,
            article_id: article.id
          },
          { timeout: 15000 }
        );

        if (response.data) {
          const biasData = response.data;

          // 3. bias_analysis 테이블에 저장
          await client.query(
            `INSERT INTO bias_analysis (
              article_id,
              political_leaning,
              bias_score,
              confidence,
              sentiment,
              analysis_data
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (article_id)
            DO UPDATE SET
              political_leaning = EXCLUDED.political_leaning,
              bias_score = EXCLUDED.bias_score,
              confidence = EXCLUDED.confidence,
              sentiment = EXCLUDED.sentiment,
              analysis_data = EXCLUDED.analysis_data,
              analyzed_at = NOW()`,
            [
              article.id,
              biasData.stance || '중립',
              biasData.bias_score || 0,
              0.8, // confidence - 고정값 (API에서 제공하지 않는 경우)
              'neutral', // sentiment - 기본값
              JSON.stringify(biasData.party_analysis || {})
            ]
          );

          successCount++;
          logger.debug(`✅ 기사 ID ${article.id} 편향 분석 완료: ${biasData.stance}`);
        } else {
          throw new Error('편향 분석 결과가 없습니다');
        }
      } catch (error: any) {
        failCount++;
        logger.error(`❌ 기사 ID ${article.id} 편향 분석 실패: ${error.message}`);
        continue;
      }

      // API 호출 제한을 위한 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    logger.info(`✅ 편향 분석 완료: ${successCount}개 성공, ${failCount}개 실패`);
  } catch (error: any) {
    logger.error(`❌ 편향 분석 작업 실패: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}
