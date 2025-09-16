# FANS 프로젝트 전체 정리 계획

## 📋 현재 상태
- **1단계: 팀 코드 대기 중** ← 🔄 현재 위치
- 작성일: 2025-09-16
- 작성자: Claude Code Assistant

## 🎯 전체 작업 계획

### **Phase 1: 환경 표준화 (우선순위 높음)**

#### 1. ✅ 팀 git pull 완료 대기
- 다른 팀원들의 코드 푸시 완료 후 최신 버전 동기화
- 충돌 해결 및 코드 리뷰

#### 2. 🔍 버전 호환성 문제 분석
- 각 팀원별 Node.js, Python, npm 버전 차이 파악
- package.json engines 필드 점검
- 호환성 문제 있는 패키지 식별
- 현재 알려진 이슈:
  - cheerio@1.1.2 (Node.js >=20.18.1 요구)
  - undici@7.16.0 (Node.js >=20.18.1 요구)
  - torch 버전 호환성 문제

#### 3. 📦 Node.js 버전 표준화
- `.nvmrc` 파일 생성 (Node.js 20.x 고정)
- package.json engines 필드 설정
- 팀 전체 Node.js 20으로 통일

#### 4. 🧹 package.json 의존성 정리
- 사용하지 않는 dependencies 제거
- devDependencies vs dependencies 분류 정리
- 중복 패키지 통합
- 보안 취약점 있는 패키지 업데이트

#### 5. 🐍 Python 버전 및 requirements.txt 표준화
- Python 3.11+ 권장 버전 설정
- requirements.txt 패키지 버전 호환성 점검
- 불필요한 패키지 제거 (SQLAlchemy 등)
- CPU-only PyTorch 사용으로 용량 최적화

#### 6. 🗑️ 사용하지 않는 라이브러리/패키지 제거
- 프론트엔드 미사용 npm 패키지
- 백엔드 미사용 Python 패키지
- 중복 설정 파일들

#### 7. 📖 통합 개발환경 셋업 가이드 작성
- OS별 설치 가이드 (Windows, macOS, Ubuntu)
- Docker 기반 환경 설정 옵션
- 한번의 스크립트로 전체 환경 구성
- 트러블슈팅 가이드

### **Phase 2: 프로젝트 구조 정리**

#### 8. 📁 디렉토리명 표준화
- `front_end` → `frontend` 변경
- 언더스코어 → 하이픈으로 일관성 유지
- Git 이력 보존하면서 안전하게 이동

#### 9. 🔄 중복 AI 서비스 디렉토리 정리
- 현재 문제: `backend/`와 `services/ai-service/` 중복
- 하나로 통합 (services/ai-service/ 권장)
- 불필요한 파일들 제거

#### 10. 🔗 모든 경로 참조 업데이트
- package.json scripts 경로 수정
- import/require 경로 업데이트
- Docker, docker-compose 경로 수정
- 설정 파일들 경로 참조 수정

### **Phase 3: 코드 개선**

#### 11. 🌐 공통 데이터 API 엔드포인트 생성
```
/api/common/categories      - 뉴스 카테고리 목록
/api/common/media-sources   - 언론사 목록  
/api/common/search-options  - 검색 조건들
```

#### 12. 🔧 프론트엔드 하드코딩 제거
- Header 컴포넌트의 하드코딩된 카테고리 제거
- 언론사 목록 하드코딩 제거
- 검색 조건 드롭다운 하드코딩 제거

#### 13. 🧩 공통 훅/서비스 구현
- `useCommonData()` 훅 생성
- 데이터 캐싱 및 재사용 로직
- 모든 컴포넌트에서 공통 데이터 활용

### **Phase 4: 테스트 및 문서화**

#### 14. 🧪 전체 시스템 테스트
- Node.js API 서버 정상 동작 확인
- Python AI 서비스 정상 동작 확인
- 프론트엔드 연동 테스트
- Docker 환경 테스트

