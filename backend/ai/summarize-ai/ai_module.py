# app/ai_module.py
import re
from typing import Optional
from transformers import pipeline
import torch
import os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

try:
    from kiwipiepy import Kiwi
    KIWI_AVAILABLE = True
except ImportError:
    KIWI_AVAILABLE = False
    print("[경고] kiwipiepy가 설치되지 않았습니다. 기본 키워드 추출을 사용합니다.")

class KeywordExtractor:
    """TF-IDF 기반 키워드 추출 + kiwipiepy 형태소 분석"""

    def __init__(self, stopwords_file='stopwords.txt'):
        self.vectorizer = None
        self.kiwi = Kiwi() if KIWI_AVAILABLE else None

        # 불용어 파일에서 로드
        self.stopwords = self._load_stopwords(stopwords_file)
        if self.stopwords:
            print(f"[키워드 추출기] 불용어 {len(self.stopwords)}개 로드 완료")

    def _load_stopwords(self, filepath):
        """stopwords.txt 파일에서 불용어 로드"""
        stopwords = set()

        # 파일 경로 확인 (상대 경로 처리)
        if not os.path.isabs(filepath):
            # 현재 스크립트의 디렉토리 기준
            script_dir = os.path.dirname(os.path.abspath(__file__))
            filepath = os.path.join(script_dir, filepath)

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    # 주석(#)과 빈 줄 무시
                    if line and not line.startswith('#'):
                        stopwords.add(line)
            return stopwords
        except FileNotFoundError:
            print(f"[경고] 불용어 파일을 찾을 수 없습니다: {filepath}")
            print("[경고] 기본 불용어 세트를 사용합니다.")
            # 기본 불용어 (최소한)
            return {
                '있다', '하다', '되다', '이다', '것', '수', '등', '때',
                '기자', '취재', '보도', '통해', '대해', '위해'
            }
        except Exception as e:
            print(f"[오류] 불용어 파일 로드 실패: {e}")
            return set()

    def _extract_nouns(self, text: str) -> list:
        """형태소 분석으로 명사만 추출"""
        if not self.kiwi:
            # Kiwi 없으면 간단한 정규식 사용
            words = re.findall(r'[가-힣]{2,}', text)
            return [w for w in words if w not in self.stopwords]

        try:
            # 품사 태깅 (Kiwi.tokenize)
            tokens = self.kiwi.tokenize(text)

            # 명사만 추출 (NNG: 일반명사, NNP: 고유명사, NNB: 의존명사)
            nouns = [
                token.form for token in tokens
                if token.tag in ['NNG', 'NNP', 'NNB']  # 명사만
                and len(token.form) >= 2  # 2글자 이상
                and token.form not in self.stopwords  # 불용어 제외
                and not token.form.isdigit()  # 숫자 제외
            ]

            return nouns

        except Exception as e:
            print(f"명사 추출 오류: {e}")
            return []

    def extract(self, text: str, top_n: int = 10) -> list:
        """단일 텍스트에서 키워드 추출"""
        try:
            # 1. 명사 추출
            nouns = self._extract_nouns(text)

            if not nouns:
                return []

            # 2. 명사들을 공백으로 연결 (TF-IDF 입력용)
            preprocessed_text = ' '.join(nouns)

            # 3. TF-IDF로 키워드 점수 계산
            vectorizer = TfidfVectorizer(
                max_features=100,
                min_df=1,
                ngram_range=(1, 1)  # 단일 명사만 (이미 전처리 완료)
            )
            tfidf_matrix = vectorizer.fit_transform([preprocessed_text])
            feature_names = vectorizer.get_feature_names_out()
            scores = tfidf_matrix.toarray()[0]

            # 4. 키워드 점수 정렬
            keyword_scores = [(feature_names[i], scores[i])
                            for i in range(len(scores)) if scores[i] > 0]
            keyword_scores.sort(key=lambda x: x[1], reverse=True)

            return keyword_scores[:top_n]

        except Exception as e:
            print(f"키워드 추출 오류: {e}")
            return []

