# CPU 전용 경량 이미지 사용
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 최소화 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Python 의존성 설치 (레이어 캐싱 최적화)
COPY requirements.txt .

# pip 업그레이드 및 CPU 전용 PyTorch 설치
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch==2.2.0 --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사 (코드 변경 시에만 재빌드)
COPY . .

# 모델 캐시 디렉토리 생성
RUN mkdir -p /root/.cache/huggingface

# 불필요한 파일 정리
RUN find /usr/local/lib/python3.11 -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local/lib/python3.11 -type f -name "*.pyc" -delete 2>/dev/null || true && \
    find /usr/local/lib/python3.11 -type f -name "*.pyo" -delete 2>/dev/null || true

# 포트 노출
EXPOSE 8000

# 헬스체크 설정 (모델 로딩 시간 고려)
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 애플리케이션 실행
CMD ["python", "-u", "main.py"]