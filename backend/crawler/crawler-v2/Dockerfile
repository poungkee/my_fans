FROM node:20-alpine

# Puppeteer 의존성 및 timezone 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    tzdata

# Timezone 설정
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Puppeteer가 chromium을 다운로드하지 않도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# shared 복사
COPY crawler/shared ./shared

# queue 복사 및 빌드
COPY queue/package*.json ./queue/
RUN cd queue && npm install
COPY queue ./queue
RUN cd queue && npm run build

# crawler-v2 package.json 복사 및 npm install
COPY crawler/crawler-v2/package*.json ./crawler-v2/
RUN cd crawler-v2 && npm install

# crawler-v2 소스 파일 복사 (*.ts, tsconfig.json 등)
COPY crawler/crawler-v2/*.ts ./crawler-v2/
COPY crawler/crawler-v2/tsconfig.json ./crawler-v2/

# @fans/queue를 빌드된 버전으로 덮어쓰기
RUN rm -rf /app/crawler-v2/node_modules/@fans/queue && \
    mkdir -p /app/crawler-v2/node_modules/@fans && \
    cp -r /app/queue /app/crawler-v2/node_modules/@fans/queue

# shared에 심볼릭 링크로 node_modules 연결
RUN ln -s /app/crawler-v2/node_modules /app/shared/node_modules

# TypeScript 컴파일
RUN cd crawler-v2 && npm run build

# 환경변수 기본값
ENV NODE_ENV=production
ENV UNIFIED_CRAWLER_PORT=4005
ENV AUTO_CRAWL=true

WORKDIR /app/crawler-v2

CMD ["node", "dist/crawler-v2/index.js"]
