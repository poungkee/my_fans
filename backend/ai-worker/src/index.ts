import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { redisConfig } from './config/redis.config';
import { logger } from './utils/logger';
import { QUEUE_NAMES } from '@fans/queue';
import { Pool } from 'pg';

// Processors
import { processSummary } from './processors/summary.processor';
import { processBias } from './processors/bias.processor';
import { processKeyword } from './processors/keyword.processor';
import { processRecommendation } from './processors/recommendation.processor';

// 환경변수 로드
dotenv.config();

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const SUMMARY_CONCURRENCY = parseInt(process.env.SUMMARY_CONCURRENCY || '1');

// Database connection
const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'fans_db',
  user: process.env.POSTGRES_USER || 'fans_user',
  password: process.env.POSTGRES_PASSWORD || 'fans_pass',
  max: 10,
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
    ? { rejectUnauthorized: false }
    : false,
});

// Summary Worker - 요약은 무거우므로 동시 1개만 처리
const summaryWorker = new Worker(
  QUEUE_NAMES.AI_SUMMARY,
  processSummary,
  {
    connection: redisConfig,
    concurrency: SUMMARY_CONCURRENCY,
    limiter: {
      max: 2,
      duration: 1000, // 1초당 2개로 제한
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

// Summary worker: save to news_articles
summaryWorker.on('completed', async (job) => {
  try {
    const result = await job.returnvalue;
    if (result?.success && result?.data) {
      await dbPool.query(
        `UPDATE news_articles SET ai_summary = $1 WHERE id = $2`,
        [result.data.summary, job.data.articleId]
      );
      logger.info(`✅ Summary saved to DB for article ${job.data.articleId}`);
    }
  } catch (error: any) {
    logger.error(`Failed to save summary: ${error.message}`);
  }
  logger.info(`✅ Job ${job.id} completed in queue ${job.queueName}`);
});

// Bias worker: save to bias_analysis AND article_sentiment
biasWorker.on('completed', async (job) => {
  try {
    const result = await job.returnvalue;
    if (result?.success && result?.data) {
      const data = result.data;

      // Save bias analysis if political article
      if (data.political_leaning) {
        await dbPool.query(
          `INSERT INTO bias_analysis
           (article_id, political_leaning, bias_score, confidence, analysis_data)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (article_id) DO UPDATE SET
             political_leaning = EXCLUDED.political_leaning,
             bias_score = EXCLUDED.bias_score,
             confidence = EXCLUDED.confidence,
             analysis_data = EXCLUDED.analysis_data`,
          [
            job.data.articleId,
            data.political_leaning,
            data.bias_score,
            data.confidence,
            JSON.stringify(data)
          ]
        );
        logger.info(`✅ Bias analysis saved to DB for article ${job.data.articleId}`);
      }

      // Save sentiment analysis (all articles)
      if (data.sentiment) {
        // Calculate normalized scores from counts
        const total = data.sentiment.positive_count + data.sentiment.negative_count;
        let posScore = 0.33, negScore = 0.33, neuScore = 0.34;

        if (total > 0) {
          posScore = data.sentiment.positive_count / total;
          negScore = data.sentiment.negative_count / total;
          neuScore = 1.0 - (posScore + negScore);
        }

        await dbPool.query(
          `INSERT INTO article_sentiment
           (article_id, overall_sentiment, positive_score, negative_score, neutral_score)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (article_id) DO UPDATE SET
             overall_sentiment = EXCLUDED.overall_sentiment,
             positive_score = EXCLUDED.positive_score,
             negative_score = EXCLUDED.negative_score,
             neutral_score = EXCLUDED.neutral_score`,
          [
            job.data.articleId,
            data.sentiment.sentiment,
            posScore,
            negScore,
            neuScore
          ]
        );
        logger.info(`✅ Sentiment analysis saved to DB for article ${job.data.articleId}`);
      }
    }
  } catch (error: any) {
    logger.error(`Failed to save bias/sentiment: ${error.message}`);
  }
  logger.info(`✅ Job ${job.id} completed in queue ${job.queueName}`);
});

// Keyword worker: save to keywords and news_keywords
keywordWorker.on('completed', async (job) => {
  try {
    const result = await job.returnvalue;
    if (result?.success && result?.data?.keywords && Array.isArray(result.data.keywords)) {
      const keywords = result.data.keywords;

      for (const kw of keywords) {
        if (!kw.keyword || !kw.relevance) continue;

        // 1. Insert keyword (or get existing)
        const keywordResult = await dbPool.query(
          `INSERT INTO keywords (keyword)
           VALUES ($1)
           ON CONFLICT (keyword) DO UPDATE SET keyword = EXCLUDED.keyword
           RETURNING id`,
          [kw.keyword]
        );
        const keywordId = keywordResult.rows[0].id;

        // 2. Link keyword to article
        await dbPool.query(
          `INSERT INTO news_keywords (news_id, keyword_id, relevance)
           VALUES ($1, $2, $3)
           ON CONFLICT (news_id, keyword_id) DO UPDATE SET relevance = EXCLUDED.relevance`,
          [job.data.articleId, keywordId, kw.relevance]
        );
      }

      logger.info(`✅ ${keywords.length} keywords saved to DB for article ${job.data.articleId}`);
    }
  } catch (error: any) {
    logger.error(`Failed to save keywords: ${error.message}`);
  }
  logger.info(`✅ Job ${job.id} completed in queue ${job.queueName}`);
});

// Recommendation worker: just log
recommendationWorker.on('completed', (job) => {
  logger.info(`✅ Job ${job.id} completed in queue ${job.queueName}`);
});

workers.forEach((worker) => {
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
logger.info(`📊 Summary Concurrency: ${SUMMARY_CONCURRENCY}, Other Concurrency: ${CONCURRENCY}`);
logger.info(`📋 Queues: ${Object.values(QUEUE_NAMES).join(', ')}`);
