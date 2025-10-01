import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { MarketSummary } from '../entities/MarketSummary';

export class MarketSummaryService {
  private marketSummaryRepository: Repository<MarketSummary>;
  private readonly UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  constructor() {
    this.marketSummaryRepository = AppDataSource.getRepository(MarketSummary);
  }

  private toNumber(numText: string | null | undefined): number | null {
    if (!numText) return null;
    const s = String(numText).replace(/[,\s]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private async fetchText(url: string): Promise<string> {
    const r = await fetch(url, {
      headers: { "User-Agent": this.UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  }

  private async getKospi(): Promise<number | null> {
    const urls = [
      "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
      "https://finance.naver.com/sise/",
    ];
    const valueRegexes = [
      /id=["']now_value["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i,
      /class=["']num["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i,
      /["']now_value["'][^>]*>\s*<span[^>]*>\s*([0-9,\.]+)/i,
    ];

    for (const u of urls) {
      try {
        const html = await this.fetchText(u);
        for (const rx of valueRegexes) {
          const m = html.match(rx);
          const v = this.toNumber(m?.[1]);
          if (v != null) return v;
        }
      } catch {
        // try next
      }
    }
    return null;
  }

  private async getNasdaq(): Promise<number | null> {
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
        const html = await this.fetchText(u);
        for (const rx of valueRegexes) {
          const m = html.match(rx);
          const v = this.toNumber(m?.[1]);
          if (v != null) return v;
        }
      } catch {
        // next
      }
    }
    return null;
  }

  private async getUsdKrw(): Promise<number | null> {
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", {
        headers: { "User-Agent": this.UA, Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`er-api HTTP ${r.status}`);
      const j: any = await r.json();
      const v = j?.rates?.KRW;
      return typeof v === "number" ? v : null;
    } catch {
      return null;
    }
  }

  private async getBtcUsd(): Promise<number | null> {
    try {
      const r = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
        { headers: { "User-Agent": this.UA, Accept: "application/json" } }
      );
      if (!r.ok) throw new Error(`binance HTTP ${r.status}`);
      const j: any = await r.json();
      const p = Number(j?.price);
      return Number.isFinite(p) ? p : null;
    } catch {
      return null;
    }
  }

  async updateMarketData(): Promise<void> {
    const [kospi, nasdaq, usdkrw, btc] = await Promise.all([
      this.getKospi(),
      this.getNasdaq(),
      this.getUsdKrw(),
      this.getBtcUsd(),
    ]);

    const marketData = [
      {
        marketType: "KOSPI",
        name: "KOSPI",
        currentValue: kospi,
        changeValue: null,
        changePercent: null,
      },
      {
        marketType: "NASDAQ",
        name: "NASDAQ",
        currentValue: nasdaq,
        changeValue: null,
        changePercent: null,
      },
      {
        marketType: "FX",
        name: "USD/KRW",
        currentValue: usdkrw,
        changeValue: null,
        changePercent: null,
      },
      {
        marketType: "CRYPTO",
        name: "Bitcoin (USD)",
        currentValue: btc,
        changeValue: null,
        changePercent: null,
      },
    ];

    for (const data of marketData) {
      if (data.currentValue != null) {
        const existing = await this.marketSummaryRepository.findOne({
          where: { marketType: data.marketType, name: data.name }
        });

        if (existing) {
          existing.currentValue = data.currentValue;
          existing.changeValue = data.changeValue;
          existing.changePercent = data.changePercent;
          existing.updatedAt = new Date();
          await this.marketSummaryRepository.save(existing);
        } else {
          const newEntry = this.marketSummaryRepository.create(data);
          await this.marketSummaryRepository.save(newEntry);
        }
      }
    }
  }

  async getMarketSummary() {
    const marketData = await this.marketSummaryRepository.find({
      order: { updatedAt: 'DESC' }
    });

    if (marketData.length === 0) {
      await this.updateMarketData();
      return await this.marketSummaryRepository.find({
        order: { updatedAt: 'DESC' }
      });
    }

    return marketData;
  }
}

export const marketSummaryService = new MarketSummaryService();