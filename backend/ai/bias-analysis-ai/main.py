"""
FANS 편향성 분석 AI 서비스
- 감성 분석, 키워드 추출, 정치 분석 통합
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging
from datetime import datetime

from sentiment_analyzer import SentimentAnalyzer
from keyword_extractor import KeywordExtractor
from political_analyzer import PoliticalAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FANS Bias Analysis AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sentiment_analyzer = SentimentAnalyzer()
keyword_extractor = KeywordExtractor()
political_analyzer = PoliticalAnalyzer()

class AnalysisRequest(BaseModel):
    text: str
    article_id: Optional[int] = None

class SentimentResponse(BaseModel):
    sentiment: str
    confidence: float
    score: float
    positive_count: int
    negative_count: int

class KeywordResponse(BaseModel):
    keywords: List[Dict[str, float]]

class PoliticalResponse(BaseModel):
    party_analysis: Dict[str, Dict]
    bias_score: float
    stance: str

class FullAnalysisResponse(BaseModel):
    sentiment: SentimentResponse
    keywords: List[tuple]
    political: Optional[PoliticalResponse]
    processed_at: str

@app.on_event("startup")
async def startup_event():
    logger.info("FANS Bias Analysis AI v2.0 시작")

@app.get("/")
def read_root():
    return {
        "service": "FANS Bias Analysis AI",
        "version": "2.0.0",
        "status": "running",
        "features": ["sentiment", "keywords", "political_bias"]
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/analyze/sentiment")
async def analyze_sentiment(request: AnalysisRequest):
    try:
        result = sentiment_analyzer.analyze(request.text)
        return SentimentResponse(**result)
    except Exception as e:
        logger.error(f"감성 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/keywords")
async def analyze_keywords(request: AnalysisRequest):
    try:
        keywords = keyword_extractor.extract(request.text, top_n=10)
        return {"keywords": [{"word": k, "score": float(s)} for k, s in keywords]}
    except Exception as e:
        logger.error(f"키워드 추출 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/political")
async def analyze_political(request: AnalysisRequest):
    try:
        party_analysis = political_analyzer.analyze_party_mentions(request.text)
        bias = political_analyzer.calculate_bias_score(request.text)

        return {
            "party_analysis": party_analysis,
            "bias_score": bias['bias_score'],
            "stance": bias['stance'],
            "ruling_sentiment": bias['ruling_sentiment'],
            "opposition_sentiment": bias['opposition_sentiment']
        }
    except Exception as e:
        logger.error(f"정치 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/full")
async def analyze_full(request: AnalysisRequest):
    try:
        sentiment = sentiment_analyzer.analyze(request.text)
        keywords = keyword_extractor.extract(request.text, top_n=10)

        party_analysis = political_analyzer.analyze_party_mentions(request.text)
        political_result = None
        bias_score = 0.0
        stance = "중립"

        if party_analysis:
            bias = political_analyzer.calculate_bias_score(request.text)
            bias_score = bias['bias_score']
            stance = bias['stance']
            political_result = {
                "party_analysis": party_analysis,
                "bias_score": bias_score,
                "stance": stance
            }

        return {
            "article_id": request.article_id,
            "sentiment": sentiment,
            "keywords": [{"word": k, "score": float(s)} for k, s in keywords],
            "political": political_result,
            "bias_score": bias_score,
            "political_leaning": stance,
            "confidence": sentiment.get('confidence', 0.0),
            "processed_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"전체 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)