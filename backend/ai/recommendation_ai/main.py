"""
FANS 추천 AI 서비스
하이브리드 추천 알고리즘 (협업 + 콘텐츠 + 키워드 + 편향 + 트렌딩)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import os

from recommendation_engine import recommendation_engine

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FANS Recommendation AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RecommendationRequest(BaseModel):
    user_id: int
    limit: int = 20

class RecommendationResponse(BaseModel):
    success: bool
    user_id: int
    recommendations: List[Dict[str, Any]]
    count: int
    generated_at: str

@app.on_event("startup")
async def startup_event():
    logger.info("FANS Recommendation AI v1.0 시작")
    logger.info(f"DB Host: {os.getenv('DB_HOST', 'localhost')}")

@app.get("/")
def read_root():
    return {
        "service": "FANS Recommendation AI",
        "version": "1.0.0",
        "status": "running",
        "features": ["hybrid_recommendation", "collaborative_filtering", "content_based", "keyword_based", "bias_based", "trending"]
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/recommend", response_model=RecommendationResponse)
async def recommend(request: RecommendationRequest):
    """
    사용자 맞춤 뉴스 추천 생성
    """
    try:
        user_id = request.user_id
        limit = request.limit

        logger.info(f"Generating recommendations for user {user_id}, limit={limit}")

        # 추천 생성
        recommendations = recommendation_engine.generate_recommendations(user_id, limit)

        # 캐시 저장
        if recommendations:
            recommendation_engine.save_recommendations_cache(user_id, recommendations)

        logger.info(f"Generated {len(recommendations)} recommendations for user {user_id}")

        return RecommendationResponse(
            success=True,
            user_id=user_id,
            recommendations=recommendations,
            count=len(recommendations),
            generated_at=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Recommendation error for user {request.user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"추천 생성 중 오류가 발생했습니다: {str(e)}"
        )

@app.get("/recommend/{user_id}")
async def get_recommendations(user_id: int, limit: int = 20):
    """
    사용자 추천 조회 (동기 방식 - 즉시 생성 및 반환)
    """
    try:
        logger.info(f"GET request for user {user_id} recommendations")

        recommendations = recommendation_engine.generate_recommendations(user_id, limit)

        if recommendations:
            recommendation_engine.save_recommendations_cache(user_id, recommendations)

        return {
            "success": True,
            "user_id": user_id,
            "recommendations": recommendations,
            "count": len(recommendations),
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Recommendation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
