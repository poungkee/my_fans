/**
 * BullMQ Job 타입 정의
 * Person A, B 모두 사용하는 공통 타입
 */

export interface SummaryJob {
  articleId: number;
  content: string;
  retryCount?: number;
}

export interface BiasJob {
  articleId: number;
  content: string;
  categoryId?: number;
}

export interface KeywordJob {
  articleId: number;
  content: string;
  title: string;
}

export interface RecommendationJob {
  userId: number;
  limit: number;
  priority?: 'high' | 'normal' | 'low';
  trigger?: 'user_request' | 'scheduled';
}

// Job 결과 타입
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processedAt: Date;
}
