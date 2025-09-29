"""
빠른 모듈 테스트
"""

print("=" * 80)
print("FANS AI 분석 시스템 테스트")
print("=" * 80)

print("\n[1] 감성 분석 모듈 테스트")
try:
    from sentiment_analyzer import SentimentAnalyzer
    sentiment = SentimentAnalyzer()

    test_text = "정부는 성공적인 경제 정책을 발표했다."
    result = sentiment.analyze(test_text)

    print(f"✅ 감성 분석: {result['sentiment']} (점수: {result['score']:.2f})")
except Exception as e:
    print(f"❌ 오류: {e}")

print("\n[2] 키워드 추출 모듈 테스트")
try:
    from keyword_extractor import KeywordExtractor
    keyword = KeywordExtractor()

    test_text = "정부는 오늘 새로운 경제 정책을 발표했다. 이번 정책은 경제 성장을 목표로 한다."
    keywords = keyword.extract(test_text, top_n=5)

    print(f"✅ 키워드 추출: {len(keywords)}개")
    for kw, score in keywords[:3]:
        print(f"   - {kw}: {score:.3f}")
except Exception as e:
    print(f"❌ 오류: {e}")

print("\n[3] 정치 분석 모듈 테스트")
try:
    from political_analyzer import PoliticalAnalyzer
    political = PoliticalAnalyzer()

    test_text = """
    여당은 정부의 정책을 지지하며 경제 성장에 도움이 될 것이라고 환영했다.
    야당은 정부의 일방적인 정책 강행에 강력히 반발하고 있다.
    """

    party_analysis = political.analyze_party_mentions(test_text)
    bias = political.calculate_bias_score(test_text)

    print(f"✅ 정치 분석:")
    print(f"   - 여당 언급: {party_analysis.get('여당', {}).get('count', 0)}회")
    print(f"   - 야당 언급: {party_analysis.get('야당', {}).get('count', 0)}회")
    print(f"   - 편향성 점수: {bias['bias_score']}/10 ({bias['stance']})")
except Exception as e:
    print(f"❌ 오류: {e}")

print("\n" + "=" * 80)
print("테스트 완료!")
print("=" * 80)