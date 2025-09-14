# app/news_collector.py
import asyncio
import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import re

from app.database import engine, SessionLocal
from app.models import NewsArticle, Keyword, news_keywords_table
from app.ai_module import ai_summarizer
from dotenv import load_dotenv

load_dotenv()

class NewsCollector:
    """뉴스 배치 수집 시스템"""

    def __init__(self):
        self.naver_id = os.getenv("NAVER_CLIENT_ID")
        self.naver_secret = os.getenv("NAVER_CLIENT_SECRET")
        self.naver_url = "https://openapi.naver.com/v1/search/news.json"
        self.db = SessionLocal()

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()

    async def collect_news(self, keywords: List[str] = None, max_per_keyword: int = 50):
        """뉴스 수집 메인 함수"""
        if not keywords:
            keywords = ["정치", "경제", "사회", "생활", "세계", "IT", "스포츠"]

        print(f"[수집 시작] 키워드: {keywords}, 개수: {max_per_keyword}")

        total_collected = 0
        total_new = 0

        async with httpx.AsyncClient(timeout=30) as client:
            for keyword in keywords:
                try:
                    collected, new_count = await self._collect_keyword_news(
                        client, keyword, max_per_keyword
                    )
                    total_collected += collected
                    total_new += new_count
                    print(f"[{keyword}] 수집: {collected}개, 신규: {new_count}개")

                    # 요청 간격 (API 제한 고려)
                    await asyncio.sleep(1)

                except Exception as e:
                    print(f"[오류] {keyword} 수집 실패: {e}")
                    continue

        print(f"[수집 완료] 총 {total_collected}개 처리, {total_new}개 신규 저장")
        return {"total_collected": total_collected, "total_new": total_new}

    async def _collect_keyword_news(self, client: httpx.AsyncClient, keyword: str, max_count: int) -> tuple[int, int]:
        """키워드별 뉴스 수집"""
        headers = {
            "X-Naver-Client-Id": self.naver_id,
            "X-Naver-Client-Secret": self.naver_secret,
        }

        collected_count = 0
        new_count = 0
        page = 1

        while collected_count < max_count:
            display = min(100, max_count - collected_count)  # 네이버 API 최대 100개
            start = (page - 1) * display + 1

            if start > 1000:  # 네이버 API 제한
                break

            params = {
                "query": keyword,
                "display": display,
                "start": start,
                "sort": "date"
            }

            try:
                response = await client.get(self.naver_url, headers=headers, params=params)
                response.raise_for_status()

                data = response.json()
                items = data.get("items", [])

                if not items:
                    break

                # 각 기사 처리
                for item in items:
                    try:
                        is_new = await self._process_article(client, item, keyword)
                        if is_new:
                            new_count += 1
                        collected_count += 1
                    except Exception as e:
                        print(f"[기사 처리 오류] {e}")
                        continue

                # 더 이상 새로운 결과가 없으면 중단
                if len(items) < display:
                    break

                page += 1

            except Exception as e:
                print(f"[API 오류] {keyword} 페이지 {page}: {e}")
                break

        return collected_count, new_count

    async def _process_article(self, client: httpx.AsyncClient, item: Dict, category: str) -> bool:
        """개별 기사 처리"""
        url = item.get("link")
        if not url:
            return False

        # 중복 확인
        existing = self.db.query(NewsArticle).filter(NewsArticle.url == url).first()
        if existing:
            return False  # 이미 존재

        # 기본 정보 추출
        title = self._clean_text(item.get("title", ""))
        summary = self._clean_text(item.get("description", ""))
        origin_url = item.get("originallink", "")
        pub_date = self._parse_date(item.get("pubDate"))

        # 미디어 URL 추출
        media_urls = await self._extract_media_urls(client, origin_url or url)

        # AI 요약 생성
        ai_summary = None
        short_ai_summary = None
        keywords_list = []

        if ai_summarizer and ai_summarizer.summarizer:
            try:
                ai_result = ai_summarizer.summarize_news(
                    title=title,
                    content=summary,
                    max_length=100
                )
                if ai_result.get("success"):
                    ai_summary = ai_result.get("summary")
                    keywords_list = ai_result.get("keywords", [])

                    # 짧은 요약 생성 (30-40자)
                    short_result = ai_summarizer.summarize_news(
                        title=title,
                        content=summary,
                        max_length=35
                    )
                    if short_result.get("success"):
                        short_ai_summary = short_result.get("summary")[:40]  # 최대 40자

            except Exception as e:
                print(f"[AI 요약 오류] {e}")

        # 뉴스 기사 저장
        article = NewsArticle(
            title=title,
            content=summary,  # 현재는 네이버 요약을 content로 사용
            summary=summary,
            ai_summary=ai_summary,
            short_ai_summary=short_ai_summary,
            url=url,
            origin_url=origin_url,
            media_urls=media_urls,
            source=self._extract_source(item),
            category=category,
            pub_date=pub_date
        )

        try:
            self.db.add(article)
            self.db.flush()  # ID 얻기 위해

            # 키워드 저장
            await self._save_keywords(article.id, keywords_list)

            self.db.commit()
            return True

        except Exception as e:
            self.db.rollback()
            print(f"[DB 저장 오류] {e}")
            return False

    async def _extract_media_urls(self, client: httpx.AsyncClient, url: str) -> Dict[str, List[str]]:
        """원문에서 이미지/동영상 URL 추출"""
        media_urls = {"images": [], "videos": []}

        if not url:
            return media_urls

        try:
            response = await client.get(
                url,
                headers={"User-Agent": "NewsBot/1.0"},
                timeout=10,
                follow_redirects=True
            )
            soup = BeautifulSoup(response.text, "html.parser")

            # Open Graph 이미지
            og_image = soup.find("meta", property="og:image")
            if og_image and og_image.get("content"):
                media_urls["images"].append(og_image["content"])

            # Twitter 이미지
            twitter_image = soup.find("meta", attrs={"name": "twitter:image"})
            if twitter_image and twitter_image.get("content"):
                img_url = twitter_image["content"]
                if img_url not in media_urls["images"]:
                    media_urls["images"].append(img_url)

            # 본문 이미지들 (최대 5개)
            img_tags = soup.find_all("img", src=True)[:5]
            for img in img_tags:
                img_url = img["src"]
                if img_url.startswith("http") and img_url not in media_urls["images"]:
                    media_urls["images"].append(img_url)

            # 동영상 URL
            og_video = soup.find("meta", property="og:video")
            if og_video and og_video.get("content"):
                media_urls["videos"].append(og_video["content"])

        except Exception as e:
            print(f"[미디어 추출 오류] {url}: {e}")

        return media_urls

    async def _save_keywords(self, news_id: int, keywords_list: List[str]):
        """키워드 저장 및 연결"""
        for keyword_text in keywords_list:
            if not keyword_text or len(keyword_text) < 2:
                continue

            # 키워드 존재 확인 또는 생성
            keyword = self.db.query(Keyword).filter(Keyword.keyword == keyword_text).first()
            if not keyword:
                keyword = Keyword(keyword=keyword_text)
                self.db.add(keyword)
                self.db.flush()
            else:
                keyword.frequency += 1

            # 뉴스-키워드 연결
            stmt = news_keywords_table.insert().values(
                news_id=news_id,
                keyword_id=keyword.id,
                relevance=1.0
            )
            try:
                self.db.execute(stmt)
            except:
                pass  # 중복 키워드는 무시

    def _clean_text(self, text: str) -> str:
        """텍스트 정리"""
        if not text:
            return ""
        # HTML 태그 제거
        text = re.sub(r'<[^>]+>', '', text)
        # 엔티티 디코딩
        text = text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
        text = text.replace('&quot;', '"').replace('&#39;', "'")
        # 공백 정리
        return ' '.join(text.split()).strip()

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """날짜 파싱"""
        if not date_str:
            return None
        try:
            # RFC 2822 형식: "Thu, 14 Sep 2023 14:30:00 +0900"
            return datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
        except:
            try:
                # ISO 형식 시도
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except:
                return datetime.now(timezone.utc)

    def _extract_source(self, item: Dict) -> Optional[str]:
        """언론사 추출"""
        title = item.get("title", "")
        # 제목에서 언론사명 추출 시도 (예: "제목... - 조선일보")
        if " - " in title:
            return title.split(" - ")[-1].strip()
        return None

# 실행 함수
async def run_news_collection():
    """뉴스 수집 실행"""
    collector = NewsCollector()
    result = await collector.collect_news(
        keywords=["정치", "경제", "기술", "사회", "스포츠", "연예", "생활", "건강", "문화", "교육"],
        max_per_keyword=25  # 10개 키워드 * 25개 = 250개 목표
    )
    return result

if __name__ == "__main__":
    asyncio.run(run_news_collection())