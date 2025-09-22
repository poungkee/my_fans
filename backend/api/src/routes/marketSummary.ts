import { Router } from "express";
import { marketSummaryService } from '../services/marketSummaryService';

const router = Router();

router.get("/summary", async (_req, res) => {
  try {
    const marketData = await marketSummaryService.getMarketSummary();

    res.json({
      ok: true,
      items: marketData.map(data => ({
        symbol: data.symbol,
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        currency: data.currency,
        market: data.market
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
