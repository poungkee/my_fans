"""
⚠️ 이 파일은 더 이상 사용되지 않습니다 ⚠️

Spark ML 분류기 → Simple Classifier API로 대체됨

실제로는 사용되지 않았던 코드입니다.
classification_api.py도 이 분류기를 사용하지 않고
원본 카테고리를 그대로 사용하고 있었습니다.

아래 코드는 참고용으로 주석 처리되었습니다.
필요 시 복구 가능하도록 코드를 삭제하지 않았습니다.
"""

'''
# ===== 아래 코드는 주석 처리됨 (Spark 대체) =====

"""
Spark ML 기반 뉴스 카테고리 분류기
한국어 뉴스를 8개 카테고리로 분류
"""

from pyspark.sql import SparkSession
from pyspark.ml.feature import HashingTF, IDF, Tokenizer, StopWordsRemover
from pyspark.ml.classification import NaiveBayes, NaiveBayesModel
from pyspark.ml import Pipeline, PipelineModel
from pyspark.sql.types import StructType, StructField, StringType, IntegerType
from pyspark.sql.functions import udf, col
import re
import os

class CategoryClassifier:
    """Spark ML을 사용한 뉴스 카테고리 분류기"""

    def __init__(self, spark: SparkSession):
        self.spark = spark
        self.categories = {
            0: '기타',
            1: '정치',
            2: '경제',
            3: '사회',
            4: '생활/문화',
            5: 'IT/과학',
            6: '세계',
            7: '스포츠',
            8: '연예'
        }

        self.category_to_id = {v: k for k, v in self.categories.items()}

        # 한국어 불용어 (간단한 버전)
        self.korean_stopwords = [
            '이', '그', '저', '것', '수', '등', '들', '및', '등', '년', '월', '일',
            '했다', '있다', '이다', '되다', '하다', '이', '가', '을', '를', '에', '의',
            '한', '은', '는', '도', '와', '과', '로', '으로', '으', '이'
        ]

        self.model_path = "/app/models/category_classifier"
        self.pipeline_model = None

    @staticmethod
    def preprocess_text(text):
        """텍스트 전처리"""
        if not text:
            return ""

        # 특수문자 제거 (한글, 영문, 숫자만 유지)
        text = re.sub(r'[^가-힣a-zA-Z0-9\s]', ' ', text)
        # 여러 공백을 하나로
        text = re.sub(r'\s+', ' ', text)
        return text.strip().lower()

    def create_training_data(self):
        """학습용 데이터 생성 (키워드 기반)"""

        # 카테고리별 대표 키워드 샘플
        training_samples = [
            # 정치
            ("국회 의원 법안 정부 대통령 여당 야당 정책", 1),
            ("선거 투표 공약 정당 국무총리 장관", 1),
            ("정치권 여야 국정감사 청와대 개각", 1),
            ("의정 행정 외교 통일 안보 국방부", 1),

            # 경제
            ("기업 경제 시장 주식 증권 금융 은행", 2),
            ("투자 수출 수입 무역 환율 금리 물가", 2),
            ("부동산 코스피 코스닥 반도체 자동차", 2),
            ("삼성 현대 LG SK 매출 영업이익 실적", 2),
            ("경영 CEO 재계 예산 세금 재무부", 2),

            # 사회
            ("사건 사고 범죄 경찰 검찰 법원 판결", 3),
            ("교육 학교 대학 학생 교사 입시 수능", 3),
            ("환경 기후 미세먼지 복지 의료 병원", 3),
            ("고용 실업 노동 임금 최저임금 아파트", 3),

            # 생활/문화
            ("문화 예술 공연 전시 영화 드라마 음악", 4),
            ("여행 관광 맛집 음식 패션 뷰티 화장품", 4),
            ("건강 운동 다이어트 육아 결혼 가족", 4),
            ("반려동물 강아지 고양이 책 도서 소설", 4),

            # IT/과학
            ("IT 과학 기술 컴퓨터 소프트웨어 인터넷", 5),
            ("AI 인공지능 머신러닝 로봇 스마트폰", 5),
            ("반도체 칩 5G 통신 우주 로켓 위성", 5),
            ("의학 바이오 유전자 백신 연구 개발", 5),

            # 세계
            ("미국 중국 일본 러시아 유럽 영국", 6),
            ("트럼프 바이든 시진핑 푸틴 외신 해외", 6),
            ("국제 세계 글로벌 UN NATO 전쟁", 6),
            ("외교 정상회담 협정 제재 달러 유로", 6),

            # 스포츠
            ("스포츠 축구 야구 농구 배구 골프", 7),
            ("선수 감독 경기 대회 리그 월드컵", 7),
            ("K리그 KBO 올림픽 손흥민 메시", 7),
            ("득점 골 승리 우승 메달 기록", 7),

            # 연예
            ("연예 연예인 가수 배우 아이돌 BTS", 7),
            ("드라마 영화 예능 방송 넷플릭스", 8),
            ("데뷔 컴백 앨범 신곡 시청률 흥행", 8),
            ("결혼 열애 스캔들 소속사 팬미팅", 8),
        ]

        # 더 많은 학습 데이터를 위해 조합 생성
        extended_samples = []
        for text, label in training_samples:
            extended_samples.append((text, label))
            # 단어 순서를 바꿔서 변형 데이터 추가
            words = text.split()
            if len(words) > 3:
                import random
                random.shuffle(words)
                extended_samples.append((' '.join(words), label))

        schema = StructType([
            StructField("text", StringType(), True),
            StructField("label", IntegerType(), True)
        ])

        return self.spark.createDataFrame(extended_samples, schema)

    def train_model(self):
        """모델 학습"""
        print("📚 학습 데이터 생성 중...")
        training_data = self.create_training_data()
        training_data.show(5, truncate=False)

        print("🔧 ML 파이프라인 생성 중...")

        # 1. Tokenizer: 텍스트를 단어로 분리
        tokenizer = Tokenizer(inputCol="text", outputCol="words")

        # 2. StopWordsRemover: 불용어 제거
        remover = StopWordsRemover(inputCol="words", outputCol="filtered_words")
        remover.setStopWords(self.korean_stopwords)

        # 3. HashingTF: 단어를 숫자 벡터로 변환
        hashingTF = HashingTF(inputCol="filtered_words", outputCol="raw_features", numFeatures=1000)

        # 4. IDF: TF-IDF 계산
        idf = IDF(inputCol="raw_features", outputCol="features")

        # 5. Naive Bayes 분류기
        nb = NaiveBayes(smoothing=1.0, modelType="multinomial")

        # 파이프라인 생성
        pipeline = Pipeline(stages=[tokenizer, remover, hashingTF, idf, nb])

        print("🎓 모델 학습 시작...")
        self.pipeline_model = pipeline.fit(training_data)

        # 모델 저장
        print(f"💾 모델 저장 중: {self.model_path}")
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        self.pipeline_model.write().overwrite().save(self.model_path)

        print("✅ 모델 학습 완료!")

    def load_model(self):
        """저장된 모델 로드"""
        try:
            if os.path.exists(self.model_path):
                print(f"📂 모델 로딩: {self.model_path}")
                self.pipeline_model = PipelineModel.load(self.model_path)
                print("✅ 모델 로드 성공")
                return True
            else:
                print(f"⚠️ 모델 파일 없음: {self.model_path}")
                return False
        except Exception as e:
            print(f"⚠️ 모델 로드 실패: {e}")
            return False

    def predict(self, title: str, content: str) -> tuple:
        """
        카테고리 예측

        Returns:
            (category_name, category_id, confidence)
        """
        if not self.pipeline_model:
            if not self.load_model():
                print("🎓 모델이 없어서 새로 학습합니다...")
                self.train_model()

        # 제목과 본문 합치기 (제목 가중치)
        text = f"{title} {title} {content[:500]}"

        # 데이터프레임 생성
        schema = StructType([
            StructField("text", StringType(), True)
        ])
        df = self.spark.createDataFrame([(text,)], schema)

        # 예측
        predictions = self.pipeline_model.transform(df)

        # 결과 추출
        result = predictions.select("prediction", "probability").collect()[0]
        category_id = int(result.prediction)
        probability = result.probability.toArray()
        confidence = float(max(probability))

        category_name = self.categories.get(category_id, '기타')

        print(f"🎯 분류 결과: {category_name} (신뢰도: {confidence:.2f})")

        return category_name, category_id, confidence


if __name__ == "__main__":
    # 테스트
    spark = SparkSession.builder \
        .appName("CategoryClassifier") \
        .master("local[*]") \
        .getOrCreate()

    classifier = CategoryClassifier(spark)

    # 모델 학습
    classifier.train_model()

    # 테스트
    test_cases = [
        ("국회, 새로운 법안 통과", "국회에서 여야 의원들이 모여 새로운 법안을 통과시켰다."),
        ("삼성전자, 신제품 발표", "삼성전자가 새로운 스마트폰을 발표했다. 반도체 기술이 적용되었다."),
        ("손흥민 골 득점", "토트넘 손흥민이 프리미어리그에서 골을 넣었다."),
    ]

    for title, content in test_cases:
        category, cat_id, confidence = classifier.predict(title, content)
        print(f"제목: {title}")
        print(f"결과: {category} (ID: {cat_id}, 신뢰도: {confidence:.2f})\n")

    spark.stop()

# ===== 주석 처리 끝 =====
'''
