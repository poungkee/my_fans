# Node.js 20 Alpine 이미지 사용
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치 (개발 의존성 포함)
RUN npm install

# 소스 코드 복사
COPY . .

# 포트 설정
EXPOSE 8000

# 개발 환경에서 실행
ENV NODE_ENV=development

# 개발 모드로 애플리케이션 시작
CMD ["npm", "run", "dev"]