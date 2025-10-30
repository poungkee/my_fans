# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# 공통 queue 디렉토리 복사
COPY ../queue/package*.json ../queue/
COPY ../queue/src ../queue/src
COPY ../queue/tsconfig.json ../queue/

# AI Worker 소스 복사
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# 의존성 설치 및 빌드
RUN npm ci
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --only=production

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist

# 환경변수
ENV NODE_ENV=production

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 실행
CMD ["node", "dist/index.js"]
