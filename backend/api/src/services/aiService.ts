import axios from 'axios';

interface SummarizeRequest {
  text: string;
}

interface SummarizeResponse {
  summary: string;
  keywords?: string[];
  success: boolean;
}

export class AIService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  }

  async summarizeText(text: string): Promise<SummarizeResponse> {
    try {
      const response = await axios.post<SummarizeResponse>(
        `${this.baseURL}/api/ai/summarize`,
        { content: text },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000 // 30초 타임아웃
        }
      );

      return response.data;
    } catch (error) {
      console.error('AI Service Error:', error.message);
      throw new Error('AI 요약 서비스 연결 실패');
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/api/ai/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('AI Service Health Check Failed:', error.message);
      return false;
    }
  }
}

export const aiService = new AIService();