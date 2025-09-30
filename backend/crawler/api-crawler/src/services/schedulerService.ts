import { newsCrawlerService } from './newsCrawlerService';
import logger from '../../shared/config/logger';

interface SchedulerConfig {
  intervalMinutes: number;
  limitPerCategory: number;
  enabled: boolean;
}

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private config: SchedulerConfig = {
    intervalMinutes: 5, // 5분마다 실행
    limitPerCategory: 20, // 카테고리당 20개씩 수집
    enabled: false
  };
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private nextRunTime: Date | null = null;

  /**
   * 스케줄러 시작
   */
  start(config?: Partial<SchedulerConfig>): void {
    if (this.config.enabled) {
      logger.info('📅 뉴스 크롤링 스케줄러가 이미 실행 중입니다.');
      return;
    }

    // 설정 업데이트
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.config.enabled = true;
    const intervalMs = this.config.intervalMinutes * 60 * 1000;

    logger.info(`🕒 뉴스 크롤링 스케줄러 시작: ${this.config.intervalMinutes}분마다 실행`);
    logger.info(`📊 카테고리당 수집 개수: ${this.config.limitPerCategory}개`);

    // 첫 실행은 즉시
    this.runCrawling();

    // 이후 주기적 실행
    this.intervalId = setInterval(() => {
      this.runCrawling();
    }, intervalMs);

    this.updateNextRunTime();
  }

  /**
   * 스케줄러 중지
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config.enabled = false;
    this.nextRunTime = null;
    logger.info('🛑 뉴스 크롤링 스케줄러 중지됨');
  }

  /**
   * 크롤링 실행
   */
  private async runCrawling(): Promise<void> {
    if (this.isRunning) {
      logger.info('⏳ 이전 크롤링이 아직 실행 중입니다. 건너뜁니다.');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      logger.info(`\n📰 [${ this.lastRunTime.toLocaleString('ko-KR')}] 뉴스 크롤링 시작...`);

      const results = await newsCrawlerService.crawlAllCategories(this.config.limitPerCategory);

      let totalCollected = 0;
      for (const [category, articles] of Object.entries(results)) {
        totalCollected += articles.length;
        logger.info(`  ✓ ${category}: ${articles.length}개`);
      }

      logger.info(`✅ 크롤링 완료 - 총 ${totalCollected}개 수집\n`);
    } catch (error) {
      logger.error('❌ 크롤링 실패:', error);
    } finally {
      this.isRunning = false;
      this.updateNextRunTime();
    }
  }

  /**
   * 다음 실행 시간 업데이트
   */
  private updateNextRunTime(): void {
    if (this.config.enabled) {
      const nextTime = new Date(Date.now() + this.config.intervalMinutes * 60 * 1000);
      this.nextRunTime = nextTime;
    }
  }

  /**
   * 스케줄러 상태 조회
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    lastRunTime: Date | null;
    nextRunTime: Date | null;
    config: SchedulerConfig;
  } {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.nextRunTime,
      config: { ...this.config }
    };
  }

  /**
   * 스케줄러 설정 업데이트
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    const wasEnabled = this.config.enabled;

    // 설정 업데이트
    this.config = { ...this.config, ...config };

    // 실행 중이면 재시작
    if (wasEnabled && this.config.enabled) {
      this.stop();
      this.start(this.config);
    }
  }
}

export const schedulerService = new SchedulerService();