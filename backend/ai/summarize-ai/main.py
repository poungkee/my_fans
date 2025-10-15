from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ai_module import AIModule, category_classifier
import uvicorn
import os

app = FastAPI(title="FANS AI Service", version="1.0.0")

# AI 모듈 초기화
ai_module = AIModule()

class SummarizeRequest(BaseModel):
    text: str
    max_length: int = 40

class SummarizeResponse(BaseModel):
    summary: str
    length: int

class CategoryRequest(BaseModel):
    title: str
    content: Optional[str] = ""

class CategoryResponse(BaseModel):
    category: str
    title: str

class BatchCategoryRequest(BaseModel):
    articles: List[dict]

@app.get("/health")
def health_check():
    """AI 서비스 헬스체크"""
    return {
        "status": "healthy",
        "service": "ai-service",
        "model": "eenzeenee/t5-base-korean-summarization"
    }

@app.post("/ai/summarize", response_model=SummarizeResponse)
def summarize_text(request: SummarizeRequest):
    """텍스트 AI 요약 생성"""
    try:
        summary = ai_module.summarize(request.text, max_length=request.max_length)

        return SummarizeResponse(
            summary=summary,
            length=len(summary)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 요약 생성 실패: {str(e)}")

@app.post("/ai/classify-category", response_model=CategoryResponse)
def classify_category(request: CategoryRequest):
    """뉴스 기사 카테고리 분류"""
    try:
        category = category_classifier.classify(request.title, request.content)

        return CategoryResponse(
            category=category,
            title=request.title
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"카테고리 분류 실패: {str(e)}")

@app.post("/ai/classify-batch")
def classify_batch(request: BatchCategoryRequest):
    """여러 기사 일괄 카테고리 분류"""
    try:
        results = category_classifier.classify_batch(request.articles)

        return {
            "success": True,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일괄 분류 실패: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)