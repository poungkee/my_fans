# FANS 프로젝트 문서 가이드

> 팀원들과 공유하기 위한 FANS (Fake news Analysis and News Service) 프로젝트의 핵심 문서 모음입니다.

## 📚 핵심 문서 목록

### 1️⃣ [프로젝트 개요 및 구성도](./01_프로젝트_개요_및_구성도.md)
**프로젝트를 처음 보는 사람이 읽어야 할 문서**

- 프로젝트 소개 및 목적
- 시스템 아키텍처 다이어그램
- 9개 마이크로서비스 구성 및 역할
- 사용 기술 스택 (Node.js, Python, PostgreSQL, Redis, Docker)
- 데이터 처리 흐름도
- 주요 구현 기능 목록

**👥 대상**: 신규 팀원, 프로젝트 관계자, 기술 검토자

---

### 2️⃣ [데이터베이스 설계 상세](./02_데이터베이스_설계_상세.md)
**DB 작업을 하는 개발자가 반드시 읽어야 할 문서**

- 15개 테이블 상세 ERD 및 설명
- 테이블별 컬럼 구조 및 타입
- 인덱스 설계 (22개)
- 트리거 및 함수 (8개)
- 뷰 정의 (3개)
- 테이블 간 관계도
- 샘플 쿼리 예제

**👥 대상**: 백엔드 개발자, DB 관리자, 데이터 분석가

---

### 3️⃣ [크롤링 및 AI 분석 흐름](./03_크롤링_및_AI_분석_흐름.md)
**뉴스 수집 및 AI 처리 파이프라인을 이해하고자 하는 개발자용 문서**

- 뉴스 크롤링 프로세스 (Daum News, Naver News API)
- 3분 간격 자동 크롤링 스케줄러
- 10분 간격 뉴스 처리 스케줄러
- AI 분석 파이프라인:
  - 카테고리 분류 (Random Forest)
  - 뉴스 요약 (T5 Korean Model)
  - 키워드 추출 (KoNLPy)
  - 편향성 분석 (KoBERT)
- 데이터 흐름: raw_news_articles → news_articles
- 각 단계별 상세 코드 예제

**👥 대상**: AI/ML 개발자, 백엔드 개발자, 크롤링 담당자

---

### 4️⃣ [환경설정 및 실행 가이드](./04_환경설정_및_실행가이드.md)
**로컬/ECS/EKS 환경에서 프로젝트를 실행하려는 개발자용 필수 문서**

- **로컬 환경 (Docker Compose)**
  - 사전 요구사항 (Docker, Node.js, Python)
  - 초기 설치 명령어
  - 환경 변수 설정 (.env.local)
  - 실행 및 종료 방법

- **AWS ECS 배포**
  - Terraform을 이용한 인프라 구축
  - AWS Secrets Manager 설정
  - 환경 변수 매핑 (.env.ecs)
  - ECR 이미지 푸시 및 배포

- **AWS EKS 배포**
  - Kubernetes 클러스터 설정
  - kubectl 명령어 모음
  - 환경 변수 매핑 (.env.eks)
  - 서비스 배포 및 스케일링

- **Docker 파일별 역할 설명**
  - docker-compose.yml: 로컬 개발 환경
  - Dockerfile들: 각 서비스별 컨테이너 이미지
  - 네트워크 및 볼륨 설정

**👥 대상**: 모든 개발자, DevOps 엔지니어, 시스템 관리자

---

### 5️⃣ [AWS 배포 아키텍처](./05_AWS_배포_아키텍처.md)
**클라우드 인프라를 이해하고 관리해야 하는 DevOps 엔지니어용 문서**

- **ECS (Elastic Container Service) 아키텍처**
  - VPC 및 네트워크 구성 (Public/Private 서브넷)
  - Task Definition 정의
  - ALB (Application Load Balancer) 설정
  - AWS Cloud Map 서비스 디스커버리
  - IAM 역할 및 보안 그룹
  - 예상 비용: $793/월

- **EKS (Elastic Kubernetes Service) 아키텍처**
  - Kubernetes 클러스터 구성
  - Deployment, Service, Ingress 매니페스트
  - Kubernetes DNS 기반 서비스 디스커버리
  - Node Group 설정
  - 예상 비용: $334/월

- **보안 및 모니터링**
  - AWS Secrets Manager 연동
  - CloudWatch Logs 설정
  - 프로메테우스/그라파나 (옵션)

**👥 대상**: DevOps 엔지니어, 클라우드 아키텍트, 인프라 관리자

