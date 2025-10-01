import { Page } from 'puppeteer';
import { SiteParser, ParsedArticle, ParserUtils } from './baseParser';
import logger from '../../../shared/config/logger';

export class MunhwaParser implements SiteParser {
  getSectionUrls(): string[] {
    return [
      'https://www.munhwa.com/news/section_list.html?sec=pol', // 정치
      'https://www.munhwa.com/news/section_list.html?sec=eco', // 경제
      'https://www.munhwa.com/news/section_list.html?sec=soc', // 사회
      'https://www.munhwa.com/news/section_list.html?sec=int', // 국제
      'https://www.munhwa.com/news/section_list.html?sec=cul', // 문화
      'https://www.munhwa.com/news/section_list.html?sec=tec', // IT/과학
    ];
  }

  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      logger.info(`문화일보 섹션 페이지 접속: ${sectionUrl}`);
      await page.goto(sectionUrl, { waitUntil: 'networkidle2' });

      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/news/view.html"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && !href.includes('javascript:'));
      });

      const uniqueUrls = [...new Set(urls)];
      logger.info(`문화일보 섹션에서 ${uniqueUrls.length}개 기사 URL 발견`);

      return uniqueUrls;
    } catch (error) {
      logger.error(`문화일보 URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  async parseArticle(page: Page, url: string): Promise<ParsedArticle | null> {
    try {
      logger.info(`문화일보 기사 파싱: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      await page.waitForSelector('.news_body', { timeout: 10000 });

      const article = await page.evaluate(() => {
        const titleEl = document.querySelector('.news_title') || document.querySelector('h1');
        const title = titleEl?.textContent?.trim() || '';

        const contentEl = document.querySelector('.news_body_text') || document.querySelector('.news_body');
        const content = contentEl?.textContent?.trim() || '';

        const imageEl = document.querySelector('.news_body img') || document.querySelector('meta[property="og:image"]');
        const imageUrl = imageEl
          ? (imageEl as HTMLImageElement).src || (imageEl as HTMLMetaElement).content
          : undefined;

        const journalistEl = document.querySelector('.news_reporter') || document.querySelector('.byline');
        const journalist = journalistEl?.textContent?.trim().replace(/기자/g, '').trim() || undefined;

        const dateEl = document.querySelector('.date_time') || document.querySelector('.news_date');
        const dateStr = dateEl?.textContent?.trim() || '';

        return { title, content, imageUrl, journalist, dateStr };
      });

      if (!article.title || !article.content) {
        logger.warn(`문화일보 기사 파싱 실패: ${url}`);
        return null;
      }

      const categoryMatch = url.match(/sec=([a-z]+)/);
      const categoryMap: { [key: string]: string } = {
        pol: '정치',
        eco: '경제',
        soc: '사회',
        int: '세계',
        cul: '생활/문화',
        tec: 'IT/과학',
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
      logger.error(`문화일보 기사 파싱 오류: ${url}`, error);
      return null;
    }
  }
}
