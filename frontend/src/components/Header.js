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

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = () => {
      // localStorage와 sessionStorage 모두 확인
      let token = localStorage.getItem('token');
      let userData = localStorage.getItem('user');
      
      // localStorage에 없으면 sessionStorage 확인
      if (!token || !userData) {
        token = sessionStorage.getItem('token');
        userData = sessionStorage.getItem('user');
      }
      
      if (token && userData) {
        setIsLoggedIn(true);
        setUser(JSON.parse(userData));
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
      const response = await fetch('/api/auth/logout', {
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
            {isLoggedIn && user?.name && (
              <div className="welcome-message">
                환영합니다 <span className="user-name-highlight">{user.name}</span>님
              </div>
            )}
            <div 
              className="user-icon" 
              onClick={() => toggleDropdown('user')}
            >
              {isLoggedIn ? (
                user?.profile_image ? (
                  <img 
                    src={user.profile_image} 
                    alt="프로필 이미지" 
                    className="user-profile-image"
                  />
                ) : (
                  user?.name ? user.name.charAt(0).toUpperCase() : '👤'
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
                  <span className="user-name">{user?.name || '사용자'}</span>
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
