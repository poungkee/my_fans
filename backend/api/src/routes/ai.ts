import { Router } from 'express';
import { localAIService } from '../services/localAIService';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';
import { BiasAnalysis } from '../entities/BiasAnalysis';
import { Source } from '../entities/Source';
import logger from '../config/logger';

const router = Router();

router.post('/ai/summarize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: '텍스트가 필요합니다' });
    }

    if (text.length < 50) {
      return res.status(400).json({ error: '요약할 텍스트가 너무 짧습니다 (최소 50자)' });
    }

    const result = await localAIService.summarizeText(text);

    res.json({
      original_length: text.length,
      summary_length: result.summary.length,
      summary: result.summary,
      keywords: result.keywords || [],
      success: result.success
    });
  } catch (error: any) {
    logger.error('AI Summarize Error:', error);
    res.status(500).json({ error: error.message || 'AI 요약 처리 중 오류가 발생했습니다' });
  }
});

router.post('/ai/summarize-news/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    const repository = AppDataSource.getRepository(NewsArticle);

    const article = await repository.findOne({
      where: { id: Number(newsId) }
    });

    if (!article) {
      return res.status(404).json({ error: '뉴스 기사를 찾을 수 없습니다' });
    }

    if (!article.content) {
      return res.status(400).json({ error: '뉴스 내용이 없어 요약할 수 없습니다' });
    }

    if (article.aiSummary) {
      return res.json({
        message: '이미 AI 요약이 존재합니다',
        ai_summary: article.aiSummary
      });
    }

    const result = await localAIService.summarizeText(article.content);

    await repository.update(Number(newsId), {
      aiSummary: result.summary
    });

    const updatedArticle = await repository.findOne({
      where: { id: Number(newsId) }
    });

    res.json({
      message: 'AI 요약이 성공적으로 생성되었습니다',
      article: updatedArticle
    });

  } catch (error: any) {
    logger.error('News AI Summarize Error:', error);
    res.status(500).json({ error: error.message || '뉴스 AI 요약 처리 중 오류가 발생했습니다' });
  }
});

