# 로컬 개발 환경 (Docker Compose)

## 🚀 빠른 시작

### 1. 백엔드 서비스 시작 (Docker)
```bash
cd environments/local
docker-compose up -d
```

### 2. 프론트엔드 시작 (로컬 - 권장)
```bash
cd ../../frontend
PORT=3001 npm start
```

## 📦 포함된 서비스

- **PostgreSQL** (5432): 데이터베이스
- **Redis** (6379): 캐싱 & 세션
- **Main API** (3000): 백엔드 API
- **Summarize AI** (8000): 뉴스 요약 AI
- **Bias Analysis AI** (8002): 편향성 분석 AI
- **Classification API** (5000): 뉴스 분류 AI
- **Unified Crawler** (4007): 뉴스 크롤러
- **Scheduler** (8080): 뉴스 처리 스케줄러

## 🔧 환경 설정

`.env` 파일에서 다음 설정을 확인하세요:

```env
# 데이터베이스
POSTGRES_DB=fans_db
POSTGRES_USER=fans_user
POSTGRES_PASSWORD=fans_password

# OAuth (카카오, 네이버)
KAKAO_CLIENT_ID=your_client_id
NAVER_CLIENT_ID=your_client_id
```

## 📝 주요 명령어

```bash
# 전체 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스만 시작
docker-compose up -d postgres redis main-api

# 전체 서비스 중지
docker-compose down

# 볼륨까지 삭제
docker-compose down -v
```

## 🐛 문제 해결

### 포트 충돌
```bash
# 사용 중인 포트 확인
netstat -ano | findstr :3000

# 해당 프로세스 종료
taskkill /PID <PID> /F
```

### 데이터베이스 초기화
```bash
docker-compose down -v
docker-compose up -d postgres
```

## 🌐 접속 주소

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/api
- Summarize AI: http://localhost:8000
- PostgreSQL: localhost:5432

## ⚙️ 구조

```
environments/local/
├── docker-compose.yml    # 서비스 정의
├── .env                  # 환경 변수
└── README.md            # 이 파일
```

**백엔드 코드:**
- `../../backend/api/`
- `../../backend/ai/`
- `../../backend/crawler/`

**프론트엔드 코드:**
- `../../frontend/`
