"""
API 엔드포인트 테스트
"""

import requests
import json

BASE_URL = "http://localhost:8002"

article_128 = """
방송미디어통신위원회(방미통위) 설치 및 운영에 관한 법안이 27일 국회 본회의를 통과하면서 방송통신위원회(방통위)는 17년 만에 역사 속으로 사라지게 됐다.
전 정부에서 임명된 이진숙 방통위원장 임기도 자동 종료된다.
"""

def test_health():
    print("=" * 80)
    print("Health Check")
    print("=" * 80)
    response = requests.get(f"{BASE_URL}/health")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

def test_sentiment():
    print("\n" + "=" * 80)
    print("Sentiment Analysis")
    print("=" * 80)
    response = requests.post(
        f"{BASE_URL}/analyze/sentiment",
        json={"text": article_128}
    )
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

def test_keywords():
    print("\n" + "=" * 80)
    print("Keyword Extraction")
    print("=" * 80)
    response = requests.post(
        f"{BASE_URL}/analyze/keywords",
        json={"text": article_128}
    )
    result = response.json()
    print(f"추출된 키워드:")
    for i, kw in enumerate(result['keywords'][:10], 1):
        print(f"  {i}. {kw['word']}: {kw['score']:.3f}")

def test_political():
    print("\n" + "=" * 80)
    print("Political Analysis")
    print("=" * 80)

    political_article = """
    정부는 새로운 경제 정책을 발표했다.
    여당은 정부의 정책을 적극 지지하며 경제 성장에 큰 도움이 될 것이라고 환영했다.
    야당은 정부의 일방적인 정책 강행에 강력히 반발하고 있다.
    더불어민주당 대변인은 정책의 효과가 의문스럽다고 비판했다.
    """

    response = requests.post(
        f"{BASE_URL}/analyze/political",
        json={"text": political_article}
    )
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

def test_full():
    print("\n" + "=" * 80)
    print("Full Analysis")
    print("=" * 80)
    response = requests.post(
        f"{BASE_URL}/analyze/full",
        json={"text": article_128}
    )
    result = response.json()

    print(f"\n감성 분석:")
    print(f"  감성: {result['sentiment']['sentiment']}")
    print(f"  점수: {result['sentiment']['score']:.2f}")

    print(f"\n키워드 (상위 5개):")
    for i, kw in enumerate(result['keywords'][:5], 1):
        print(f"  {i}. {kw['word']}: {kw['score']:.3f}")

    if result['political']:
        print(f"\n정치 분석:")
        print(f"  편향성: {result['political']['bias_score']}/10 ({result['political']['stance']})")

if __name__ == "__main__":
    try:
        test_health()
        test_sentiment()
        test_keywords()
        test_political()
        test_full()

        print("\n" + "=" * 80)
        print("모든 테스트 완료!")
        print("=" * 80)
    except requests.exceptions.ConnectionError:
        print("오류: AI 서비스가 실행되지 않았습니다.")
        print("실행: cd /Users/hodduk/Documents/git/FANS/backend/ai/bias-analysis-ai && python3 main.py")
    except Exception as e:
        print(f"오류: {e}")