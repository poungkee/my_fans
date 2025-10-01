FROM node:20-alpine

# 빌드 캐시 무효화 (node:18 -> node:20 마이그레이션 보장)
ARG CACHEBUST=1

# curl 설치 (헬스체크용)
RUN apk add --no-cache curl

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY rss-crawler/package*.json ./
RUN npm install

# shared 디렉토리 복사 (먼저)
COPY shared ./shared

# 소스 코드 복사
COPY rss-crawler ./

# TypeScript 컴파일
RUN npm run build

# 포트 노출
EXPOSE 4002

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4002/health || exit 1

# 서비스 시작
CMD ["node", "dist/src/index.js"]