"use strict";
/**
 * AI 요약 생성 작업
 * Airflow의 summarize_articles 태스크 대체
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAISummaries = generateAISummaries;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const SUMMARIZE_AI_URL = process.env.SUMMARIZE_AI_URL || 'http://summarize-ai:8000';
const BATCH_SIZE = parseInt(process.env.SUMMARY_BATCH_SIZE || '50');
/**
 * AI 요약 생성 메인 함수
 */
async function generateAISummaries() {
    const client = await (0, database_1.getDbClient)();
    try {
        // 1. AI 요약이 없는 기사 조회
        const result = await client.query(`
      SELECT id, content
      FROM news_articles
      WHERE ai_summary IS NULL
        AND content IS NOT NULL
        AND LENGTH(content) >= 100
      ORDER BY created_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);
        const articles = result.rows;
        if (articles.length === 0) {
            logger_1.logger.info('📭 요약할 기사가 없습니다');
            return;
        }
        logger_1.logger.info(`📚 ${articles.length}개 기사 AI 요약 생성 중...`);
        let successCount = 0;
        let failCount = 0;
        // 2. 각 기사에 대해 AI 요약 생성
        for (const article of articles) {
            try {
                // AI 요약 API 호출
                const response = await axios_1.default.post(`${SUMMARIZE_AI_URL}/ai/summarize`, { text: article.content }, { timeout: 15000 } // 15초 타임아웃
                );
                if (response.data && response.data.summary) {
                    const summary = response.data.summary;
                    // DB 업데이트
                    await client.query('UPDATE news_articles SET ai_summary = $1 WHERE id = $2', [summary, article.id]);
                    successCount++;
                    logger_1.logger.debug(`✅ 기사 ID ${article.id} 요약 완료`);
                }
                else {
                    throw new Error('요약 결과가 없습니다');
                }
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`❌ 기사 ID ${article.id} 요약 실패: ${error.message}`);
                // 에러가 발생해도 계속 진행
                continue;
            }
            // API 호출 제한을 위한 짧은 지연
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        logger_1.logger.info(`✅ AI 요약 생성 완료: ${successCount}개 성공, ${failCount}개 실패`);
    }
    catch (error) {
        logger_1.logger.error(`❌ AI 요약 생성 작업 실패: ${error.message}`);
        throw error;
    }
    finally {
        client.release();
    }
}
