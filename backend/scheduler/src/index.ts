/**
 * News Processing Scheduler Service
 * Airflow 대체: node-cron을 사용한 스케줄러
 */

import cron from 'node-cron';
import { processRawNews } from './jobs/processRawNews';
import { generateAISummaries } from './jobs/generateSummaries';
import { extractKeywords } from './jobs/extractKeywords';
import { analyzeBias } from './jobs/analyzeBias';
import { logger } from './utils/logger';

// 환경변수 로드
import dotenv from 'dotenv';
dotenv.config();

const SCHEDULE_INTERVAL = process.env.SCHEDULE_INTERVAL || '*/10 * * * *'; // 10분마다

/**
 * 메인 스케줄러 시작
 */
async function startScheduler() {
  logger.info('🚀 News Processing Scheduler 시작...');
  logger.info(`⏰ 스케줄: ${SCHEDULE_INTERVAL}`);

  // 1. Raw 뉴스 처리 작업 (10분마다)
  cron.schedule(SCHEDULE_INTERVAL, async () => {
    logger.info('📰 [JOB START] Raw News Processing');

    try {
      await processRawNews();
      logger.info('✅ [JOB COMPLETE] Raw News Processing');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] Raw News Processing: ${error.message}`);
    }
  });

  // 2. AI 요약 생성 작업 (10분마다, 1분 후 시작)
  cron.schedule(SCHEDULE_INTERVAL, async () => {
    logger.info('📝 [JOB START] AI Summary Generation');

    try {
      // Raw 처리가 끝난 후 실행되도록 1분 지연
      await new Promise(resolve => setTimeout(resolve, 60000));
      await generateAISummaries();
      logger.info('✅ [JOB COMPLETE] AI Summary Generation');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] AI Summary Generation: ${error.message}`);
    }
  });

  // 3. 키워드 추출 작업 (10분마다, 2분 후 시작)
  cron.schedule(SCHEDULE_INTERVAL, async () => {
    logger.info('🔑 [JOB START] Keyword Extraction');

    try {
      // AI 요약 후 실행되도록 2분 지연
      await new Promise(resolve => setTimeout(resolve, 120000));
      await extractKeywords();
      logger.info('✅ [JOB COMPLETE] Keyword Extraction');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] Keyword Extraction: ${error.message}`);
    }
  });

  // 4. 편향 분석 작업 (10분마다, 3분 후 시작)
  cron.schedule(SCHEDULE_INTERVAL, async () => {
    logger.info('⚖️  [JOB START] Bias Analysis');

    try {
      // 키워드 추출 후 실행되도록 3분 지연
      await new Promise(resolve => setTimeout(resolve, 180000));
      await analyzeBias();
      logger.info('✅ [JOB COMPLETE] Bias Analysis');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] Bias Analysis: ${error.message}`);
    }
  });

  logger.info('✅ 스케줄러 초기화 완료');
  logger.info('🔄 작업 실행 대기 중...\n');

  // 시작 시 한 번 실행 (선택적)
  const RUN_ON_START = process.env.RUN_ON_START === 'true';
  if (RUN_ON_START) {
    logger.info('🏃 시작 시 즉시 실행...');

    try {
      await processRawNews();
      await new Promise(resolve => setTimeout(resolve, 5000));
      await generateAISummaries();
      await new Promise(resolve => setTimeout(resolve, 5000));
      await extractKeywords();
      await new Promise(resolve => setTimeout(resolve, 5000));
      await analyzeBias();
    } catch (error: any) {
      logger.error(`❌ 초기 실행 실패: ${error.message}`);
    }
  }
}

// 프로세스 종료 처리
process.on('SIGINT', () => {
  logger.info('\n🛑 스케줄러 종료 중...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n🛑 스케줄러 종료 중...');
  process.exit(0);
});

// 스케줄러 시작
startScheduler().catch((error) => {
  logger.error(`❌ 스케줄러 시작 실패: ${error.message}`);
  process.exit(1);
});
