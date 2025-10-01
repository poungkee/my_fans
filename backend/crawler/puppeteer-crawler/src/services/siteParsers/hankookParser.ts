import { Page } from 'puppeteer';
import { SiteParser, ParsedArticle, ParserUtils } from './baseParser';
import logger from '../../../shared/config/logger';

export class HankookParser implements SiteParser {
  getSectionUrls(): string[] {
    return [
      'https://www.hankookilbo.com/News/Politics', // 정치
      'https://www.hankookilbo.com/News/Economy', // 경제
      'https://www.hankookilbo.com/News/Society', // 사회
      'https://www.hankookilbo.com/News/World', // 국제
      'https://www.hankookilbo.com/News/Culture', // 문화
      'https://www.hankookilbo.com/News/Science', // IT/과학
    ];
  }

  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      logger.info(`한국일보 섹션 페이지 접속: ${sectionUrl}`);
      await page.goto(sectionUrl, { waitUntil: 'networkidle2' });

      await page.waitForSelector('.article-list', { timeout: 10000 });

      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/News/Read/"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && !href.includes('javascript:'));
      });

      const uniqueUrls = [...new Set(urls)];
      logger.info(`한국일보 섹션에서 ${uniqueUrls.length}개 기사 URL 발견`);

      return uniqueUrls;
    } catch (error) {
      logger.error(`한국일보 URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  async parseArticle(page: Page, url: string): Promise<ParsedArticle | null> {
    try {
      logger.info(`한국일보 기사 파싱: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      await page.waitForSelector('.article-body', { timeout: 10000 });

      const article = await page.evaluate(() => {
        const titleEl = document.querySelector('.headline') || document.querySelector('h1');
        const title = titleEl?.textContent?.trim() || '';

        const contentEl = document.querySelector('.article-body') || document.querySelector('.editor-p');
        const content = contentEl?.textContent?.trim() || '';

        const imageEl = document.querySelector('.article-body img') || document.querySelector('meta[property="og:image"]');
        const imageUrl = imageEl
          ? (imageEl as HTMLImageElement).src || (imageEl as HTMLMetaElement).content
          : undefined;

        const journalistEl = document.querySelector('.byline .name') || document.querySelector('.reporter');
        const journalist = journalistEl?.textContent?.trim().replace(/기자/g, '').trim() || undefined;

        const dateEl = document.querySelector('.byline time') || document.querySelector('.date-time');
        const dateStr = dateEl?.textContent?.trim() || (dateEl as HTMLTimeElement)?.dateTime || '';

        return { title, content, imageUrl, journalist, dateStr };
      });

      if (!article.title || !article.content) {
        logger.warn(`한국일보 기사 파싱 실패: ${url}`);
        return null;
      }

      const categoryMatch = url.match(/\/News\/([^/]+)/);
      const categoryMap: { [key: string]: string } = {
        Politics: '정치',
        Economy: '경제',
        Society: '사회',
        World: '세계',
        Culture: '생활/문화',
        Science: 'IT/과학',
      };
      const categoryName = categoryMatch ? categoryMap[categoryMatch[1]] : undefined;

      return {
        title: ParserUtils.cleanText(article.title),
        content: ParserUtils.cleanText(article.content),
        url,
        imageUrl: article.imageUrl,
        journalist: article.journalist,
        pubDate: ParserUtils.parseDate(article.dateStr),
        categoryName,
      };
    } catch (error) {
      logger.error(`한국일보 기사 파싱 오류: ${url}`, error);
      return null;
    }
  }
}