class NewsAISummarizer:
    def __init__(self):
        """뉴스 요약 AI 모델 초기화"""
        self.summarizer = None
        self.keyword_extractor = KeywordExtractor()
        self._load_model()

    def _load_model(self):
        """한국어 요약 모델 로드"""
        try:
            # 경량화된 한국어 요약 모델 사용 (T5-small: 60M 파라미터)
            model_name = "eenzeenee/t5-small-korean-summarization"
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

    def truncate_at_sentence(self, text: str, max_chars: int) -> str:
        """문장 경계에서 텍스트 자르기"""
        if len(text) <= max_chars:
            return text

        # max_chars까지 자른 후, 마지막 문장 경계 찾기
        truncated = text[:max_chars]

        # 한국어 문장 종결 부호: ., !, ?, 다, 요, 습니다, 었다, 였다 등
        sentence_endings = ['. ', '! ', '? ', '다. ', '요. ', '습니다. ', '었다. ', '였다. ', '는다. ', '한다. ']

        last_pos = -1
        for ending in sentence_endings:
            pos = truncated.rfind(ending)
            if pos > last_pos:
                last_pos = pos + len(ending)

        # 문장 경계를 찾았으면 그곳에서 자르기
        if last_pos > len(truncated) * 0.7:  # 70% 이상 위치에서 찾았으면
            return truncated[:last_pos].strip()

        # 못 찾았으면 원래대로
        return truncated + "..."

    def ensure_sentence_ending(self, text: str) -> str:
        """요약이 완전한 문장으로 끝나도록 보정"""
        if not text:
            return text

        text = text.strip()

        # 이미 문장 종결 부호로 끝나면 OK
        if text.endswith(('.', '!', '?', '다', '요', '음')):
            return text

        # 마지막 완전한 문장 찾기
        sentence_endings = ['. ', '! ', '? ', '다. ', '요. ', '습니다. ', '었다. ', '였다. ', '는다. ', '한다. ']

        last_pos = -1
        for ending in sentence_endings:
            pos = text.rfind(ending)
            if pos > last_pos:
                last_pos = pos + len(ending) - 1  # 공백 제외

        # 80% 이상 위치에서 문장 경계를 찾았으면 그곳까지만 반환
        if last_pos > len(text) * 0.8:
            return text[:last_pos+1].strip()

        # 못 찾았으면 원문 그대로 (잘림 표시)
        return text

    def summarize_news(self, title: str, content: str, max_length: int = 150) -> dict:
        """뉴스 기사 요약 (개선 버전)"""
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

            # 제목 + 내용 결합
            full_text = f"{cleaned_title}. {cleaned_content}"

            # 텍스트가 너무 짧으면 원문 반환
            if len(full_text.strip()) < 50:
                return {
                    "summary": cleaned_content or cleaned_title,
                    "keywords": self.extract_keywords(full_text),
                    "success": True
                }

            # 긴 텍스트 처리: 문장 경계에서 자르기 (3000자로 증가)
            if len(full_text) > 3000:
                full_text = self.truncate_at_sentence(full_text, 3000)

            # AI 요약 생성
            # max_length를 더 여유있게 설정 (기본 150)
            actual_max_length = max(max_length, 100)  # 최소 100자 보장
            min_summary_length = min(50, actual_max_length - 20)  # 최소 길이 설정

            summary_result = self.summarizer(
                full_text,
                max_length=actual_max_length,
                min_length=min_summary_length,
                do_sample=True,
                temperature=0.7,
                truncation=True,
                early_stopping=True  # 문장이 완성되면 조기 종료
            )

            summary = summary_result[0]['summary_text'] if summary_result else full_text

            # 요약 후처리: 완전한 문장으로 끝나도록 보정
            summary = self.ensure_sentence_ending(summary)

            return {
                "summary": summary,
                "keywords": self.extract_keywords(full_text),
                "success": True
            }

        except Exception as e:
            print(f"[AI] 요약 생성 실패: {e}")
            # 실패시 원본 텍스트의 앞부분을 문장 경계에서 자르기
            fallback_text = content or title or ""
            fallback = self.truncate_at_sentence(fallback_text, max_length)
            return {
                "summary": fallback,
                "keywords": [],
                "success": False,
                "error": str(e)
            }

    def extract_keywords(self, text: str, top_k: int = 5) -> list:
        """TF-IDF 기반 키워드 추출 (형태소 분석 적용)"""
        try:
            if not text:
                return []

            # KeywordExtractor 사용
            keyword_scores = self.keyword_extractor.extract(text, top_n=top_k)

            # (키워드, 점수) 튜플 리스트를 키워드만 리스트로 변환 (기존 인터페이스 유지)
            return [keyword for keyword, score in keyword_scores]


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
                   '법안', '정책', '행정', '여당', '야당', '여야', '의회', '입법', '총리', '청와대', '국정',
                   '국회의원', '공약', '개헌', '탄핵', '청문회', '국감', '예산안', '법률안'],
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