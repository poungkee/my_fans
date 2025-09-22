import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { NewsArticle } from "../entities/NewsArticle";
import { Category } from "../entities/Category";
import { Source } from "../entities/Source";
import { ArticleStat } from "../entities/ArticleStat";
import { ILike, In } from "typeorm";

const router = Router();

/** 응답 형태로 매핑 */
async function mapArticle(a: NewsArticle) {
  // 통계 정보 가져오기
  const statRepo = AppDataSource.getRepository(ArticleStat);
  const stats = await statRepo.findOne({ where: { articleId: a.id } });

  // 카테고리와 소스 정보 가져오기
  const categoryRepo = AppDataSource.getRepository(Category);
  const sourceRepo = AppDataSource.getRepository(Source);

  const category = await categoryRepo.findOne({ where: { id: a.categoryId } });
  const source = await sourceRepo.findOne({ where: { id: a.sourceId } });

  // 요약: AI 요약 → 본문 앞부분
  const fallbackSummary =
    (a.content || "").replace(/\s+/g, " ").slice(0, 160) +
    ((a.content || "").length > 160 ? "…" : "");

  return {
    id: a.id,
    title: a.title,
    url: a.url,
    image_url: a.imageUrl || null,

    // 요약 필드들
    ai_summary: a.aiSummary || null,
    summary: a.aiSummary || fallbackSummary,

    // 메타 정보
    source: source?.name || null,
    category: category?.name || null,
    journalist: a.journalist || null,
    pub_date: a.pubDate,

    // 통계 정보
    view_count: stats?.viewCount || 0,
    like_count: stats?.likeCount || 0,
    bookmark_count: stats?.bookmarkCount || 0,

    // 시간 정보
    created_at: a.createdAt,
    updated_at: a.updatedAt,

    // 키워드 정보 (기본값)
    keywords: [] as any[]
  };
}

/**
 * GET /api/feed
 * ?topics=정치,경제,사회,세계,IT/과학,생활/문화
 * ?limit=60
 * ?sort=latest|popular
 */
router.get("/feed", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);
    const categoryRepo = AppDataSource.getRepository(Category);

    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const topicsRaw = String(req.query.topics || "");
    const sort = String(req.query.sort || "latest");
    const topics = topicsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];

    let query = newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats");

    // 카테고리 필터
    if (topics.length > 0) {
      const categories = await categoryRepo.find({
        where: topics.map(name => ({ name }))
      });
      const categoryIds = categories.map(c => c.id);
      if (categoryIds.length > 0) {
        query = query.where("article.categoryId IN (:...categoryIds)", { categoryIds });
      }
    }

    // 정렬
    if (sort === "popular") {
      query = query.orderBy("stats.viewCount", "DESC")
        .addOrderBy("stats.likeCount", "DESC");
    } else {
      query = query.orderBy("article.pubDate", "DESC");
    }

    const articles = await query.take(limit).getMany();
    const items = await Promise.all(articles.map(mapArticle));

    res.json({ items });
  } catch (e: any) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "FEED_FAILED" });
  }
});

/**
 * GET /api/search
 * ?q=검색어
 * ?sort=latest|views
 * ?limit=60
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const sort = String(req.query.sort || "latest");

    if (!q) return res.json({ items: [] });

    let query = newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats")
      .where("article.title ILIKE :q OR article.content ILIKE :q OR article.aiSummary ILIKE :q",
        { q: `%${q}%` });

    // 정렬
    if (sort === "views") {
      query = query.orderBy("stats.viewCount", "DESC");
    } else {
      query = query.orderBy("article.pubDate", "DESC");
    }

    const articles = await query.take(limit).getMany();
    const items = await Promise.all(articles.map(mapArticle));

    res.json({ items });
  } catch (e: any) {
    console.error("SEARCH_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "SEARCH_FAILED" });
  }
});

/**
 * GET /api/news/trending
 * 인기 뉴스 조회
 */
router.get("/trending", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    // 7일 이내 뉴스 중 인기순
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const articles = await newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats")
      .where("article.pubDate > :date", { date: sevenDaysAgo })
      .orderBy("stats.viewCount", "DESC")
      .addOrderBy("stats.likeCount", "DESC")
      .take(limit)
      .getMany();

    const items = await Promise.all(articles.map(mapArticle));
    res.json({ items });
  } catch (e: any) {
    console.error("TRENDING_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "TRENDING_FAILED" });
  }
});

/**
 * GET /api/news/:id
 * 뉴스 상세 조회
 */
router.get("/news/:id", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);
    const statRepo = AppDataSource.getRepository(ArticleStat);

    const id = Number(req.params.id);
    const article = await newsRepo.findOne({
      where: { id },
      relations: ["source", "category", "stats", "newsKeywords", "newsKeywords.keyword"]
    });

    if (!article) return res.status(404).json({ error: "NOT_FOUND" });

    // 조회수 증가 (stats 테이블에)
    let stats = await statRepo.findOne({ where: { articleId: id } });
    if (!stats) {
      stats = statRepo.create({ articleId: id, viewCount: 1 });
    } else {
      stats.viewCount++;
    }
    await statRepo.save(stats);

    const result = await mapArticle(article);

    // 키워드 추가
    if (article.newsKeywords) {
      result.keywords = article.newsKeywords.map(nk => ({
        keyword: nk.keyword?.keyword,
        relevance: nk.relevance
      }));
    }

    res.json(result);
  } catch (e: any) {
    console.error("DETAIL_ERROR:", e);
    res.status(500).json({ error: e?.message || "DETAIL_FAILED" });
  }
});

export default router;