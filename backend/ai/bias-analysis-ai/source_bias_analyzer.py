"""
FANS 언론사별 편향성 분석 시스템
언론사별 상대적 정치 성향을 분석하고 점수화
"""

from sentiment_analyzer import SentimentAnalyzer
from typing import Dict, Optional
import psycopg2
import psycopg2.pool
import logging

logger = logging.getLogger(__name__)

class SourceBiasAnalyzer:
    def __init__(self, db_pool=None):
        self.sentiment_analyzer = SentimentAnalyzer()
        self.db_pool = db_pool

        # 알려진 주요 언론사 정치 성향 프로필 (-10: 진보, 0: 중도, +10: 보수)
        self.source_profiles = {
            '조선일보': {'base_score': 7.5, 'leaning': '보수'},
            '중앙일보': {'base_score': 5.0, 'leaning': '보수'},
            '동아일보': {'base_score': 6.0, 'leaning': '보수'},
            '문화일보': {'base_score': 5.5, 'leaning': '보수'},
            '세계일보': {'base_score': 4.0, 'leaning': '중도우'},

            '한겨레': {'base_score': -7.0, 'leaning': '진보'},
            '경향신문': {'base_score': -6.5, 'leaning': '진보'},
            '한국일보': {'base_score': -3.0, 'leaning': '중도좌'},

            '연합뉴스': {'base_score': 0.0, 'leaning': '중립'},
            'YTN': {'base_score': 0.5, 'leaning': '중립'},
            'JTBC': {'base_score': -2.0, 'leaning': '중도좌'},

            '한국경제': {'base_score': 4.0, 'leaning': '중도우'},
            '매일경제': {'base_score': 3.5, 'leaning': '중도우'},
            '머니투데이': {'base_score': 2.0, 'leaning': '중도'},

            '기타': {'base_score': 0.0, 'leaning': '중립'}
        }

        # 정치 관련 키워드
        self.political_keywords = [
            '정부', '여당', '야당', '국회', '의원', '장관', '대통령', '총리',
            '더불어민주당', '민주당', '국민의힘', '정치', '선거', '투표',
            '정책', '법안', '국정', '행정부', '입법부'
        ]

        # 보수 성향 키워드 (확장)
        self.conservative_keywords = [
            # 이념
            '자유민주주의', '시장경제', '자유시장', '민주주의수호',
            # 안보
            '안보', '국방', '동맹', '한미동맹', '북한위협', '대북제재', '국가안보',
            # 경제
            '규제완화', '감세', '성장', '기업', '투자유치', '경제성장', '친기업',
            '경쟁력', '글로벌', '수출', '대기업',
            # 비판적 표현
            '좌파', '종북', '친북', '반시장', '포퓰리즘', '선동',
            # 가치
            '법치', '준법', '질서', '원칙', '책임', '자율', '효율'
        ]

        # 진보 성향 키워드 (확장)
        self.progressive_keywords = [
            # 이념
            '민주주의', '민주화', '촛불', '시민참여',
            # 평화/외교
            '평화', '대북포용', '남북대화', '통일', '평화공존',
            # 복지/분배
            '복지', '평등', '분배', '민생', '서민', '취약계층', '소득주도성장',
            '최저임금', '공공성', '무상', '보편복지',
            # 노동/인권
            '노동', '노동권', '인권', '차별금지', '양극화', '불평등',
            '비정규직', '노동자', '근로자',
            # 환경/사회
            '환경', '기후위기', '탈핵', '재생에너지', '지속가능',
            # 개혁
            '재벌개혁', '검찰개혁', '언론개혁', '적폐청산', '개혁',
            # 경제
            '증세', '공정', '상생', '중소기업', '골목상권',
            # 비판적 표현
            '우파', '보수기득권', '적폐', '특권', '반민주'
        ]

    def is_political_article(self, text: str) -> bool:
        """정치 기사인지 판단"""
        count = sum(1 for keyword in self.political_keywords if keyword in text)
        return count >= 2

    def calculate_content_bias(self, text: str) -> float:
        """기사 내용 기반 편향성 점수 (-5 ~ +5)"""
        if not self.is_political_article(text):
            return 0.0

        # 보수/진보 키워드 빈도 계산
        conservative_count = sum(text.count(kw) for kw in self.conservative_keywords)
        progressive_count = sum(text.count(kw) for kw in self.progressive_keywords)

        # 정부/야당 감성 분석
        gov_sentiment = 0.0
        opp_sentiment = 0.0
        gov_mentions = 0
        opp_mentions = 0

        sentences = text.split('.')
        for sent in sentences:
            if any(kw in sent for kw in ['정부', '여당', '집권']):
                sentiment = self.sentiment_analyzer.analyze(sent)
                gov_sentiment += sentiment['score']
                gov_mentions += 1

            if any(kw in sent for kw in ['야당', '국민의힘']):
                sentiment = self.sentiment_analyzer.analyze(sent)
                opp_sentiment += sentiment['score']
                opp_mentions += 1

        # 평균 계산
        if gov_mentions > 0:
            gov_sentiment /= gov_mentions
        if opp_mentions > 0:
            opp_sentiment /= opp_mentions

        # 종합 점수 계산
        keyword_bias = 0.0
        if conservative_count + progressive_count > 0:
            keyword_bias = (conservative_count - progressive_count) / (conservative_count + progressive_count) * 3

        sentiment_bias = 0.0
        if gov_mentions > 0 and opp_mentions > 0:
            sentiment_bias = (gov_sentiment - opp_sentiment) * 2

        # 최종 점수 (-10 ~ +10 범위로 확장)
        content_bias = (keyword_bias + sentiment_bias) * 2
        return max(-10, min(10, content_bias))

    def get_source_average_from_db(self, source_name: str) -> Optional[float]:
        """
        DB에서 해당 언론사의 최근 30일 편향 점수 평균 조회
        최소 10개 이상의 기사가 있어야 평균 반영
        """
        if not self.db_pool:
            logger.warning("DB pool not available, skipping source average lookup")
            return None

        try:
            conn = self.db_pool.getconn()
            cursor = conn.cursor()

            # 최근 30일, 해당 언론사의 편향 점수 평균 (최소 10개 필요)
            query = """
                SELECT AVG(ba.bias_score)::float as avg_score, COUNT(*) as count
                FROM bias_analysis ba
                JOIN news_articles na ON ba.article_id = na.id
                JOIN sources s ON na.source_id = s.id
                WHERE s.name = %s
                  AND ba.created_at > NOW() - INTERVAL '30 days'
                HAVING COUNT(*) >= 10
            """

            cursor.execute(query, (source_name,))
            result = cursor.fetchone()

            cursor.close()
            self.db_pool.putconn(conn)

            if result and result[0] is not None:
                logger.info(f"Source '{source_name}' average: {result[0]:.2f} (from {result[1]} articles)")
                return result[0]
            else:
                logger.info(f"No sufficient data for source '{source_name}' (need 10+ articles in 30 days)")
                return None

        except Exception as e:
            logger.error(f"Error fetching source average: {e}")
            if 'conn' in locals():
                self.db_pool.putconn(conn)
            return None

    def calculate_final_bias(self, source_name: str, text: str) -> Dict:
        """
        기사 내용 기반 편향성 계산 (100% 내용 분석)
        언론사 평균은 참고용으로만 조회
        """
        # 기사 내용 편향성 분석 (-10 ~ +10)
        content_bias = self.calculate_content_bias(text)

        # DB에서 해당 언론사의 최근 30일 평균 조회 (참고용)
        source_average = self.get_source_average_from_db(source_name)

        # 최종 점수 = 내용 100%
        final_score = content_bias
        logger.info(f"Content bias: {content_bias:.2f}, Source avg (reference): {source_average if source_average else 'N/A'}")

        # 점수 범위 조정 (-10 ~ +10)
        final_score = max(-10, min(10, final_score))

        # 성향 분류
        if final_score <= -5:
            leaning = '진보'
        elif final_score <= -2:
            leaning = '중도좌'
        elif final_score < 2:
            leaning = '중립'
        elif final_score < 5:
            leaning = '중도우'
        else:
            leaning = '보수'

        # 신뢰도 계산
        is_political = self.is_political_article(text)
        confidence = 0.85 if is_political else 0.50

        return {
            'bias_score': round(final_score, 2),
            'political_leaning': leaning,
            'confidence': confidence,
            'source_base_score': round(source_average, 2) if source_average is not None else 0.0,
            'content_bias': round(content_bias, 2),
            'is_political': is_political
        }


if __name__ == "__main__":
    analyzer = SourceBiasAnalyzer()

    test_cases = [
        ("조선일보", "정부의 경제 정책이 시장경제 원칙에 부합한다. 자유민주주의 가치를 지켜야 한다."),
        ("한겨레", "정부의 일방적인 정책 추진으로 서민 생활이 어려워지고 있다. 복지 확대가 시급하다."),
        ("연합뉴스", "국회에서 예산안이 통과되었다. 여야가 합의했다."),
        ("머니투데이", "코스피가 상승했다. 외국인 투자자들의 매수세가 이어졌다.")
    ]

    print("=" * 80)
    print("언론사별 편향성 분석 테스트")
    print("=" * 80)

    for source, article in test_cases:
        result = analyzer.calculate_final_bias(source, article)
        print(f"\n언론사: {source}")
        print(f"기사: {article[:50]}...")
        print(f"편향성 점수: {result['bias_score']}/10 ({result['political_leaning']})")
        print(f"언론사 기본 점수: {result['source_base_score']}")
        print(f"기사 내용 편향: {result['content_bias']}")
        print(f"정치 기사: {result['is_political']}")
        print(f"신뢰도: {result['confidence']}")
