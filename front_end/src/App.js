// front_end/src/App.js
import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import StockSection from './components/StockSection';
import NewsGrid from './components/NewsGrid';
import Sidebar from './components/Sidebar';
import AgencySection from './components/AgencySection';
import Footer from './components/Footer';

function App() {
  // 정렬/필터/검색
  const [selectedSort, setSelectedSort] = useState('최신순');
  const [selectedAgency, setSelectedAgency] = useState('전체'); // 초기엔 전체로
  const [searchQuery, setSearchQuery] = useState('');

  // 원본과 화면용 분리
  const [allNews, setAllNews] = useState([]);
  const [newsData, setNewsData] = useState([]);

  // 주식 섹션(시뮬레이션 유지)
  const [stockData, setStockData] = useState([
    { label: '코스피', value: '2,456.78', change: '+12.34 (+0.50%)', type: 'positive' },
    { label: '나스닥', value: '14,567.89', change: '-23.45 (-0.16%)', type: 'negative' },
    { label: '환율 (USD/KRW)', value: '1,234.56', change: '+5.67 (+0.46%)', type: 'positive' },
    { label: '비트코인', value: '$43,567.89', change: '+1,234.56 (+2.92%)', type: 'positive' }
  ]);

  // CRA 프록시 사용 시 빈 문자열, 아니면 REACT_APP_API_BASE 사용
  const API_BASE = useMemo(() => process.env.REACT_APP_API_BASE || '', []);
  // 네이버 정렬 매핑: 최신순→date, 그 외→sim
  const naverSort = useMemo(() => (selectedSort === '최신순' ? 'date' : 'sim'), [selectedSort]);

  // 뉴스 패치 (프록시 경로 / 직접 경로 폴백)
  useEffect(() => {
    const controller = new AbortController();
    const q = (searchQuery || '정치').trim();

    const urls = [
      `${API_BASE}/api/news?query=${encodeURIComponent(q)}&display=12&sort=${naverSort}`,
      `http://localhost:8000/api/news?query=${encodeURIComponent(q)}&display=12&sort=${naverSort}`,
    ];

    (async () => {
      let lastErr;
      for (const url of urls) {
        try {
          const res = await fetch(url, { signal: controller.signal }); // credentials 불필요
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const items = Array.isArray(data.items) ? data.items : [];
          setAllNews(items);
          setNewsData(items);
          return;
        } catch (e) {
          lastErr = e;
          // 다음 URL로 폴백 시도
        }
      }
      console.error('뉴스 로드 실패:', lastErr);
      setAllNews([]);
      setNewsData([]);
    })();

    return () => controller.abort();
  }, [API_BASE, searchQuery, naverSort]);

  // 주식 데이터 업데이트 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      setStockData(prevData =>
        prevData.map(item => {
          const currentValue = parseFloat(item.value.replace(/[^0-9.-]/g, ''));
          const change = (Math.random() - 0.5) * 10;
          const newValue = (currentValue + change).toFixed(2);
          return { ...item, value: item.value.replace(/[0-9.-]+/, newValue) };
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 정렬
  const handleSortChange = (sortType, displayText) => {
    setSelectedSort(displayText);
    const sorted = [...newsData].sort((a, b) => {
      switch (sortType) {
        case 'latest':
          return (a.timeValue ?? 9999) - (b.timeValue ?? 9999);
        case 'popular':
        case 'relevant':
        case 'trending':
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });
    setNewsData(sorted);
  };

  // 검색
  const handleSearch = (query) => setSearchQuery(query);

  // 필터는 항상 원본 기준
  const handleAgencyFilter = (agency) => {
    const base = allNews;
    const filtered = agency && agency !== '전체' ? base.filter(n => n.agency === agency) : base;
    setNewsData(filtered);
  };

  const handleCategoryFilter = (category) => {
    const base = allNews;
    const filtered = category ? base.filter(n => n.category === category) : base;
    setNewsData(filtered);
  };

  const handleAgencySelect = (agency) => {
    setSelectedAgency(agency);
    handleAgencyFilter(agency);
  };

  return (
    <div className="App">
      <Header
        onSortChange={handleSortChange}
        onSearch={handleSearch}
        selectedSort={selectedSort}
      />

      <StockSection stockData={stockData} />

      <main className="main">
        <div className="main-content">
          <div className="content-area">
            <NewsGrid
              newsData={newsData}
              searchQuery={searchQuery}
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

export default App;
