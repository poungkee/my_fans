# 자기소개서 - FANS 프로젝트 기반

## 1. 지원동기

**"항공에서 IT로, 안정적인 서비스 운영에 대한 열정"**

항공 조종사를 꿈꾸며 미국에서 자격증을 취득했지만, 비자 문제로 미국에서 일할 수 없게 되면서 새로운 길을 모색하게 되었습니다. 학부에서 항공소프트웨어를 전공하며 프로그래밍의 기초를 배웠던 경험을 떠올리며, IT 개발자로의 전환을 결심했습니다.

FANS 프로젝트에서 AWS EKS 인프라를 구축하며 **안정적인 서비스 운영**의 중요성을 체감했습니다. 새벽에 발생한 AI Pod OOMKilled 이슈를 해결하던 순간, 항공 운항 중 비상 상황에 대응하던 경험이 겹쳐 보였습니다. **시스템이 멈추지 않도록 사전에 모니터링하고, 장애 발생 시 신속히 원인을 파악해 복구하는 일**이 조종사가 안전 운항을 책임지는 것과 같다고 느꼈습니다. 비록 늦은 시작이지만, 5년간 한 직장에서 증명한 **성실함**과 최전방 경계 업무에서 배운 **위기 상황 대응력**을 바탕으로 백엔드 시스템의 안정적인 운영에 기여하고 싶습니다.

---

## 2. 직무적합성

**"AWS EKS 인프라 구축부터 AI 파이프라인까지, 실전 프로젝트 경험"**

### FANS 프로젝트 - 백엔드 인프라 담당 (2025.09 ~ 2025.11, 8주)

**1) AWS EKS 클러스터 구축 및 운영**
- Terraform IaC로 EKS 클러스터 구축 (2-AZ 구성, 고가용성 확보)
- Karpenter 도입으로 AI 워크로드 증가 시 자동 노드 프로비저닝 (Spot Instance 활용)
- ALB Ingress Controller 설정 및 도메인 연결
- 비용 대비 처리량 300% 향상, 인프라 비용 70% 절감

**2) BullMQ 분산 작업 큐 시스템 구축**
- Redis 기반 작업 큐로 AI 처리 파이프라인 구축
- 4개 Worker 분리 (Summary, Bias, Keyword, Recommendation)
- Rate Limiting 및 Retry 전략 구현으로 AI 서비스 OOMKilled 이슈 해결
- 순차 처리 → 병렬 처리로 전환하여 처리량 대폭 향상

**3) 통합 크롤러 개발 (Puppeteer + TypeScript)**
- 다음/네이버 뉴스 크롤러 통합 (JSON API + Meta Tag 파싱)
- 중복 제거 로직 및 다중 인스턴스 지원 (해시 기반 섹션 분산)
- Kubernetes CronJob으로 3분마다 자동 실행
- 일일 11,000+ 기사 수집, 크롤링 성공률 98.5%

**4) PostgreSQL 데이터베이스 설계**
- 10개 테이블 설계 (news_articles, bias_analysis, article_sentiment 등)
- TypeORM Entity/Repository 패턴 적용
- 인덱스 최적화로 평균 쿼리 응답 < 50ms

### 보유 기술
- **Backend**: Node.js, Express, TypeScript, Spring Boot, FastAPI
- **Database**: PostgreSQL, MySQL, Redis, Elasticsearch
- **DevOps**: Docker, Kubernetes, AWS EKS, Terraform, Karpenter
- **Frontend**: React.js, Redux, Router
- **Tools**: Git, GitHub, Notion, Puppeteer, BullMQ

### 자격증
- 정보처리기사 (2014.11)
- 네트워크관리사 2급 (2021.02)
- TOEIC 945 (2025.01)

---

## 3. 조직적합성

**"5년간 증명한 성실함과 팀 협업 능력"**