router.get('/ai/health', async (req, res) => {
  try {
    const isHealthy = await localAIService.checkHealth();
    const rateLimitStatus = localAIService.getRateLimitStatus();

    if (isHealthy) {
      res.json({
        status: 'healthy',
        ai_service: 'local-korean-t5',
        rate_limit: rateLimitStatus,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        ai_service: 'local-korean-t5',
        rate_limit: rateLimitStatus,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    logger.error('AI Health Check Error:', error);
    res.status(503).json({
      status: 'error',
      ai_service: 'local-korean-t5',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 테스트용 하드코딩 뉴스 요약 엔드포인트
router.get('/ai/test-news', async (req, res) => {
  try {
    const testNews = [
      {
        id: 1,
        title: "대통령실, 조희대 대법원장 사퇴 요구에 '원칙적 공감'",
        content: "강유정 대통령실 대변인은 15일 추미애 국회 법제사법위원장이 조희대 대법원장 사퇴를 공개 요구한 것에 대해 \"(대통령실은) 특별한 입장은 없다\"고 말했다. 강 대변인은 \"시대적·국민적 요구가 있다면 임명된 권한으로서 그 요구의 개연성과 이유에 대해 돌이켜봐야 할 필요가 있지 않느냐는 점에 대해 아주 원칙적으로 공감한다\"고 설명했다. 강 대변인은 이날 용산 대통령실에서 열린 오전 브리핑에서 추 위원장 발언 관련 질의에 이같이 말했다. 강 대변인은 \"아직은 저희가 특별한 입장이 있는 것은 아니다\"라고 전제했다. 그는 \"국회가 어떤 숙고와 논의를 통해 헌법 정신과 국민 뜻을 반영하고자 한다면, (그 과정에서) 가장 우선시되는 것은 국민의 선출 권력\"이라고 말했다. 강 대변인은 조 대법원장 사퇴 요구에 대통령실이 동조한 것이란 해석이 제기되자 다시 브리핑을 열어 자신의 발언 취지를 설명했다."
      },
      {
        id: 2,
        title: "대통령실, '조희대 사퇴 요구에 원칙적 공감' 발언 해명",
        content: "대통령실은 더불어민주당 소속 추미애 국회 법제사법위원장이 조희대 대법원장의 사퇴를 요구한 것에 관해 \"원칙적으로 공감한다\"고 밝혔다. 강유정 대통령실 대변인은 15일 오전 용산 대통령실 브리핑을 통해 \"시대적, 국민적 요구가 있다면 임명된 권한으로서 그 요구에 대한 개연성과 그 이후에 대해 돌이켜볼 필요가 있다\"고 말했다. 강 대변인은 \"아직 특별한 입장이 있는 건 아니지만, 국회가 숙고와 논의를 통해 헌법 정신과 국민 뜻을 반영하고자 한다면 가장 우선시되는 국민 선출권력\"이라고 강조했다. 앞서 추 위원장은 전날 페이스북을 통해 \"조희대 대법원장이 헌법 수호를 핑계로 사법 독립을 외치지만 속으로는 내란범을 재판 지연으로 보호하고 있다\"며 \"사법 독립을 위해 자신이 먼저 물러남이 마땅하다\"고 주장했다."
      }
    ];

    const results = [];

    for (const news of testNews) {
      if (!news.content || news.content.length < 50) {
        results.push({
          id: news.id,
          title: news.title,
          error: "뉴스 내용이 없거나 너무 짧습니다. 실제 뉴스 내용을 넣어주세요."
        });
        continue;
      }

      try {
        const startTime = Date.now();
        const summary = await localAIService.summarizeText(news.content);
        const endTime = Date.now();

        results.push({
          id: news.id,
          title: news.title,
          original_length: news.content.length,
          summary: summary.summary,
          keywords: summary.keywords,
          processing_time: `${endTime - startTime}ms`,
          success: true
        });

        logger.info(`[TEST] 뉴스 ${news.id} 요약 완료: ${endTime - startTime}ms`);
      } catch (error: any) {
        results.push({
          id: news.id,
          title: news.title,
          error: error.message,
          success: false
        });
      }
    }

    const rateLimitStatus = localAIService.getRateLimitStatus();

    res.json({
      message: "테스트 뉴스 요약 결과",
      results,
      rate_limit_status: rateLimitStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Test News Error:', error);
    res.status(500).json({ error: '테스트 중 오류가 발생했습니다: ' + error.message });
  }
});

// 언론사별 편향성 통계 API
router.get('/ai/bias/source-statistics', async (req, res) => {
  try {
    const biasRepo = AppDataSource.getRepository(BiasAnalysis);
    const sourceRepo = AppDataSource.getRepository(Source);

    // 최근 30일간 데이터만 분석
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 언론사별 편향성 통계 쿼리 (news_articles와 조인)
    const statistics = await biasRepo
      .createQueryBuilder('bias')
      .innerJoin('news_articles', 'article', 'article.id = bias.article_id')
      .select('article.source_id', 'sourceId')
      .addSelect('COUNT(bias.id)', 'articleCount')
      .addSelect('AVG(bias.bias_score)', 'avgBiasScore')
      .addSelect('STDDEV(bias.bias_score)', 'biasStdDev')
      .addSelect('AVG(bias.confidence)', 'avgConfidence')
      .where('bias.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy('article.source_id')
      .getRawMany();

    // 언론사 정보 조회
    const sources = await sourceRepo.find();
    const sourceMap = new Map(sources.map(s => [s.id.toString(), s.name]));

    // 결과 포맷팅
    const formattedStats = statistics.map(stat => {
      const biasScore = parseFloat(stat.avgBiasScore) || 0;

      // 편향 성향 판단
      let stance = '중도';
      if (biasScore < -3) stance = '진보';
      else if (biasScore > 3) stance = '보수';

      // 일관성 점수 계산 (표준편차가 낮을수록 일관성이 높음)
      const stdDev = parseFloat(stat.biasStdDev || 0);
      const consistency = Math.max(0, 100 - (stdDev * 10));

      return {
        sourceId: stat.sourceId,
        sourceName: sourceMap.get(stat.sourceId.toString()) || '알 수 없음',
        articleCount: parseInt(stat.articleCount),
        biasScore: Math.round(biasScore * 10) / 10,
        stance: stance,
        consistency: Math.round(consistency),
        standardDeviation: Math.round(stdDev * 100) / 100,
        avgConfidence: Math.round(parseFloat(stat.avgConfidence || 0) * 100) / 100,
        period: '최근 30일'
      };
    });

    // 편향성 점수로 정렬
    formattedStats.sort((a, b) => Math.abs(b.biasScore) - Math.abs(a.biasScore));

    res.json({
      success: true,
      data: formattedStats,
      metadata: {
        period: '최근 30일',
        totalSources: formattedStats.length,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Source bias statistics error:', error);
    res.status(500).json({
      success: false,
      error: '언론사별 편향성 통계 조회 중 오류가 발생했습니다'
    });
  }
});

// 특정 기사의 편향성 분석 데이터 조회 API
router.get('/ai/bias/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    const biasRepo = AppDataSource.getRepository(BiasAnalysis);

    // 기사의 편향성 분석 데이터 조회
    const biasData = await biasRepo.findOne({
      where: { articleId: Number(articleId) }
    });

    if (!biasData) {
      return res.status(404).json({
        success: false,
        error: '해당 기사의 분석 데이터를 찾을 수 없습니다'
      });
    }

    // analysis_data에 저장된 전체 AI 분석 결과 반환
    res.json(biasData.analysisData || {
      sentiment: {
        sentiment: 'neutral',
        confidence: biasData.confidence || 0
      },
      political: {
        bias_score: biasData.biasScore || 0,
        leaning: biasData.politicalLeaning || 'neutral'
      }
    });
  } catch (error: any) {
    logger.error('Article bias data error:', error);
    res.status(500).json({
      success: false,
      error: '기사 편향성 데이터 조회 중 오류가 발생했습니다'
    });
  }
});

// 특정 언론사의 편향성 통계 API
router.get('/ai/bias/source/:sourceName', async (req, res) => {
  try {
    const { sourceName } = req.params;
    const sourceRepo = AppDataSource.getRepository(Source);
    const biasRepo = AppDataSource.getRepository(BiasAnalysis);

    // 언론사 찾기
    const source = await sourceRepo.findOne({ where: { name: sourceName } });
    if (!source) {
      return res.status(404).json({
        success: false,
        error: '해당 언론사를 찾을 수 없습니다'
      });
    }

    // 최근 30일간 데이터
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 해당 언론사의 편향성 통계 (news_articles와 조인)
    const statistics = await biasRepo
      .createQueryBuilder('bias')
      .innerJoin('news_articles', 'article', 'article.id = bias.article_id')
      .select('COUNT(bias.id)', 'articleCount')
      .addSelect('AVG(bias.bias_score)', 'avgBiasScore')
      .addSelect('STDDEV(bias.bias_score)', 'biasStdDev')
      .addSelect('AVG(bias.confidence)', 'avgConfidence')
      .addSelect('MIN(bias.bias_score)', 'minBiasScore')
      .addSelect('MAX(bias.bias_score)', 'maxBiasScore')
      .where('article.source_id = :sourceId', { sourceId: source.id })
      .andWhere('bias.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .getRawOne();

    if (!statistics || parseInt(statistics.articleCount) === 0) {
      return res.json({
        success: true,
        data: {
          sourceName: source.name,
          message: '최근 30일간 분석된 기사가 없습니다'
        }
      });
    }

    const biasScore = parseFloat(statistics.avgBiasScore) || 0;

    let stance = '중도';
    if (biasScore < -3) stance = '진보';
    else if (biasScore > 3) stance = '보수';

    const stdDev = parseFloat(statistics.biasStdDev || 0);
    const consistency = Math.max(0, 100 - (stdDev * 10));

    res.json({
      success: true,
      data: {
        sourceName: source.name,
        articleCount: parseInt(statistics.articleCount),
        biasScore: Math.round(biasScore * 10) / 10,
        stance: stance,
        consistency: Math.round(consistency),
        range: {
          min: Math.round(parseFloat(statistics.minBiasScore || 0) * 10) / 10,
          max: Math.round(parseFloat(statistics.maxBiasScore || 0) * 10) / 10
        },
        standardDeviation: Math.round(stdDev * 100) / 100,
        avgConfidence: Math.round(parseFloat(statistics.avgConfidence || 0) * 100) / 100,
        period: '최근 30일',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Source bias detail error:', error);
    res.status(500).json({
      success: false,
      error: '언론사 편향성 상세 조회 중 오류가 발생했습니다'
    });
  }
});

export default router;