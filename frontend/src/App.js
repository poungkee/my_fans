// src/App.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Header from './components/Header';
import StockSection from './components/StockSection';
import NewsGrid from './components/NewsGrid';
import Sidebar from './components/Sidebar';
import AgencySection from './components/AgencySection';
import Footer from './components/Footer';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import MyPage from './pages/MyPage';
import LoginSuccessPage from './pages/LoginSuccessPage';
import LoginErrorPage from './pages/LoginErrorPage';

function HomePage() {
  /* -------------------- 상태 -------------------- */
  const [feedNews, setFeedNews] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedSort, setSelectedSort] = useState('최신순');
  const [selectedAgency, setSelectedAgency] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');

  // 주식 데이터
  const [stockData, setStockData] = useState([]);
  const [stockError, setStockError] = useState(null);
  const [stockLoading, setStockLoading] = useState(true);

  // API 베이스 (프록시 사용 시 빈 문자열)
  const API_BASE = useMemo(() => process.env.REACT_APP_API_BASE || '', []);

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

  /* -------------------- 헤더 핸들러 -------------------- */
  const handleSortChange = (_sortType, displayText) => setSelectedSort(displayText);
  const handleSearch = (query) => {
    const q = (query || '').trim();
    setSearchQuery(q);
    setIsSearching(!!q);
  };

  /* -------------------- 필터 상태 -------------------- */
  const [agencyFilteredNews, setAgencyFilteredNews] = useState(null);
  const [categoryFilteredNews, setCategoryFilteredNews] = useState(null);

  const currentList = isSearching
    ? (categoryFilteredNews ?? agencyFilteredNews ?? searchResults)
    : (categoryFilteredNews ?? agencyFilteredNews ?? feedNews);

  const handleAgencySelect = (agency) => {
    setSelectedAgency(agency);
    if (!agency || agency === '전체') {
      setAgencyFilteredNews(null);
      return;
    }
    const base = isSearching ? searchResults : feedNews;
    setAgencyFilteredNews(base.filter((n) => n.agency === agency));
  };

  const handleCategoryFilter = (category) => {
    if (!category) {
      setCategoryFilteredNews(null);
      return;
    }
    const base = isSearching ? searchResults : feedNews;
    setCategoryFilteredNews(base.filter((n) => n.category === category));
  };

  /* -------------------- 렌더 -------------------- */
  return (
    <div className="App">
      <Header
        onSortChange={handleSortChange}
        onSearch={handleSearch}
        selectedSort={selectedSort}
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
          <Sidebar />
        </div>

        <AgencySection
          selectedAgency={selectedAgency}
          onAgencySelect={handleAgencySelect}
        />
      </main>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/email-verification" element={<EmailVerificationPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/login-success" element={<LoginSuccessPage />} />
        <Route path="/login-error" element={<LoginErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
