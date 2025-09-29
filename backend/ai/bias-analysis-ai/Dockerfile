FROM python:3.10-slim

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 모델 디렉토리 생성
RUN mkdir -p models

# 학습된 모델 파일들 복사
COPY models/*.pkl models/
COPY models/*.json models/

# 포트 노출
EXPOSE 8002

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

# 서비스 시작
CMD ["python", "main.py"]