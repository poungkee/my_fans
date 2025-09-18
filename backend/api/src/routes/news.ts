import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { NewsArticle } from "../entities/NewsArticle";
import { ILike } from "typeorm";

const router = Router();

/** 응답 형태로 매핑 */
function mapArticle(a: NewsArticle) {
  // 요약: AI 요약 → 짧은 요약 → 본문 앞부분
  const fallbackSummary =
    (a.content || "").replace(/\s+/g, " ").slice(0, 160) +
    ((a.content || "").length > 160 ? "…" : "");

  // 카테고리 ID를 이름으로 매핑
  const categoryIdToName: { [key: number]: string } = {
    1: '정치', 2: '경제', 3: '사회', 4: '연예',
    5: '생활/문화', 6: 'IT/과학', 7: '세계', 8: '스포츠'
  };

  return {
    id: a.id,
    title: a.title,
    url: a.url,
    origin_url: a.origin_url || a.url,
    image_url: a.image_url || null,
    video_url: a.video_url || null,

    // 카드에서 쓰는 요약 필드들
    ai_summary: a.ai_summary || null,
    short_ai_summary: a.short_ai_summary || null,
    summary: a.short_ai_summary || a.ai_summary || a.summary || fallbackSummary,

    // 메타 (단순화된 문자열)
    source: null,
    category: categoryIdToName[a.category_id] || null,
    pub_date: a.pub_date,
    time: a.pub_date,
  };
}

/**
 * GET /api/feed
 * ?topics=정치,경제,사회,세계,IT/과학,생활/문화
 * ?limit=60
 * ?sort=latest|popular (지금은 latest만 사용)
 */
router.get("/feed", async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(NewsArticle);

    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const topicsRaw = String(req.query.topics || "");
    const topics =
      topicsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) || [];

    // 카테고리 이름을 ID로 매핑
    const categoryNameToId: { [key: string]: number } = {
      '정치': 1, '경제': 2, '사회': 3, '연예': 4,
      '생활/문화': 5, 'IT/과학': 6, '세계': 7, '스포츠': 8
    };

    // 최신순
    // 카테고리 필터가 있으면 where 에 포함
    const where = topics.length
      ? topics
          .map((t) => categoryNameToId[t])
          .filter(id => id !== undefined)
          .map((category_id) => ({ category_id }))
      : {};

    const list = await repo.find({
      where,
      order: { pub_date: "DESC" },
      take: limit,
    });

    res.json({ items: list.map(mapArticle) });
  } catch (e: any) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "FEED_FAILED" });
  }
});

/**
 * GET /api/search
 * ?q=검색어
 * ?sort=latest|views (기본 latest)
 * ?limit=60
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(NewsArticle);

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const sort = String(req.query.sort || "latest");

    if (!q) return res.json({ items: [] });

    const order = { pub_date: "DESC" as const };

    const list = await repo.find({
      where: [
        { title: ILike(`%${q}%`) },
        { content: ILike(`%${q}%`) },
      ],
      order,
      take: limit,
    });

    res.json({ items: list.map(mapArticle) });
  } catch (e: any) {
    console.error("SEARCH_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "SEARCH_FAILED" });
  }
});

/** 상세 */
router.get("/news/:id", async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(NewsArticle);
    const id = Number(req.params.id);
    const row = await repo.findOne({
      where: { id },
    });
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(mapArticle(row));
  } catch (e: any) {
    console.error("DETAIL_ERROR:", e);
    res.status(500).json({ error: e?.message || "DETAIL_FAILED" });
  }
});

export default router;
