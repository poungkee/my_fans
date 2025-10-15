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

class NewsCategoryClassifier:
    """뉴스 카테고리 분류기"""

    def __init__(self):
        """카테고리 키워드 맵 초기화"""
        self.category_keywords = {
            '정치': ['정부', '국회', '의원', '대통령', '장관', '정당', '민주당', '국민의힘', '선거',
                   '법안', '정책', '행정', '여당', '야당', '의회', '입법', '총리', '청와대', '국정'],
            '경제': ['경제', '금융', '증시', '주식', '코스피', '달러', '환율', '기업', '은행',
                   '투자', '부동산', '시장', '매출', '수익', '금리', '채권', '펀드', '재계', '상장', '거래'],
            '사회': ['경찰', '사건', '사고', '재판', '법원', '검찰', '범죄', '화재', '교통',
                   '안전', '복지', '교육', '학교', '학생', '의료', '병원', '환경', '재난', '피해'],
            'IT/과학': ['AI', '인공지능', '기술', '과학', '연구', '개발', 'IT', '소프트웨어',
                      '하드웨어', '반도체', '전자', '로봇', '우주', '바이오', '의학', '실험', '혁신'],
            '세계': ['미국', '중국', '일본', '러시아', '유럽', '트럼프', '바이든', '국제',
                   '외교', '전쟁', '분쟁', '유엔', 'NATO', 'G7', '정상회담', '해외', '글로벌'],
            '연예': ['배우', '가수', '아이돌', 'K-POP', '영화', '드라마', 'MV', '음악',
                   '방송', '연예인', '스타', '엔터', '걸그룹', '보이그룹', '데뷔', '컴백'],
            '스포츠': ['야구', '축구', '농구', '배구', '골프', '올림픽', 'MLB', 'NBA',
                    '선수', '경기', '우승', '감독', '구단', '리그', '월드컵', '승리', '패배'],
            '생활/문화': ['여행', '맛집', '레시피', '패션', '뷰티', '문화', '전시', '공연',
                       '축제', '요리', '건강', '다이어트', '운동', '취미', '책', '미술', '음악회']
        }

    def classify(self, title: str, content: str = "") -> str:
        """기사 제목과 내용을 분석하여 카테고리 분류"""
        try:
            # 제목과 내용 결합
            text = f"{title} {content}".lower()

            # 각 카테고리별 점수 계산
            scores = {}
            for category, keywords in self.category_keywords.items():
                score = sum(1 for keyword in keywords if keyword.lower() in text)
                if score > 0:
                    scores[category] = score

            # 점수가 가장 높은 카테고리 반환
            if scores:
                best_category = max(scores, key=scores.get)
                # 최소 2개 이상의 키워드가 매칭되어야 함
                if scores[best_category] >= 2:
                    return best_category

            # 분류 불가능한 경우 기타
            return '기타'

        except Exception as e:
            print(f"[AI] 카테고리 분류 실패: {e}")
            return '기타'

    def classify_batch(self, articles: list) -> list:
        """여러 기사 일괄 분류"""
        results = []
        for article in articles:
            title = article.get('title', '')
            content = article.get('content', '')
            category = self.classify(title, content)
            results.append({
                'title': title,
                'category': category
            })
        return results

# 전역 인스턴스
ai_summarizer = NewsAISummarizer()
category_classifier = NewsCategoryClassifier()