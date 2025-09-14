# app/main.py
import os, re, html, time
from typing import Optional, Tuple, Dict, Any
from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from functools import lru_cache

# AI 모듈 import
try:
    from app.ai_module import ai_summarizer
except ImportError:
    # 개발 환경에서의 fallback
    ai_summarizer = None
    print("[WARNING] AI 모듈을 로드할 수 없습니다.")

# 데이터베이스 import
from app.database import get_db
from app.models import NewsArticle, Keyword, news_keywords_table
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from typing import List

# -----------------------------
# 환경 변수 로드 (.env)
# -----------------------------
load_dotenv()
NAVER_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_SECRET = os.getenv("NAVER_CLIENT_SECRET")
DEBUG = os.getenv("DEBUG", "1") == "1"

NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json"

if DEBUG:
    print("[BOOT] NAVER_ID loaded?", bool(NAVER_ID), "NAVER_SECRET loaded?", bool(NAVER_SECRET))

# -----------------------------
# FastAPI 앱 & CORS
# -----------------------------
app = FastAPI(title="News Backend (Naver Proxy)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요시 ["http://localhost:3000"] 등으로 제한
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# 유틸
# -----------------------------
TAG_RE = re.compile(r"</?b>")  # 네이버 응답의 <b> 태그 제거용

def clean(s: Optional[str]) -> Optional[str]:
    if not s:
        return s
    return html.unescape(TAG_RE.sub("", s))

def map_page(page: int, page_size: int) -> Tuple[int, int]:
    """
    네이버 제약: display ≤ 100, start ≤ 1000
    start = (page-1)*display + 1
    """
    page_size = max(1, min(page_size, 100))
    start = (max(1, page) - 1) * page_size + 1
    return start, page_size

# -----------------------------
# 루트/헬스/디버그
# -----------------------------
@app.get("/")
def root():
    return {"ok": True, "msg": "Backend is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

# Pydantic 모델 정의
class SummaryRequest(BaseModel):
    title: Optional[str] = None
    content: str
    max_length: Optional[int] = 100

@app.get("/debug/env")
def debug_env():
    # 키가 로딩되었는지 빠르게 확인
    return {"NAVER_ID": bool(NAVER_ID), "NAVER_SECRET": bool(NAVER_SECRET)}

# -----------------------------
# AI 요약 API
# -----------------------------
@app.post("/api/ai/summarize")
async def summarize_text(request: SummaryRequest):
    """텍스트 요약 API"""
    if ai_summarizer is None:
        raise HTTPException(status_code=503, detail="AI 모듈을 사용할 수 없습니다")

    try:
        result = ai_summarizer.summarize_news(
            title=request.title,
            content=request.content,
            max_length=request.max_length
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요약 생성 실패: {str(e)}")

@app.get("/api/ai/health")
async def ai_health():
    """AI 모델 상태 확인"""
    if ai_summarizer is None:
        return {"model_loaded": False, "error": "AI module not available"}

    return {
        "model_loaded": ai_summarizer.summarizer is not None,
        "model_name": "eenzeenee/t5-base-korean-summarization" if ai_summarizer and ai_summarizer.summarizer else None
    }

# -----------------------------
# 뉴스 검색 프록시 (페이지네이션)
# -----------------------------
@app.get("/api/search")
async def search_news(
    q: str = Query("", min_length=0),  # 빈 문자열 허용 (최신 뉴스용)
    page: int = Query(1, ge=1, le=100),  # 페이지 제한 추가
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("date", pattern="^(date|sim|relevance)$"),  # 최신/정확도/관련도
    category: str = Query(None),  # 카테고리 필터
    db: Session = Depends(get_db)
):
    """데이터베이스 기반 뉴스 검색"""

    try:
        offset = (page - 1) * page_size

        # 기본 쿼리
        query = db.query(NewsArticle)

        # 키워드 검색 (빈 문자열이면 전체 뉴스)
        if q and q.strip():
            search_term = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    NewsArticle.title.ilike(search_term),
                    NewsArticle.summary.ilike(search_term),
                    NewsArticle.ai_summary.ilike(search_term),
                    NewsArticle.content.ilike(search_term)
                )
            )

        # 카테고리 필터
        if category:
            query = query.filter(NewsArticle.category == category)

        # 총 개수 구하기
        total = query.count()

        # 정렬
        if sort == "date":
            query = query.order_by(desc(NewsArticle.pub_date))
        elif sort == "sim":  # 정확도 (제목 매칭 우선)
            if q and q.strip():
                query = query.order_by(
                    NewsArticle.title.ilike(f"%{q.strip()}%").desc(),
                    desc(NewsArticle.pub_date)
                )
            else:
                query = query.order_by(desc(NewsArticle.pub_date))
        elif sort == "relevance":
            # AI 요약이 있는 것 우선, 최신순
            query = query.order_by(
                NewsArticle.ai_summary.is_(None),
                desc(NewsArticle.pub_date)
            )

        # 페이지네이션
        articles = query.offset(offset).limit(page_size).all()

        # 결과 변환 (키워드 배치로 가져와서 성능 최적화)
        article_ids = [article.id for article in articles]

        # 모든 기사의 키워드를 한 번에 가져오기
        keywords_query = db.query(
            news_keywords_table.c.news_id,
            Keyword.keyword
        ).join(
            Keyword,
            Keyword.id == news_keywords_table.c.keyword_id
        ).filter(
            news_keywords_table.c.news_id.in_(article_ids)
        ).all()

        # 기사별 키워드 그룹핑
        keywords_by_article = {}
        for news_id, keyword in keywords_query:
            if news_id not in keywords_by_article:
                keywords_by_article[news_id] = []
            if len(keywords_by_article[news_id]) < 5:  # 최대 5개
                keywords_by_article[news_id].append(keyword)

        items = []
        for article in articles:
            keyword_list = keywords_by_article.get(article.id, [])

            # 미디어 URL 처리
            media_urls = article.media_urls if article.media_urls else {"images": [], "videos": []}

            item = {
                "id": str(article.id),
                "title": article.title,
                "url": article.url,
                "origin_url": article.origin_url,
                "summary": article.summary,
                "ai_summary": article.ai_summary,
                "short_ai_summary": article.short_ai_summary,
                "pub_date": article.pub_date.isoformat() if article.pub_date else None,
                "source": article.source,
                "category": article.category,
                "keywords": keyword_list,
                "media_urls": media_urls,
                "created_at": article.created_at.isoformat() if article.created_at else None
            }
            items.append(item)

        # 다음 페이지 여부
        has_next = offset + len(items) < total

        if DEBUG:
            print(f"[DB SEARCH] 키워드='{q}', 카테고리={category}, 정렬={sort}")
            print(f"[DB SEARCH] 총 {total}개 중 {len(items)}개 반환 (페이지 {page})")

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_next": has_next,
            "source": "database",  # DB에서 가져온 것임을 표시
            "search_query": q if q.strip() else None
        }

    except Exception as e:
        print(f"[DB ERROR] {e}")
        raise HTTPException(status_code=500, detail="데이터베이스 조회 실패")

