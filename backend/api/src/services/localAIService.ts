import axios from 'axios';

interface LocalAISummarizeRequest {
  text: string;
  max_length?: number;
}

interface LocalAISummarizeResponse {
  summary: string;
  length: number;
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
  private readonly REQUEST_LIMIT = 30; // 분당 30회

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // 1분 이내 요청 정리
    this.requests = this.requests.filter(time => time > oneMinuteAgo);

    if (this.requests.length >= this.REQUEST_LIMIT) {
      console.log(`[RATE LIMIT] 분당 제한 초과: ${this.requests.length}/${this.REQUEST_LIMIT}`);
      return false;
    }

    return true;
  }

  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
  }

  getStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentRequests = this.requests.filter(time => time > oneMinuteAgo).length;

    return {
      requests_per_minute: `${recentRequests}/${this.REQUEST_LIMIT}`,
      can_make_request: this.canMakeRequest()
    };
  }
}

export class LocalAIService {
  private aiServiceURL: string;
  private rateLimiter: RateLimiter;
  private fallbackEnabled: boolean = true;

  constructor() {
    // 네트워크 상의 다른 컴퓨터에서 실행 중인 AI 서비스
    this.aiServiceURL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.rateLimiter = new RateLimiter();

    console.log('[DEBUG] Local AI Service URL:', this.aiServiceURL);
  }

  private extractKeywords(text: string): string[] {
    // 간단한 키워드 추출 (한국어 명사 패턴)
    const sentences = text.split(/[.!?]/);
    const firstSentence = sentences[0] || text.substring(0, 100);

    // 2글자 이상 한글 단어 추출
    const words = firstSentence.match(/[가-힣]{2,}/g) || [];

    // 불용어 제거
    const stopwords = ['그리고', '하지만', '그런데', '이러한', '그래서', '따라서', '때문에', '이번', '지난', '오늘', '어제', '내일', '기자', '취재'];
    const filteredWords = words.filter(word => !stopwords.includes(word));

    // 중복 제거 및 상위 5개
    const uniqueWords = [...new Set(filteredWords)];
    return uniqueWords.slice(0, 5);
  }

  private generateFallbackSummary(text: string): string {
    // 폴백 요약: 첫 번째 문장들을 활용
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);

    if (sentences.length === 0) {
      return text.substring(0, 100) + "...";
    }

    // 처음 2-3 문장을 요약으로 사용
    let summary = "";
    let sentenceCount = 0;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10 && sentenceCount < 3) {
        summary += trimmed + ". ";
        sentenceCount++;

        // 요약이 150자 정도가 되면 중단
        if (summary.length > 150) {
          break;
        }
      }
    }

    return summary.trim() || text.substring(0, 100) + "...";
  }

  async summarizeText(text: string): Promise<SummarizeResponse> {
    // Rate Limiting 체크
    if (!this.rateLimiter.canMakeRequest()) {
      const status = this.rateLimiter.getStatus();
      throw new Error(`Rate limit 초과: 분당 ${status.requests_per_minute}`);
    }

    if (text.length < 50) {
      throw new Error('요약할 텍스트가 너무 짧습니다 (최소 50자)');
    }

    // Rate limiter에 요청 기록
    this.rateLimiter.recordRequest();

    try {
      console.log(`[LOCAL AI] 요약 요청 시작... (${text.length}자)`);
      const startTime = Date.now();

      const requestBody: LocalAISummarizeRequest = {
        text: text,
        max_length: 150
      };

      // 먼저 AI 서비스 시도
      try {
        const response = await axios.post<LocalAISummarizeResponse>(
          `${this.aiServiceURL}/ai/summarize`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        const summary = response.data.summary || this.generateFallbackSummary(text);
        const keywords = this.extractKeywords(text);

        console.log(`[LOCAL AI] 요약 완료 (${duration}ms)`);

        return {
          success: true,
          summary,
          keywords,
          original_length: text.length,
          summary_length: summary.length
        };

      } catch (aiError: any) {
        console.warn('[LOCAL AI] AI 서비스 연결 실패, 폴백 모드 사용:', aiError.message);

        if (!this.fallbackEnabled) {
          throw aiError;
        }

        // 폴백 요약 생성
        const fallbackSummary = this.generateFallbackSummary(text);
        const keywords = this.extractKeywords(text);

        console.log('[LOCAL AI] 폴백 요약 생성 완료');

        return {
          success: true,
          summary: fallbackSummary,
          keywords,
          original_length: text.length,
          summary_length: fallbackSummary.length
        };
      }

    } catch (error: any) {
      console.error('[LOCAL AI] 요약 실패:', error.message);
      throw new Error(`Local AI 요약 실패: ${error.message}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.aiServiceURL}/health`, {
        timeout: 5000
      });

      console.log('[LOCAL AI] Health check 성공:', response.data);
      return true;
    } catch (error: any) {
      console.warn('[LOCAL AI] AI 서비스 연결 실패, 폴백 모드 사용 가능:', error.message);
      return this.fallbackEnabled; // 폴백이 활성화되어 있으면 healthy로 간주
    }
  }

  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  setAIServiceURL(url: string) {
    this.aiServiceURL = url;
    console.log('[LOCAL AI] AI Service URL 변경:', url);
  }

  setFallbackEnabled(enabled: boolean) {
    this.fallbackEnabled = enabled;
    console.log('[LOCAL AI] 폴백 모드:', enabled ? '활성화' : '비활성화');
  }
}

export const localAIService = new LocalAIService();