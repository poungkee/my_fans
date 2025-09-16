import { Router } from 'express';
import { newsCrawlerService } from '../services/newsCrawlerService';

const router = Router();

router.get('/crawler/categories', (req, res) => {
  try {
    const categories = newsCrawlerService.getSupportedCategories();
    res.json({
      categories,
      total: categories.length
    });
  } catch (error) {
    console.error('카테고리 목록 조회 실패:', error);
    res.status(500).json({ error: '카테고리 목록 조회 중 오류가 발생했습니다' });
  }
});

router.post('/crawler/crawl', async (req, res) => {
  try {
    const { category, limit = 10 } = req.body;

    if (!category) {
      return res.status(400).json({ error: '카테고리를 지정해주세요' });
    }

    const supportedCategories = newsCrawlerService.getSupportedCategories();
    if (!supportedCategories.includes(category)) {
      return res.status(400).json({
        error: `지원하지 않는 카테고리입니다. 지원 카테고리: ${supportedCategories.join(', ')}`
      });
    }

    console.log(`뉴스 크롤링 시작 - 카테고리: ${category}, 개수: ${limit}`);

    const articles = await newsCrawlerService.crawlNewsByCategory(category, limit);

    res.json({
      message: `${category} 카테고리 뉴스 수집 완료`,
      category,
      collected: articles.length,
      articles: articles.map(article => ({
        id: article.id,
        title: article.title,
        url: article.url,
        pub_date: article.pub_date,
        media_source: article.media_source?.name,
        journalist: article.journalist?.name
      }))
    });

  } catch (error) {
    console.error('뉴스 크롤링 실패:', error);
    res.status(500).json({ error: '뉴스 크롤링 중 오류가 발생했습니다' });
  }
});

router.post('/crawler/crawl-all', async (req, res) => {
  try {
    const { limitPerCategory = 5 } = req.body;

    console.log(`전체 카테고리 뉴스 크롤링 시작 - 카테고리당 ${limitPerCategory}개`);

    const results = await newsCrawlerService.crawlAllCategories(limitPerCategory);

    const summary = Object.entries(results).map(([category, articles]) => ({
      category,
      collected: articles.length,
      articles: articles.map(article => ({
        id: article.id,
        title: article.title,
        url: article.url
      }))
    }));

    const totalCollected = Object.values(results).reduce((sum, articles) => sum + articles.length, 0);

    res.json({
      message: '전체 카테고리 뉴스 수집 완료',
      totalCollected,
      summary
    });

  } catch (error) {
    console.error('전체 뉴스 크롤링 실패:', error);
    res.status(500).json({ error: '전체 뉴스 크롤링 중 오류가 발생했습니다' });
  }
});

router.post('/crawler/test-parse', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL을 제공해주세요' });
    }

    console.log(`테스트 파싱 시작: ${url}`);

    // private 메서드에 접근하기 위해 any로 캐스팅
    const parsed = await (newsCrawlerService as any).parseNewsContent(url);

    if (!parsed) {
      return res.status(400).json({ error: '뉴스 파싱에 실패했습니다' });
    }

    res.json({
      message: '뉴스 파싱 성공',
      parsed: {
        title: parsed.title,
        content: parsed.content.substring(0, 200) + (parsed.content.length > 200 ? '...' : ''),
        journalist: parsed.journalist,
        mediaSource: parsed.mediaSource,
        pubDate: parsed.pubDate,
        imageUrl: parsed.imageUrl,
        contentLength: parsed.content.length
      }
    });

  } catch (error) {
    console.error('테스트 파싱 실패:', error);
    res.status(500).json({ error: '테스트 파싱 중 오류가 발생했습니다' });
  }
});

router.get('/crawler/status', async (req, res) => {
  try {
    const hasNaverKeys = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    res.json({
      status: 'ready',
      configurations: {
        naverApi: hasNaverKeys,
        geminiAi: hasGeminiKey
      },
      supportedCategories: newsCrawlerService.getSupportedCategories(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('크롤러 상태 확인 실패:', error);
    res.status(500).json({ error: '크롤러 상태 확인 중 오류가 발생했습니다' });
  }
});

export default router;