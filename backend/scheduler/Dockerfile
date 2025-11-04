FROM node:18-alpine

WORKDIR /app

# queue 모듈 먼저 빌드 (workspace dependency)
COPY ./queue/package*.json ./queue/
RUN cd queue && npm install
COPY ./queue ./queue
RUN cd queue && npm run build

# scheduler package.json 복사 및 설치
COPY ./scheduler/package*.json ./scheduler/
RUN cd scheduler && npm ci --only=production

# TypeScript 빌드를 위한 dev dependencies 설치
RUN cd scheduler && npm install typescript ts-node @types/node @types/node-cron @types/pg --save-dev

# @fans/queue를 빌드된 버전으로 링크
RUN rm -rf /app/scheduler/node_modules/@fans/queue && \
    mkdir -p /app/scheduler/node_modules/@fans && \
    cp -r /app/queue /app/scheduler/node_modules/@fans/queue

# scheduler 소스 코드 복사
COPY ./scheduler/tsconfig.json ./scheduler/
COPY ./scheduler/src ./scheduler/src

# TypeScript 빌드
RUN cd scheduler && npm run build

# dev dependencies 제거
RUN cd scheduler && npm prune --production

WORKDIR /app/scheduler

# 실행
CMD ["npm", "start"]
