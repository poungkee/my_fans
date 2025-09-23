# Node.js 기반 React 개발 환경
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 소스 코드 복사
COPY . .

# 환경 변수 설정
ENV PORT=3001

# 포트 노출
EXPOSE 3001

# 개발 서버 시작
CMD ["npm", "start"]