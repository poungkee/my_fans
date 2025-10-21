html = """<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>FANS Architecture</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/theme/black.min.css">
<style>.reveal h1,.reveal h2{text-transform:none}.arch{background:rgba(255,255,255,0.1);padding:15px;margin:8px;border-radius:8px;border:2px solid #42affa}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:0.7em}.item{background:rgba(66,175,250,0.2);padding:12px;border-radius:6px}.port{color:#42affa;font-weight:bold}.ok{color:#4caf50;font-weight:bold}.hi{color:#ffa726;font-weight:bold}</style>
</head><body><div class="reveal"><div class="slides">
<section><h1>FANS</h1><h3>Financial & Analytics News Service</h3><p>뉴스 수집 및 AI 분석 시스템</p></section>
<section><h2>시스템 개요</h2><div class="arch"><h3>12개 마이크로서비스</h3><p>크롤링→분류→분석→요약→API제공</p></div></section>
<section><h2>기술 스택</h2><p>Node.js 20 | Python 3.10/3.11</p><p>React | PostgreSQL 15 | Redis 7</p><p>Docker Compose</p></section>
<section><h2>서비스 구성</h2><div class="grid">
<div class="item"><strong>Main API</strong><br><span class="port">:3000</span><br><span class="ok">✓ Running</span></div>
<div class="item"><strong>Frontend</strong><br><span class="port">:3001</span><br><span class="ok">✓ Running</span></div>
<div class="item"><strong>API Crawler</strong><br><span class="port">:4003</span><br><span class="ok">✓ Healthy</span></div>
<div class="item"><strong>Puppeteer #1</strong><br><span class="port">:4004</span><br><span class="ok">✓ Healthy</span></div>
<div class="item"><strong>Puppeteer #2</strong><br><span class="port">:4005</span><br><span class="ok">✓ Healthy</span></div>
<div class="item"><strong>Puppeteer #3</strong><br><span class="port">:4006</span><br><span class="ok">✓ Healthy</span></div>
<div class="item"><strong>Classification</strong><br><span class="port">:5000</span><br><span class="ok">✓ Healthy</span></div>
<div class="item"><strong>Summarize AI</strong><br><span class="port">:8000</span><br><span class="ok">✓ Healthy</span></div>
<div class="item"><strong>Bias AI</strong><br><span class="port">:8002</span><br><span class="ok">✓ Healthy</span></div>
</div></section>
<section><h2>데이터베이스</h2><div class="grid" style="grid-template-columns:1fr 1fr">
<div class="item"><h3>PostgreSQL 15</h3><span class="port">:5432</span><br><span class="ok">✓ Healthy</span><p style="font-size:0.9em;margin-top:10px">뉴스 기사 | 분석 결과 | 사용자 데이터</p></div>
<div class="item"><h3>Redis 7</h3><span class="port">:6379</span><br><span class="ok">✓ Running</span><p style="font-size:0.9em;margin-top:10px">세션 관리 | 캐시 | 실시간 데이터</p></div>
</div></section>
<section><h2>크롤링 시스템</h2><div class="arch"><p><strong class="hi">API Crawler</strong> - 주요 언론사 RSS/API (30초 간격)</p></div>
<div class="arch"><p><strong class="hi">Puppeteer x3</strong> - 동적 웹페이지 병렬 크롤링</p></div></section>
<section><h2>AI 분석</h2><div class="arch"><p><strong class="hi">Summarize AI</strong> - 기사 요약 | 카테고리 분류 | 키워드 추출</p></div>
<div class="arch"><p><strong class="hi">Bias Analysis AI</strong> - 감정 분석 | 편향성 탐지 | 정치 성향</p></div></section>
<section><h2>분류 시스템</h2><div class="arch"><h3>Classification API</h3><p>raw_news_articles → AI 분류 → news_articles</p>
<p style="font-size:0.85em">카테고리: 정치|경제|사회|생활/문화|IT/과학|세계|스포츠|연예</p></div></section>
<section><h2>자동 스케줄러</h2><div class="arch"><p><strong>10분마다</strong> Raw 뉴스 처리 및 AI 요약 생성</p><p>배치 크기: 100개/회</p></div></section>
<section><h2>데이터 흐름</h2><div style="font-size:0.8em">
<div class="arch" style="background:rgba(66,175,250,0.1)">1. 크롤링 → raw_news_articles</div>
<div class="arch" style="background:rgba(255,167,38,0.1)">2. AI 분류 → Classification API</div>
<div class="arch" style="background:rgba(76,175,80,0.1)">3. 이동 → news_articles</div>
<div class="arch" style="background:rgba(156,39,176,0.1)">4. AI 분석 → 요약 + 편향 분석</div>
<div class="arch" style="background:rgba(33,150,243,0.1)">5. API 제공 → Frontend</div>
</div></section>
<section><h2>아키텍처 최적화</h2><div class="arch"><p style="color:#f44336">❌ 제거: Spark | Kafka | Airflow</p>
<p style="color:#4caf50">✅ 대체: Node.js Scheduler | PostgreSQL 직접 처리</p><p class="hi">결과: 메모리 75% 절감</p></div></section>
<section><h2>포트 구성</h2><div style="font-size:0.75em;display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div><p><span class="port">:3000</span> Main API</p><p><span class="port">:3001</span> Frontend</p><p><span class="port">:4003</span> API Crawler</p>
<p><span class="port">:4004-6</span> Puppeteer x3</p></div>
<div><p><span class="port">:5000</span> Classification</p><p><span class="port">:5432</span> PostgreSQL</p>
<p><span class="port">:6379</span> Redis</p><p><span class="port">:8000</span> Summarize AI</p><p><span class="port">:8002</span> Bias AI</p></div>
</div></section>
<section><h2>시스템 상태</h2><div class="arch"><h3 class="ok">✅ 모든 서비스 정상</h3><p>Healthy: PostgreSQL, 크롤러x4, AI x3</p>
<p>Running: Redis, Main API, Frontend, Scheduler</p><p class="hi">총 12개 컨테이너 운영 중</p></div></section>
<section><h2>주요 기능</h2><div class="arch">📰 실시간 뉴스 수집 (30초)</div><div class="arch">🤖 AI 자동 분류 (8개 카테고리)</div>
<div class="arch">📊 감정/편향 분석</div><div class="arch">📝 자동 요약</div><div class="arch">🔍 키워드 추출</div></section>
<section><h1>Q & A</h1><p>FANS - Financial & Analytics News Service</p><p style="font-size:0.8em">http://localhost:3001</p></section>
</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.js"></script>
<script>Reveal.initialize({hash:true,transition:'slide',controls:true,progress:true,center:true,slideNumber:true});</script>
</body></html>"""

with open('fans_architecture_ppt.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("✅ 15장 PPT 생성 완료!")
print("📍 D:/dev1/fans_architecture_ppt.html")
