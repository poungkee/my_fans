# FANS 프로젝트 리팩토링 변경사항

**리팩토링 완료일:** 2025-09-16  
**작업자:** Claude Code Assistant

## 📋 주요 변경사항 요약

### 1. 프로젝트 구조 재편
**기존 구조:**
```
FANS/
├── backend/              # Python 서비스
├── services/
│   ├── main-api/         # Node.js API  
│   └── ai-service/       # Python AI (중복)
└── front_end/            # React 앱
```

**새로운 구조:**
```
FANS/
├── backend/
│   ├── api/              # Node.js 메인 API
│   ├── ai-service/       # Python AI 서비스
│   └── database/         # DB 관련 파일
├── frontend/             # React 앱 (front_end → frontend)
├── infrastructure/       # DevOps 도구들 (추후 확장)
├── docs/                 # 문서
└── scripts/              # 설정/배포 스크립트
```

### 2. 버전 호환성 표준화

#### Node.js 버전 통일
- **추가된 파일:** `.nvmrc` (v20.19.5)
- **수정된 파일:** 모든 `package.json`에 engines 필드 추가
```json
"engines": {
  "node": ">=20.19.5",
  "npm": ">=10.0.0"
}
```

#### 프록시 설정 수정
- **frontend/package.json:** `proxy: "http://localhost:8000"` → `"http://localhost:3000"`

### 3. Python 패키지 최적화

#### requirements.txt 개선사항
- **제거:** SQLAlchemy, psycopg2-binary, alembic (AI 서비스에 불필요)
- **수정:** `torch==2.1.1` → `torch>=2.2.0+cpu` (CPU 버전, 용량 절약)
- **정리:** 패키지별 주석 추가로 가독성 향상

### 4. 공통 데이터 API 구현

#### 새로 생성된 파일들

**Backend API (`backend/api/src/routes/common/index.ts`):**
- `/api/common/categories` - 뉴스 카테고리 목록
- `/api/common/media-sources` - 언론사 목록  
- `/api/common/search-options` - 검색 조건
- `/api/common/all` - 모든 공통 데이터 한번에

**Frontend Services (`frontend/src/services/api.js`):**
- `commonAPI` - 공통 데이터 API 호출 함수들
- `newsAPI` - 뉴스 검색 API 호출 함수들
- 환경별 API URL 설정

**Frontend Hooks (`frontend/src/hooks/useCommonData.js`):**
- `useCommonData()` - 전체 공통 데이터 훅
- `useCategories()` - 카테고리만 필요한 경우
- `useMediaSources()` - 언론사만 필요한 경우  
- `useSearchOptions()` - 검색 옵션만 필요한 경우
- 에러 처리 및 기본값 제공

### 5. 개발 환경 자동화

#### 설정 스크립트 (`scripts/setup-dev.sh`)
- Node.js/Python 버전 자동 확인
- 패키지 자동 설치 (Backend API, Frontend, AI Service)
- 가상환경 자동 생성
- 환경변수 파일 확인
- 다음 단계 안내

## 🔧 사용법 변경사항

### 개발 환경 설정
```bash
# 기존 방법
cd services/main-api && npm install
cd ../../front_end && npm install  
cd ../backend && python -m venv venv

# 새로운 방법 (자동화)
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

### 서버 실행
```bash
# Backend API
cd backend/api && npm run dev

# AI Service  
cd backend/ai-service && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm start

# PostgreSQL
docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15
```

### 프론트엔드 공통 데이터 사용법

**기존 방식 (하드코딩):**
```javascript
const categories = ['정치', '경제', '사회']; // 하드코딩
```

**새로운 방식 (API 호출):**
```javascript
import { useCommonData } from '../hooks/useCommonData';

function MyComponent() {
  const { categories, mediaSources, loading } = useCommonData();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <select>
      {categories.map(cat => <option key={cat}>{cat}</option>)}
    </select>
  );
}
```

## 📁 파일 이동/생성 내역

### 새로 생성된 파일
- `.nvmrc` - Node.js 버전 고정
- `backend/api/src/routes/common/index.ts` - 공통 데이터 API
- `frontend/src/services/api.js` - API 호출 서비스
- `frontend/src/hooks/useCommonData.js` - 공통 데이터 훅
- `scripts/setup-dev.sh` - 개발환경 설정 스크립트
- `REFACTORING_CHANGES.md` - 변경사항 문서 (이 파일)

### 이동된 파일들
- `services/main-api/*` → `backend/api/`
- `services/ai-service/*` → `backend/ai-service/`  
- `front_end/*` → `frontend/`
- `backend/schema.sql` → `backend/database/`

### 수정된 파일들
- `services/main-api/package.json` → engines 필드 추가
- `frontend/package.json` → engines 필드 추가, proxy 수정
- `backend/package.json` → engines 필드 추가
- `backend/requirements.txt` → 패키지 최적화
- `backend/ai-service/requirements.txt` → 패키지 최적화

## ⚠️ 중요 고려사항

### 팀원 대응 필요사항
1. **Node.js 20 업그레이드:** `nvm use` 또는 Node.js 20+ 설치
2. **경로 변경:** IDE/에디터 프로젝트 설정 업데이트
3. **환경변수:** `.env` 파일들이 새 위치에 있는지 확인
4. **Git:** 파일 이동으로 인한 히스토리 변경 주의

### 추후 작업 필요사항
1. **기존 API 라우팅:** main-api의 라우터를 새 구조에 맞게 수정
2. **프론트엔드 컴포넌트:** Header, Sidebar 등에서 새 훅 사용
3. **테스트:** 전체 시스템 통합 테스트
4. **문서:** API 문서 업데이트

## 🎯 예상 효과

### 개발 효율성
- **일관된 환경:** 모든 팀원이 동일한 Node.js/Python 버전 사용
- **자동화:** 한번의 스크립트로 전체 환경 구성
- **구조 명확화:** backend/frontend 분리로 역할 구분 명확

### 유지보수성  
- **중앙집중화:** 카테고리, 언론사 목록 등을 API로 관리
- **확장성:** infrastructure 폴더로 DevOps 도구 확장 준비
- **표준화:** 일관된 코딩 스타일과 구조

### 성능 최적화
- **패키지 경량화:** 불필요한 Python 패키지 제거
- **CPU 전용:** PyTorch CPU 버전으로 설치 용량 절약
- **캐싱:** 공통 데이터 훅에서 자동 캐싱

---

**다음 단계:** 팀원들과 공유 후 점진적 마이그레이션 진행  
**문의사항:** 변경사항 관련 질문은 이 문서를 참고해주세요.