# 최신 뉴스 전용 엔드포인트
@app.get("/api/latest")
async def get_latest_news(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str = Query(None),  # 카테고리 필터
    db: Session = Depends(get_db)
):
    """최신 뉴스 조회 (검색어 없이)"""
    return await search_news(
        q="",  # 빈 검색어로 전체 뉴스
        page=page,
        page_size=page_size,
        sort="date",  # 최신순 고정
        category=category,
        db=db
    )

# -----------------------------
# 원문 페이지에서 미디어(og:image / og:video) 추출
# -----------------------------
_MEDIA_CACHE: Dict[str, Dict[str, Any]] = {}  # 간단 in-memory 캐시
_MEDIA_TTL = 60 * 30  # 30분

def _cache_get(url: str) -> Optional[Dict[str, Any]]:
    doc = _MEDIA_CACHE.get(url)
    if not doc:
        return None
    if time.time() - doc["ts"] > _MEDIA_TTL:
        _MEDIA_CACHE.pop(url, None)
        return None
    return doc["data"]

def _cache_set(url: str, data: Dict[str, Any]):
    _MEDIA_CACHE[url] = {"ts": time.time(), "data": data}

@app.get("/api/media")
async def extract_media(url: str):
    """
    기사 원문 URL에서 Open Graph 메타 태그로 이미지/동영상을 추출
    - image: og:image, twitter:image
    - video: og:video, twitter:player, twitter:player:stream
    """
    if cached := _cache_get(url):
        return cached
    try:
        async with httpx.AsyncClient(
            timeout=10,
            headers={"User-Agent": "NewsBoard/1.0 (+https://example.local)"}
        ) as client:
            resp = await client.get(url, follow_redirects=True)
        html_text = resp.text
        soup = BeautifulSoup(html_text, "html.parser")

        def meta(*pairs):
            for (k, v) in pairs:
                tag = soup.find("meta", {k: v})
                if tag and tag.get("content"):
                    return tag["content"]
            return None

        image_url = meta(("property", "og:image"), ("name", "twitter:image"))
        video_url = meta(("property", "og:video"),
                         ("name", "twitter:player"),
                         ("name", "twitter:player:stream"))

        out = {"image_url": image_url, "video_url": video_url}
        _cache_set(url, out)
        return out
    except Exception as e:
        if DEBUG:
            print("[MEDIA] error:", e)
        return {"image_url": None, "video_url": None, "error": str(e)}

