import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import os from 'os';
import logger from '../shared/config/logger';
import { NewsCrawlerService } from './services/newsCrawlerService';
import { getPuppeteerPool } from './services/puppeteerPoolService';

// 환경 변수 로드
dotenv.config({ path: '../../../.env' });

const app = express();
const PORT = process.env.PUPPETEER_CRAWLER_PORT || 4004;

app.use(express.json());

// 크롤러 서비스
let crawlerService: NewsCrawlerService;
let isInitialized = false;

/**
 * 자동 크롤링 시작 - 방법 1: 환경변수 기반 (수동 정의 방식)
 * docker-compose.yml에서 각 인스턴스마다 REPLICA_INDEX 설정 필요
 */
function startAutoCrawlingWithEnv(service: NewsCrawlerService): void {
  const interval = parseInt(process.env.CRAWL_INTERVAL || '180000'); // 기본 3분
  const replicaIndex = parseInt(process.env.REPLICA_INDEX || '0');
  const totalReplicas = parseInt(process.env.TOTAL_REPLICAS || '3');

  // 부하 분산: interval을 replica 수로 나눠 시작 시간 균등 분산
  const startDelay = (interval / totalReplicas) * replicaIndex;

  logger.info(`[Auto-Crawl] 방법: 환경변수 기반`);
  logger.info(`[Auto-Crawl] 인스턴스: ${replicaIndex}/${totalReplicas}, 간격: ${interval}ms, 지연: ${startDelay}ms`);

  setTimeout(() => {
    logger.info(`[Instance ${replicaIndex}] 첫 크롤링 시작`);

    // 첫 실행
    service.crawlAll().catch((error) => {
      logger.error(`[Instance ${replicaIndex}] 크롤링 오류`, error);
    });

    // 주기적 실행
    setInterval(async () => {
      logger.info(`[Instance ${replicaIndex}] 자동 크롤링 시작`);
      try {
        await service.crawlAll();
      } catch (error) {
        logger.error(`[Instance ${replicaIndex}] 크롤링 오류`, error);
      }
    }, interval);
  }, startDelay);
}

/**
 * 자동 크롤링 시작 - 방법 2: 랜덤 지연 (자동 확장 방식)
 * docker-compose scale 사용 가능, 완벽한 분산은 아니지만 확장 용이
 */
function startAutoCrawlingWithRandom(service: NewsCrawlerService): void {
  const interval = parseInt(process.env.CRAWL_INTERVAL || '180000'); // 기본 3분
  const totalReplicas = parseInt(process.env.TOTAL_REPLICAS || '3');

  // 랜덤 지연: 0 ~ (interval / totalReplicas) 사이
  const maxDelay = interval / totalReplicas;
  const startDelay = Math.floor(Math.random() * maxDelay);

  logger.info(`[Auto-Crawl] 방법: 랜덤 지연 기반`);
  logger.info(`[Auto-Crawl] 호스트: ${os.hostname()}, 간격: ${interval}ms, 랜덤 지연: ${startDelay}ms`);

  setTimeout(() => {
    const instanceId = os.hostname().substring(0, 8);
    logger.info(`[Instance ${instanceId}] 첫 크롤링 시작`);

    // 첫 실행
    service.crawlAll().catch((error) => {
      logger.error(`[Instance ${instanceId}] 크롤링 오류`, error);
    });

    // 주기적 실행
    setInterval(async () => {
      logger.info(`[Instance ${instanceId}] 자동 크롤링 시작`);
      try {
        await service.crawlAll();
      } catch (error) {
        logger.error(`[Instance ${instanceId}] 크롤링 오류`, error);
      }
    }, interval);
  }, startDelay);
}

/**
 * 자동 크롤링 시작 (방식 선택)
 */
function startAutoCrawling(service: NewsCrawlerService): void {
  // 방법 1: 환경변수 기반 (완벽한 시간차, 수동 정의)
  startAutoCrawlingWithEnv(service);

  // 방법 2: 랜덤 지연 (자동 확장, 대략적 분산)
  // startAutoCrawlingWithRandom(service);
}

/**
 * 헬스체크
 */
app.get('/health', (req: Request, res: Response) => {
  const pool = getPuppeteerPool();
  const stats = pool.getPoolStats();

  res.json({
    status: 'ok',
    service: 'puppeteer-crawler',
    initialized: isInitialized,
    browserPool: stats,
  });
});

/**
 * 특정 언론사 크롤링
 * POST /crawl/:sourceName
 */
app.post('/crawl/:sourceName', async (req: Request, res: Response) => {
  if (!isInitialized) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const { sourceName } = req.params;
  logger.info(`수동 크롤링 요청: ${sourceName}`);

  try {
    const result = await crawlerService.crawlSource(sourceName);
    res.json({
      success: true,
      sourceName,
      result,
    });
  } catch (error: any) {
    logger.error(`크롤링 실패: ${sourceName}`, error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Crawl failed',
    });
  }
});

/**
 * 전체 언론사 크롤링
 * POST /crawl-all
 */
app.post('/crawl-all', async (req: Request, res: Response) => {
  if (!isInitialized) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  logger.info('전체 크롤링 요청');

  try {
    // 비동기로 실행 (응답은 즉시)
    crawlerService.crawlAll().catch((error) => {
      logger.error('전체 크롤링 오류', error);
    });

    res.json({
      success: true,
      message: 'Crawling started in background',
    });
  } catch (error: any) {
    logger.error('전체 크롤링 시작 실패', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Crawl start failed',
    });
  }
});

/**
 * 브라우저 풀 상태 조회
 * GET /pool-stats
 */
app.get('/pool-stats', (req: Request, res: Response) => {
  const pool = getPuppeteerPool();
  const stats = pool.getPoolStats();

  res.json({
    success: true,
    stats,
  });
});

/**
 * 서버 시작
 */
async function startServer() {
  try {
    logger.info('Puppeteer Crawler 서비스 시작 중...');

    // 크롤러 서비스 초기화
    crawlerService = new NewsCrawlerService();
    await crawlerService.initialize();
    isInitialized = true;

    logger.info('크롤러 서비스 초기화 완료');

    // Express 서버 시작
    app.listen(PORT, () => {
      logger.info(`Puppeteer Crawler 서버 시작 - 포트: ${PORT}`);
    });

    // 자동 크롤링 활성화
    if (process.env.AUTO_CRAWL === 'true') {
      startAutoCrawling(crawlerService);
    }
  } catch (error) {
    logger.error('서버 시작 실패', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM 시그널 수신, 종료 중...');
  const pool = getPuppeteerPool();
  await pool.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT 시그널 수신, 종료 중...');
  const pool = getPuppeteerPool();
  await pool.destroy();
  process.exit(0);
});

// 서버 시작
startServer();
