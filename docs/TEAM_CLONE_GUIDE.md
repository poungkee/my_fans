# 팀원 클론 가이드

## 📥 프로젝트 클론 후 초기 설정

### 1단계: 저장소 클론
```bash
git clone https://github.com/poungkee/my_fans.git
cd my_fans
```

### 2단계: 환경 변수 설정
```bash
# .env.example을 .env.local로 복사
cp .env.example .env.local

# .env.local 파일 수정 (중요!)
# 아래 항목들을 실제 값으로 변경하세요:
```

**필수 수정 항목**:
```bash
# 데이터베이스 비밀번호
POSTGRES_PASSWORD=your_strong_password

# JWT 시크릿 (랜덤 문자열)
JWT_SECRET=your_random_secret_key_here

# OAuth 클라이언트 ID/Secret (팀장에게 문의)
KAKAO_CLIENT_ID=실제_카카오_클라이언트_ID
KAKAO_CLIENT_SECRET=실제_카카오_시크릿
NAVER_CLIENT_ID=실제_네이버_클라이언트_ID
NAVER_CLIENT_SECRET=실제_네이버_시크릿
```

### 3단계: Docker 시작
```bash
# Makefile 사용 (권장)
make start-local

# 또는 직접 실행
docker-compose up -d
```

### 4단계: 프론트엔드 실행 (로컬 권장)
```bash
cd frontend
npm install
PORT=3001 npm start
```

### 5단계: 확인
- 프론트엔드: http://localhost:3001
- 백엔드 API: http://localhost:3000/api
- API 헬스체크: http://localhost:3000/health

---

## ⚠️ 주의사항

### 절대 하지 말아야 할 것
1. **`.env`, `.env.local` 파일을 절대 커밋하지 마세요!**
   - 이미 `.gitignore`에 포함되어 있습니다
   - OAuth 키 등 민감한 정보가 포함되어 있습니다

2. **데이터베이스 Entity 파일 수정 금지**
   - `backend/api/src/entities/` 폴더
   - 팀원들과 이미 맞춰놓은 상태입니다
   - 꼭 수정해야 한다면 팀원들과 먼저 협의하세요

### 필수 확인 사항
- Docker와 Docker Compose가 설치되어 있는지 확인
- Node.js 18+ 버전이 설치되어 있는지 확인
- 포트 충돌 확인 (3000, 3001, 5432 등)

---

## 🐛 문제 해결

### 1. Docker 실행 안됨
```bash
# Docker가 실행 중인지 확인
docker ps

# Docker Compose 로그 확인
docker-compose logs -f
```

### 2. 포트 충돌
```bash
# 사용 중인 포트 확인 (Windows)
netstat -ano | findstr :3000
netstat -ano | findstr :5432

# 프로세스 종료 후 재시작
```

### 3. OAuth 로그인 안됨
- `.env.local`에 실제 Kakao/Naver 클라이언트 ID가 입력되었는지 확인
- Redirect URI가 `http://localhost:3000/api/auth/kakao/callback` 형식인지 확인
- 팀장에게 OAuth 키 요청

### 4. DB 연결 실패
```bash
# PostgreSQL 컨테이너 상태 확인
docker ps | grep postgres

# DB 비밀번호 확인 (.env.local)
# POSTGRES_PASSWORD가 올바른지 확인
```

---

## 📚 참고 문서

- **빠른 시작**: `docs/QUICK_START_GUIDE.md`
- **환경 설정**: `docs/04_환경설정_및_실행가이드.md`
- **소스 리뷰**: `docs/06_소스코드_상세_리뷰.md`
- **전체 문서**: `docs/README.md`

---

## 💬 질문/문의

- Slack: #fans-dev 채널
- 팀장: [팀장 이름/연락처]
- 긴급: [긴급 연락처]

---

**Happy Coding! 🚀**
