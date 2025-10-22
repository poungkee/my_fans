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

  // 순차적 작업 실행 함수
  async function runSequentialJobs() {
    logger.info('📰 [JOB START] Raw News Processing');
    try {
      await processRawNews();
      logger.info('✅ [JOB COMPLETE] Raw News Processing');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] Raw News Processing: ${error.message}`);
      return; // 실패 시 다음 작업 중단
    }

    logger.info('📝 [JOB START] AI Summary Generation');
    try {
      await generateAISummaries();
      logger.info('✅ [JOB COMPLETE] AI Summary Generation');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] AI Summary Generation: ${error.message}`);
      return; // 실패 시 다음 작업 중단
    }

    logger.info('🔑 [JOB START] Keyword Extraction');
    try {
      await extractKeywords();
      logger.info('✅ [JOB COMPLETE] Keyword Extraction');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] Keyword Extraction: ${error.message}`);
      return; // 실패 시 다음 작업 중단
    }

    logger.info('⚖️  [JOB START] Bias Analysis');
    try {
      await analyzeBias();
      logger.info('✅ [JOB COMPLETE] Bias Analysis');
    } catch (error: any) {
      logger.error(`❌ [JOB FAILED] Bias Analysis: ${error.message}`);
    }
  }

  // 단일 스케줄로 모든 작업 순차 실행
  cron.schedule(SCHEDULE_INTERVAL, async () => {
    logger.info('\n⏰ [SCHEDULER TRIGGER] 스케줄 작업 시작');
    await runSequentialJobs();
    logger.info('🏁 [SCHEDULER COMPLETE] 모든 작업 완료\n');
  });

  logger.info('✅ 스케줄러 초기화 완료');
  logger.info('🔄 작업 실행 대기 중...\n');

  // 시작 시 한 번 실행 (선택적)
  const RUN_ON_START = process.env.RUN_ON_START === 'true';
  if (RUN_ON_START) {
    logger.info('🏃 시작 시 즉시 실행...');
    try {
      await runSequentialJobs();
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
