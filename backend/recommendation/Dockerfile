FROM apache/spark:3.5.0-python3

USER root

# Flask 및 필요한 패키지 설치
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# 애플리케이션 코드 복사
COPY category_classifier.py /app/category_classifier.py
COPY classification_api.py /app/classification_api.py

WORKDIR /app

# 모델 저장 디렉토리 생성
RUN mkdir -p /app/models && chmod 777 /app/models

# 포트 노출
EXPOSE 5000

# API 서버 시작 (모델 디렉토리 권한 설정 후 실행)
CMD bash -c "mkdir -p /app/models && chmod -R 777 /app/models && python3 classification_api.py"
