import puppeteer, { Browser, Page } from 'puppeteer';
import * as genericPool from 'generic-pool';
import logger from '../../shared/config/logger';

/**
 * Puppeteer Browser Pool
 * 여러 브라우저 인스턴스를 풀로 관리하여 병렬 크롤링 지원
 */
export class PuppeteerPoolService {
  private pool: genericPool.Pool<Browser>;
  private readonly maxBrowsers: number;

  constructor(maxBrowsers: number = 5) {
    this.maxBrowsers = maxBrowsers;

    // 브라우저 풀 생성
    this.pool = genericPool.createPool(
      {
        // 브라우저 생성 factory
        create: async (): Promise<Browser> => {
          logger.info('새 Puppeteer 브라우저 인스턴스 생성 중...');
          const browser = await puppeteer.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-software-rasterizer',
              '--disable-extensions',
              '--disable-background-networking',
              '--disable-default-apps',
              '--disable-sync',
              '--no-first-run',
              '--no-zygote',
              '--single-process', // 컨테이너 환경에서 중요
            ],
          });
          logger.info('Puppeteer 브라우저 인스턴스 생성 완료');
          return browser;
        },

        // 브라우저 파괴
        destroy: async (browser: Browser): Promise<void> => {
          logger.info('Puppeteer 브라우저 인스턴스 종료 중...');
          await browser.close();
        },

        // 브라우저 상태 검증
        validate: async (browser: Browser): Promise<boolean> => {
          return browser.isConnected();
        },
      },
      {
        min: 1, // 최소 1개 브라우저 유지
        max: this.maxBrowsers, // 최대 브라우저 개수
        testOnBorrow: true, // 대여 전 검증
        acquireTimeoutMillis: 30000, // 30초 타임아웃
        evictionRunIntervalMillis: 60000, // 1분마다 유휴 브라우저 정리
        idleTimeoutMillis: 300000, // 5분 동안 사용 안되면 종료
      }
    );

    logger.info(`Puppeteer Pool 초기화 완료 (최대 ${this.maxBrowsers}개 브라우저)`);
  }

  /**
   * 브라우저 획득
   */
  async acquireBrowser(): Promise<Browser> {
    return await this.pool.acquire();
  }

  /**
   * 브라우저 반환
   */
  async releaseBrowser(browser: Browser): Promise<void> {
    await this.pool.release(browser);
  }

  /**
   * 새 페이지 생성 (자동으로 브라우저 획득/반환)
   */
  async withPage<T>(callback: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.acquireBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();

      // 타임아웃 설정
      await page.setDefaultNavigationTimeout(30000);
      await page.setDefaultTimeout(30000);

      // User-Agent 설정 (봇 차단 우회)
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 불필요한 리소스 차단 (속도 최적화)
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const result = await callback(page);
      return result;
    } finally {
      if (page) {
        await page.close();
      }
      await this.releaseBrowser(browser);
    }
  }

  /**
   * 병렬 크롤링 실행
   */
  async processUrls<T>(
    urls: string[],
    processor: (url: string, page: Page) => Promise<T>,
    concurrency?: number
  ): Promise<T[]> {
    const limit = concurrency || this.maxBrowsers;
    const results: T[] = [];

    // URL을 청크로 나누어 병렬 처리
    for (let i = 0; i < urls.length; i += limit) {
      const chunk = urls.slice(i, i + limit);

      const chunkResults = await Promise.allSettled(
        chunk.map((url) =>
          this.withPage(async (page) => {
            return await processor(url, page);
          })
        )
      );

      // 성공한 결과만 수집
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error(`URL 크롤링 실패: ${chunk[index]}`, result.reason);
        }
      });

      logger.info(`진행률: ${Math.min(i + limit, urls.length)}/${urls.length} 완료`);
    }

    return results;
  }

  /**
   * 풀 상태 확인
   */
  getPoolStats() {
    return {
      size: this.pool.size,
      available: this.pool.available,
      borrowed: this.pool.borrowed,
      pending: this.pool.pending,
      max: this.pool.max,
      min: this.pool.min,
    };
  }

  /**
   * 풀 종료
   */
  async destroy(): Promise<void> {
    logger.info('Puppeteer Pool 종료 중...');
    await this.pool.drain();
    await this.pool.clear();
    logger.info('Puppeteer Pool 종료 완료');
  }
}

// 싱글톤 인스턴스
let poolInstance: PuppeteerPoolService | null = null;

export function getPuppeteerPool(maxBrowsers: number = 5): PuppeteerPoolService {
  if (!poolInstance) {
    poolInstance = new PuppeteerPoolService(maxBrowsers);
  }
  return poolInstance;
}
