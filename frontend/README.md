# 뉴스 포털 React 애플리케이션

## 개요
뉴스 포털 웹사이트를 React로 구현한 현대적인 웹 애플리케이션입니다.

## 주요 기능
- 📰 실시간 뉴스 표시 (4x3 그리드 레이아웃)
- 📊 주식 API 데이터 표시 (코스피, 나스닥, 환율, 비트코인)
- 🔍 뉴스 검색 및 필터링
- 📱 반응형 디자인 (모바일, 태블릿, 데스크톱)
- 👤 사용자 인증 시스템 (로그인, 회원가입, 마이페이지)
- 🏢 언론사별 뉴스 관리 및 구독 기능
- ⭐ 북마크 및 좋아요 기능

## 기술 스택
- **Frontend**: React 18.2.0
- **Styling**: CSS3 (모듈화된 컴포넌트 스타일)
- **Build Tool**: Create React App
- **State Management**: React Hooks (useState, useEffect)

## 프로젝트 구조
```
src/
├── components/
│   ├── Header.js          # 헤더 컴포넌트 (로고, 메뉴, 검색)
│   ├── StockSection.js    # 주식 정보 섹션
│   ├── NewsGrid.js        # 뉴스 그리드 컨테이너
│   ├── NewsItem.js        # 개별 뉴스 아이템
│   ├── Sidebar.js         # 사이드바 (인기 뉴스)
│   ├── AgencySection.js   # 언론사 정보 섹션
│   └── Footer.js          # 푸터 컴포넌트
├── App.js                 # 메인 앱 컴포넌트
├── index.js              # 앱 진입점
└── index.css             # 전역 스타일
```

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm start
```

### 3. 프로덕션 빌드
```bash
npm run build
```

## 주요 컴포넌트 설명

### Header 컴포넌트
- 로고 및 브랜딩
- 언론사/카테고리 드롭다운 메뉴
- 검색 기능 및 정렬 옵션
- 사용자 메뉴 (로그인, 회원가입, 마이페이지)

### NewsGrid 컴포넌트
- 4x3 그리드 레이아웃으로 뉴스 표시
- 검색 및 필터링 기능
- 북마크, 좋아요, 공유 기능
- 반응형 디자인 지원

### StockSection 컴포넌트
- 실시간 주식 데이터 표시
- 5초마다 자동 업데이트 시뮬레이션
- 코스피, 나스닥, 환율, 비트코인 정보

### AgencySection 컴포넌트
- 언론사 목록 및 정보 표시
- 구독 기능
- 동적 정보 업데이트

## 반응형 디자인
- **데스크톱**: 4열 그리드
- **태블릿 (768px 이하)**: 2열 그리드
- **모바일 (480px 이하)**: 1열 그리드

## 상태 관리
React Hooks를 사용한 상태 관리:
- `useState`: 컴포넌트별 로컬 상태
- `useEffect`: 사이드 이펙트 및 데이터 업데이트
- Props를 통한 부모-자식 컴포넌트 간 데이터 전달

## 향후 개선 계획
- [ ] Redux 또는 Context API를 통한 전역 상태 관리
- [ ] 실제 뉴스 API 연동
- [ ] 사용자 인증 시스템 구현
- [ ] PWA (Progressive Web App) 지원
- [ ] 다크 모드 지원
- [ ] 무한 스크롤 기능
- [ ] 뉴스 상세 페이지 구현

## 라이선스
MIT License
