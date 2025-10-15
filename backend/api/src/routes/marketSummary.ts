import { Router } from "express";
import { marketSummaryService } from '../services/marketSummaryService';

const router = Router();

router.get("/summary", async (_req, res) => {
  try {
    const marketData = await marketSummaryService.getMarketSummary();

    res.json({
      ok: true,
      items: marketData.map(data => ({
        marketType: data.marketType,
        name: data.name,
        currentValue: Number(data.currentValue),
        changeValue: Number(data.changeValue),
        changePercent: Number(data.changePercent),
        updatedAt: data.updatedAt
      })),
      updatedAt: new Date().toISOString(),
      source: "database + live feeds",
    });
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      items: [],
      error: e?.message || "FATAL",
      updatedAt: new Date().toISOString(),
    });
  }
});

export default router;
