// src/App.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import Header from './components/Header';
import StockSection from './components/StockSection';
import NewsGrid from './components/NewsGrid';
import AdSidebar from './components/AdSidebar';
import Footer from './components/Footer';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import MyPage from './pages/MyPage';
import DeleteAccount from './pages/DeleteAccount';
import LoginSuccessPage from './pages/LoginSuccessPage';
import LoginErrorPage from './pages/LoginErrorPage';
import ActivityLog from './pages/ActivityLog';
import NewsDetailPage from './pages/NewsDetailPage';


function HomePageWrapper() {
  /* -------------------- 상태 -------------------- */
  const [feedNews, setFeedNews] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedSort, setSelectedSort] = useState('최신순');
  const [searchQuery, setSearchQuery] = useState('');

  // 스크롤 상태
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // URL 매개변수 처리를 위한 hooks 추가
  const location = useLocation();
  const navigate = useNavigate();

  // 주식 데이터
  const [stockData, setStockData] = useState([]);
  const [stockError, setStockError] = useState(null);
  const [stockLoading, setStockLoading] = useState(true);

  // API 베이스 (프록시 사용 시 빈 문자열)
  const API_BASE = useMemo(() => process.env.REACT_APP_API_BASE || '', []);

  // URL 검색 매개변수 처리
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const searchParam = urlParams.get('search');

    if (searchParam) {
      setSearchQuery(searchParam);
      setIsSearching(true);

      // URL에서 검색 매개변수 제거 (깔끔한 URL 유지)
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);

  // 검색 정렬 키 매핑
  const searchSortKey = useMemo(() => {
    const map = {
      '최신순': 'latest',
      '관련순': 'related',
      '인기순': 'popular',
      '조회순': 'views',
      relevant: 'related',
      trending: 'popular',
      latest: 'latest',
      popular: 'popular',
      views: 'views',
    };
    return map[selectedSort] || 'latest';
  }, [selectedSort]);

  /* -------------------- 데이터 로드: 홈 피드 -------------------- */
  useEffect(() => {
    const controller = new AbortController();
    // topics는 없어도 동작하도록 파라미터 분리
    const params = new URLSearchParams({
      limit: '60',
      sort: 'latest',
      topics: '정치,경제,사회,세계,IT/과학,생활/문화',
    });
    const url = `${API_BASE}/api/feed?${params.toString()}`;

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFeedNews(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('피드 로드 실패:', e);
          setFeedNews([]); // 빈 배열 유지해도 다른 섹션은 렌더링
        }
      }
    })();

    return () => controller.abort();
  }, [API_BASE]);

  /* -------------------- 데이터 로드: 검색 -------------------- */
  useEffect(() => {
    if (!isSearching) return;

    const q = (searchQuery || '').trim();
    if (!q) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      q,
      sort: searchSortKey,
      limit: '60',
    });
    const url = `${API_BASE}/api/search?${params.toString()}`;

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('검색 실패:', e);
          setSearchResults([]);
        }
      }
    })();

    return () => controller.abort();
  }, [API_BASE, isSearching, searchQuery, searchSortKey]);

  /* -------------------- 데이터 로드: 주식 요약(30초 갱신) -------------------- */
  const stockControllerRef = useRef(null);
  const firstLoadDoneRef = useRef(false);

  useEffect(() => {
    let timerId;

    const load = async () => {
      // 이전 요청 취소
      if (stockControllerRef.current) stockControllerRef.current.abort();
      const controller = new AbortController();
      stockControllerRef.current = controller;

      try {
        if (!firstLoadDoneRef.current) setStockLoading(true);
        setStockError(null);

        const res = await fetch(`${API_BASE}/api/market/summary`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const items = Array.isArray(json.items) ? json.items : [];
        setStockData(items);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('주식 데이터 로드 실패:', e);
          setStockError(e.message || '불러오기 실패');
          setStockData([]);
        }
      } finally {
        setStockLoading(false);
        firstLoadDoneRef.current = true;
      }
    };

    load(); // 즉시 1회
    timerId = setInterval(load, 30000);

    return () => {
      if (stockControllerRef.current) stockControllerRef.current.abort();
      clearInterval(timerId);
    };
  }, [API_BASE]);

  /* -------------------- 스크롤 처리 -------------------- */
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollToTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  /* -------------------- 헤더 핸들러 -------------------- */
  const handleSortChange = (_sortType, displayText) => setSelectedSort(displayText);
  const handleSearch = (query) => {
    const q = (query || '').trim();
    setSearchQuery(q);
    setIsSearching(!!q);
  };

  /* -------------------- 필터 상태 -------------------- */
  const [categoryFilteredNews, setCategoryFilteredNews] = useState(null);
  const [sourceFilteredNews, setSourceFilteredNews] = useState(null);

  const currentList = isSearching
    ? (sourceFilteredNews ?? categoryFilteredNews ?? searchResults)
    : (sourceFilteredNews ?? categoryFilteredNews ?? feedNews);


  const handleCategoryFilter = (category) => {
    if (!category || category === '전체') {
      setCategoryFilteredNews(null);
      setSourceFilteredNews(null);
      return;
    }
    const base = isSearching ? searchResults : feedNews;
    const filtered = base.filter((n) => n.category === category);
    setCategoryFilteredNews(filtered);
    setSourceFilteredNews(null); // 카테고리 변경 시 미디어 소스 필터 초기화
  };

  const handleSourceFilter = (sourceName) => {
    if (!sourceName) {
      setSourceFilteredNews(null);
      return;
    }
    const base = categoryFilteredNews || (isSearching ? searchResults : feedNews);
    setSourceFilteredNews(base.filter((n) => n.source === sourceName));
  };

  /* -------------------- 렌더 -------------------- */
  return (
    <div className="App">
      <Header
        onSortChange={handleSortChange}
        onSearch={handleSearch}
        selectedSort={selectedSort}
        onCategoryFilter={handleCategoryFilter}
        onSourceFilter={handleSourceFilter}
      />

      {/* 주식 위젯 – 로딩/에러가 있어도 아래 콘텐츠 렌더링은 계속 진행 */}
      {stockLoading && (
        <div style={{ padding: 10 }}>📊 주식 데이터 불러오는 중…</div>
      )}
      {stockError && (
        <div style={{ padding: 10, color: 'red' }}>⚠ {stockError}</div>
      )}
      {!stockLoading && !stockError && (
        <StockSection stockData={stockData} />
      )}

      <main className="main">
        <div className="main-content">
          <div className="content-area">
            <NewsGrid
              newsData={currentList}
              searchQuery={isSearching ? searchQuery : ''}
            />
          </div>
          <AdSidebar />
        </div>

      </main>

      <Footer />

      {/* 맨 위로 올라가는 버튼 */}
      {showScrollToTop && (
        <button
          className="scroll-to-top-button"
          onClick={scrollToTop}
          title="맨 위로"
        >
          ↑
        </button>
      )}
    </div>
  );
}

