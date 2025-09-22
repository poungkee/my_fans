import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommonData } from '../hooks/useCommonData';
import './Header.css';

const Header = ({ onSortChange, onSearch, selectedSort }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const searchInputRef = useRef(null); // ✅ 검색창 참조
  
  // 공통 데이터 가져오기
  const { categories, mediaSources, searchOptions, loading, error } = useCommonData();

  // 토큰 만료 확인 함수
  const isTokenExpired = (token) => {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  // 자동 로그아웃 함수
  const performAutoLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
    alert('로그인이 만료되어 자동으로 로그아웃되었습니다.');
    navigate('/login');
  };

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = () => {
      // localStorage와 sessionStorage 모두 확인
      let token = localStorage.getItem('token');
      let userData = localStorage.getItem('user');
      let isRememberMe = localStorage.getItem('rememberMe') === 'true';

      // localStorage에 없으면 sessionStorage 확인
      if (!token || !userData) {
        token = sessionStorage.getItem('token');
        userData = sessionStorage.getItem('user');
        isRememberMe = false;
      }

      if (token && userData) {
        // 토큰 만료 확인
        if (isTokenExpired(token)) {
          performAutoLogout();
          return;
        }

        setIsLoggedIn(true);
        setUser(JSON.parse(userData));

        // 토큰 만료 30분 전에 알림 (rememberMe가 false인 경우만)
        if (!isRememberMe) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expirationTime = payload.exp * 1000;
          const warningTime = expirationTime - (30 * 60 * 1000); // 30분 전
          const currentTime = Date.now();

          if (currentTime < warningTime) {
            const timeoutId = setTimeout(() => {
              if (confirm('로그인이 30분 후 만료됩니다. 연장하시겠습니까?')) {
                // 토큰 갱신 요청 (선택적 구현)
                window.location.reload();
              }
            }, warningTime - currentTime);

            return () => clearTimeout(timeoutId);
          }
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    // 초기 로그인 상태 확인
    checkLoginStatus();

    // localStorage 변화 감지를 위한 이벤트 리스너
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        checkLoginStatus();
      }
    };

    // storage 이벤트 리스너 등록 (다른 탭에서의 변화 감지)
    window.addEventListener('storage', handleStorageChange);

    // 커스텀 이벤트 리스너 등록 (같은 탭에서의 변화 감지)
    window.addEventListener('loginStatusChange', checkLoginStatus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('loginStatusChange', checkLoginStatus);
    };
  }, []);

  // 로그아웃 함수
  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // localStorage와 sessionStorage 모두에서 데이터 삭제
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setIsLoggedIn(false);
        setUser(null);
        setActiveDropdown(null);
        alert('로그아웃되었습니다.');
        navigate('/');
      }
    } catch (error) {
      console.error('로그아웃 에러:', error);
      // 에러가 발생해도 로컬 스토리지는 정리
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsLoggedIn(false);
      setUser(null);
      setActiveDropdown(null);
      navigate('/');
    }
  };

  const toggleDropdown = (type) => {
    setActiveDropdown(activeDropdown === type ? null : type);
  };

  const handleMouseEnter = (type) => setActiveDropdown(type);
  const handleMouseLeave = () => setActiveDropdown(null);

  const handleSortClick = (sortType, displayText) => {
    onSortChange(sortType, displayText);
    setActiveDropdown(null);
  };

  
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      onSearch(e.target.value);
    } else if (e.type === 'click') {
      const query = searchInputRef.current?.value ?? '';
      onSearch(query);
    }
  };

  const handleLogoClick = () => {
    // ✅ 검색창 입력값 비우고 포커스 해제 + 상태 초기화
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.blur();
    }
    setActiveDropdown(null);
    onSearch('');     // 전체 뉴스로
    
    // 페이지 새로고침
    window.location.reload();
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" onClick={handleLogoClick}>FANS</div>
        
        <div 
          className="dropdown"
          onMouseEnter={() => handleMouseEnter('agency')}
          onMouseLeave={handleMouseLeave}
        >
          <div className="news-agency">
            언론사 ▼
          </div>
          <div 
            id="agency-dropdown" 
            className={`dropdown-content ${activeDropdown === 'agency' ? 'show' : ''}`}
          >
            {loading ? (
              <div style={{padding: '10px', textAlign: 'center'}}>로딩 중...</div>
            ) : (
              mediaSources.map((source, index) => (
                <a 
                  key={index} 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); }}
                >
                  {source.name}
                </a>
              ))
            )}
          </div>
        </div>
        
        <div 
          className="dropdown"
          onMouseEnter={() => handleMouseEnter('category')}
          onMouseLeave={handleMouseLeave}
        >
          <div className="category-nav">
            카테고리 ▼
          </div>
          <div 
            id="category-dropdown" 
            className={`dropdown-content ${activeDropdown === 'category' ? 'show' : ''}`}
          >
            {loading ? (
              <div style={{padding: '10px', textAlign: 'center'}}>로딩 중...</div>
            ) : (
              categories.map((category, index) => (
                <a 
                  key={index} 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); }}
                >
                  {category}
                </a>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="search-section">
        <div className="dropdown">
          <div 
            className="search-filter" 
            onClick={() => toggleDropdown('sort')}
          >
            <span className="search-filter-text">{selectedSort}</span>
            <span>▼</span>
          </div>
          <div 
            id="sort-dropdown" 
            className={`dropdown-content ${activeDropdown === 'sort' ? 'show' : ''}`}
          >
            {loading ? (
              <div style={{padding: '10px', textAlign: 'center'}}>로딩 중...</div>
            ) : (
              searchOptions.sort?.map((option, index) => (
                <a 
                  key={index} 
                  href="#" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSortClick(option.value, option.label); 
                  }}
                >
                  {option.label}
                </a>
              ))
            )}
          </div>
        </div>
        
        <input
          ref={searchInputRef}        // ✅ ref 연결
          type="text"
          className="search-input"
          placeholder="검색어를 입력하세요"
          onKeyUp={handleSearch}
        />
        
            <div 
              className="search-icon" 
              onClick={handleSearch}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
      </div>
      
      <div className="user-menu">
        <div className="user-dropdown">
          <div className="user-section">
            {isLoggedIn && (user?.userName || user?.name || user?.username) && (
              <div className="welcome-message">
                환영합니다 <span className="user-name-highlight">{user.userName || user.name || user.username}</span>님
              </div>
            )}
            <div
              className="user-icon"
              onClick={() => toggleDropdown('user')}
            >
              {isLoggedIn ? (
                user?.profileImage && user.profileImage.trim() !== '' ? (
                  <>
                    <img
                      src={user.profileImage.startsWith('http') ? user.profileImage : `http://localhost:3000${user.profileImage}?t=${Date.now()}`}
                      alt="프로필 이미지"
                      className="user-profile-image"
                      crossOrigin="anonymous"
                      onLoad={() => {
                        console.log('✅ 헤더 이미지 로드 성공:', user.profileImage);
                      }}
                      onError={(e) => {
                        console.error('❌ 헤더 이미지 로드 실패:', e.target.src);
                        console.error('❌ 헤더 원본 경로:', user.profileImage);
                        e.target.style.display = 'none';
                        // 대체 텍스트 표시
                        const fallback = e.target.nextElementSibling;
                        if (fallback && fallback.classList.contains('user-profile-fallback')) {
                          fallback.style.display = 'block';
                        }
                      }}
                    />
                    <span
                      className="user-profile-fallback"
                      style={{
                        display: 'none',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}
                    >
                      {(user?.userName || user?.name || user?.username) ? (user.userName || user.name || user.username).charAt(0).toUpperCase() : '👤'}
                    </span>
                  </>
                ) : (
                  // 이미지가 없을 때 이름 첫 글자 또는 기본 아이콘 표시
                  (user?.userName || user?.name || user?.username) ? (user.userName || user.name || user.username).charAt(0).toUpperCase() : '👤'
                )
              ) : '👤'}
            </div>
          </div>
          <div 
            id="user-dropdown" 
            className={`user-dropdown-content ${activeDropdown === 'user' ? 'show' : ''}`}
          >
            {isLoggedIn ? (
              <>
                <div className="user-info">
                  <span className="user-name">{user?.userName || user?.name || user?.username || '사용자'}</span>
                  <span className="user-email">{user?.email}</span>
                </div>
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/mypage'); setActiveDropdown(null); }}>마이페이지</a>
                <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>로그아웃</a>
              </>
            ) : (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); setActiveDropdown(null); }}>로그인</a>
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); setActiveDropdown(null); }}>회원가입</a>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
