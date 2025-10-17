"use strict";
/**
 * 키워드 추출 작업
 * Bias Analysis AI의 키워드 추출 엔드포인트 호출
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractKeywords = extractKeywords;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const BIAS_ANALYSIS_AI_URL = process.env.BIAS_ANALYSIS_AI_URL || 'http://bias-analysis-ai:8002';
const BATCH_SIZE = parseInt(process.env.KEYWORD_BATCH_SIZE || '50');
/**
 * 키워드 추출 메인 함수
 */
async function extractKeywords() {
    const client = await (0, database_1.getDbClient)();
    try {
        // 1. 키워드가 없는 기사 조회
        const result = await client.query(`
      SELECT id, title, content
      FROM news_articles
      WHERE id NOT IN (SELECT DISTINCT news_id FROM news_keywords)
        AND content IS NOT NULL
        AND LENGTH(content) >= 100
      ORDER BY created_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);
        const articles = result.rows;
        if (articles.length === 0) {
            logger_1.logger.info('🔑 키워드 추출할 기사가 없습니다');
            return;
        }
        logger_1.logger.info(`🔑 ${articles.length}개 기사 키워드 추출 중...`);
        let successCount = 0;
        let failCount = 0;
        // 2. 각 기사에 대해 키워드 추출
        for (const article of articles) {
            try {
                // Bias Analysis AI 호출
                const response = await axios_1.default.post(`${BIAS_ANALYSIS_AI_URL}/analyze/keywords`, {
                    text: `${article.title}\n\n${article.content}`,
                    article_id: article.id
                }, { timeout: 10000 });
                if (response.data && response.data.keywords) {
                    const keywords = response.data.keywords;
                    // 3. 키워드 DB 저장
                    for (const kw of keywords) {
                        // 키워드가 이미 있으면 가져오고, 없으면 생성
                        const keywordResult = await client.query(`INSERT INTO keywords (keyword)
               VALUES ($1)
               ON CONFLICT (keyword) DO UPDATE SET keyword = EXCLUDED.keyword
               RETURNING id`, [kw.word]);
                        const keywordId = keywordResult.rows[0].id;
                        // news_keywords 테이블에 연결
                        await client.query(`INSERT INTO news_keywords (news_id, keyword_id, relevance)
               VALUES ($1, $2, $3)
               ON CONFLICT (news_id, keyword_id) DO NOTHING`, [article.id, keywordId, kw.score]);
                    }
                    successCount++;
                    logger_1.logger.debug(`✅ 기사 ID ${article.id} 키워드 추출 완료: ${keywords.length}개`);
                }
                else {
                    throw new Error('키워드 결과가 없습니다');
                }
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`❌ 기사 ID ${article.id} 키워드 추출 실패: ${error.message}`);
                continue;
            }
            // API 호출 제한을 위한 짧은 지연
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        logger_1.logger.info(`✅ 키워드 추출 완료: ${successCount}개 성공, ${failCount}개 실패`);
    }
    catch (error) {
        logger_1.logger.error(`❌ 키워드 추출 작업 실패: ${error.message}`);
        throw error;
    }
    finally {
        client.release();
    }
}