#### 15. 📚 모든 변경사항 문서화
- 변경 내역 상세 기록
- 새로운 API 엔드포인트 문서화
- 개발 환경 설정 가이드 업데이트

#### 16. ✅ 팀 리뷰용 요약 작성
- 주요 변경사항 요약
- 팀원들이 알아야 할 포인트
- 마이그레이션 가이드

## 🏗️ 팀 제안 구조 (2025-09-16 추가)

### 팀원 피드백 반영한 새로운 구조:
```
FANS/
├─ backend/
│  ├─ api/                      # Node.js 메인 API
│  │  ├─ news/
│  │  │  ├─ agencyMap.js        # 언론사 도메인/oid 매핑
│  │  │  └─ feedRoute.js        # /api/feed 라우터
│  │  ├─ common/                # 공통 API (새로 추가)
│  │  │  ├─ categoriesRoute.js  # /api/common/categories
│  │  │  ├─ mediaSources.js     # /api/common/media-sources
│  │  │  └─ index.js            # 공통 데이터 관리
│  │  ├─ entities/              # TypeORM 엔티티
│  │  ├─ config/                # DB 설정 등
│  │  ├─ app.js                 # Express 앱
│  │  ├─ server.js              # 서버 시작
│  │  ├─ config.js              # env 로딩
│  │  ├─ .env
│  │  └─ package.json
│  ├─ ai-service/               # Python AI 서비스
│  │  ├─ app/
│  │  │  ├─ main.py             # FastAPI 앱
│  │  │  └─ ai_module.py        # AI 로직
│  │  ├─ .env
│  │  ├─ requirements.txt
│  │  └─ Dockerfile
│  └─ database/                 # DB 관련
│     ├─ schema.sql
│     ├─ migrations/
│     └─ docker-compose.yml     # PostgreSQL
├─ frontend/                    # React 앱
│  ├─ src/
│  │  ├─ components/
│  │  │  └─ Header.js           # 드롭다운 → API 호출
│  │  ├─ pages/
│  │  ├─ hooks/                 # 새로 추가
│  │  │  └─ useCommonData.js    # 공통 데이터 훅
│  │  ├─ constants/
│  │  │  └─ nav.js              # 공통 상수 (백업용)
│  │  ├─ services/              # 새로 추가
│  │  │  └─ api.js              # API 호출 로직
│  │  ├─ App.js
│  │  ├─ index.js
│  │  └─ setupProxy.js          # CRA 프록시
│  ├─ public/
│  └─ package.json
├─ infrastructure/              # DevOps (추후 추가)
│  ├─ terraform/
│  ├─ kubernetes/
│  └─ ansible/
├─ docs/                        # 문서
├─ scripts/                     # 셋업/배포 스크립트
└─ PROJECT_REFACTORING_PLAN.md
```

### 새 구조의 장점:
1. **명확한 분리**: backend/frontend 구분이 확실
2. **확장성**: 각 영역별로 독립적 발전 가능  
3. **팀 협업**: 프론트/백엔드 팀 분업 용이
4. **DevOps 준비**: infrastructure 폴더로 확장 가능

## 🚀 향후 확장 계획 (참고용)

### DevOps 및 인프라 구조 (추후 추가 예정)
- Terraform (인프라 코드)
- Kubernetes (컨테이너 오케스트레이션)  
- Ansible (설정 관리)
- 마이크로서비스 구조 완성

## 📝 실행 방법
1. 팀 코드 git pull 완료 후
2. Claude에게 "시작해" 명령
3. Phase 1부터 순차적으로 진행
4. 각 단계별로 확인 및 승인 후 다음 단계 진행

## ⚠️ 주의사항
- 모든 변경사항은 git commit 전에 검토
- 팀원들과 상의 후 진행
- 백업 및 브랜치 생성 후 작업
- 점진적 적용으로 리스크 최소화

---
**마지막 업데이트:** 2025-09-16
**상태:** 팀 코드 대기 중