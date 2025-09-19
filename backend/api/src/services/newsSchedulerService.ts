import { newsCrawlerService } from './newsCrawlerService';

interface SchedulerConfig {
  intervalMinutes: number;
  limitPerCategory: number;
  enabled: boolean;
}

class NewsSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private config: SchedulerConfig = {
    intervalMinutes: 10, // 10분마다 실행
    limitPerCategory: 3, // 카테고리당 3개씩 수집
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
      console.log('뉴스 크롤링 스케줄러가 이미 실행 중입니다.');
      return;
    }

    // 설정 업데이트
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.config.enabled = true;
    const intervalMs = this.config.intervalMinutes * 60 * 1000;

    console.log(`🕒 뉴스 크롤링 스케줄러 시작: ${this.config.intervalMinutes}분마다 실행`);
    console.log(`📊 카테고리당 수집 개수: ${this.config.limitPerCategory}개`);

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
    console.log('🛑 뉴스 크롤링 스케줄러가 중지되었습니다.');
  }

  /**
   * 수동으로 크롤링 실행
   */
  async runNow(): Promise<void> {
    console.log('📰 수동 크롤링 시작...');
    await this.runCrawling();
  }

  /**
   * 실제 크롤링 실행 함수
   */
  private async runCrawling(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ 이미 크롤링이 실행 중입니다. 건너뜀...');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      console.log(`🚀 자동 뉴스 크롤링 시작: ${this.lastRunTime.toLocaleString('ko-KR')}`);

      const results = await newsCrawlerService.crawlAllCategories(this.config.limitPerCategory);

      // 결과 로깅
      let totalCollected = 0;
      const summary: string[] = [];

      for (const [category, articles] of Object.entries(results)) {
        totalCollected += articles.length;
        summary.push(`${category}: ${articles.length}개`);
      }

      console.log(`✅ 자동 크롤링 완료: 총 ${totalCollected}개 수집`);
      console.log(`📋 수집 결과: ${summary.join(', ')}`);

      this.updateNextRunTime();

    } catch (error) {
      console.error('❌ 자동 크롤링 실패:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 다음 실행 시간 업데이트
   */
  private updateNextRunTime(): void {
    if (this.config.enabled) {
      this.nextRunTime = new Date(Date.now() + this.config.intervalMinutes * 60 * 1000);
      console.log(`⏰ 다음 크롤링 예정: ${this.nextRunTime.toLocaleString('ko-KR')}`);
    }
  }

  /**
   * 현재 스케줄러 상태 반환
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      intervalMinutes: this.config.intervalMinutes,
      limitPerCategory: this.config.limitPerCategory,
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime ? this.lastRunTime.toISOString() : null,
      nextRunTime: this.nextRunTime ? this.nextRunTime.toISOString() : null,
      lastRunTimeKr: this.lastRunTime ? this.lastRunTime.toLocaleString('ko-KR') : null,
      nextRunTimeKr: this.nextRunTime ? this.nextRunTime.toLocaleString('ko-KR') : null
    };
  }

  /**
   * 스케줄러 설정 업데이트
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    console.log('⚙️ 스케줄러 설정 업데이트:', {
      이전: oldConfig,
      현재: this.config
    });

    // 실행 중이고 주기가 변경된 경우 재시작
    if (this.config.enabled && oldConfig.intervalMinutes !== this.config.intervalMinutes) {
      console.log('🔄 주기 변경으로 스케줄러 재시작...');
      this.stop();
      this.start();
    }
  }

  /**
   * 수집 통계 정보 반환
   */
  getStats() {
    return {
      supportedCategories: newsCrawlerService.getSupportedCategories(),
      currentConfig: this.config,
      status: this.getStatus()
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const newsSchedulerService = new NewsSchedulerService();