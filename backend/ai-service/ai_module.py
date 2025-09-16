# app/ai_module.py
import re
from typing import Optional
from transformers import pipeline
import torch

class NewsAISummarizer:
    def __init__(self):
        """뉴스 요약 AI 모델 초기화"""
        self.summarizer = None
        self._load_model()

    def _load_model(self):
        """한국어 요약 모델 로드"""
        try:
            # 경량화된 한국어 요약 모델 사용
            model_name = "eenzeenee/t5-base-korean-summarization"
            self.summarizer = pipeline(
                "summarization",
                model=model_name,
                tokenizer=model_name,
                device=0 if torch.cuda.is_available() else -1  # GPU 사용 가능하면 GPU, 아니면 CPU
            )
            print(f"[AI] 모델 로드 완료: {model_name}")
        except Exception as e:
            print(f"[AI] 모델 로드 실패: {e}")
            self.summarizer = None

    def clean_text(self, text: str) -> str:
        """텍스트 전처리"""
        if not text:
            return ""

        # HTML 태그 제거
        text = re.sub(r'<[^>]+>', '', text)
        # 특수문자 정리
        text = re.sub(r'[^\w\s가-힣.,!?]', '', text)
        # 연속된 공백 제거
        text = ' '.join(text.split())

        return text.strip()

    def summarize_news(self, title: str, content: str, max_length: int = 100) -> dict:
        """뉴스 기사 요약"""
        try:
            if not self.summarizer:
                return {
                    "summary": "AI 모델을 사용할 수 없습니다.",
                    "keywords": [],
                    "success": False
                }

            # 텍스트 전처리
            cleaned_title = self.clean_text(title or "")
            cleaned_content = self.clean_text(content or "")

            # 제목 + 내용 결합 (토큰 제한 고려)
            full_text = f"{cleaned_title}. {cleaned_content}"

            # 텍스트가 너무 짧으면 원문 반환
            if len(full_text.strip()) < 50:
                return {
                    "summary": cleaned_content or cleaned_title,
                    "keywords": self.extract_keywords(full_text),
                    "success": True
                }

            # 토큰 길이 제한 (대략 512토큰)
            if len(full_text) > 2000:
                full_text = full_text[:2000] + "..."

            # AI 요약 생성 (입력 길이에 따라 max_length 자동 조정)
            actual_max_length = min(max_length, len(full_text) // 2) if len(full_text) > 50 else max_length
            summary_result = self.summarizer(
                full_text,
                max_length=actual_max_length,
                min_length=min(30, actual_max_length - 10),
                do_sample=True,
                temperature=0.7
            )

            summary = summary_result[0]['summary_text'] if summary_result else full_text

            return {
                "summary": summary,
                "keywords": self.extract_keywords(full_text),
                "success": True
            }

        except Exception as e:
            print(f"[AI] 요약 생성 실패: {e}")
            # 실패시 원본 텍스트의 앞부분을 요약으로 사용
            fallback = (content or title or "")[:max_length] + "..."
            return {
                "summary": fallback,
                "keywords": [],
                "success": False,
                "error": str(e)
            }

    def extract_keywords(self, text: str, top_k: int = 5) -> list:
        """간단한 키워드 추출 (빈도 기반)"""
        try:
            if not text:
                return []

            # 한글 단어만 추출 (2글자 이상)
            words = re.findall(r'[가-힣]{2,}', text)

            # 불용어 제거
            stopwords = {'그리고', '하지만', '그런데', '이러한', '그래서', '따라서',
                        '때문에', '이번', '지난', '오늘', '어제', '내일', '기자', '취재'}
            words = [w for w in words if w not in stopwords]

            # 빈도 계산
            word_freq = {}
            for word in words:
                word_freq[word] = word_freq.get(word, 0) + 1

            # 빈도순 정렬하여 상위 키워드 반환
            keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
            return [word for word, freq in keywords[:top_k]]

        except Exception as e:
            print(f"[AI] 키워드 추출 실패: {e}")
            return []

# AIModule 클래스 (main.py 호환성)
class AIModule:
    def __init__(self):
        self.summarizer = NewsAISummarizer()
    
    def summarize(self, text: str, max_length: int = 100) -> str:
        """간단한 요약 인터페이스"""
        result = self.summarizer.summarize_news("", text, max_length)
        return result["summary"]

# 전역 인스턴스
ai_summarizer = NewsAISummarizer()