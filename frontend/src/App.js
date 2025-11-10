// src/App.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import Header from './components/Header';
import StockSection from './components/StockSection';
import RecommendationsSection from './components/RecommendationsSection';
import NewsGrid from './components/NewsGrid';
import AdSidebar from './components/AdSidebar';
import Footer from './components/Footer';
import { API_BASE_URL } from './config/api';

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
import AccountLinkPage from './pages/AccountLinkPage';


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

  // 페이지 로드 타입 감지 (새로고침 vs 뒤로가기)
  const [isPageRefresh, setIsPageRefresh] = useState(false);

  // 주식 데이터
  const [stockData, setStockData] = useState([]);
  const [stockError, setStockError] = useState(null);
  const [stockLoading, setStockLoading] = useState(true);

  // API 베이스 URL (config/api.js에서 가져옴)
  const API_BASE = API_BASE_URL;

  /* -------------------- 새로고침 감지 및 카테고리 복원 -------------------- */
  useEffect(() => {
    // 새로고침 감지
    const navigationEntries = performance.getEntriesByType('navigation');
    const isRefresh = navigationEntries.length > 0 &&
      navigationEntries[0].type === 'reload';

    if (isRefresh) {
      // 새로고침 시 카테고리 및 검색어 상태 초기화
      sessionStorage.removeItem('selectedCategory');
      sessionStorage.removeItem('searchQuery');
      setIsPageRefresh(true);
    } else {
      // 뒤로가기 또는 일반 네비게이션
      setIsPageRefresh(false);
    }
  }, []);

  // URL 검색 매개변수 처리 (handleCategoryFilter, handleSourceFilter 정의 후 실행하도록 아래로 이동)

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
    console.log('🔄 피드 데이터 로드 시작');

    const controller = new AbortController();
    // topics는 없어도 동작하도록 파라미터 분리
    const params = new URLSearchParams({
      limit: '800', // 8개 카테고리 × 100개씩
      sort: 'created_at',
      topics: '정치,경제,사회,세계,IT/과학,생활/문화,스포츠,연예',
      _t: Date.now() // 캐시 무효화용 타임스탬프
    });
    const url = `${API_BASE}/api/feed?${params.toString()}`;

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('🔍 피드 데이터 수신:');
        console.log('- 전체 기사:', data.items?.length || 0);
        const hankyoreh = data.items?.filter(item => item.source === '한겨레') || [];
        console.log('- 한겨레 기사:', hankyoreh.length);
        console.log('- 한겨레 기사 ID들:', hankyoreh.map(item => item.id));

        // 모든 소스 확인
        const allSources = [...new Set(data.items?.map(item => item.source) || [])];
        console.log('- 받은 모든 소스들:', allSources);
        console.log('- 한겨레 상세:', hankyoreh.map(item => ({id: item.id, title: item.title})));

        // 카테고리 확인 추가
        const allCategories = [...new Set(data.items?.map(item => item.category) || [])];
        console.log('📊 받은 모든 카테고리들:', allCategories);
        const entertainmentArticles = data.items?.filter(item => item.category === '연예') || [];
        console.log('📺 연예 기사 수:', entertainmentArticles.length);
        if (entertainmentArticles.length > 0) {
          console.log('📺 연예 기사 상세:', entertainmentArticles.map(item => ({
            id: item.id,
            title: item.title?.substring(0, 50),
            category: item.category
          })));
        }

        setFeedNews(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('피드 로드 실패:', e);
          setFeedNews([]); // 빈 배열 유지해도 다른 섹션은 렌더링
        }
      }
    })();

    return () => controller.abort();
  }, [API_BASE]); // 의존성은 그대로 두고

  /* -------------------- 카테고리 및 검색어 상태 복원 (뒤로가기 시) -------------------- */
  useEffect(() => {
    // 새로고침이 아닐 때만 실행
    if (!isPageRefresh) {
      // 카테고리 복원
      if (feedNews.length > 0) {
        const savedCategory = sessionStorage.getItem('selectedCategory');
        if (savedCategory && savedCategory !== '전체') {
          const filtered = feedNews.filter((n) => n.category === savedCategory);
          setCategoryFilteredNews(filtered);
          console.log(`🔄 카테고리 복원: ${savedCategory} (${filtered.length}개 기사)`);
        }
      }

      // 검색어 복원
      const savedSearchQuery = sessionStorage.getItem('searchQuery');
      if (savedSearchQuery && savedSearchQuery.trim()) {
        console.log(`🔍 검색어 복원: "${savedSearchQuery}"`);
        setSearchQuery(savedSearchQuery);
        setIsSearching(true);
      }
    }
  }, [feedNews, isPageRefresh]);

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
      limit: '200',
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
        console.log('[App.js] 백엔드에서 받은 market summary 데이터:', items);
        console.log('[App.js] 첫 번째 항목:', items[0]);
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

    // 검색어 상태를 sessionStorage에 저장 (뒤로가기 시 복원용)
    if (q) {
      sessionStorage.setItem('searchQuery', q);
    } else {
      sessionStorage.removeItem('searchQuery');
    }
  };

  // 강제 데이터 새로고침 함수
  const forceRefresh = () => {
    console.log('🔄 강제 새로고침 시작');
    setCategoryFilteredNews(null);
    setSourceFilteredNews(null);
    setFeedNews([]);
    // 컴포넌트 다시 마운트 효과를 위해 key 변경
    window.location.reload();
  };

  /* -------------------- 필터 상태 -------------------- */
  const [categoryFilteredNews, setCategoryFilteredNews] = useState(null);
  const [sourceFilteredNews, setSourceFilteredNews] = useState(null);

  // 언론사별 로딩 상태 및 페이지 관리
  const [sourceLoadingState, setSourceLoadingState] = useState({
    sourceName: null,
    page: 1,
    hasMore: true,
    isLoading: false
  });

  // 카테고리별 로딩 상태 및 페이지 관리
  const [categoryLoadingState, setCategoryLoadingState] = useState({
    categoryName: null,
    page: 1,
    hasMore: true,
    isLoading: false
  });

  // 카테고리와 언론사 필터를 AND 조건으로 적용
  const currentList = useMemo(() => {
    let base = isSearching ? searchResults : feedNews;

    // 카테고리 필터 적용
    if (categoryFilteredNews) {
      base = categoryFilteredNews;
    }

    // 언론사 필터 적용 (카테고리 필터가 있으면 그 결과에서, 없으면 전체에서)
    if (sourceFilteredNews && categoryFilteredNews) {
      // 둘 다 있으면 AND 조건: 카테고리 필터된 결과 중에서 언론사 필터링
      return base.filter(item =>
        sourceFilteredNews.some(sourceItem => sourceItem.id === item.id)
      );
    } else if (sourceFilteredNews) {
      // 언론사 필터만 있으면 언론사 필터 결과 사용
      return sourceFilteredNews;
    }

    return base;
  }, [isSearching, searchResults, feedNews, categoryFilteredNews, sourceFilteredNews]);

  // 디버깅: currentList 상태 확인
  useEffect(() => {
    console.log('🔍 App.js currentList 상태:');
    console.log('- sourceFilteredNews:', sourceFilteredNews?.length || 'null');
    console.log('- categoryFilteredNews:', categoryFilteredNews?.length || 'null');
    console.log('- feedNews:', feedNews?.length || 0);
    console.log('- currentList:', currentList?.length || 0);
  }, [sourceFilteredNews, categoryFilteredNews, feedNews, currentList]);


  const handleCategoryFilter = async (category) => {
    if (!category || category === '전체') {
      setCategoryFilteredNews(null);
      setCategoryLoadingState({
        categoryName: null,
        page: 1,
        hasMore: true,
        isLoading: false
      });
      sessionStorage.removeItem('selectedCategory');
      return;
    }

    // 카테고리별 전용 API 호출
    try {
      const url = `${API_BASE}/api/news/by-category/${encodeURIComponent(category)}?page=1&limit=100&days=30`;
      console.log('🔍 카테고리별 API 호출:', url);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log('- 카테고리별 API 응답:', data.items?.length || 0);

      setCategoryFilteredNews(Array.isArray(data.items) ? data.items : []);

      // 로딩 상태 초기화
      setCategoryLoadingState({
        categoryName: category,
        page: 1,
        hasMore: data.pagination?.hasMore || false,
        isLoading: false
      });

      // 카테고리 상태를 sessionStorage에 저장 (뒤로가기 시 복원용)
      sessionStorage.setItem('selectedCategory', category);
    } catch (error) {
      console.error('카테고리별 API 호출 실패:', error);
      // 실패 시 기존 방식으로 폴백
      const base = isSearching ? searchResults : feedNews;
      const filtered = base.filter((n) => n.category === category);
      setCategoryFilteredNews(filtered);
      sessionStorage.setItem('selectedCategory', category);
    }
  };

  const handleSourceFilter = async (sourceName) => {
    console.log('🔍 소스 필터링:', sourceName);
    if (!sourceName) {
      setSourceFilteredNews(null);
      return;
    }

    // 언론사별 전용 API 호출
    try {
      const url = `${API_BASE}/api/news/by-source/${encodeURIComponent(sourceName)}?page=1&limit=100&days=7&sort=created_at`;
      console.log('- API URL:', url);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log('- 언론사별 API 응답:', data.items?.length || 0);
      console.log('- 받은 기사 ID들:', data.items?.map(item => item.id) || []);

      setSourceFilteredNews(Array.isArray(data.items) ? data.items : []);

      // 로딩 상태 초기화
      setSourceLoadingState({
        sourceName: sourceName,
        page: 1,
        hasMore: data.pagination?.hasMore || false,
        isLoading: false
      });
    } catch (error) {
      console.error('언론사별 API 호출 실패:', error);
      // 실패 시 기존 방식으로 폴백
      const base = categoryFilteredNews || (isSearching ? searchResults : feedNews);
      const filtered = base.filter((n) => n.source === sourceName);
      setSourceFilteredNews(filtered);
    }
  };

  // 카테고리별 추가 데이터 로드 함수
  const loadMoreCategoryNews = async () => {
    if (!categoryLoadingState.categoryName || categoryLoadingState.isLoading || !categoryLoadingState.hasMore) {
      return;
    }

    setCategoryLoadingState(prev => ({ ...prev, isLoading: true }));

    try {
      const nextPage = categoryLoadingState.page + 1;
      const url = `${API_BASE}/api/news/by-category/${encodeURIComponent(categoryLoadingState.categoryName)}?page=${nextPage}&limit=100&days=30`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log(`- 카테고리 페이지 ${nextPage} 로드:`, data.items?.length || 0);

      if (data.items && data.items.length > 0) {
        setCategoryFilteredNews(prev => [...(prev || []), ...data.items]);
        setCategoryLoadingState(prev => ({
          ...prev,
          page: nextPage,
          hasMore: data.pagination?.hasMore || false,
          isLoading: false
        }));
      } else {
        setCategoryLoadingState(prev => ({
          ...prev,
          hasMore: false,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('카테고리 추가 로드 실패:', error);
      setCategoryLoadingState(prev => ({
        ...prev,
        hasMore: false,
        isLoading: false
      }));
    }
  };

  // 언론사별 추가 데이터 로드 함수
  const loadMoreSourceNews = async () => {
    if (!sourceLoadingState.sourceName || sourceLoadingState.isLoading || !sourceLoadingState.hasMore) {
      return;
    }

    setSourceLoadingState(prev => ({ ...prev, isLoading: true }));

    try {
      const nextPage = sourceLoadingState.page + 1;
      const url = `${API_BASE}/api/news/by-source/${encodeURIComponent(sourceLoadingState.sourceName)}?page=${nextPage}&limit=100&days=30`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log(`- 언론사 페이지 ${nextPage} 로드:`, data.items?.length || 0);

      if (data.items && data.items.length > 0) {
        setSourceFilteredNews(prev => [...(prev || []), ...data.items]);
        setSourceLoadingState(prev => ({
          ...prev,
          page: nextPage,
          hasMore: data.pagination?.hasMore || false,
          isLoading: false
        }));
      } else {
        setSourceLoadingState(prev => ({
          ...prev,
          hasMore: false,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('언론사 추가 로드 실패:', error);
      setSourceLoadingState(prev => ({
        ...prev,
        hasMore: false,
        isLoading: false
      }));
    }
  };

  // URL 검색 매개변수 처리
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const searchParam = urlParams.get('search');
    const categoryParam = urlParams.get('category');
    const sourceParam = urlParams.get('source');

    if (searchParam) {
      setSearchQuery(searchParam);
      setIsSearching(true);
    }

    if (categoryParam) {
      handleCategoryFilter(categoryParam);
    }

    if (sourceParam) {
      handleSourceFilter(sourceParam);
    }

    // URL 파라미터 유지 (뒤로가기 시 복원을 위해)
  }, [location.search]);

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
            {/* 맞춤 추천 뉴스 섹션 (로그인 사용자만) */}
            <RecommendationsSection
              onNavigateToDetail={(articleId) => {
                window.location.href = `/news/${articleId}`;
              }}
            />

            <NewsGrid
              newsData={currentList}
              searchQuery={isSearching ? searchQuery : ''}
              onLoadMore={
                categoryLoadingState.categoryName
                  ? loadMoreCategoryNews
                  : sourceLoadingState.sourceName
                    ? loadMoreSourceNews
                    : null
              }
              isLoadingMore={
                categoryLoadingState.categoryName
                  ? categoryLoadingState.isLoading
                  : sourceLoadingState.isLoading
              }
              hasMore={
                categoryLoadingState.categoryName
                  ? categoryLoadingState.hasMore
                  : sourceLoadingState.hasMore
              }
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
    // 소셜 로그인 세션 관리 개선
    const handleBeforeUnload = (e) => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      if (isSocialLogin) {
        // 새로고침 vs 브라우저 종료 구분을 위한 플래그 설정
        sessionStorage.setItem('isRefreshing', 'true');

        // 잠시 후 플래그 제거 (새로고침인 경우)
        setTimeout(() => {
          sessionStorage.removeItem('isRefreshing');
        }, 100);
      }
    };

    // 페이지 로드 시 새로고침인지 확인
    const handleLoad = () => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      const isRefreshing = sessionStorage.getItem('isRefreshing') === 'true';

      if (isSocialLogin) {
        if (!isRefreshing) {
          // 새로고침이 아닌 경우 (브라우저 재시작 등) - 세션 확인
          const socialLoginTime = sessionStorage.getItem('socialLoginTime');
          if (socialLoginTime) {
            const loginTime = parseInt(socialLoginTime);
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if ((Date.now() - loginTime) > twentyFourHours) {
              // 24시간 경과 시 로그아웃
              sessionStorage.clear();
              localStorage.clear();
              alert('24시간이 경과하여 자동 로그아웃되었습니다.');
              window.location.href = '/login';
              return;
            }
          }
        }
        // 새로고침 플래그 제거
        sessionStorage.removeItem('isRefreshing');
      }
    };

    // 페이지 새로고침/창 닫기 감지
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('load', handleLoad);

    // 페이지 로드 시 즉시 실행
    handleLoad();

    // 페이지 숨김/표시 감지 (탭 전환, 창 최소화 등) - 소셜 로그인 시 장시간 비활성 체크
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
          // 2시간 이상 숨겨져 있었다면 자동 로그아웃 (소셜 로그인은 더 관대하게)
          if (hiddenTime > 2 * 60 * 60 * 1000) { // 2시간으로 연장
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

    // 페이지 포커스 이벤트 감지 - 소셜 로그인 24시간 만료 체크
    const handleFocus = () => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      if (isSocialLogin) {
        const socialLoginTime = sessionStorage.getItem('socialLoginTime');
        if (socialLoginTime) {
          const loginTime = parseInt(socialLoginTime);
          const twentyFourHours = 24 * 60 * 60 * 1000;

          if ((Date.now() - loginTime) > twentyFourHours) {
            // 24시간 경과 시 로그아웃
            sessionStorage.clear();
            localStorage.clear();
            window.dispatchEvent(new Event('loginStatusChange'));
            alert('24시간이 경과하여 자동 로그아웃되었습니다.');
            window.location.href = '/login';
          }
        }
      }
    };

    // 주기적 세션 체크 (5분마다) - 소셜 로그인 24시간 만료 체크
    const sessionCheckInterval = setInterval(() => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';

      if (isSocialLogin) {
        const socialLoginTime = sessionStorage.getItem('socialLoginTime');
        if (socialLoginTime) {
          const loginTime = parseInt(socialLoginTime);
          const twentyFourHours = 24 * 60 * 60 * 1000;

          if ((Date.now() - loginTime) > twentyFourHours) {
            // 24시간 경과 시 로그아웃
            sessionStorage.clear();
            localStorage.clear();
            window.dispatchEvent(new Event('loginStatusChange'));
            alert('24시간이 경과하여 자동 로그아웃되었습니다.');
            window.location.href = '/login';
          }
        }
      }
    }, 5 * 60 * 1000); // 5분마다

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
        <Route path="/account-link" element={<AccountLinkPage />} />
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
