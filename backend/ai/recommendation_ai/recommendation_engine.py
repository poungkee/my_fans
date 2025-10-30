"""
뉴스 추천 엔진
하이브리드 추천 알고리즘 (협업 필터링 + 콘텐츠 기반 + 키워드 + 편향 + 트렌딩)
"""

import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from database import db

logger = logging.getLogger(__name__)

class RecommendationEngine:
    def __init__(self):
        # 하이브리드 가중치
        self.weights = {
            'collaborative': 0.25,
            'content_based': 0.20,
            'keyword_based': 0.30,
            'bias_based': 0.15,
            'trending': 0.10
        }

    def generate_recommendations(self, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        """
        추천 생성 메인 로직
        """
        try:
            # 1. 사용자 선호도 분석
            user_prefs = self._get_user_preferences(user_id)

            # 2. Cold Start 체크
            has_profile = len(user_prefs['preferred_categories']) > 0 or len(user_prefs['preferred_sources']) > 0
            has_activity = user_prefs['total_read'] > 0 or user_prefs['total_likes'] > 0

            # 3. Cold Start 사용자 - 인기 기사 6개
            if not has_profile and not has_activity:
                logger.info(f"Cold Start user {user_id}, returning top 6 popular articles")
                return self._get_most_viewed_articles(6)

            # 4. 프로필 설정 사용자 - 맞춤 추천
            # 협업 필터링
            similar_users = self._find_similar_users(user_id, 10)
            collaborative_articles = self._get_articles_from_similar_users(user_id, similar_users, limit * 2)

            # 콘텐츠 기반
            content_based_articles = self._get_similar_articles(user_id, user_prefs, limit * 2)

            # 키워드 기반
            keyword_based_articles = self._get_keyword_based_articles(user_id, limit * 2)

            # 편향 기반
            bias_based_articles = self._get_bias_based_articles(user_id, limit)

            # 트렌딩
            trending_articles = self._get_trending_articles(limit)

            # 인기 기사 3개
            popular_articles = self._get_most_viewed_articles(3)

            # 5. 하이브리드 점수 계산 및 병합
            scored_articles = self._merge_and_score_articles(
                collaborative_articles,
                content_based_articles,
                keyword_based_articles,
                bias_based_articles,
                trending_articles
            )

            # 6. 인기 기사 맨 앞 + 나머지
            final_recommendations = popular_articles + [
                article for article in scored_articles
                if article['id'] not in [p['id'] for p in popular_articles]
            ]

            return final_recommendations[:limit]

        except Exception as e:
            logger.error(f"Recommendation generation error: {e}")
            # Fallback to popular articles
            return self._get_popular_articles(limit)

    def _get_user_preferences(self, user_id: int) -> Dict[str, Any]:
        """사용자 선호도 가져오기"""
        # 활동 기록
        activity = db.execute_one("""
            SELECT
                COUNT(DISTINCT article_id) as total_read,
                COUNT(CASE WHEN activity_type = 'like' THEN 1 END) as total_likes,
                AVG(reading_time_seconds) as avg_reading_time
            FROM user_activity_log
            WHERE user_id = %s
        """, (user_id,)) or {}

        # 선호 설정
        prefs = db.execute_one("""
            SELECT preferred_categories, preferred_sources
            FROM user_preferences
            WHERE user_id = %s
        """, (user_id,)) or {}

        return {
            'preferred_categories': self._parse_json_field(prefs.get('preferred_categories')),
            'preferred_sources': self._parse_json_field(prefs.get('preferred_sources')),
            'total_read': int(activity.get('total_read', 0)) if activity.get('total_read') else 0,
            'total_likes': int(activity.get('total_likes', 0)) if activity.get('total_likes') else 0,
            'avg_reading_time': float(activity.get('avg_reading_time', 0)) if activity.get('avg_reading_time') else 0
        }

    def _find_similar_users(self, user_id: int, limit: int) -> List[int]:
        """유사한 사용자 찾기 (협업 필터링)"""
        result = db.execute_query("""
            SELECT ual2.user_id, COUNT(*) as common_likes
            FROM user_activity_log ual1
            JOIN user_activity_log ual2
              ON ual1.article_id = ual2.article_id
              AND ual1.user_id != ual2.user_id
            WHERE ual1.user_id = %s
              AND ual1.activity_type = 'like'
              AND ual2.activity_type = 'like'
            GROUP BY ual2.user_id
            ORDER BY common_likes DESC
            LIMIT %s
        """, (user_id, limit))

        return [row['user_id'] for row in result]

    def _get_articles_from_similar_users(self, user_id: int, similar_users: List[int], limit: int) -> List[Dict]:
        """유사 사용자가 좋아한 기사"""
        if not similar_users:
            return []

        result = db.execute_query("""
            SELECT DISTINCT na.*,
                s.name as source_name,
                c.name as category_name,
                COUNT(DISTINCT ual.user_id) as recommender_count
            FROM user_activity_log ual
            JOIN news_articles na ON ual.article_id = na.id
            LEFT JOIN sources s ON na.source_id = s.id
            LEFT JOIN categories c ON na.category_id = c.id
            WHERE ual.user_id = ANY(%s::int[])
              AND ual.activity_type IN ('like', 'bookmark')
              AND na.id NOT IN (
                SELECT article_id FROM user_activity_log
                WHERE user_id = %s AND activity_type IN ('view', 'like', 'bookmark')
              )
              AND na.pub_date > NOW() - INTERVAL '7 days'
            GROUP BY na.id, s.name, c.name
            ORDER BY recommender_count DESC
            LIMIT %s
        """, (similar_users, user_id, limit))

        return [{**row, 'recommendation_type': 'collaborative', 'score': float(row.get('recommender_count', 1))} for row in result]

    def _get_similar_articles(self, user_id: int, user_prefs: Dict, limit: int) -> List[Dict]:
        """콘텐츠 기반 유사 기사"""
        categories = user_prefs['preferred_categories']
        sources = user_prefs['preferred_sources']

        if not categories and not sources:
            return []

        result = db.execute_query("""
            SELECT * FROM (
                SELECT DISTINCT na.*,
                  s.name as source_name,
                  c.name as category_name,
                  CASE WHEN c.name = ANY(%s::text[]) THEN 2 ELSE 1 END as category_match_score,
                  CASE WHEN s.name = ANY(%s::text[]) THEN 2 ELSE 1 END as source_match_score
                FROM news_articles na
                LEFT JOIN sources s ON na.source_id = s.id
                LEFT JOIN categories c ON na.category_id = c.id
                WHERE (c.name = ANY(%s::text[]) OR s.name = ANY(%s::text[]))
                  AND na.id NOT IN (
                    SELECT article_id FROM user_activity_log
                    WHERE user_id = %s AND activity_type IN ('view', 'like', 'bookmark')
                  )
                  AND na.pub_date > NOW() - INTERVAL '7 days'
            ) scored_articles
            ORDER BY (category_match_score + source_match_score) DESC, pub_date DESC
            LIMIT %s
        """, (
            categories if categories else [''],
            sources if sources else [''],
            categories if categories else [''],
            sources if sources else [''],
            user_id,
            limit
        ))

        return [{
            **row,
            'recommendation_type': 'content_based',
            'score': row.get('category_match_score', 1) + row.get('source_match_score', 1)
        } for row in result]

    def _get_keyword_based_articles(self, user_id: int, limit: int) -> List[Dict]:
        """키워드 기반 추천"""
        # 1. 사용자 키워드 추출
        user_keywords = db.execute_query("""
            SELECT k.id, k.keyword, COUNT(*) as frequency,
                MAX(ual.created_at) as last_read
            FROM user_activity_log ual
            JOIN news_keywords nk ON ual.article_id = nk.news_id
            JOIN keywords k ON nk.keyword_id = k.id
            WHERE ual.user_id = %s
              AND ual.activity_type IN ('view', 'like', 'bookmark')
              AND ual.created_at > NOW() - INTERVAL '30 days'
            GROUP BY k.id, k.keyword
            ORDER BY frequency DESC, last_read DESC
            LIMIT 20
        """, (user_id,))

        if not user_keywords:
            return []

        keyword_ids = [k['id'] for k in user_keywords]

        # 2. 키워드로 기사 추천
        result = db.execute_query("""
            SELECT DISTINCT na.*,
                s.name as source_name,
                c.name as category_name,
                COUNT(DISTINCT nk.keyword_id) as keyword_match_count,
                SUM(nk.relevance) as total_relevance
            FROM news_articles na
            JOIN news_keywords nk ON na.id = nk.news_id
            LEFT JOIN sources s ON na.source_id = s.id
            LEFT JOIN categories c ON na.category_id = c.id
            WHERE nk.keyword_id = ANY(%s::bigint[])
              AND na.id NOT IN (
                SELECT article_id FROM user_activity_log
                WHERE user_id = %s AND activity_type IN ('view', 'like', 'bookmark')
              )
              AND na.pub_date > NOW() - INTERVAL '7 days'
            GROUP BY na.id, s.name, c.name
            HAVING COUNT(DISTINCT nk.keyword_id) >= 1
            ORDER BY keyword_match_count DESC, total_relevance DESC, na.pub_date DESC
            LIMIT %s
        """, (keyword_ids, user_id, limit))

        return [{
            **row,
            'recommendation_type': 'keyword_based',
            'score': int(row.get('keyword_match_count', 1)) * float(row.get('total_relevance', 1))
        } for row in result]

    def _get_bias_based_articles(self, user_id: int, limit: int) -> List[Dict]:
        """정치 편향 기반 추천"""
        # 1. 사용자 정치 편향 선호도
        user_bias_pref = db.execute_query("""
            SELECT
                ba.political_leaning,
                COUNT(*) as frequency,
                AVG(ba.bias_score) as avg_bias_score,
                AVG(ual.reading_time_seconds) as avg_reading_time
            FROM user_activity_log ual
            JOIN news_articles na ON ual.article_id = na.id
            JOIN categories c ON na.category_id = c.id
            LEFT JOIN bias_analysis ba ON na.id = ba.article_id
            WHERE ual.user_id = %s
              AND c.name = '정치'
              AND ual.activity_type IN ('view', 'like', 'bookmark')
              AND ual.created_at > NOW() - INTERVAL '30 days'
              AND ba.political_leaning IS NOT NULL
            GROUP BY ba.political_leaning
            ORDER BY frequency DESC, avg_reading_time DESC
            LIMIT 3
        """, (user_id,))

        if not user_bias_pref:
            return []

        preferred_leanings = [p['political_leaning'] for p in user_bias_pref]

        # 2. 선호 편향 기사 추천
        result = db.execute_query("""
            SELECT na.*,
                s.name as source_name,
                c.name as category_name,
                ba.political_leaning,
                ba.bias_score,
                ba.confidence
            FROM news_articles na
            JOIN categories c ON na.category_id = c.id
            LEFT JOIN sources s ON na.source_id = s.id
            LEFT JOIN bias_analysis ba ON na.id = ba.article_id
            WHERE c.name = '정치'
              AND ba.political_leaning = ANY(%s::text[])
              AND ba.confidence > 0.6
              AND na.id NOT IN (
                SELECT article_id FROM user_activity_log
                WHERE user_id = %s AND activity_type IN ('view', 'like', 'bookmark')
              )
              AND na.pub_date > NOW() - INTERVAL '7 days'
            ORDER BY ba.confidence DESC, na.pub_date DESC
            LIMIT %s
        """, (preferred_leanings, user_id, limit))

        return [{
            **row,
            'recommendation_type': 'bias_based',
            'score': float(row.get('confidence', 0.5)) * 10
        } for row in result]

    def _get_trending_articles(self, limit: int) -> List[Dict]:
        """트렌딩 기사"""
        result = db.execute_query("""
            SELECT na.*,
                s.name as source_name,
                c.name as category_name,
                COUNT(DISTINCT ual.user_id) as view_count,
                COUNT(CASE WHEN ual.activity_type = 'like' THEN 1 END) as like_count
            FROM news_articles na
            LEFT JOIN sources s ON na.source_id = s.id
            LEFT JOIN categories c ON na.category_id = c.id
            LEFT JOIN user_activity_log ual ON na.id = ual.article_id
            WHERE na.pub_date > NOW() - INTERVAL '24 hours'
            GROUP BY na.id, s.name, c.name
            ORDER BY COUNT(DISTINCT ual.user_id) + COUNT(CASE WHEN ual.activity_type = 'like' THEN 1 END) * 2 DESC
            LIMIT %s
        """, (limit,))

        return [{
            **row,
            'recommendation_type': 'trending',
            'score': int(row.get('view_count', 0)) + int(row.get('like_count', 0)) * 2
        } for row in result]

    def _get_most_viewed_articles(self, limit: int) -> List[Dict]:
        """가장 많이 조회된 기사 (Cold Start용)"""
        result = db.execute_query("""
            SELECT na.*,
                s.name as source_name,
                c.name as category_name,
                COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) as view_count,
                COUNT(DISTINCT CASE WHEN ual.activity_type = 'like' THEN ual.user_id END) as like_count,
                COUNT(DISTINCT CASE WHEN ual.activity_type = 'comment' THEN ual.user_id END) as comment_count
            FROM news_articles na
            LEFT JOIN sources s ON na.source_id = s.id
            LEFT JOIN categories c ON na.category_id = c.id
            LEFT JOIN user_activity_log ual ON na.id = ual.article_id
            WHERE na.pub_date > NOW() - INTERVAL '3 days'
            GROUP BY na.id, s.name, c.name
            ORDER BY
                COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) DESC,
                COUNT(DISTINCT CASE WHEN ual.activity_type = 'like' THEN ual.user_id END) DESC,
                COUNT(DISTINCT CASE WHEN ual.activity_type = 'comment' THEN ual.user_id END) DESC,
                na.pub_date DESC
            LIMIT %s
        """, (limit,))

        return [{
            **row,
            'recommendation_type': 'most_viewed',
            'view_count': int(row.get('view_count', 0)),
            'like_count': int(row.get('like_count', 0)),
            'comment_count': int(row.get('comment_count', 0))
        } for row in result]

    def _get_popular_articles(self, limit: int) -> List[Dict]:
        """인기 기사 (fallback)"""
        result = db.execute_query("""
            SELECT na.*,
                s.name as source_name,
                c.name as category_name
            FROM news_articles na
            LEFT JOIN sources s ON na.source_id = s.id
            LEFT JOIN categories c ON na.category_id = c.id
            WHERE na.pub_date > NOW() - INTERVAL '7 days'
            ORDER BY na.pub_date DESC
            LIMIT %s
        """, (limit,))

        return [{**row, 'recommendation_type': 'most_viewed'} for row in result]

    def _merge_and_score_articles(
        self,
        collaborative: List[Dict],
        content_based: List[Dict],
        keyword_based: List[Dict],
        bias_based: List[Dict],
        trending: List[Dict]
    ) -> List[Dict]:
        """기사 병합 및 하이브리드 점수 계산"""
        article_map = {}

        # 각 추천 타입별로 점수 합산
        for articles, weight_key in [
            (collaborative, 'collaborative'),
            (content_based, 'content_based'),
            (keyword_based, 'keyword_based'),
            (bias_based, 'bias_based'),
            (trending, 'trending')
        ]:
            weight = self.weights[weight_key]
            for article in articles:
                article_id = article['id']
                if article_id not in article_map:
                    article_map[article_id] = {
                        **article,
                        'final_score': 0,
                        'recommendation_type': article.get('recommendation_type', weight_key)
                    }
                article_map[article_id]['final_score'] += article.get('score', 1) * weight

        # 점수순 정렬
        return sorted(article_map.values(), key=lambda x: x['final_score'], reverse=True)

    def save_recommendations_cache(self, user_id: int, articles: List[Dict]) -> None:
        """추천 결과 캐시 저장"""
        article_ids = [a['id'] for a in articles]
        scores = {a['id']: a.get('final_score', 1) for a in articles}
        types = {a['id']: a.get('recommendation_type', 'hybrid') for a in articles}

        db.execute_query("""
            INSERT INTO user_recommendations (
                user_id, recommended_article_ids, recommendation_scores,
                recommendation_types, expires_at
            )
            VALUES (%s, %s, %s, %s, NOW() + INTERVAL '1 hour')
            ON CONFLICT (user_id)
            DO UPDATE SET
                recommended_article_ids = EXCLUDED.recommended_article_ids,
                recommendation_scores = EXCLUDED.recommendation_scores,
                recommendation_types = EXCLUDED.recommendation_types,
                generated_at = NOW(),
                expires_at = NOW() + INTERVAL '1 hour'
        """, (user_id, json.dumps(article_ids), json.dumps(scores), json.dumps(types)))

    def _parse_json_field(self, field: Any) -> List:
        """JSON 필드 파싱"""
        if not field:
            return []
        if isinstance(field, list):
            return field
        if isinstance(field, str):
            try:
                return json.loads(field)
            except:
                return []
        return []

# 싱글톤 인스턴스
recommendation_engine = RecommendationEngine()
