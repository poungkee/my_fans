#!/bin/bash

# Extract values from .env file
KAKAO_CLIENT_ID=$(grep "^KAKAO_CLIENT_ID=" d:/dev1/.env | cut -d '=' -f2)
KAKAO_CLIENT_SECRET=$(grep "^KAKAO_CLIENT_SECRET=" d:/dev1/.env | cut -d '=' -f2)
NAVER_CLIENT_ID=$(grep "^NAVER_CLIENT_ID=" d:/dev1/.env | cut -d '=' -f2)
NAVER_CLIENT_SECRET=$(grep "^NAVER_CLIENT_SECRET=" d:/dev1/.env | cut -d '=' -f2)
NAVER_SEARCH_CLIENT_ID=$(grep "^NAVER_SEARCH_CLIENT_ID=" d:/dev1/.env | cut -d '=' -f2)
NAVER_SEARCH_CLIENT_SECRET=$(grep "^NAVER_SEARCH_CLIENT_SECRET=" d:/dev1/.env | cut -d '=' -f2)
# Use the actual PostgreSQL password from the running database
POSTGRES_PASSWORD="fans_secure_password_2025"
JWT_SECRET=$(grep "^JWT_SECRET=" d:/dev1/.env | cut -d '=' -f2)
SESSION_SECRET=$(grep "^SESSION_SECRET=" d:/dev1/.env | cut -d '=' -f2)
EMAIL_USER=$(grep "^EMAIL_USER=" d:/dev1/.env | cut -d '=' -f2)
EMAIL_PASSWORD=$(grep "^EMAIL_PASSWORD=" d:/dev1/.env | cut -d '=' -f2)

# Delete existing secret
kubectl delete secret fans-secrets -n fans 2>/dev/null || true

# Create new secret with correct Kubernetes values
kubectl create secret generic fans-secrets -n fans \
  --from-literal=KAKAO_CLIENT_ID="$KAKAO_CLIENT_ID" \
  --from-literal=KAKAO_CLIENT_SECRET="$KAKAO_CLIENT_SECRET" \
  --from-literal=NAVER_CLIENT_ID="$NAVER_CLIENT_ID" \
  --from-literal=NAVER_CLIENT_SECRET="$NAVER_CLIENT_SECRET" \
  --from-literal=NAVER_SEARCH_CLIENT_ID="$NAVER_SEARCH_CLIENT_ID" \
  --from-literal=NAVER_SEARCH_CLIENT_SECRET="$NAVER_SEARCH_CLIENT_SECRET" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=DB_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=SESSION_SECRET="$SESSION_SECRET" \
  --from-literal=EMAIL_USER="$EMAIL_USER" \
  --from-literal=EMAIL_PASSWORD="$EMAIL_PASSWORD" \
  --from-literal=DB_HOST=postgres-service \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_NAME=fans_db \
  --from-literal=DB_USERNAME=fans_user \
  --from-literal=POSTGRES_DB=fans_db \
  --from-literal=POSTGRES_USER=fans_user

echo "✅ Secret created successfully"
