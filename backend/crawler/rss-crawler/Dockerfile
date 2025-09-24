FROM node:20-alpine

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# 포트 노출
EXPOSE 4002

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4002/health || exit 1

# 서비스 시작
CMD ["node", "dist/index.js"]