FROM node:20-alpine

# Puppeteer 의존성 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Puppeteer가 chromium을 다운로드하지 않도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY puppeteer-crawler/package*.json ./
RUN npm install

# shared 디렉토리 복사
COPY shared ./shared

# 소스 코드 복사
COPY puppeteer-crawler ./

# TypeScript 컴파일
RUN npm run build

# 포트 노출
EXPOSE 4004

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4004/health || exit 1

# 서비스 시작
CMD ["node", "dist/src/index.js"]
