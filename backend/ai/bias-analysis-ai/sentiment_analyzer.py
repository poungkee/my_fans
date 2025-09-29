"""
FANS 감성 분석 시스템
규칙 기반 감성 분석 (긍정/중립/부정)
"""

class SentimentAnalyzer:
    def __init__(self):
        self.positive_keywords = {
            '성공', '성과', '발전', '성장', '호황', '개선', '효과', '긍정', '희망',
            '회복', '증가', '상승', '혁신', '우수', '뛰어나다', '훌륭', '좋다',
            '환영', '기대', '긍정적', '개혁', '발전적', '효과적', '성공적',
            '수출증가', '경제성장', '일자리창출', '합의', '협의', '대화', '타협'
        }

        self.negative_keywords = {
            '실패', '위기', '문제', '논란', '비판', '부정', '우려', '불안', '위험',
            '침체', '감소', '하락', '부작용', '악화', '나쁘다', '심각', '우려스럽다',
            '부정적', '졸속', '독단', '일방적', '강행', '반발', '갈등',
            '물가상승', '경제위기', '불황', '대립', '충돌', '분쟁'
        }

        self.neutral_indicators = {
            '발표', '계획', '예정', '진행', '조사', '확인', '밝혔다', '말했다',
            '전했다', '보도', '알렸다', '설명', '언급'
        }

    def analyze(self, text: str) -> dict:
        """
        텍스트 감성 분석
        """
        positive_count = sum(1 for word in self.positive_keywords if word in text)
        negative_count = sum(1 for word in self.negative_keywords if word in text)

        total = positive_count + negative_count

        if total == 0:
            sentiment = 'neutral'
            confidence = 0.5
        elif positive_count > negative_count:
            sentiment = 'positive'
            confidence = min(0.5 + (positive_count / (total * 2)), 0.95)
        elif negative_count > positive_count:
            sentiment = 'negative'
            confidence = min(0.5 + (negative_count / (total * 2)), 0.95)
        else:
            sentiment = 'neutral'
            confidence = 0.5

        return {
            'sentiment': sentiment,
            'confidence': confidence,
            'positive_count': positive_count,
            'negative_count': negative_count,
            'score': (positive_count - negative_count) / max(total, 1)
        }

    def get_sentiment_label(self, text: str) -> str:
        """간단한 감성 라벨 반환"""
        result = self.analyze(text)
        return result['sentiment']

    def get_sentiment_score(self, text: str) -> float:
        """감성 점수 반환 (-1.0 ~ 1.0)"""
        result = self.analyze(text)
        return result['score']


if __name__ == "__main__":
    analyzer = SentimentAnalyzer()

    test_sentences = [
        "정부는 경제 성장과 일자리 창출을 위한 성공적인 정책을 발표했다.",
        "경제 위기와 물가 상승으로 국민들의 우려가 커지고 있다.",
        "정부는 오늘 새로운 정책을 발표했다.",
        "야당은 정부의 일방적인 정책 강행에 강력히 반발하고 있다.",
        "여야는 합의를 통해 대화로 문제를 해결하기로 했다."
    ]

    print("=" * 60)
    print("감성 분석 테스트")
    print("=" * 60)

    for sent in test_sentences:
        result = analyzer.analyze(sent)
        print(f"\n문장: {sent}")
        print(f"감성: {result['sentiment']} (신뢰도: {result['confidence']:.2f})")
        print(f"점수: {result['score']:.2f} (긍정:{result['positive_count']}, 부정:{result['negative_count']})")