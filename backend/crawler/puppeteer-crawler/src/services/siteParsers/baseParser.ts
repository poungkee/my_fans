import { Page } from 'puppeteer';

export interface ParsedArticle {
  title: string;
  content: string;
  url: string;
  imageUrl?: string;
  journalist?: string;
  pubDate?: Date;
  categoryName?: string;
}

export interface SiteParser {
  /**
   * 사이트 메인/섹션 페이지에서 기사 URL 목록 추출
   */
  extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]>;

  /**
   * 개별 기사 페이지에서 콘텐츠 파싱
   */
  parseArticle(page: Page, url: string): Promise<ParsedArticle | null>;

  /**
   * 사이트별 크롤링 대상 섹션 URL 목록
   */
  getSectionUrls(): string[];
}

/**
 * 공통 유틸리티 함수
 */
export class ParserUtils {
  /**
   * HTML 태그 제거 및 텍스트 정제
   */
  static cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/\s+/g, ' ') // 연속 공백 단일화
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * 날짜 파싱 (다양한 형식 지원)
   */
  static parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    try {
      // ISO 형식
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      }

      // YYYY-MM-DD HH:mm:ss 형식
      const match = dateStr.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})\s*(\d{1,2}):(\d{1,2}):(\d{1,2})?/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second || '0')
        );
      }

      // YYYY.MM.DD HH:mm 형식
      const match2 = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})\s*(\d{1,2}):(\d{1,2})/);
      if (match2) {
        const [, year, month, day, hour, minute] = match2;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
      }

      // 그 외는 Date 생성자에 맡김
      return new Date(dateStr);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 상대 URL을 절대 URL로 변환
   */
  static resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }
}
