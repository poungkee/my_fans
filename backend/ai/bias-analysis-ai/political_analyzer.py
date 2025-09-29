"""
FANS 정치 분석 시스템
정당별 언급 빈도 및 감성 분석
"""

from sentiment_analyzer import SentimentAnalyzer
import re

class PoliticalAnalyzer:
    def __init__(self):
        self.sentiment_analyzer = SentimentAnalyzer()

        self.party_keywords = {
            '여당': ['여당', '더불어민주당', '민주당', '집권여당'],
            '야당': ['야당', '국민의힘', '국민의 힘', '제1야당', '최대야당'],
            '정부': ['정부', '행정부', '청와대', '대통령실'],
            '국회': ['국회', '입법부', '국회의원']
        }

        self.politician_keywords = {
            '대통령': ['대통령', '윤석열', '문재인'],
            '총리': ['국무총리', '총리'],
            '장관': ['장관', '부총리'],
            '의원': ['의원', '국회의원']
        }

    def analyze_party_mentions(self, text: str) -> dict:
        """
        정당별 언급 분석
        """
        result = {}

        for party_name, keywords in self.party_keywords.items():
            mentions = []
            sentences = text.split('.')

            for sent in sentences:
                for keyword in keywords:
                    if keyword in sent:
                        sentiment = self.sentiment_analyzer.analyze(sent)
                        mentions.append({
                            'sentence': sent.strip(),
                            'keyword': keyword,
                            'sentiment': sentiment['sentiment'],
                            'score': sentiment['score']
                        })
                        break

            if mentions:
                avg_score = sum(m['score'] for m in mentions) / len(mentions)
                positive_count = sum(1 for m in mentions if m['sentiment'] == 'positive')
                negative_count = sum(1 for m in mentions if m['sentiment'] == 'negative')
                neutral_count = sum(1 for m in mentions if m['sentiment'] == 'neutral')

                result[party_name] = {
                    'count': len(mentions),
                    'avg_score': avg_score,
                    'positive': positive_count,
                    'negative': negative_count,
                    'neutral': neutral_count,
                    'mentions': mentions
                }

        return result

    def calculate_bias_score(self, text: str) -> dict:
        """
        편향성 점수 계산 (-10 ~ +10)
        음수: 진보 성향, 양수: 보수 성향
        """
        party_analysis = self.analyze_party_mentions(text)

        if '여당' in party_analysis and '야당' in party_analysis:
            ruling_score = party_analysis['여당']['avg_score']
            opposition_score = party_analysis['야당']['avg_score']

            bias_score = (ruling_score - opposition_score) * 10
            bias_score = max(-10, min(10, bias_score))

            if bias_score < -3:
                stance = '진보'
            elif bias_score > 3:
                stance = '보수'
            else:
                stance = '중도'

            return {
                'bias_score': round(bias_score, 2),
                'stance': stance,
                'ruling_sentiment': ruling_score,
                'opposition_sentiment': opposition_score
            }

        return {
            'bias_score': 0.0,
            'stance': '중립',
            'ruling_sentiment': 0.0,
            'opposition_sentiment': 0.0
        }


if __name__ == "__main__":
    analyzer = PoliticalAnalyzer()

    test_article = """
    정부는 오늘 새로운 경제 정책을 발표했다.
    여당은 이번 정책이 경제 성장에 큰 도움이 될 것이라고 환영했다.
    야당은 정부의 일방적인 정책 강행에 강력히 반발하고 있다.
    더불어민주당 대변인은 정책의 효과가 의문스럽다고 비판했다.
    국민의힘은 정부와 협의 없이 진행된 점을 문제 삼았다.
    """

    print("=" * 60)
    print("정치 분석 테스트")
    print("=" * 60)

    party_analysis = analyzer.analyze_party_mentions(test_article)

    print("\n정당별 언급 분석:")
    for party, data in party_analysis.items():
        print(f"\n{party}:")
        print(f"  언급 횟수: {data['count']}")
        print(f"  평균 감성 점수: {data['avg_score']:.2f}")
        print(f"  긍정: {data['positive']}, 중립: {data['neutral']}, 부정: {data['negative']}")

    bias = analyzer.calculate_bias_score(test_article)
    print(f"\n편향성 분석:")
    print(f"  편향성 점수: {bias['bias_score']} / 10")
    print(f"  성향: {bias['stance']}")
    print(f"  여당 감성: {bias['ruling_sentiment']:.2f}")
    print(f"  야당 감성: {bias['opposition_sentiment']:.2f}")