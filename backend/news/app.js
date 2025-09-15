// backend/news/app.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');

const app = express();

// CORS (개발 편의)
const allowed = [config.ALLOW_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
  credentials: true,
}));
app.use(express.json());

// 유틸
const clean = (s = '') =>
  s.replace(/<\/?b>/g, '')
   .replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'")
   .replace(/&amp;/g, '&')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>');

const hoursAgo = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 3_600_000));
};
const prettyTime = (h) => (h == null ? '' : h === 0 ? '방금' : `${h}시간 전`);
const hostnameOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// ─────────────────────────────────────────────
// 1) 뉴스 검색 프록시
// ─────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  const { query = '정치', display = 12, start = 1, sort = 'date' } = req.query;

  try {
    const { data } = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: { query, display, start, sort }, // display<=100, start<=1000
      headers: {
        'X-Naver-Client-Id': config.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': config.NAVER_CLIENT_SECRET,
      },
      timeout: 10_000,
    });

    const items = (data.items || []).map((it, idx) => {
      const title = clean(it.title);
      const summary = clean(it.description);
      const origin = it.originallink || it.link;
      const h = hoursAgo(it.pubDate);
      const host = hostnameOf(origin || it.link);

      return {
        id: it.link || String(idx),
        title,
        summary,
        source: host,
        agency: host,
        category: '뉴스',
        views: '',
        timeValue: h,
        time: prettyTime(h),
        url: it.link,
        origin_url: origin,
      };
    });

    res.json({ items });
  } catch (e) {
    console.error('[Naver API error]', e?.response?.status, e?.message);
    res.status(500).json({ error: '네이버 뉴스 API 호출 실패' });
  }
});

// ─────────────────────────────────────────────
// 2) 썸네일/동영상 추출 API (og:image / og:video)
// ─────────────────────────────────────────────

// 간단 TTL 캐시(30분)
const MEDIA_TTL_MS = 30 * 60 * 1000;
const mediaCache = new Map(); // url -> { ts, data }

app.get('/api/media', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url 쿼리 필요' });

  // 캐시 조회
  const cached = mediaCache.get(url);
  if (cached && Date.now() - cached.ts < MEDIA_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const resp = await axios.get(url, {
      timeout: 10_000,
      maxRedirects: 5,
      headers: {
        // 일부 사이트가 UA 없으면 차단하는 경우가 있어 브라우저 UA 흉내
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        'Accept-Language': 'ko,en;q=0.9',
      },
      // referrer는 서버 요청이라 크게 영향 없음
      validateStatus: s => s >= 200 && s < 400, // 3xx도 통과(리디렉션 후 body 없는 경우도 있음)
    });

    const $ = cheerio.load(resp.data || '');

    const pick = (...pairs) => {
      for (const [k, v] of pairs) {
        const el = $(`meta[${k}="${v}"]`);
        const content = el.attr('content');
        if (content) return content;
      }
      return null;
    };

    const image_url =
      pick(['property', 'og:image'], ['name', 'twitter:image'], ['name', 'twitter:image:src']) || null;

    const video_url =
      pick(['property', 'og:video'], ['name', 'twitter:player'], ['name', 'twitter:player:stream']) || null;

    const data = { image_url, video_url };
    mediaCache.set(url, { ts: Date.now(), data });

    return res.json(data);
  } catch (e) {
    console.warn('[MEDIA] fail', e?.message);
    return res.json({ image_url: null, video_url: null, error: e?.message });
  }
});

// 헬스체크
app.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = app;
