import '../config/env'; // Load environment variables first
import axios from 'axios';

interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface SummarizeResponse {
  success: boolean;
  summary: string;
  keywords: string[];
  original_length: number;
  summary_length: number;
  error?: string;
}

class RateLimiter {
  private requests: number[] = [];
  private dailyRequests: number[] = [];
  private readonly RPM_LIMIT = 10; // 분당 10회
  private readonly RPD_LIMIT = 250; // 일당 250회

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 1분 이내 요청 정리
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    // 24시간 이내 요청 정리
    this.dailyRequests = this.dailyRequests.filter(time => time > oneDayAgo);

    // 제한 확인
    if (this.requests.length >= this.RPM_LIMIT) {
      console.log(`[RATE LIMIT] 분당 제한 초과: ${this.requests.length}/${this.RPM_LIMIT}`);
      return false;
    }

    if (this.dailyRequests.length >= this.RPD_LIMIT) {
      console.log(`[RATE LIMIT] 일당 제한 초과: ${this.dailyRequests.length}/${this.RPD_LIMIT}`);
      return false;
    }

    return true;
  }

  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
    this.dailyRequests.push(now);
  }

  getStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentRequests = this.requests.filter(time => time > oneMinuteAgo).length;
    const dailyRequestsCount = this.dailyRequests.filter(time => time > oneDayAgo).length;

    return {
      requests_per_minute: `${recentRequests}/${this.RPM_LIMIT}`,
      requests_per_day: `${dailyRequestsCount}/${this.RPD_LIMIT}`,
      can_make_request: this.canMakeRequest()
    };
  }
}

export class GeminiService {
  private apiKey: string;
  private baseURL: string;
  private rateLimiter: RateLimiter;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
    this.rateLimiter = new RateLimiter();

    console.log('[DEBUG] GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '***LOADED***' : 'NOT FOUND');
    console.log('[DEBUG] API Key length:', this.apiKey.length);

    if (!this.apiKey) {
      console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다');
    }
  }

  async summarizeText(text: string): Promise<SummarizeResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API Key가 설정되지 않았습니다');
    }

    // Rate Limiting 체크
    if (!this.rateLimiter.canMakeRequest()) {
      const status = this.rateLimiter.getStatus();
      throw new Error(`Rate limit 초과: 분당 ${status.requests_per_minute}, 일당 ${status.requests_per_day}`);
    }

    if (text.length < 50) {
      throw new Error('요약할 텍스트가 너무 짧습니다 (최소 50자)');
    }

    const prompt = `다음 한국어 뉴스 텍스트를 간결하게 3줄 이내로 요약해주세요. 요약문은 핵심 내용만 포함하고 명확하게 작성해주세요.

뉴스 텍스트:
${text}

요약:`;

    const requestBody: GeminiRequest = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.3
      }
    };

    try {
      console.log(`[GEMINI] 요약 요청 시작... (${text.length}자)`);
      const startTime = Date.now();

      // Rate limiter에 요청 기록
      this.rateLimiter.recordRequest();

      const response = await axios.post<GeminiResponse>(
        `${this.baseURL}?key=${this.apiKey}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('Gemini API 응답에 결과가 없습니다');
      }

      const summary = response.data.candidates[0].content.parts[0].text.trim();

      // 간단한 키워드 추출 (첫 문장에서 명사 추출)
      const keywords = this.extractKeywords(text);

      console.log(`[GEMINI] 요약 완료 (${duration}ms)`);

      return {
        success: true,
        summary,
        keywords,
        original_length: text.length,
        summary_length: summary.length
      };

    } catch (error: any) {
      console.error('[GEMINI] 요약 실패:', error.message);

      if (error.response) {
        console.error('[GEMINI] API 응답 오류:', error.response.status, error.response.data);
      }

      throw new Error(`Gemini 요약 실패: ${error.message}`);
    }
  }

  private extractKeywords(text: string): string[] {
    // 간단한 키워드 추출 (한국어 명사 패턴)
    const sentences = text.split(/[.!?]/);
    const firstSentence = sentences[0] || text.substring(0, 100);

    // 2글자 이상 한글 단어 추출
    const words = firstSentence.match(/[가-힣]{2,}/g) || [];

    // 중복 제거 및 상위 5개
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 5);
  }

  async checkHealth(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      const status = this.rateLimiter.getStatus();
      console.log('[GEMINI] Rate Limit Status:', status);

      return status.can_make_request;
    } catch (error) {
      console.error('[GEMINI] Health check 실패:', error);
      return false;
    }
  }

  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }
}

export const geminiService = new GeminiService();