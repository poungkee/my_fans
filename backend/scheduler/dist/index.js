"use strict";
/**
 * News Processing Scheduler Service
 * Airflow 대체: node-cron을 사용한 스케줄러
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const processRawNews_1 = require("./jobs/processRawNews");
const generateSummaries_1 = require("./jobs/generateSummaries");
const extractKeywords_1 = require("./jobs/extractKeywords");
const analyzeBias_1 = require("./jobs/analyzeBias");
const logger_1 = require("./utils/logger");
// 환경변수 로드
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const SCHEDULE_INTERVAL = process.env.SCHEDULE_INTERVAL || '*/10 * * * *'; // 10분마다
/**
 * 메인 스케줄러 시작
 */
async function startScheduler() {
    logger_1.logger.info('🚀 News Processing Scheduler 시작...');
    logger_1.logger.info(`⏰ 스케줄: ${SCHEDULE_INTERVAL}`);
    // 1. Raw 뉴스 처리 작업 (10분마다)
    node_cron_1.default.schedule(SCHEDULE_INTERVAL, async () => {
        logger_1.logger.info('📰 [JOB START] Raw News Processing');
        try {
            await (0, processRawNews_1.processRawNews)();
            logger_1.logger.info('✅ [JOB COMPLETE] Raw News Processing');
        }
        catch (error) {
            logger_1.logger.error(`❌ [JOB FAILED] Raw News Processing: ${error.message}`);
        }
    });
    // 2. AI 요약 생성 작업 (10분마다, 1분 후 시작)
    node_cron_1.default.schedule(SCHEDULE_INTERVAL, async () => {
        logger_1.logger.info('📝 [JOB START] AI Summary Generation');
        try {
            // Raw 처리가 끝난 후 실행되도록 1분 지연
            await new Promise(resolve => setTimeout(resolve, 60000));
            await (0, generateSummaries_1.generateAISummaries)();
            logger_1.logger.info('✅ [JOB COMPLETE] AI Summary Generation');
        }
        catch (error) {
            logger_1.logger.error(`❌ [JOB FAILED] AI Summary Generation: ${error.message}`);
        }
    });
    // 3. 키워드 추출 작업 (10분마다, 2분 후 시작)
    node_cron_1.default.schedule(SCHEDULE_INTERVAL, async () => {
        logger_1.logger.info('🔑 [JOB START] Keyword Extraction');
        try {
            // AI 요약 후 실행되도록 2분 지연
            await new Promise(resolve => setTimeout(resolve, 120000));
            await (0, extractKeywords_1.extractKeywords)();
            logger_1.logger.info('✅ [JOB COMPLETE] Keyword Extraction');
        }
        catch (error) {
            logger_1.logger.error(`❌ [JOB FAILED] Keyword Extraction: ${error.message}`);
        }
    });
    // 4. 편향 분석 작업 (10분마다, 3분 후 시작)
    node_cron_1.default.schedule(SCHEDULE_INTERVAL, async () => {
        logger_1.logger.info('⚖️  [JOB START] Bias Analysis');
        try {
            // 키워드 추출 후 실행되도록 3분 지연
            await new Promise(resolve => setTimeout(resolve, 180000));
            await (0, analyzeBias_1.analyzeBias)();
            logger_1.logger.info('✅ [JOB COMPLETE] Bias Analysis');
        }
        catch (error) {
            logger_1.logger.error(`❌ [JOB FAILED] Bias Analysis: ${error.message}`);
        }
    });
    logger_1.logger.info('✅ 스케줄러 초기화 완료');
    logger_1.logger.info('🔄 작업 실행 대기 중...\n');
    // 시작 시 한 번 실행 (선택적)
    const RUN_ON_START = process.env.RUN_ON_START === 'true';
    if (RUN_ON_START) {
        logger_1.logger.info('🏃 시작 시 즉시 실행...');
        try {
            await (0, processRawNews_1.processRawNews)();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await (0, generateSummaries_1.generateAISummaries)();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await (0, extractKeywords_1.extractKeywords)();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await (0, analyzeBias_1.analyzeBias)();
        }
        catch (error) {
            logger_1.logger.error(`❌ 초기 실행 실패: ${error.message}`);
        }
    }
}
// 프로세스 종료 처리
process.on('SIGINT', () => {
    logger_1.logger.info('\n🛑 스케줄러 종료 중...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_1.logger.info('\n🛑 스케줄러 종료 중...');
    process.exit(0);
});
// 스케줄러 시작
startScheduler().catch((error) => {
    logger_1.logger.error(`❌ 스케줄러 시작 실패: ${error.message}`);
    process.exit(1);
});