# -----------------------------
# 게시판 형태의 간단한 HTML UI
# -----------------------------
@app.get("/board", response_class=HTMLResponse)
def board():
    return """
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>뉴스 게시판</title>
<style>
  body{font-family:system-ui,apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:960px;margin:24px auto;padding:0 12px;}
  header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;}
  input,select,button{padding:8px;border:1px solid #ddd;border-radius:8px;}
  button{background:#111;color:#fff;cursor:pointer}
  ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px;}
  .item{border:1px solid #eee;border-radius:12px;padding:12px;display:grid;grid-template-columns:160px 1fr;gap:12px;align-items:start;}
  .thumb{width:100%;aspect-ratio:16/9;background:#f3f4f6;border-radius:8px;object-fit:cover}
  .video{width:100%;border:0;border-radius:8px;aspect-ratio:16/9}
  .meta{font-size:12px;color:#666;margin-top:4px}
  .title{font-weight:600;margin:0 0 6px 0;line-height:1.3}
  .summary{color:#333;margin-top:6px}
  .no-media{grid-template-columns:1fr;}
  .pill{display:inline-block;background:#eef;border:1px solid #cfe;padding:2px 8px;border-radius:999px;font-size:12px;margin-left:6px;}
</style>
</head>
<body>
<header>
  <input id="q" placeholder="검색어 입력 (비워두면 최신 뉴스)" style="min-width:220px"/>
  <select id="sort">
    <option value="date" selected>최신순</option>
    <option value="sim">정확도순</option>
  </select>
  <select id="pageSize">
    <option>20</option><option>30</option><option>50</option><option>100</option>
  </select>
  <button id="searchBtn">검색</button>
  <span id="total" class="pill">total: -</span>
</header>

<ul id="list"></ul>

<div style="display:flex;justify-content:center;margin:18px 0">
  <button id="moreBtn" style="display:none">더 보기</button>
</div>

<script>
console.log("[BOARD] script loaded");

const $q = document.getElementById('q');
const $sort = document.getElementById('sort');
const $pageSize = document.getElementById('pageSize');
const $btn = document.getElementById('searchBtn');
const $list = document.getElementById('list');
const $more = document.getElementById('moreBtn');
const $total = document.getElementById('total');

let state = { page: 1, hasNext: false, q: '', sort: 'date', pageSize: 20 };

function qs(name, def){ const u=new URL(window.location.href); return u.searchParams.get(name) || def; }
function setQS(p){
  const u=new URL(window.location.href);
  for (const [k,v] of Object.entries(p)) u.searchParams.set(k, v);
  history.replaceState(null,'',u.toString());
}

async function fetchPage(reset=false){
  const params = new URLSearchParams({
    q: state.q, page: state.page, page_size: state.pageSize, sort: state.sort
  });

  console.log("[BOARD] call /api/search", params.toString());

  let res;
  try {
    res = await fetch('/api/search?' + params.toString());
  } catch (e) {
    alert('네트워크 오류: ' + e);
    console.error(e);
    return;
  }

  if (!res.ok) {
    const txt = await res.text();
    alert('검색 API 오류 (' + res.status + '):\\n' + txt);
    console.error("[BOARD] /api/search error", res.status, txt);
    return;
  }

  const data = await res.json();
  console.log("[BOARD] got items:", data.items?.length);
  if (reset) $list.innerHTML = '';
  $total.textContent = 'total: ' + data.total;
  state.hasNext = data.has_next;
  await renderItems(data.items);
  $more.style.display = state.hasNext ? 'inline-block' : 'none';
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#039;" }[m])); }

async function renderItems(items){
  for (const it of items){
    const li = document.createElement('li');
    li.className = 'item no-media';
    li.innerHTML = `
      <div class="media"></div>
      <div>
        <h3 class="title"><a href="${it.url||it.origin_url}" target="_blank" rel="noopener">${(it.title||'(제목없음)')}</a></h3>
        <div class="meta">${it.pub_date ? new Date(it.pub_date).toLocaleString() : ''}</div>
        <div class="summary">${(it.short_ai_summary||it.ai_summary||it.summary||'').substring(0,40)}${(it.short_ai_summary||it.ai_summary||it.summary||'').length > 40 ? '...' : ''}</div>
      </div>
    `;
    const mediaBox = li.querySelector('.media');

    const targetUrl = it.origin_url || it.url;
    if (targetUrl){
      try{
        const r = await fetch('/api/media?url='+encodeURIComponent(targetUrl));
        const m = await r.json();
        if (m.video_url){
          if (m.video_url.endsWith('.mp4')){
            const v = document.createElement('video');
            v.className='thumb'; v.controls=true; v.src=m.video_url;
            mediaBox.appendChild(v);
          }else{
            const f = document.createElement('iframe');
            f.className='video'; f.src=m.video_url; f.allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"; f.allowFullscreen=true;
            mediaBox.appendChild(f);
          }
          li.classList.remove('no-media');
        } else if (m.image_url){
          const img = document.createElement('img');
          img.className='thumb'; img.loading='lazy'; img.referrerPolicy='no-referrer';
          img.src = m.image_url;
          img.onerror = ()=>{ img.remove(); li.classList.add('no-media'); };
          mediaBox.appendChild(img);
          li.classList.remove('no-media');
        }
      }catch(e){ console.warn("media fail", e); }
    }
    $list.appendChild(li);
  }
}

$btn.onclick = ()=>{
  state.q = $q.value.trim(); // 빈 문자열도 허용 (최신 뉴스)
  state.page = 1;
  state.sort = $sort.value;
  state.pageSize = parseInt($pageSize.value,10);
  setQS({ q: state.q, sort: state.sort, page: state.page, pageSize: state.pageSize });
  fetchPage(true);
};

$more.onclick = ()=>{
  if (!state.hasNext) return;
  state.page += 1;
  setQS({ q: state.q, sort: state.sort, page: state.page, pageSize: state.pageSize });
  fetchPage(false);
};

document.addEventListener('DOMContentLoaded', ()=>{
  // 초기값(주소창 파라미터)
  $q.value = qs('q','');  // 기본값을 빈 문자열로 (최신 뉴스)
  $sort.value = qs('sort','date');
  $pageSize.value = qs('pageSize','20');
  state.q = $q.value; state.sort=$sort.value; state.pageSize=parseInt($pageSize.value,10);
  const initPage = parseInt(qs('page','1'),10);
  state.page = isNaN(initPage) ? 1 : initPage;

  // 초기 로딩 시 최신 뉴스 표시
  fetchPage(true);
});
</script>
</body>
</html>
    """

# -----------------------------
# 실행 방법 (참고)
# uvicorn app.main:app --reload --port 8000
# http://127.0.0.1:8000/board
# -----------------------------
