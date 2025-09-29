"""
실제 뉴스 기사로 분석 시스템 테스트
"""

from sentiment_analyzer import SentimentAnalyzer
from keyword_extractor import KeywordExtractor
from political_analyzer import PoliticalAnalyzer

article_128 = """
방송미디어통신위원회(방미통위) 설치 및 운영에 관한 법안이 27일 국회 본회의를 통과하면서 방송통신위원회(방통위)는 17년 만에 역사 속으로 사라지게 됐다.
전 정부에서 임명된 이진숙 방통위원장 임기도 자동 종료된다.
27일 오후 국회에서 열린 본회의에서 방송미디어통신위원회의 설치 및 운영에 관한 법률안(대안)이 재적 298인, 재석 177인 중 찬성 176인 반대 1인으로 가결됐다.
뉴시스공포와 함께 법이 시행되면 현재 방통위에 과학기술정보통신부의 유료방송 정책 기능을 더한 방미통위가 새로 출범한다.
방미통위는 지상파, 종합편성채널, 보도전문채널뿐 아니라 인터넷TV(IPTV), 케이블TV(종합유선방송사업자) 등 유료방송 플랫폼 심사까지 전담하게 된다.
"""

print("=" * 80)
print("뉴스 기사 분석 테스트 - 기사 128번")
print("=" * 80)

print("\n[1] 감성 분석")
print("-" * 80)
sentiment = SentimentAnalyzer()
result = sentiment.analyze(article_128)
print(f"감성: {result['sentiment']}")
print(f"신뢰도: {result['confidence']:.2f}")
print(f"점수: {result['score']:.2f}")
print(f"긍정 키워드: {result['positive_count']}개, 부정 키워드: {result['negative_count']}개")

print("\n[2] 키워드 추출")
print("-" * 80)
keyword_ext = KeywordExtractor()
keywords = keyword_ext.extract(article_128, top_n=10)
for i, (kw, score) in enumerate(keywords, 1):
    print(f"{i}. {kw} ({score:.3f})")

print("\n[3] 정치 분석")
print("-" * 80)
political = PoliticalAnalyzer()
party_analysis = political.analyze_party_mentions(article_128)

for party, data in party_analysis.items():
    print(f"\n{party}:")
    print(f"  언급: {data['count']}회")
    print(f"  평균 감성: {data['avg_score']:.2f}")
    print(f"  긍정 {data['positive']}회, 중립 {data['neutral']}회, 부정 {data['negative']}회")

bias = political.calculate_bias_score(article_128)
print(f"\n편향성 점수: {bias['bias_score']}/10 ({bias['stance']})")

print("\n" + "=" * 80)
print("분석 완료!")
print("=" * 80)