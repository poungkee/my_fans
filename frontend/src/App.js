// front_end/src/App.js
import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import StockSection from './components/StockSection';
import NewsGrid from './components/NewsGrid';
import Sidebar from './components/Sidebar';
import AgencySection from './components/AgencySection';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyPage from './pages/MyPage';

// 메인 홈페이지 컴포넌트
function HomePage() {
  /* 상태 */
  const [feedNews, setFeedNews] = useState([]);       // 홈 피드(전체 키워드)
  const [searchResults, setSearchResults] = useState([]); // 검색 결과
  const [isSearching, setIsSearching] = useState(false);

  const [selectedSort, setSelectedSort] = useState('최신순'); // 검색 정렬 전용
  const [selectedAgency, setSelectedAgency] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');

  /* 주식 섹션 시뮬레이션 유지 */
  const [stockData, setStockData] = useState([
    { label: '코스피', value: '2,456.78', change: '+12.34 (+0.50%)', type: 'positive' },
    { label: '나스닥', value: '14,567.89', change: '-23.45 (-0.16%)', type: 'negative' },
    { label: '환율 (USD/KRW)', value: '1,234.56', change: '+5.67 (+0.46%)', type: 'positive' },
    { label: '비트코인', value: '$43,567.89', change: '+1,234.56 (+2.92%)', type: 'positive' }
  ]);

  /* API 베이스 (proxy가 있으면 '') */
  const API_BASE = useMemo(() => process.env.REACT_APP_API_BASE || '', []);

  /* 검색 정렬 매핑: 최신, 관련, 인기, 조회 */
  const searchSortKey = useMemo(() => {
    const map = {
      '최신순': 'latest',
      '관련순': 'related',
      '인기순': 'popular',
      '조회순': 'views',
      // 기존 헤더가 latest/relevant/trending/popular 같은 키면 여기서 매핑 추가
      'relevant': 'related',
      'trending': 'popular',
      'latest': 'latest',
      'popular': 'popular',
      'views': 'views',
    };
    return map[selectedSort] || 'latest';
  }, [selectedSort]);

  /* 홈 피드 불러오기 (검색 전 화면) */
  useEffect(() => {
    const controller = new AbortController();
    const url = `${API_BASE}/api/feed?topics=${encodeURIComponent('정치,경제,사회,세계,IT/과학,생활/문화')}&limit=60&sort=latest`;
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFeedNews(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('피드 로드 실패:', e);
          setFeedNews([]);
        }
      }
    })();
    return () => controller.abort();
  }, [API_BASE]);

  /* 검색 전용 API 호출 (검색어/정렬이 바뀔 때만) */
  useEffect(() => {
    if (!isSearching) return;
    const q = (searchQuery || '').trim();
    if (!q) { setIsSearching(false); setSearchResults([]); return; }

    const controller = new AbortController();
    const url = `${API_BASE}/api/search?q=${encodeURIComponent(q)}&sort=${searchSortKey}&limit=60`;
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

  /* 주식 데이터 변동 시뮬레이션 */
  useEffect(() => {
    const interval = setInterval(() => {
      setStockData(prev =>
        prev.map(item => {
          const currentValue = parseFloat(item.value.replace(/[^0-9.-]/g, ''));
          const change = (Math.random() - 0.5) * 10;
          const newValue = (currentValue + change).toFixed(2);
          return { ...item, value: item.value.replace(/[0-9.-]+/, newValue) };
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /* 헤더: 정렬(검색에만 영향) */
  const handleSortChange = (_sortType, displayText) => {
    // 헤더에서 넘어오는 텍스트를 그대로 사용(최신순/관련순/인기순/조회순 등)
    setSelectedSort(displayText);
    // 검색중이 아닐 때는 화면 피드 정렬은 유지(최신)
  };

  /* 헤더: 검색 실행 */
  const handleSearch = (query) => {
    const q = (query || '').trim();
    setSearchQuery(q);
    setIsSearching(!!q); // 빈 검색어면 검색모드 해제 → 홈 피드로 복귀
  };

  /* 에이전시/카테고리 필터 (피드/검색 각각 현재 리스트에만 적용) */
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
    setAgencyFilteredNews(base.filter(n => n.agency === agency));
  };

  const handleCategoryFilter = (category) => {
    if (!category) { setCategoryFilteredNews(null); return; }
    const base = isSearching ? searchResults : feedNews;
    setCategoryFilteredNews(base.filter(n => n.category === category));
  };

  return (
    <div className="App">
      <Header
        onSortChange={handleSortChange}   // 검색 정렬
        onSearch={handleSearch}           // 검색 실행/해제
        selectedSort={selectedSort}
      />

      <StockSection stockData={stockData} />

      <main className="main">
        <div className="main-content">
          <div className="content-area">
            <NewsGrid
              newsData={currentList}
              searchQuery={isSearching ? searchQuery : ''} // 검색모드시에만 카드 내부 검색필터 동작
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

// 메인 App 컴포넌트
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/mypage" element={<MyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
