import { Router } from 'express';
import { newsSchedulerService } from '../services/newsSchedulerService';

const router = Router();

// 스케줄러 상태 조회
router.get('/scheduler/status', (req, res) => {
  try {
    const status = newsSchedulerService.getStatus();
    const stats = newsSchedulerService.getStats();

    res.json({
      message: '스케줄러 상태 조회 성공',
      status,
      stats
    });
  } catch (error) {
    console.error('스케줄러 상태 조회 실패:', error);
    res.status(500).json({ error: '스케줄러 상태 조회 중 오류가 발생했습니다' });
  }
});

// 스케줄러 시작
router.post('/scheduler/start', (req, res) => {
  try {
    const { intervalMinutes, limitPerCategory } = req.body;

    // 설정 유효성 검사
    const config: any = {};
    if (intervalMinutes && typeof intervalMinutes === 'number' && intervalMinutes > 0) {
      config.intervalMinutes = intervalMinutes;
    }
    if (limitPerCategory && typeof limitPerCategory === 'number' && limitPerCategory > 0) {
      config.limitPerCategory = limitPerCategory;
    }

    newsSchedulerService.start(config);

    const status = newsSchedulerService.getStatus();

    res.json({
      message: '자동 크롤링 스케줄러가 시작되었습니다',
      status
    });
  } catch (error) {
    console.error('스케줄러 시작 실패:', error);
    res.status(500).json({ error: '스케줄러 시작 중 오류가 발생했습니다' });
  }
});

// 스케줄러 중지
router.post('/scheduler/stop', (req, res) => {
  try {
    newsSchedulerService.stop();

    const status = newsSchedulerService.getStatus();

    res.json({
      message: '자동 크롤링 스케줄러가 중지되었습니다',
      status
    });
  } catch (error) {
    console.error('스케줄러 중지 실패:', error);
    res.status(500).json({ error: '스케줄러 중지 중 오류가 발생했습니다' });
  }
});

// 수동 크롤링 실행
router.post('/scheduler/run-now', async (req, res) => {
  try {
    // 비동기로 실행하여 응답을 바로 반환
    newsSchedulerService.runNow().catch(error => {
      console.error('수동 크롤링 실행 중 오류:', error);
    });

    res.json({
      message: '수동 크롤링이 시작되었습니다. 백그라운드에서 실행됩니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('수동 크롤링 시작 실패:', error);
    res.status(500).json({ error: '수동 크롤링 시작 중 오류가 발생했습니다' });
  }
});

// 스케줄러 설정 업데이트
router.put('/scheduler/config', (req, res) => {
  try {
    const { intervalMinutes, limitPerCategory } = req.body;

    const newConfig: any = {};

    if (intervalMinutes !== undefined) {
      if (typeof intervalMinutes !== 'number' || intervalMinutes <= 0) {
        return res.status(400).json({
          error: 'intervalMinutes는 0보다 큰 숫자여야 합니다'
        });
      }
      newConfig.intervalMinutes = intervalMinutes;
    }

    if (limitPerCategory !== undefined) {
      if (typeof limitPerCategory !== 'number' || limitPerCategory <= 0) {
        return res.status(400).json({
          error: 'limitPerCategory는 0보다 큰 숫자여야 합니다'
        });
      }
      newConfig.limitPerCategory = limitPerCategory;
    }

    if (Object.keys(newConfig).length === 0) {
      return res.status(400).json({
        error: '업데이트할 설정을 제공해주세요 (intervalMinutes, limitPerCategory)'
      });
    }

    newsSchedulerService.updateConfig(newConfig);

    const status = newsSchedulerService.getStatus();

    res.json({
      message: '스케줄러 설정이 업데이트되었습니다',
      status
    });
  } catch (error) {
    console.error('스케줄러 설정 업데이트 실패:', error);
    res.status(500).json({ error: '스케줄러 설정 업데이트 중 오류가 발생했습니다' });
  }
});

export default router;