FROM node:18-alpine

WORKDIR /app

# 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# TypeScript 빌드를 위한 dev dependencies 임시 설치
COPY tsconfig.json ./
COPY package*.json ./
RUN npm install typescript ts-node @types/node @types/node-cron @types/pg --save-dev

# 소스 코드 복사
COPY src ./src

# TypeScript 빌드
RUN npm run build

# dev dependencies 제거
RUN npm prune --production

# 실행
CMD ["npm", "start"]