---

## 🛠️ 추가 참고 문서

### [ECS 마이그레이션 환경 변수 가이드](./ECS_MIGRATION_ENV_GUIDE.md)
- 로컬 → ECS 전환 시 필요한 환경 변수 변경사항
- RDS 연결 설정
- 서비스 디스커버리 URL 변경

### [멀티 환경 전략 가이드](./MULTI_ENV_STRATEGY.md)
- .env.local, .env.ecs, .env.eks 자동 전환 방법
- 환경별 설정 차이점
- 스크립트 사용법 (load-env.sh, switch-env.sh)

### [빠른 시작 가이드](./QUICK_START_GUIDE.md)
- 5분 안에 로컬 환경 실행하기
- 주요 명령어 치트시트
- 트러블슈팅 FAQ

---

## 📂 문서 구조

```
docs/
├── README.md                                    # 👈 현재 파일
├── 01_프로젝트_개요_및_구성도.md                  # 필수: 프로젝트 전체 개요
├── 02_데이터베이스_설계_상세.md                   # 필수: DB 스키마
├── 03_크롤링_및_AI_분석_흐름.md                   # 필수: 크롤링/AI 파이프라인
├── 04_환경설정_및_실행가이드.md                   # 필수: 실행 방법
├── 05_AWS_배포_아키텍처.md                        # 필수: 클라우드 배포
├── ECS_MIGRATION_ENV_GUIDE.md                   # 참고: ECS 환경 변수
├── MULTI_ENV_STRATEGY.md                        # 참고: 멀티 환경 전략
├── QUICK_START_GUIDE.md                         # 참고: 빠른 시작
└── archive/                                     # 보관: 구 버전 문서들
    ├── PPT_발표_요약본.md
    ├── 발표_대본.md
    ├── 01_EKS_운영_가이드.md
    ├── 02_프로젝트_아키텍처_설명서.md
    ├── AI_학습_및_뉴스_분석_시스템_정리.md
    └── ... (기타 이전 문서들)
```

---

## 🎯 역할별 추천 읽기 순서

### 신규 팀원 (처음 프로젝트를 접하는 경우)
1. **01_프로젝트_개요_및_구성도.md** - 전체 이해
2. **QUICK_START_GUIDE.md** - 로컬 환경 실행
3. **04_환경설정_및_실행가이드.md** - 상세 실행 방법
4. 본인 역할에 맞는 문서 (백엔드라면 02번, AI라면 03번)

### 백엔드 개발자
1. **02_데이터베이스_설계_상세.md** - DB 스키마 이해
2. **03_크롤링_및_AI_분석_흐름.md** - 데이터 파이프라인
3. **04_환경설정_및_실행가이드.md** - API 실행 및 디버깅

### AI/ML 개발자
1. **03_크롤링_및_AI_분석_흐름.md** - AI 모델 파이프라인
2. **02_데이터베이스_설계_상세.md** - 학습 데이터 구조
3. **04_환경설정_및_실행가이드.md** - AI 서비스 실행

### DevOps 엔지니어
1. **05_AWS_배포_아키텍처.md** - 클라우드 인프라
2. **04_환경설정_및_실행가이드.md** - 배포 프로세스
3. **MULTI_ENV_STRATEGY.md** - 환경 관리 전략
4. **ECS_MIGRATION_ENV_GUIDE.md** - 환경 변수 설정

### 프론트엔드 개발자
1. **01_프로젝트_개요_및_구성도.md** - 전체 시스템 이해
2. **QUICK_START_GUIDE.md** - 로컬 백엔드 실행
3. **04_환경설정_및_실행가이드.md** - API 엔드포인트 확인

---

## 🔄 아키텍처 주요 변경사항

**2025년 10월 16일 업데이트**
- ❌ 제거: Spark, Kafka, Airflow
- ✅ 도입: Node.js 스케줄러 (node-cron), 경량 Python AI 서비스
- 📉 메모리 사용량 75% 절감
- 자세한 내용: 루트의 `MIGRATION.md` 참고

---

## 📞 문의 및 기여

- **문서 오류 발견 시**: GitHub Issues에 등록
- **문서 개선 제안**: Pull Request 환영
- **긴급 문의**: 팀 슬랙 채널 #fans-dev

---

## 🔖 버전 정보

- **문서 버전**: v2.0
- **최종 업데이트**: 2025년 10월 23일
- **작성자**: Claude Code
- **검토자**: FANS 개발팀

---

**Happy Coding! 🚀**
