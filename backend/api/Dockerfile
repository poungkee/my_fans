# Node.js 20 Alpine 이미지 사용
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app/backend

# queue 패키지 먼저 복사 및 빌드 (로컬 의존성)
COPY queue/package*.json queue/tsconfig.json ./queue/
COPY queue/src ./queue/src
RUN cd queue && npm ci --only=production && npm run build

# API 디렉토리로 이동
WORKDIR /app/backend/api

# 패키지 파일 복사
COPY api/package*.json ./

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY api/. .

# 포트 설정
EXPOSE 8000

# 개발 환경에서 실행
ENV NODE_ENV=development

# 개발 모드로 애플리케이션 시작
CMD ["npm", "run", "dev"]