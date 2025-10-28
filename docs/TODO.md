# FANS 프로젝트 TODO 목록

## 🔥 우선순위: 높음 (즉시 처리)

### 1. 검색 후 기사 보고 뒤로가기 시 검색 유지 기능
- **설명**: 검색 → 기사 상세 → 뒤로가기 시 검색어 및 검색 결과 유지
- **현재 상태**: 카테고리는 sessionStorage로 복원되지만 검색어는 복원 안 됨
- **구현 방법**: 검색어도 sessionStorage에 저장/복원
- **관련 파일**: `frontend/src/App.js`, `frontend/src/components/Header.js`

### 2. 종합뉴스 거르기 (중복 제목 및 내용 문제)
- **설명**: 동일한 뉴스가 여러 언론사에서 중복으로 표시됨
- **구현 방법**: 제목 유사도 검사 또는 내용 해시 비교로 중복 제거
- **관련 파일**: 백엔드 뉴스 API 또는 프론트엔드 필터링

### 3. 카테고리/언론사 횡스크롤 제거 및 선택 시 풀 컬러 적용
- **설명**: 현재 횡스크롤이 있는데 이를 제거하고, 선택한 항목에 풀 컬러 적용
- **구현 방법**: CSS 수정 (flex-wrap, 선택 상태 스타일)
- **관련 파일**: `frontend/src/components/Header.css`, `frontend/src/components/Header.js`

### 4. 상단에 선택한 카테고리/언론사 표시
- **설명**: 현재 어떤 카테고리/언론사를 선택했는지 명확하게 표시
- **구현 방법**: Header에 선택된 필터 표시 영역 추가
- **관련 파일**: `frontend/src/components/Header.js`, `frontend/src/App.js`

### 5. 네이버 크롤링 확인 (추천뉴스 중복, 기자정보, 시간 미표시)
- **설명**: 네이버 크롤러에서 추천뉴스 중복, 기자 정보 누락, 시간 미표시 문제
- **구현 방법**: 크롤러 로직 수정 및 디버깅
- **관련 파일**: `backend/crawler/`, 네이버 크롤러 관련 파일

---

## ⏳ 우선순위: 보통 (나중에 처리)

### 모니터링 메트릭 적용
- **설명**: Prometheus 메트릭을 각 서비스에 적용
- **소요 시간**: 약 60-90분
- **가이드 문서**: `environments/eks/docs/prometheus-metrics-guide.md`

#### 세부 작업
1. **Main API에 Prometheus 메트릭 적용**
   - prom-client 설치
   - `src/metrics.ts` 파일 생성
   - `/metrics` 엔드포인트 추가
   - HTTP 요청 메트릭 미들웨어 추가

2. **Crawler에 Prometheus 메트릭 적용**
   - 크롤링 성공/실패 카운터
   - 크롤링 소요 시간 히스토그램
   - 크롤링 중인 작업 수 게이지

3. **Scheduler에 Prometheus 메트릭 적용**
   - 스케줄 실행 카운터
   - 처리 시간 메트릭

4. **Summarize AI에 Prometheus 메트릭 적용**
   - AI 요청 카운터
   - 처리 시간 히스토그램
   - 성공/실패 카운터

5. **Bias Analysis AI에 Prometheus 메트릭 적용**
   - 분석 요청 카운터
   - 처리 시간 메트릭

6. **ServiceMonitor YAML 작성 및 배포**
   - 각 서비스별 ServiceMonitor 생성
   - Prometheus가 자동으로 메트릭 수집하도록 설정

---

## ✅ 완료된 작업

- ✅ 회원탈퇴 이메일 발송 기능 + 이메일 환경변수 업데이트
- ✅ 모니터링 설정 (Prometheus, Grafana, Alertmanager 배포)
- ✅ CI/CD 파이프라인 구축 (GitHub Actions)
- ✅ Prometheus 메트릭 구현 가이드 문서 작성

---

## 📌 참고사항

- 모니터링 대시보드: https://monitoring.fans.ai.kr
- Grafana 로그인: admin / fans-admin-2025
- 가이드 문서 위치: `environments/eks/docs/`
