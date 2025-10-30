import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { redisConfig } from './config/redis.config';
import { logger } from './utils/logger';
import { QUEUE_NAMES } from '../../queue/src/config/queue-names';

// Processors
import { processSummary } from './processors/summary.processor';
import { processBias } from './processors/bias.processor';
import { processKeyword } from './processors/keyword.processor';
import { processRecommendation } from './processors/recommendation.processor';

// 환경변수 로드
dotenv.config();

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');

// Summary Worker
const summaryWorker = new Worker(
  QUEUE_NAMES.AI_SUMMARY,
  processSummary,
  {
    connection: redisConfig,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000, // 1초당 10개
    },
  }
);

// Bias Worker
const biasWorker = new Worker(
  QUEUE_NAMES.AI_BIAS,
  processBias,
  {
    connection: redisConfig,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Keyword Worker
const keywordWorker = new Worker(
  QUEUE_NAMES.AI_KEYWORD,
  processKeyword,
  {
    connection: redisConfig,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Recommendation Worker
const recommendationWorker = new Worker(
  QUEUE_NAMES.AI_RECOMMENDATION,
  processRecommendation,
  {
    connection: redisConfig,
    concurrency: CONCURRENCY,
    limiter: {
      max: 5,
      duration: 1000, // 추천은 더 무거우므로 5개/초
    },
  }
);

// 이벤트 핸들러
const workers = [summaryWorker, biasWorker, keywordWorker, recommendationWorker];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    logger.info(`✅ Job ${job.id} completed in queue ${job.queueName}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Job ${job?.id} failed in queue ${job?.queueName}: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`Worker error: ${err.message}`);
  });
});

// Graceful Shutdown
const gracefulShutdown = async () => {
  logger.info('🛑 Shutting down workers...');
  await Promise.all(workers.map((worker) => worker.close()));
  logger.info('✅ All workers closed');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

logger.info('🚀 AI Workers started');
logger.info(`📊 Concurrency: ${CONCURRENCY}`);
logger.info(`📋 Queues: ${Object.values(QUEUE_NAMES).join(', ')}`);
