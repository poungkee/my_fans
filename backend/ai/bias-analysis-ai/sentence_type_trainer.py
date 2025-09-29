#!/usr/bin/env python3
"""
AI-Hub 데이터를 사용한 문장 유형 분류 모델 학습
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, List, Tuple
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback
)
from torch.utils.data import Dataset
import warnings
warnings.filterwarnings('ignore')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SentenceTypeDataset(Dataset):
    """문장 유형 분류 데이터셋"""

    def __init__(self, texts, labels, tokenizer, max_length=512):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

class SentenceTypeTrainer:
    """문장 유형 분류 모델 학습기"""

    def __init__(self, model_name: str = "beomi/KcELECTRA-base-v2022"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.label_map = {}
        self.reverse_label_map = {}

    def load_aihub_data(self, data_path: str, sample_size: int = None) -> pd.DataFrame:
        """AI-Hub 데이터 로드"""
        all_data = []

        # AI-Hub 데이터 파일 패턴
        patterns = [
            "TL_뉴스_사회*.json",
            "TL_뉴스_금융*.json",
            "TL_뉴스_문화*.json",
            "TL_뉴스_정치*.json",
            "TL_뉴스_경제*.json"
        ]

        for pattern in patterns:
            files = list(Path(data_path).glob(pattern))
            for file_path in files[:1]:  # 각 카테고리에서 1개 파일만
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    # 데이터 추출
                    for doc in data.get('document', [])[:sample_size]:
                        for sentence in doc.get('sentence', []):
                            sentence_data = {
                                'text': sentence.get('form', ''),
                                'sentence_type': sentence.get('sentence_type', 'unknown')
                            }
                            if sentence_data['text'] and sentence_data['sentence_type'] != 'unknown':
                                all_data.append(sentence_data)

                    logger.info(f"로드 완료: {file_path.name} - {len(all_data)}개 문장")

                except Exception as e:
                    logger.warning(f"파일 로드 실패 {file_path}: {e}")

        return pd.DataFrame(all_data)

    def prepare_data(self, df: pd.DataFrame) -> Tuple[List[str], List[int]]:
        """데이터 전처리"""
        # 라벨 정규화
        label_mapping = {
            '사실형-진술': '사실형',
            '사실형-인용': '사실형',
            '추론형-추측': '추론형',
            '추론형-분석': '추론형',
            '예측형': '예측형',
            '대화형': '대화형'
        }

        df['sentence_type'] = df['sentence_type'].map(
            lambda x: label_mapping.get(x, x)
        )

        # 주요 유형만 필터링
        main_types = ['사실형', '추론형', '예측형', '대화형']
        df = df[df['sentence_type'].isin(main_types)]

        # 라벨 인코딩
        unique_labels = sorted(df['sentence_type'].unique())
        self.label_map = {label: idx for idx, label in enumerate(unique_labels)}
        self.reverse_label_map = {idx: label for label, idx in self.label_map.items()}

        texts = df['text'].tolist()
        labels = [self.label_map[label] for label in df['sentence_type']]

        return texts, labels

    def train_model(
        self,
        train_texts: List[str],
        train_labels: List[int],
        val_texts: List[str],
        val_labels: List[int],
        output_dir: str = "./models/sentence_type_model",
        num_epochs: int = 3,
        batch_size: int = 16,
        learning_rate: float = 2e-5
    ):
        """모델 학습"""
        # 토크나이저 및 모델 로드
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name,
            num_labels=len(self.label_map),
            ignore_mismatched_sizes=True
        )
        self.model.to(self.device)

        # 데이터셋 생성
        train_dataset = SentenceTypeDataset(train_texts, train_labels, self.tokenizer)
        val_dataset = SentenceTypeDataset(val_texts, val_labels, self.tokenizer)

        # 학습 설정
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            warmup_ratio=0.1,
            weight_decay=0.01,
            logging_dir=f'{output_dir}/logs',
            logging_steps=100,
            evaluation_strategy="steps",
            eval_steps=500,
            save_strategy="steps",
            save_steps=500,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            save_total_limit=2,
            remove_unused_columns=False,
            push_to_hub=False,
            report_to="none",
            seed=42
        )

        # 학습기 생성
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            tokenizer=self.tokenizer,
            callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
        )

        # 학습 시작
        logger.info("모델 학습 시작...")
        train_result = trainer.train()

        # 모델 저장
        trainer.save_model()
        self.tokenizer.save_pretrained(output_dir)

        # 라벨 맵 저장
        with open(f"{output_dir}/label_map.json", 'w', encoding='utf-8') as f:
            json.dump({
                'label_map': self.label_map,
                'reverse_label_map': self.reverse_label_map
            }, f, ensure_ascii=False, indent=2)

        return train_result

    def evaluate_model(self, test_texts: List[str], test_labels: List[int]) -> Dict:
        """모델 평가"""
        if not self.model:
            raise ValueError("모델이 로드되지 않았습니다")

        self.model.eval()
        predictions = []

        with torch.no_grad():
            for text in test_texts:
                inputs = self.tokenizer(
                    text,
                    truncation=True,
                    padding=True,
                    max_length=512,
                    return_tensors='pt'
                ).to(self.device)

                outputs = self.model(**inputs)
                pred = torch.argmax(outputs.logits, dim=-1)
                predictions.append(pred.cpu().numpy()[0])

        # 평가 지표 계산
        accuracy = accuracy_score(test_labels, predictions)
        report = classification_report(
            test_labels,
            predictions,
            target_names=list(self.label_map.keys()),
            output_dict=True
        )

        return {
            'accuracy': accuracy,
            'classification_report': report
        }

def main():
    """메인 실행 함수"""
    print("🚀 AI-Hub 데이터로 문장 유형 분류 모델 학습 시작!")

    # 학습기 초기화
    trainer = SentenceTypeTrainer()

    # 데이터 경로 설정
    data_paths = [
        "/Users/hodduk/Downloads/ai_hub_data",
        "/tmp/ai_hub_data",
        "./data"
    ]

    data_path = None
    for path in data_paths:
        if os.path.exists(path):
            data_path = path
            break

    if not data_path:
        logger.error("AI-Hub 데이터 경로를 찾을 수 없습니다")
        return

    logger.info("=== 문장 유형 분류 모델 학습 시작 ===")

    # 데이터 로드
    logger.info(f"AI-Hub 데이터 로딩 중... (경로: {data_path})")
    df = trainer.load_aihub_data(data_path, sample_size=1000)

    if df.empty:
        logger.error("데이터를 로드할 수 없습니다")
        return

    # 데이터 준비
    logger.info(f"데이터 준비 완료: {len(df)}개 문장")
    texts, labels = trainer.prepare_data(df)

    # 데이터 분할
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
    )

    logger.info(f"학습 데이터: {len(X_train)}개, 검증 데이터: {len(X_val)}개, 테스트 데이터: {len(X_test)}개")

    # 모델 학습
    trainer.train_model(
        X_train, y_train,
        X_val, y_val,
        num_epochs=3,
        batch_size=8
    )

    # 모델 평가
    logger.info("모델 평가 중...")
    results = trainer.evaluate_model(X_test, y_test)

    logger.info(f"테스트 정확도: {results['accuracy']:.4f}")
    logger.info("분류 보고서:")
    for label, metrics in results['classification_report'].items():
        if label not in ['accuracy', 'macro avg', 'weighted avg']:
            logger.info(f"  {label}: precision={metrics['precision']:.3f}, recall={metrics['recall']:.3f}, f1={metrics['f1-score']:.3f}")

    print("✅ 모델 학습 완료! 모델이 ./models/sentence_type_model에 저장되었습니다.")

if __name__ == "__main__":
    main()