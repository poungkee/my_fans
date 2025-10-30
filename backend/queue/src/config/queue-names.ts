/**
 * BullMQ 큐 이름 상수
 * Person A, B 모두 사용
 */

export const QUEUE_NAMES = {
  AI_SUMMARY: 'ai-summary',
  AI_BIAS: 'ai-bias',
  AI_KEYWORD: 'ai-keyword',
  AI_RECOMMENDATION: 'ai-recommendation'
} as const;

export const QUEUE_OPTIONS = {
  // 기본 재시도 설정
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000  // 5초, 10초, 20초
    },
    removeOnComplete: 100,  // 완료된 작업 100개까지 보관
    removeOnFail: 1000       // 실패한 작업 1000개까지 보관
  }
} as const;
