"""
FANS 편향성 분석 AI 학습 스크립트
- AI-Hub 라벨링 데이터를 사용한 문장 유형 분류 모델 학습
- 전체 데이터셋 사용 (166,339 문장)
"""

import os
import json
import pickle
import glob
from collections import Counter
from datetime import datetime
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import warnings
warnings.filterwarnings('ignore')

# 경로 설정
BASE_DIR = "/Users/hodduk/Documents/git/FANS/backend/ai/bias-analysis-ai"
TRAIN_DATA_DIR = os.path.join(BASE_DIR, "ai-training/159.문장 유형(추론, 예측 등) 판단 데이터/01-1.정식개방데이터/Training/02.라벨링데이터")
VALID_DATA_DIR = os.path.join(BASE_DIR, "ai-training/159.문장 유형(추론, 예측 등) 판단 데이터/01-1.정식개방데이터/Validation/02.라벨링데이터")
MODEL_DIR = os.path.join(BASE_DIR, "models")

# 모델 디렉토리 생성
os.makedirs(MODEL_DIR, exist_ok=True)

class BiasAnalysisTrainer:
    def __init__(self):
        self.data = []
        self.vectorizer = TfidfVectorizer(max_features=10000, min_df=2, max_df=0.95)
        self.model = None

    def load_json_data(self, data_dir):
        """JSON 라벨링 데이터 로드"""
        json_files = glob.glob(os.path.join(data_dir, "**/*.json"), recursive=True)

        sentences = []
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                    # annotation 배열에서 문장과 라벨 추출
                    if 'annotation' in data:
                        for item in data['annotation']:
                            # 핵심동사가 아닌 문장 유형만 추출
                            if item.get('label') in ['사실형', '추론형', '예측형', '대화형']:
                                sentences.append({
                                    'text': item['text'],
                                    'label': item['label']
                                })
            except Exception as e:
                print(f"파일 읽기 실패 {json_file}: {e}")
                continue

        return sentences

    def load_data(self):
        """학습 데이터 로드"""
        print("=" * 50)
        print("1. 데이터 로딩 시작...")
        print("=" * 50)

        # Training 데이터 로드
        print(f"Training 데이터 로딩: {TRAIN_DATA_DIR}")
        train_sentences = self.load_json_data(TRAIN_DATA_DIR)
        print(f"Training 문장 수: {len(train_sentences)}")

        # Validation 데이터도 학습에 포함
        print(f"\nValidation 데이터 로딩: {VALID_DATA_DIR}")
        valid_sentences = self.load_json_data(VALID_DATA_DIR)
        print(f"Validation 문장 수: {len(valid_sentences)}")

        # 전체 데이터 합치기
        self.data = train_sentences + valid_sentences
        print(f"\n총 학습 데이터 수: {len(self.data)}")

        # 라벨 분포 확인
        labels = [d['label'] for d in self.data]
        label_dist = Counter(labels)
        print("\n라벨 분포:")
        for label, count in sorted(label_dist.items()):
            print(f"  {label}: {count:,} ({count/len(labels)*100:.1f}%)")

    def prepare_features(self):
        """특징 추출"""
        print("\n" + "=" * 50)
        print("2. 특징 추출 중...")
        print("=" * 50)

        texts = [d['text'] for d in self.data]
        labels = [d['label'] for d in self.data]

        X = self.vectorizer.fit_transform(texts)
        y = np.array(labels)

        print(f"특징 차원: {X.shape}")

        return X, y

    def train_models(self, X, y):
        """여러 모델 학습 및 비교"""
        print("\n" + "=" * 50)
        print("3. 모델 학습 시작...")
        print("=" * 50)

        # 학습/테스트 분할
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        print(f"학습 데이터: {X_train.shape[0]:,}")
        print(f"테스트 데이터: {X_test.shape[0]:,}")

        # 모델 정의
        models = {
            'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
            'Random Forest': RandomForestClassifier(n_estimators=200, max_depth=50, random_state=42, n_jobs=-1),
            'Naive Bayes': MultinomialNB()
        }

        best_model = None
        best_score = 0
        best_name = ""

        print("\n모델별 성능 비교:")
        print("-" * 40)

        for name, model in models.items():
            print(f"\n{name} 학습 중...")
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            score = accuracy_score(y_test, y_pred)
            print(f"정확도: {score:.4f}")

            if score > best_score:
                best_score = score
                best_model = model
                best_name = name

        print(f"\n최고 모델: {best_name} (정확도: {best_score:.4f})")

        self.model = best_model
        return X_test, y_test

    def evaluate(self, X_test, y_test):
        """모델 평가"""
        print("\n" + "=" * 50)
        print("4. 상세 평가 결과")
        print("=" * 50)

        y_pred = self.model.predict(X_test)
        print(classification_report(y_test, y_pred))

    def save_model(self):
        """모델 저장"""
        print("\n" + "=" * 50)
        print("5. 모델 저장 중...")
        print("=" * 50)

        # 모델 저장
        model_path = os.path.join(MODEL_DIR, "bias_model.pkl")
        with open(model_path, 'wb') as f:
            pickle.dump(self.model, f)
        print(f"✅ 모델 저장 완료: {model_path}")

        # 벡터라이저 저장
        vectorizer_path = os.path.join(MODEL_DIR, "vectorizer.pkl")
        with open(vectorizer_path, 'wb') as f:
            pickle.dump(self.vectorizer, f)
        print(f"✅ 벡터라이저 저장 완료: {vectorizer_path}")

        # 메타데이터 저장
        metadata = {
            'model_type': type(self.model).__name__,
            'trained_at': datetime.now().isoformat(),
            'n_samples': len(self.data),
            'labels': list(set([d['label'] for d in self.data]))
        }
        metadata_path = os.path.join(MODEL_DIR, "metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"✅ 메타데이터 저장 완료: {metadata_path}")

    def test_model(self):
        """모델 테스트"""
        print("\n" + "=" * 50)
        print("6. 모델 테스트")
        print("=" * 50)

        test_sentences = [
            "정부는 오늘 새로운 경제정책을 발표했다.",
            "전문가들은 내년 경제가 회복될 것으로 예측한다.",
            "이번 정책이 성공하려면 국민의 협조가 필요하다고 강조했다.",
            "김 의원은 '정부 정책에 문제가 있다'고 말했다.",
            "코스피 지수가 2% 상승했다.",
            "분석가들은 주가가 더 오를 가능성이 있다고 본다."
        ]

        print("\n테스트 문장 분류 결과:")
        print("-" * 60)

        for sent in test_sentences:
            X_test = self.vectorizer.transform([sent])
            pred = self.model.predict(X_test)[0]
            proba = self.model.predict_proba(X_test)[0].max()
            print(f"\n문장: {sent}")
            print(f"분류: {pred} (확률: {proba:.2f})")

def main():
    start_time = datetime.now()

    print("🚀 " * 20)
    print("FANS 편향성 분석 AI 학습 시작")
    print("🚀 " * 20)

    # 학습 실행
    trainer = BiasAnalysisTrainer()
    trainer.load_data()
    X, y = trainer.prepare_features()
    X_test, y_test = trainer.train_models(X, y)
    trainer.evaluate(X_test, y_test)
    trainer.save_model()
    trainer.test_model()

    # 완료
    elapsed = datetime.now() - start_time
    print("\n" + "=" * 50)
    print("✨ 학습 완료!")
    print("=" * 50)
    print(f"총 학습 시간: {elapsed}")
    print(f"학습된 모델 위치: {MODEL_DIR}")
    print("\n이제 학습된 모델을 API에서 사용할 수 있습니다.")

if __name__ == "__main__":
    main()