# Node.js 20 Alpine 이미지 사용
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# 포트 설정
EXPOSE 3000

# 프로덕션 환경에서 실행
ENV NODE_ENV=production

# 애플리케이션 시작
CMD ["npm", "start"]