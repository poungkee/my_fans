# 🔧 FANS 백엔드 개발 가이드

## 📋 사전 요구사항

- Docker Desktop 설치 및 실행
- Git 설치

## 🚀 빠른 시작

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd FANS/backend
```

### 2. 개발환경 시작

#### 🐧 Linux/macOS
```bash
# 개발환경 시작 (PostgreSQL + API 서버)
./scripts/dev-start.sh

# 또는 직접 docker-compose 사용
docker-compose --profile dev up -d
```

#### 🪟 Windows
```cmd
# 개발환경 시작 (PostgreSQL + API 서버)
scripts\dev-start.bat

# 또는 직접 docker-compose 사용
docker-compose --profile dev up -d
```

### 3. 서비스 확인
- API 서버: http://localhost:3000
- PostgreSQL: localhost:5432
- Health Check: http://localhost:3000/health

### 4. 개발환경 중지

#### 🐧 Linux/macOS
```bash
# 개발환경 중지
./scripts/dev-stop.sh

# 또는 직접 docker-compose 사용
docker-compose --profile dev down
```

#### 🪟 Windows
```cmd
# 개발환경 중지
scripts\dev-stop.bat

# 또는 직접 docker-compose 사용
docker-compose --profile dev down
```

## 🏗️ 프로젝트 구조

```
backend/
├── api/                    # Express.js API 서버
│   ├── src/
│   │   ├── entities/      # TypeORM 엔티티
│   │   ├── routes/        # API 라우트
│   │   ├── services/      # 비즈니스 로직
│   │   └── middleware/    # 미들웨어
│   ├── Dockerfile         # 프로덕션용 도커파일
│   └── Dockerfile.dev     # 개발용 도커파일
├── database/
│   └── init.sql          # 데이터베이스 초기화 스크립트
├── scripts/              # 유틸리티 스크립트
└── docker-compose.yml    # 도커 컴포즈 설정
```

## 🔧 개발 명령어

### Docker Compose 프로필
```bash
# 개발환경 (PostgreSQL + API Dev 서버)
docker-compose --profile dev up -d

# 프로덕션환경 (PostgreSQL + API 서버)
docker-compose --profile prod up -d

# PostgreSQL만 시작
docker-compose up -d postgres
```

### 로그 확인
```bash
# API 서버 로그
docker-compose logs -f api-dev

# PostgreSQL 로그
docker-compose logs -f postgres

# 모든 서비스 로그
docker-compose logs -f
```

### 데이터베이스 관리
```bash
# 데이터베이스 접속
docker exec -it fans-postgres psql -U fans_user -d fans_db

# 데이터베이스 초기화
docker-compose down -v
docker-compose --profile dev up -d
```

## 🌐 환경변수

주요 환경변수들이 docker-compose.yml에 설정되어 있습니다:

- `DATABASE_URL`: PostgreSQL 연결 정보
- `NAVER_CLIENT_ID/SECRET`: 네이버 OAuth 키
- `KAKAO_CLIENT_ID/SECRET`: 카카오 OAuth 키
- `AI_SERVICE_URL`: AI 서비스 엔드포인트
- `FRONTEND_URL`: 프론트엔드 URL

## 🧪 테스트

### Health Check
```bash
curl http://localhost:3000/health
```

### API 테스트
```bash
# 뉴스 목록 조회
curl http://localhost:3000/api/news

# 크롤러 상태 확인
curl http://localhost:3000/api/crawler/status
```

## 🐛 트러블슈팅

### Docker 관련
```bash
# 모든 컨테이너 중지 및 삭제
docker-compose down -v

# 이미지 재빌드
docker-compose build --no-cache

# 볼륨 삭제 (데이터 완전 초기화)
docker volume prune
```

### 포트 충돌
- 3000번 포트가 사용 중인 경우: `lsof -ti:3000 | xargs kill -9`
- 5432번 포트가 사용 중인 경우: 로컬 PostgreSQL 서비스 중지

## 📚 추가 리소스

- [TypeORM 문서](https://typeorm.io/)
- [Express.js 문서](https://expressjs.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)