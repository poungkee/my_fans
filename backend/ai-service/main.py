from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ai_module import AIModule
import uvicorn

app = FastAPI(title="FANS AI Service", version="1.0.0")

# AI 모듈 초기화
ai_module = AIModule()

class SummarizeRequest(BaseModel):
    text: str
    max_length: int = 40

class SummarizeResponse(BaseModel):
    summary: str
    length: int

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)