"""
FANS 키워드 추출 시스템
TF-IDF 기반 키워드 추출
"""

from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

class KeywordExtractor:
    def __init__(self):
        self.vectorizer = None
        # 한국어 불용어 리스트 (확장판)
        self.stopwords = {
            # 조사
            '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '으로',
            '에서', '부터', '까지', '이다', '입니다', '합니다', '에게', '한테', '께서',
            # 어미
            '있다', '없다', '했다', '한다', '된다', '이다', '것이다', '있는', '하는',
            '되는', '했던', '했습니다', '했다고', '라고', '이라고', '것으로', '있을',
            '이라면', '라면', '이면', '면', '다면', '에는', '지만', '으면',
            # 대명사/지시어
            '그', '이', '저', '그것', '이것', '저것', '그는', '그녀', '우리', '저희',
            '그들', '이번', '지난', '다음', '오늘', '어제', '내일', '이날', '그날',
            '나도', '너도', '우리는', '저희는',
            # 조동사/보조용언
            '있어', '없어', '되어', '해서', '하여', '되고', '하고', '되며', '하며',
            '되는', '하는', '된', '한', '되다', '하다', '이다', '있었다', '없었다',
            # 접속사
            '그리고', '하지만', '그러나', '그런데', '그래서', '따라서', '또한', '또',
            '및', '등', '등을', '등의', '등에', '등이', '그래서', '그러면', '그럼',
            # 조사가 붙은 형태
            '말했다', '밝혔다', '전했다', '했다', '됐다', '됐습니다', '했습니다',
            '의원은', '대통령은', '대통령이', '대표는', '대표가', '장관은',
            '강조했다', '설명했다', '말했다', '전했다', '발표했다',
            '안보는', '나토는', '이라는', '것이라고',
            # 관형사/부사
            '위해', '위한', '대한', '통해', '따른', '통한', '위해서', '대해',
            '위하여', '대하여', '같은', '같이', '함께', '더욱', '매우', '가장',
            '아주', '정말', '너무', '많이', '조금', '약간',
            # 숫자 패턴
            '10', '15', '20', '30', '10 15', '15 20', '20 30',
            '1', '2', '3', '4', '5', '6', '7', '8', '9',
            # 기타 불필요한 단어
            '것', '수', '등', '때', '곳', '점', '중', '내', '간', '뿐',
            '것이', '것을', '것은', '게', '거', '걸',
            # 접미사
            '들', '적', '들이', '들은'
        }

    def _is_valid_keyword(self, word: str) -> bool:
        """키워드가 유효한지 검증"""
        # 불용어 체크
        if word.lower() in self.stopwords:
            return False
        # 1글자 키워드 제외
        if len(word) <= 1:
            return False
        # 숫자만 있는 키워드 제외
        if word.isdigit():
            return False
        # 특수문자만 있는 키워드 제외
        if not any(c.isalnum() for c in word):
            return False
        return True

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
                            for i in range(len(scores))
                            if scores[i] > 0 and self._is_valid_keyword(feature_names[i])]
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