2011년부터 2015년까지 약 5년간 공연장에서 무대 스태프로 일하며 성실함을 증명했습니다. 새로운 공연장을 만드는 프로젝트에서 많은 사람들이 힘들어 그만뒀지만, 저는 끝까지 맡은 바 책임을 다했고 대학 복학 후에도 팀장님이 주말 근무를 제안할 정도로 신뢰받았습니다. FANS 프로젝트에서도 이러한 성실함이 발휘되었으며, 8주간 팀원들과 매일 Daily Standup을 진행하며 진행 상황을 공유했고 **인프라 이슈 발생 시 즉시 로그를 분석하고 해결 방안을 제시**했습니다. 특히 AI Worker OOMKilled 이슈를 해결하는 과정에서 Worker 분리, Rate Limiting, Concurrency 조정 등 여러 시도를 하며 끝까지 해결책을 찾았습니다.

또한 5명 팀 프로젝트에서 백엔드 3명 중 인프라를 담당하며 협업과 소통 능력을 발휘했습니다. 프론트엔드 팀과 API 명세를 조율하고 AI 팀과 데이터 파이프라인을 설계했으며, GitHub을 통한 Code Review와 Branch 전략을 수립하여 충돌 없이 협업했습니다. Notion으로 기술 문서를 작성해 팀원들이 언제든 참고할 수 있도록 했고, 군 복무 중 최전방 부대에서 경계 업무를 하며 배운 **반복되는 업무도 소홀히 하지 않는 습관**은 현재 Kubernetes 배포 전 체크리스트 작성, 인프라 변경 전 롤백 계획 수립 등으로 이어졌습니다.

---

## 4. 문제해결 사례

**"인프라 장애 발생 시 근본 원인 분석과 재발 방지 전략"**

### 사례 1. AI 서비스 OOMKilled 반복 이슈

**상황**: FANS 프로젝트 초기, Summarize AI Pod가 10~14분마다 메모리 부족으로 재시작되며 서비스 불안정

**과제**: Transformer 모델 로딩 시 메모리 누수, 동시 요청 처리로 메모리 급증

**해결**:
- Kubernetes 로그 및 CloudWatch 메트릭 분석
- BullMQ Worker를 4개로 분리하여 AI 처리 부하 분산
- Summary Worker의 Concurrency를 1로 제한하고 Rate Limiting 적용 (2/sec)
- 모델 로딩 최적화 (캐싱 적용)

**결과**: OOMKilled 완전 해소, 안정적 24시간 운영 달성

**배운 점 및 개선 방향**:
- 메모리 사용량이 높은 AI 워크로드는 처음부터 **리소스 모니터링**이 필수임을 깨달았습니다.
- Kubernetes의 Resource Request/Limit 설정만으로는 부족하며, 애플리케이션 레벨에서 **동시 처리 수를 제한**하는 것이 중요했습니다.
- 앞으로는 배포 전에 부하 테스트를 통해 **적정 Concurrency 값을 미리 산정**하고, Prometheus + Grafana로 메모리 사용 패턴을 실시간 모니터링하여 문제를 사전에 예방하겠습니다.

---

### 사례 2. Redis Eviction Policy로 인한 BullMQ 작동 불가

**상황**: Crawler가 기사를 수집하지만 BullMQ Queue에 Job이 추가되지 않음

**과제**: AWS ElastiCache Redis가 `allkeys-lru` 정책 사용 (BullMQ는 `noeviction` 필수)

**해결**:
- Redis 로그 및 BullMQ 코드 분석으로 원인 파악
- AWS Console에서 Parameter Group 생성 및 `noeviction` 설정
- ElastiCache 재시작 및 정책 적용

**결과**: Queue 정상 작동, Job 처리율 100% 달성

**배운 점 및 개선 방향**:
- 오픈소스 라이브러리를 사용할 때는 **공식 문서의 필수 요구사항을 반드시 확인**해야 함을 배웠습니다.
- AWS 관리형 서비스의 기본 설정이 모든 상황에 맞는 것은 아니며, 사용 목적에 맞게 **Parameter 조정이 필수**임을 깨달았습니다.
- 앞으로는 인프라 구축 시 체크리스트를 작성하여 (Redis eviction policy, DB connection pool, timeout 설정 등) **필수 설정 항목을 사전에 검증**하고, Terraform 코드에 명시적으로 작성하여 설정 누락을 방지하겠습니다.