function App() {
  useEffect(() => {
    // 소셜 로그인 자동 로그아웃 로직
    const handleBeforeUnload = () => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      if (isSocialLogin) {
        console.log('소셜 로그인 감지 - 창 닫기 시 세션 정리 실행');
        // 소셜 로그인 사용자의 경우 창을 닫을 때 세션 정리
        sessionStorage.clear(); // 전체 세션 스토리지 정리
      }
    };

    // 페이지 새로고침/창 닫기 감지
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 페이지 숨김/표시 감지 (탭 전환, 창 최소화 등)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
        if (isSocialLogin) {
          // 페이지가 숨겨질 때 타임스탬프 저장
          sessionStorage.setItem('lastHidden', Date.now().toString());
        }
      } else if (document.visibilityState === 'visible') {
        const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
        const lastHidden = sessionStorage.getItem('lastHidden');

        if (isSocialLogin && lastHidden) {
          const hiddenTime = Date.now() - parseInt(lastHidden);
          // 5분 이상 숨겨져 있었다면 자동 로그아웃
          if (hiddenTime > 5 * 60 * 1000) { // 5분으로 단축
            sessionStorage.clear();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('rememberMe');

            // 로그인 상태 변경 이벤트 발생
            window.dispatchEvent(new Event('loginStatusChange'));

            // 메인 페이지로 리다이렉트
            alert('장시간 비활성으로 인해 자동 로그아웃되었습니다.');
            window.location.href = '/';
          }
          sessionStorage.removeItem('lastHidden');
        }
      }
    };

    // 페이지 포커스 이벤트 감지
    const handleFocus = () => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      if (isSocialLogin && !sessionStorage.getItem('token')) {
        // 소셜 로그인 토큰이 없어진 경우 강제 로그아웃
        sessionStorage.clear();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        window.dispatchEvent(new Event('loginStatusChange'));
        alert('세션이 만료되어 로그아웃되었습니다.');
        window.location.href = '/';
      }
    };

    // 주기적 세션 체크 (30초마다)
    const sessionCheckInterval = setInterval(() => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      const token = sessionStorage.getItem('token');

      if (isSocialLogin && !token) {
        // 소셜 로그인인데 토큰이 없으면 로그아웃 처리
        sessionStorage.clear();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        window.dispatchEvent(new Event('loginStatusChange'));
        window.location.href = '/';
      }
    }, 30000); // 30초

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // 컴포넌트 언마운트 시 정리
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(sessionCheckInterval);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePageWrapper />} />
        <Route path="/news/:id" element={<NewsDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/email-verification" element={<EmailVerificationPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/activity-log" element={<ActivityLog />} />
        <Route path="/login-success" element={<LoginSuccessPage />} />
        <Route path="/login-error" element={<LoginErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
