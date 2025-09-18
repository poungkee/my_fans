import { Router } from "express";

const router = Router();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* ───────────── 공통 유틸 ───────────── */

function toNumber(numText: string | null | undefined): number | null {
  if (!numText) return null;
  const s = String(numText).replace(/[,\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.text();
}

/* ───────────── KOSPI (네이버 금융) ─────────────
   후보 URL:
   - https://finance.naver.com/sise/sise_index.naver?code=KOSPI
   - https://finance.naver.com/sise/ (메인 페이지)
*/
async function getKospi(): Promise<number | null> {
  const urls = [
    "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
    "https://finance.naver.com/sise/",
  ];
  const valueRegexes = [
    /id=["']now_value["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i,      // id=now_value
    /class=["']num["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i,         // <span class="num">
    /["']now_value["'][^>]*>\s*<span[^>]*>\s*([0-9,\.]+)/i,  // nested span
  ];

  for (const u of urls) {
    try {
      const html = await fetchText(u);
      for (const rx of valueRegexes) {
        const m = html.match(rx);
        const v = toNumber(m?.[1]);
        if (v != null) return v;
      }
    } catch {
      // try next
    }
  }
  return null;
}

/* ───────────── NASDAQ (네이버 세계지수) ─────────────
   후보 URL:
   - https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC
   - https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC&fdtc=2
*/
async function getNasdaq(): Promise<number | null> {
  const urls = [
    "https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC",
    "https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC&fdtc=2",
  ];
  const valueRegexes = [
    /id=["']now_value["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i,
    /class=["']num["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i,
  ];

  for (const u of urls) {
    try {
      const html = await fetchText(u);
      for (const rx of valueRegexes) {
        const m = html.match(rx);
        const v = toNumber(m?.[1]);
        if (v != null) return v;
      }
    } catch {
      // next
    }
  }
  return null;
}

/* ───────────── USD/KRW (open.er-api.com) ───────────── */
async function getUsdKrw(): Promise<number | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`er-api HTTP ${r.status}`);
    const j: any = await r.json();
    const v = j?.rates?.KRW;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/* ───────────── BTC/USD (Binance) ───────────── */
async function getBtcUsd(): Promise<number | null> {
  try {
    const r = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      { headers: { "User-Agent": UA, Accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`binance HTTP ${r.status}`);
    const j: any = await r.json();
    const p = Number(j?.price);
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

/* ───────────── 라우트 ───────────── */

router.get("/summary", async (_req, res) => {
  try {
    const [kospi, nasdaq, usdkrw, btc] = await Promise.all([
      getKospi(),
      getNasdaq(),
      getUsdKrw(),
      getBtcUsd(),
    ]);

    res.json({
      ok: true,
      items: [
        {
          symbol: "^KS11",
          name: "KOSPI",
          price: kospi,
          change: null,
          changePercent: null,
          currency: "KRW",
        },
        {
          symbol: "^IXIC",
          name: "NASDAQ",
          price: nasdaq,
          change: null,
          changePercent: null,
          currency: "USD",
        },
        {
          symbol: "USD/KRW",
          name: "USD/KRW",
          price: usdkrw,
          change: null,
          changePercent: null,
          currency: "KRW",
        },
        {
          symbol: "BTC-USD",
          name: "Bitcoin (USD)",
          price: btc,
          change: null,
          changePercent: null,
          currency: "USD",
        },
      ],
      updatedAt: new Date().toISOString(),
      source: "naver finance + er-api + binance",
    });
  } catch (e: any) {
    res.status(200).json({
      ok: false,
      items: [],
      error: e?.message || "FATAL",
      updatedAt: new Date().toISOString(),
    });
  }
});

export default router;
