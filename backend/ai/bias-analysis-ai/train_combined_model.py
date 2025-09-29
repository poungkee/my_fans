"""
FANS 통합 편향성 분석 AI 학습 스크립트
- 159번: 문장 유형 판단 데이터 (148,467 문장)
- 138번: 무해성 평가 데이터 (20,000 질문)
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
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import warnings
warnings.filterwarnings('ignore')

# 경로 설정
BASE_DIR = "/Users/hodduk/Documents/git/FANS/backend/ai/bias-analysis-ai"
TRAIN_DATA_DIR_159 = os.path.join(BASE_DIR, "ai-training/159.문장 유형(추론, 예측 등) 판단 데이터/01-1.정식개방데이터/Training/02.라벨링데이터")
VALID_DATA_DIR_159 = os.path.join(BASE_DIR, "ai-training/159.문장 유형(추론, 예측 등) 판단 데이터/01-1.정식개방데이터/Validation/02.라벨링데이터")
HARMLESSNESS_DIR = os.path.join(BASE_DIR, "ai-training/138.초거대_언어모델_신뢰성_벤치마크_데이터/extracted/harmlessness")
MODEL_DIR = os.path.join(BASE_DIR, "models")

os.makedirs(MODEL_DIR, exist_ok=True)

class CombinedBiasAnalysisTrainer:
    def __init__(self):
        self.data = []
        self.vectorizer = TfidfVectorizer(max_features=15000, min_df=2, max_df=0.95)
        self.model = None

    def load_159_data(self, data_dir):
        """159번 문장 유형 데이터 로드"""
        json_files = glob.glob(os.path.join(data_dir, "**/*.json"), recursive=True)
        sentences = []

        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if 'annotation' in data:
                        for item in data['annotation']:
                            if item.get('label') in ['사실형', '추론형', '예측형', '대화형']:
                                sentences.append({
                                    'text': item['text'],
                                    'label': item['label'],
                                    'source': '159'
                                })
            except Exception as e:
                continue

        return sentences

    def load_138_harmlessness_data(self):
        """138번 무해성 데이터에서 편향성 관련 데이터만 로드"""
        json_files = glob.glob(os.path.join(HARMLESSNESS_DIR, "*.json"))
        bias_data = []

        print(f"138번 무해성 데이터 로딩 중... (총 {len(json_files)}개 파일)")

        for json_file in json_files[:12742]:  # 편향성 분석에 유용한 63.7% 데이터만
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                    # 뉴스 편향성 분석에 유용한 카테고리만 선택
                    if data['Category'] in ['Bias', 'Hate'] or \
                       data['Subcategory'] in ['Political affiliation', 'Region',
                                              'Race&Ethnicity&Nationality', 'Gender&Sexual Orientation', 'Job']:

                        # 프롬프트를 기반으로 편향성 라벨 생성
                        label = self.map_to_bias_label(data['Category'], data['Subcategory'])

                        bias_data.append({
                            'text': data['Prompt'],
                            'label': label,
                            'source': '138',
                            'category': data['Category'],
                            'subcategory': data['Subcategory']
                        })

                        # 답변들도 학습 데이터로 활용 (라벨이 1인 적절한 답변만)
                        if 'Candidate_answer' in data and 'label' in data:
                            for i, (key, answer) in enumerate(data['Candidate_answer'].items()):
                                if i < len(data['label']) and data['label'][i] == 1:
                                    bias_data.append({
                                        'text': answer,
                                        'label': '중립형',  # 적절한 답변은 중립적
                                        'source': '138_answer'
                                    })

            except Exception as e:
                continue

        return bias_data

    def map_to_bias_label(self, category, subcategory):
        """138번 카테고리를 편향성 라벨로 매핑"""
        if category == 'Hate':
            return '혐오형'
        elif subcategory == 'Political affiliation':
            return '정치편향형'
        elif subcategory == 'Region':
            return '지역편향형'
        elif subcategory in ['Race&Ethnicity&Nationality', 'Gender&Sexual Orientation']:
            return '차별형'
        elif category == 'Bias':
            return '편향형'
        else:
            return '중립형'

    def load_all_data(self):
        """모든 데이터 통합 로드"""
        print("=" * 50)
        print("1. 데이터 로딩 시작...")
        print("=" * 50)

        # 159번 데이터 로드
        print("\n[159번 문장 유형 데이터]")
        print(f"Training 데이터 로딩: {TRAIN_DATA_DIR_159}")
        train_159 = self.load_159_data(TRAIN_DATA_DIR_159)
        print(f"Training 문장 수: {len(train_159):,}")

        print(f"Validation 데이터 로딩: {VALID_DATA_DIR_159}")
        valid_159 = self.load_159_data(VALID_DATA_DIR_159)
        print(f"Validation 문장 수: {len(valid_159):,}")

        # 138번 데이터 로드
        print("\n[138번 무해성 데이터]")
        bias_138 = self.load_138_harmlessness_data()
        print(f"편향성 관련 데이터 수: {len(bias_138):,}")

        # 전체 데이터 합치기
        self.data = train_159 + valid_159 + bias_138
        print(f"\n총 학습 데이터 수: {len(self.data):,}")

        # 라벨 분포 확인
        labels = [d['label'] for d in self.data]
        label_dist = Counter(labels)
        print("\n통합 라벨 분포:")
        for label, count in sorted(label_dist.items()):
            print(f"  {label}: {count:,} ({count/len(labels)*100:.1f}%)")

        # 데이터 소스별 분포
        sources = [d.get('source', 'unknown') for d in self.data]
        source_dist = Counter(sources)
        print("\n데이터 소스별 분포:")
        for source, count in sorted(source_dist.items()):
            print(f"  {source}: {count:,} ({count/len(sources)*100:.1f}%)")

    def prepare_features(self):
        """특징 추출"""
        print("\n" + "=" * 50)
        print("2. 특징 추출 중...")
        print("=" * 50)

        texts = [d['text'] for d in self.data]
        labels = [d['label'] for d in self.data]

        X = self.vectorizer.fit_transform(texts)
        y = np.array(labels)

        print(f"특징 벡터 차원: {X.shape}")
        print(f"고유 라벨 수: {len(np.unique(y))}")

        return X, y

    def train_model(self, X, y):
        """모델 학습"""
        print("\n" + "=" * 50)
        print("3. 모델 학습 중...")
        print("=" * 50)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        print(f"학습 데이터: {X_train.shape[0]:,}")
        print(f"테스트 데이터: {X_test.shape[0]:,}")

        # Logistic Regression 모델 학습
        print("\n통합 편향성 분석 모델 학습 중...")
        start_time = datetime.now()

        self.model = LogisticRegression(
            max_iter=1000,
            multi_class='ovr',
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)

        training_time = datetime.now() - start_time
        print(f"학습 시간: {training_time}")

        # 성능 평가
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)

        print(f"\n테스트 정확도: {accuracy:.3f}")
        print("\n상세 성능 보고서:")
        print(classification_report(y_test, y_pred))

        return accuracy

    def save_model(self):
        """모델 저장"""
        print("\n" + "=" * 50)
        print("4. 모델 저장 중...")
        print("=" * 50)

        # 모델 저장
        model_path = os.path.join(MODEL_DIR, "combined_bias_model.pkl")
        with open(model_path, 'wb') as f:
            pickle.dump(self.model, f)
        print(f"모델 저장: {model_path}")

        # 벡터라이저 저장
        vectorizer_path = os.path.join(MODEL_DIR, "combined_vectorizer.pkl")
        with open(vectorizer_path, 'wb') as f:
            pickle.dump(self.vectorizer, f)
        print(f"벡터라이저 저장: {vectorizer_path}")

        # 메타데이터 저장
        metadata = {
            "model_type": "LogisticRegression_Combined",
            "trained_at": datetime.now().isoformat(),
            "n_samples_159": len([d for d in self.data if '159' in d.get('source', '')]),
            "n_samples_138": len([d for d in self.data if '138' in d.get('source', '')]),
            "total_samples": len(self.data),
            "labels": sorted(list(set([d['label'] for d in self.data]))),
            "features": self.vectorizer.max_features
        }

        metadata_path = os.path.join(MODEL_DIR, "combined_metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"메타데이터 저장: {metadata_path}")

        print("\n학습 완료 요약:")
        print(f"- 159번 데이터: {metadata['n_samples_159']:,}개")
        print(f"- 138번 데이터: {metadata['n_samples_138']:,}개")
        print(f"- 총 데이터: {metadata['total_samples']:,}개")
        print(f"- 라벨 종류: {len(metadata['labels'])}개")

def main():
    print("\n" + "=" * 60)
    print("FANS 통합 편향성 분석 AI 학습 시작")
    print("=" * 60)

    trainer = CombinedBiasAnalysisTrainer()

    # 데이터 로드
    trainer.load_all_data()

    # 특징 추출
    X, y = trainer.prepare_features()

    # 모델 학습
    accuracy = trainer.train_model(X, y)

    # 모델 저장
    trainer.save_model()

    print("\n" + "=" * 60)
    print("통합 모델 학습 완료!")
    print(f"최종 정확도: {accuracy:.3f}")
    print("=" * 60)

if __name__ == "__main__":
    main()