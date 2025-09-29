"""
FANS 키워드 추출 시스템
TF-IDF 기반 키워드 추출
"""

from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

class KeywordExtractor:
    def __init__(self):
        self.vectorizer = None

    def extract(self, text: str, top_n: int = 10) -> list:
        """
        단일 텍스트에서 키워드 추출
        """
        try:
            vectorizer = TfidfVectorizer(
                max_features=100,
                min_df=1,
                ngram_range=(1, 2)
            )
            tfidf_matrix = vectorizer.fit_transform([text])
            feature_names = vectorizer.get_feature_names_out()
            scores = tfidf_matrix.toarray()[0]

            keyword_scores = [(feature_names[i], scores[i])
                            for i in range(len(scores)) if scores[i] > 0]
            keyword_scores.sort(key=lambda x: x[1], reverse=True)

            return keyword_scores[:top_n]
        except Exception as e:
            print(f"키워드 추출 오류: {e}")
            return []

    def extract_from_multiple(self, texts: list, top_n: int = 10) -> dict:
        """
        여러 텍스트에서 키워드 추출
        """
        try:
            tfidf_matrix = self.vectorizer.fit_transform(texts)
            feature_names = self.vectorizer.get_feature_names_out()

            result = {}
            for idx, text in enumerate(texts):
                scores = tfidf_matrix[idx].toarray()[0]
                keyword_scores = [(feature_names[i], scores[i])
                                for i in range(len(scores)) if scores[i] > 0]
                keyword_scores.sort(key=lambda x: x[1], reverse=True)
                result[idx] = keyword_scores[:top_n]

            return result
        except Exception as e:
            print(f"키워드 추출 오류: {e}")
            return {}


if __name__ == "__main__":
    extractor = KeywordExtractor()

    test_text = """
    정부는 오늘 새로운 경제 정책을 발표했다.
    이번 정책은 경제 성장과 일자리 창출을 목표로 한다.
    야당은 정부의 정책에 대해 비판적인 입장을 보이고 있다.
    전문가들은 이 정책의 효과에 대해 의견이 엇갈리고 있다.
    """

    print("=" * 60)
    print("키워드 추출 테스트")
    print("=" * 60)

    keywords = extractor.extract(test_text, top_n=10)

    print(f"\n추출된 키워드 (상위 10개):")
    for i, (keyword, score) in enumerate(keywords, 1):
        print(f"{i}. {keyword}: {score:.3f}")