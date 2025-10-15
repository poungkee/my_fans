import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { MarketSummary } from '../entities/MarketSummary';

interface MarketData {
  value: number;
  change: number;
  changePercent: number;
}

export class MarketSummaryService {
  private marketSummaryRepository: Repository<MarketSummary>;
  private readonly UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5분

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

  // 네이버 지수 (KOSPI, NASDAQ)
  private async getNaverIndex(url: string): Promise<MarketData | null> {
    try {
      const html = await this.fetchText(url);

      const valueMatch = html.match(/id=["']now_value["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i);
      const value = this.toNumber(valueMatch?.[1]);

      const changeMatch = html.match(/class=["']change["'][^>]*>\s*([0-9,]+\.?[0-9]*)/i);
      const change = this.toNumber(changeMatch?.[1]) ?? 0;

      const changePercentMatch = html.match(/class=["']rate["'][^>]*>\s*([+-]?[0-9,]+\.?[0-9]*)%?/i);
      const changePercent = this.toNumber(changePercentMatch?.[1]) ?? 0;

      if (value != null) {
        return { value, change, changePercent };
      }
    } catch (error) {
      // fallback
    }
    return null;
  }

  // 네이버 환율 (한 페이지에서 4개 모두 가져오기)
  private async getNaverExchangeRates(): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();

    try {
      const html = await this.fetchText("https://finance.naver.com/marketindex/");

      // USD/KRW
      const usdMatch = html.match(/href="[^"]*FX_USDKRW[^"]*"[^>]*>[\s\S]*?<span class="value">([0-9,\.]+)<\/span>[\s\S]*?<span class="change">\s*([0-9,\.]+)/i);
      if (usdMatch) {
        const value = this.toNumber(usdMatch[1]);
        const change = this.toNumber(usdMatch[2]);
        if (value != null && change != null) {
          const changePercent = (change / (value - change)) * 100;
          results.set('USD/KRW', { value, change, changePercent });
        }
      }

      // EUR/KRW
      const eurMatch = html.match(/href="[^"]*FX_EURKRW[^"]*"[^>]*>[\s\S]*?<span class="value">([0-9,\.]+)<\/span>[\s\S]*?<span class="change">\s*([0-9,\.]+)/i);
      if (eurMatch) {
        const value = this.toNumber(eurMatch[1]);
        const change = this.toNumber(eurMatch[2]);
        if (value != null && change != null) {
          const changePercent = (change / (value - change)) * 100;
          results.set('EUR/KRW', { value, change, changePercent });
        }
      }

      // JPY/KRW (100엔당)
      const jpyMatch = html.match(/href="[^"]*FX_JPYKRW[^"]*"[^>]*>[\s\S]*?<span class="value">([0-9,\.]+)<\/span>[\s\S]*?<span class="change">\s*([0-9,\.]+)/i);
      if (jpyMatch) {
        const value = this.toNumber(jpyMatch[1]);
        const change = this.toNumber(jpyMatch[2]);
        if (value != null && change != null) {
          const changePercent = (change / (value - change)) * 100;
          results.set('JPY/KRW', { value, change, changePercent });
        }
      }

      // CNY/KRW
      const cnyMatch = html.match(/href="[^"]*FX_CNYKRW[^"]*"[^>]*>[\s\S]*?<span class="value">([0-9,\.]+)<\/span>[\s\S]*?<span class="change">\s*([0-9,\.]+)/i);
      if (cnyMatch) {
        const value = this.toNumber(cnyMatch[1]);
        const change = this.toNumber(cnyMatch[2]);
        if (value != null && change != null) {
          const changePercent = (change / (value - change)) * 100;
          results.set('CNY/KRW', { value, change, changePercent });
        }
      }
    } catch (error) {
      // fallback
    }

    return results;
  }

  // Binance 코인 (BTC, ETH, DOGE)
  private async getCryptoFromBinance(symbol: string): Promise<MarketData | null> {
    try {
      const r = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`,
        { headers: { "User-Agent": this.UA, Accept: "application/json" } }
      );
      if (!r.ok) throw new Error(`binance HTTP ${r.status}`);
      const j: any = await r.json();

      const value = Number(j?.lastPrice);
      const changePercent = Number(j?.priceChangePercent);
      const change = Number(j?.priceChange);

      if (Number.isFinite(value) && Number.isFinite(changePercent)) {
        return { value, change: change ?? 0, changePercent };
      }
    } catch {
      return null;
    }
    return null;
  }

  // Yahoo Finance API (NASDAQ, US stocks, KR stocks)
  private async getYahooFinance(symbol: string): Promise<MarketData | null> {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        { headers: { "User-Agent": this.UA, Accept: "application/json" } }
      );
      if (!r.ok) throw new Error(`yahoo HTTP ${r.status}`);
      const data: any = await r.json();

      const quote = data?.chart?.result?.[0]?.meta;
      if (quote && quote.regularMarketPrice && quote.previousClose) {
        const value = Number(quote.regularMarketPrice);
        const previousClose = Number(quote.previousClose);
        const change = value - previousClose;
        const changePercent = (change / previousClose) * 100;

        if (Number.isFinite(value)) {
          return { value, change, changePercent };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  async updateMarketData(): Promise<void> {
    // 모든 데이터 병렬로 가져오기
    const [
      kospi,
      nasdaq,
      exchangeRates,
      btc,
      eth,
      doge,
      tsla,
      aapl,
      msft,
      samsung,
      skhynix,
      naver
    ] = await Promise.all([
      this.getNaverIndex("https://finance.naver.com/sise/sise_index.naver?code=KOSPI"),
      this.getYahooFinance("^IXIC"), // NASDAQ
      this.getNaverExchangeRates(),
      this.getCryptoFromBinance("BTC"),
      this.getCryptoFromBinance("ETH"),
      this.getCryptoFromBinance("DOGE"),
      this.getYahooFinance("TSLA"),
      this.getYahooFinance("AAPL"),
      this.getYahooFinance("MSFT"),
      this.getYahooFinance("005930.KS"), // 삼성전자
      this.getYahooFinance("000660.KS"), // SK하이닉스
      this.getYahooFinance("035420.KS")  // 네이버
    ]);

    // 저장할 데이터 배열
    const marketData: Array<{ marketType: string; name: string; data: MarketData | null; symbol?: string; }> = [
      // 지수
      { marketType: "INDEX", name: "KOSPI", data: kospi },
      { marketType: "INDEX", name: "NASDAQ", data: nasdaq },

      // 환율
      { marketType: "FX", name: "USD/KRW", data: exchangeRates.get('USD/KRW') || null, symbol: "원" },
      { marketType: "FX", name: "EUR/KRW", data: exchangeRates.get('EUR/KRW') || null, symbol: "원" },
      { marketType: "FX", name: "JPY/KRW", data: exchangeRates.get('JPY/KRW') || null, symbol: "원/100엔" },
      { marketType: "FX", name: "CNY/KRW", data: exchangeRates.get('CNY/KRW') || null, symbol: "원" },

      // 코인
      { marketType: "CRYPTO", name: "Bitcoin", data: btc, symbol: "USD" },
      { marketType: "CRYPTO", name: "Ethereum", data: eth, symbol: "USD" },
      { marketType: "CRYPTO", name: "Dogecoin", data: doge, symbol: "USD" },

      // 해외주식
      { marketType: "US_STOCK", name: "Tesla", data: tsla, symbol: "USD" },
      { marketType: "US_STOCK", name: "Apple", data: aapl, symbol: "USD" },
      { marketType: "US_STOCK", name: "Microsoft", data: msft, symbol: "USD" },

      // 국내주식
      { marketType: "KR_STOCK", name: "삼성전자", data: samsung, symbol: "원" },
      { marketType: "KR_STOCK", name: "SK하이닉스", data: skhynix, symbol: "원" },
      { marketType: "KR_STOCK", name: "NAVER", data: naver, symbol: "원" },
    ];

    // DB에 저장
    for (const item of marketData) {
      if (item.data != null) {
        const existing = await this.marketSummaryRepository.findOne({
          where: { marketType: item.marketType, name: item.name }
        });

        if (existing) {
          existing.currentValue = item.data.value;
          existing.changeValue = item.data.change;
          existing.changePercent = item.data.changePercent;
          existing.updatedAt = new Date();
          await this.marketSummaryRepository.save(existing);
        } else {
          const newEntry = this.marketSummaryRepository.create({
            marketType: item.marketType,
            name: item.name,
            currentValue: item.data.value,
            changeValue: item.data.change,
            changePercent: item.data.changePercent,
          });
          await this.marketSummaryRepository.save(newEntry);
        }
      }
    }
  }

  async getMarketSummary() {
    const marketData = await this.marketSummaryRepository.find({
      order: { updatedAt: 'DESC' }
    });

    // 데이터가 없거나, 가장 최근 데이터가 5분 이상 오래되었으면 업데이트
    const shouldUpdate =
      marketData.length === 0 ||
      (marketData[0]?.updatedAt &&
       (Date.now() - new Date(marketData[0].updatedAt).getTime()) > this.CACHE_DURATION_MS);

    if (shouldUpdate) {
      await this.updateMarketData();
      return await this.marketSummaryRepository.find({
        order: { updatedAt: 'DESC' }
      });
    }

    return marketData;
  }
}

export const marketSummaryService = new MarketSummaryService();