---

### 사례 3. Crawler에서 Queue 모듈 import 실패

**상황**: Crawler 코드에서 `addSummaryJob()` 함수 호출 시 "module not found" 에러

**과제**: Docker 빌드 시 `@fans/queue` 모듈이 node_modules에 없음

**해결**:
- Dockerfile에 multi-stage build 적용
- `backend/queue/` 빌드 후 `node_modules/@fans/queue/`로 복사
- TypeScript import 경로 수정 및 tsconfig rootDir 조정

**결과**: Crawler → Queue → Worker → AI 전체 파이프라인 정상 작동

**배운 점 및 개선 방향**:
- Monorepo 구조에서 공통 모듈을 관리할 때는 **npm workspace 또는 스코프 패키지 구조**를 초기부터 설계해야 함을 배웠습니다.
- Docker 빌드 시 로컬에서는 작동하지만 컨테이너에서 실패하는 경우, **빌드 컨텍스트와 의존성 복사 순서**를 철저히 확인해야 합니다.
- 앞으로는 프로젝트 초기에 **Lerna 또는 Turborepo 같은 Monorepo 도구**를 도입하여 공통 모듈 의존성을 명확히 관리하고, CI/CD 파이프라인에 Docker 빌드 테스트를 추가하여 배포 전 이슈를 사전에 발견하겠습니다.

---

## 5. 입사 후 포부

**"1년 내 독립적 개발자, 3년 내 DevOps 전문가로 성장"**

### 1년 차: 기술 역량 강화 및 실무 적응

**목표 1) 3개월 내 기존 시스템 파악 및 1건 이상의 개선 제안**
- 입사 후 기존 백엔드 아키텍처, CI/CD 파이프라인, 모니터링 시스템 학습
- 코드 리뷰를 통해 Best Practice 습득
- 성능 개선 또는 비용 절감 관련 개선안 제안 (FANS 프로젝트에서 70% 비용 절감 경험 활용)

**목표 2) 6개월 내 독립적인 기능 개발 및 배포**
- 소규모 기능부터 설계, 개발, 테스트, 배포까지 전 과정 수행
- 장애 발생 시 신속한 원인 분석 및 해결 (평균 대응 시간 30분 이내)

**목표 3) 1년 내 AWS Certified Solutions Architect Associate 취득**
- FANS 프로젝트에서 쌓은 AWS 경험을 바탕으로 전문 자격증 취득
- 클라우드 아키텍처 설계 역량 강화

### 2~3년 차: 전문성 확립 및 팀 기여도 향상

**목표 1) Kubernetes 및 DevOps 전문가로 성장**
- CKA (Certified Kubernetes Administrator) 자격증 취득
- 사내 인프라 안정성 99.9% 이상 유지
- 배포 자동화 파이프라인 개선으로 배포 시간 50% 단축

**목표 2) 신규 팀원 온보딩 및 기술 문서화**
- 신입 개발자 멘토링 (연간 2명 이상)
- 기술 Wiki 작성 및 사내 세미나 발표 (분기별 1회)

**목표 3) 대용량 트래픽 처리 경험 쌓기**
- 동시 접속자 10만+ 이벤트 대응 경험
- Auto Scaling, Caching, Load Balancing 최적화

### 장기 목표: 기술 리더로 성장

- 백엔드 팀 Tech Lead 또는 DevOps 팀 리더로 성장
- 사내 기술 표준 수립 및 아키텍처 의사 결정 참여
- 오픈소스 기여 및 기술 블로그 운영으로 회사 기술력 홍보

---

**"변화를 두려워하지 않고 끊임없이 노력하는 개발자가 되겠습니다."**

항공에서 IT로의 전환은 쉽지 않았지만, FANS 프로젝트를 통해 백엔드 개발자로서 역량을 증명했습니다. 귀사에서도 성실함과 책임감, 그리고 문제 해결 능력을 바탕으로 팀에 기여하고 함께 성장하는 개발자가 되겠습니다.
