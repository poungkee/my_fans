// backend/news/app.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');

const app = express();

/* CORS (개발 편의: localhost 허용) */
const allowed = [config.ALLOW_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
  credentials: true,
}));
app.use(express.json());

/* ───────────── 유틸 ───────────── */
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

const mapItem = (it, idx, topicLabel) => {
  const title = clean(it.title);
  const summary = clean(it.description);
  const origin = it.originallink || it.link;
  const h = hoursAgo(it.pubDate);
  const host = hostnameOf(origin || it.link);

  return {
    id: it.link || String(idx),
    title,
    summary,
    source: host,            // 표시용
    agency: host,            // 필터용
    category: topicLabel || '뉴스',
    views: '',               // (나중에 내부 메트릭 연결)
    timeValue: h,            // 정렬용 숫자
    time: prettyTime(h),
    url: it.link,            // 네이버 링크
    origin_url: origin,      // 원문 링크
    pubDate: it.pubDate,
  };
};

/* ───────────── 확장 가능한 랭커(자리만들기) ─────────────
   - popular, views 정렬은 지금은 메트릭이 없어 원본순/최신순을 사용
   - 추후 DB(views_count, likes_count) 붙이면 여기서 재정렬하면 됨
*/
function reRank(items, { sort }) {
  if (sort === 'popular') {
    // TODO: 인기 점수(좋아요/스크랩/댓글 등) 기준 재정렬
    return items; // placeholder
  }
  if (sort === 'views') {
    // TODO: 조회수 기준 재정렬
    return items; // placeholder
  }
  return items;
}

/* ─────────────────────────────────────────────
   1) 홈 피드: 여러 주제 묶어서 최신순으로 반환
     - 검색 전 화면에서 사용
     - /api/feed?topics=정치,경제,사회,세계,IT/과학,생활/문화&limit=60&sort=latest
     - personalize=1&userId=... 추가하면 추후 개인화 랭킹 훅 연결 예정
   ───────────────────────────────────────────── */
app.get('/api/feed', async (req, res) => {
  const {
    topics,                              // 콤마분리 주제
    limit = 60,                          // 최종 아이템 수
    perTopic,                            // 주제당 가져올 수
    sort = 'latest',                     // latest | related(실제론 latest와 동일 처리)
    personalize, userId,                 // 자리만들기(추후 확장)
  } = req.query;

  const defaultTopics = ['정치', '경제', '사회', '세계', 'IT/과학', '생활/문화'];
  const topicList = (topics ? String(topics).split(',') : defaultTopics)
    .map(s => s.trim())
    .filter(Boolean);

  const per = Math.min(Number(perTopic) || Math.ceil(Number(limit) / Math.max(topicList.length, 1)), 100);

  try {
    const results = await Promise.all(
      topicList.map(async (t) => {
        const { data } = await axios.get('https://openapi.naver.com/v1/search/news.json', {
          params: { query: t, display: per, start: 1, sort: 'date' }, // 피드는 최신 중심
          headers: {
            'X-Naver-Client-Id': config.NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': config.NAVER_CLIENT_SECRET,
          },
          timeout: 10_000,
        });
        return (data.items || []).map((it, idx) => mapItem(it, idx, t));
      })
    );

    // 합치기 + 중복 제거(원문/링크 기준)
    const flat = results.flat();
    const seen = new Set();
    const deduped = flat.filter(it => {
      const key = it.origin_url || it.url || it.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 최신순 정렬
    deduped.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // 개인화 자리(추후 확장: userId로 선호 카테고리 가중치 주기)
    let items = deduped.slice(0, Number(limit) || 60);
    if (personalize && userId) {
      // TODO: userId 기반 선호도 가중치 재정렬
      items = items; // placeholder
    }

    // 정렬 스위치(현재 latest 위주)
    if (sort === 'related') {
      // TODO: 관련도 기준(키워드 유사도) 정렬
    }

    res.json({ mode: 'feed', topics: topicList, items });
  } catch (e) {
    console.error('[Feed error]', e?.response?.status, e?.message);
    res.status(500).json({ error: '피드 생성 실패' });
  }
});

/* ─────────────────────────────────────────────
   2) 검색: 키워드별 + 정렬
     - /api/search?q=키워드&sort=latest|related|popular|views&limit=60&start=1
     - latest  → Naver 'date'
     - related → Naver 'sim'
     - popular/views → 내부 메트릭 필요(지금은 date로 가져온 뒤 reRank 자리만들기)
   ───────────────────────────────────────────── */
app.get('/api/search', async (req, res) => {
  const {
    q,                                   // 검색 키워드
    sort = 'latest',                     // latest | related | popular | views
    limit = 60,
    start = 1,
  } = req.query;

  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'q(검색어) 파라미터가 필요합니다.' });
  }

  // 네이버 정렬로 매핑
  const naverSort = sort === 'related' ? 'sim' : 'date';

  try {
    const disp = Math.min(Number(limit) || 60, 100); // 네이버 최대 100
    const { data } = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: { query: q, display: disp, start, sort: naverSort },
      headers: {
        'X-Naver-Client-Id': config.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': config.NAVER_CLIENT_SECRET,
      },
      timeout: 10_000,
    });

    let items = (data.items || []).map((it, idx) => mapItem(it, idx, '뉴스'));

    // 인기/조회 정렬은 자리만들기(추후 DB 메트릭으로 재정렬)
    items = reRank(items, { sort });

    res.json({ mode: 'search', q, sort, items, start: Number(start), limit: Number(limit) });
  } catch (e) {
    console.error('[Search error]', e?.response?.status, e?.message);
    res.status(500).json({ error: '검색 실패' });
  }
});

/* ─────────────────────────────────────────────
   3) 썸네일/동영상 추출: og:image / twitter:image / og:video
   ───────────────────────────────────────────── */
const MEDIA_TTL_MS = 30 * 60 * 1000;
const mediaCache = new Map();

app.get('/api/media', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url 쿼리 필요' });

  const cached = mediaCache.get(url);
  if (cached && Date.now() - cached.ts < MEDIA_TTL_MS) return res.json(cached.data);

  try {
    const resp = await axios.get(url, {
      timeout: 10_000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        'Accept-Language': 'ko,en;q=0.9',
      },
      validateStatus: s => s >= 200 && s < 400,
    });

    const $ = cheerio.load(resp.data || '');
    const pick = (...pairs) => {
      for (const [k, v] of pairs) {
        const el = $(`meta[${k}="${v}"]`);
        const c = el.attr('content');
        if (c) return c;
      }
      return null;
    };

    const image_url = pick(['property','og:image'], ['name','twitter:image'], ['name','twitter:image:src']);
    const video_url = pick(['property','og:video'], ['name','twitter:player'], ['name','twitter:player:stream']);

    const data = { image_url: image_url || null, video_url: video_url || null };
    mediaCache.set(url, { ts: Date.now(), data });
    res.json(data);
  } catch (e) {
    console.warn('[MEDIA] fail', e?.message);
    res.json({ image_url: null, video_url: null, error: e?.message });
  }
});

/* 헬스체크 */
app.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = app;
