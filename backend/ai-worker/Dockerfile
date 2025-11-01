FROM node:20-alpine

# Timezone 설정
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# queue 복사 및 빌드
COPY queue/package*.json ./queue/
RUN cd queue && npm install
COPY queue ./queue
RUN cd queue && npm run build

# ai-worker package.json 복사 및 npm install
COPY ai-worker/package*.json ./ai-worker/
RUN cd ai-worker && npm install

# ai-worker 소스 파일 복사
COPY ai-worker/src ./ai-worker/src
COPY ai-worker/tsconfig.json ./ai-worker/

# @fans/queue를 빌드된 버전으로 덮어쓰기
RUN rm -rf /app/ai-worker/node_modules/@fans && \
    mkdir -p /app/ai-worker/node_modules/@fans && \
    cp -r /app/queue /app/ai-worker/node_modules/@fans/queue

# TypeScript 컴파일
RUN cd ai-worker && npm run build

# 환경변수 기본값
ENV NODE_ENV=production

WORKDIR /app/ai-worker

CMD ["node", "dist/index.js"]
