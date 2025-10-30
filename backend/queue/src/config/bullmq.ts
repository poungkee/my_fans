import { ConnectionOptions } from 'bullmq';

/**
 * Redis 연결 설정
 */
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

/**
 * BullMQ 설정
 */
export const REDIS_CONFIG = {
  connection: redisConnection,
  prefix: 'bull'  // Redis 키 prefix
};
