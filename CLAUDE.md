# CLAUDE 메모리 파일

## ⚠️ 아키텍처 변경 내역 (2025-10-16)

**Spark, Kafka, Airflow → Node.js + Python으로 대체**
- 자세한 내용: `MIGRATION.md` 참고

## 데이터베이스, enttity
- 팀원들과 협업중이고 이미 모두 맞춰놨으니까 절대 수정 금지
- 정말 불가피하게 수정해야될 경우 반드시 직접 수정해야되는데 수정해도 되냐고 물어보고 허가 나오면 수정

## 포트 설정
- 3000번: 백엔드 API (fans_main_api)
- 3001번: 프론트엔드 React (로컬 실행)
- 4003번: API Crawler (fans_api_crawler)
- 5000번: Classification API (fans_classification_api) - NEW
- 5432번: PostgreSQL (fans_postgres)
- 6379번: Redis (fans_redis)
- 8000번: Summarize AI (fans_summarize_ai)
- 8002번: Bias Analysis AI (fans_bias_analysis_ai)

## 서비스별 설정상태
- 프론트엔드: 로컬 (권장) 또는 도커
- 나머지 서비스: 도커 컨테이너화

## 실행 방법
- 백엔드 서비스들(API, AI, DB): `docker-compose up -d`
- 프론트엔드 (로컬): `cd frontend && PORT=3001 npm start`
- 프론트엔드 (도커): `docker-compose.yml`의 환경변수가 자동으로 컨테이너 네트워크 설정됨

## 프론트엔드 도커 설정 참고
- 로컬: `localhost:3000` 사용 (호스트 머신의 백엔드)
- 도커: `main-api:3000` 사용 (컨테이너 네트워크)
- docker-compose.yml에서 자동으로 오버라이드됨

## 자동 크롤링
- 30초마다 자동 실행 중 (API Crawler)
- 스케줄러가 활성화되어 있음
- 수동 크롤링 불필요 (자동으로 작동함)

## 뉴스 처리 스케줄러 (NEW)
- 10분마다 자동 실행 (Node.js 스케줄러)
- Raw 뉴스 처리 → news_articles로 이동
- AI 요약 자동 생성
- 기존 Airflow 대체

## 현재 아키텍처 (2025-10-16 업데이트)
- PostgreSQL + Redis + Node.js + Python
- ~~Spark, Kafka, Airflow~~ (제거됨)
- 경량화된 구조로 메모리 75% 절감

## 중요 지시사항
- 프론트엔드는 로컬에서 실행시키기
- 백엔드 서비스들(DB, API, AI, Scheduler)은 도커 컴포즈로 실행시키기
- 말한대로만 수행할것
- 주석 처리된 코드 (Spark, Kafka, Airflow) 삭제 금지 (롤백 대비)
