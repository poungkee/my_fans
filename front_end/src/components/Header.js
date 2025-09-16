import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ onSortChange, onSearch, selectedSort }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const navigate = useNavigate();
  const searchInputRef = useRef(null); // ✅ 검색창 참조

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
    navigate('/');    // 홈으로
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
            <a href="#" onClick={(e) => { e.preventDefault(); }}>조선일보</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>중앙일보</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>동아일보</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>한국경제</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>문화일보</a>
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
            <a href="#" onClick={(e) => { e.preventDefault(); }}>정치</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>경제</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>사회</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>세계</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>IT/과학</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>생활/문화</a>
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
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('latest', '최신순'); }}>최신순</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('relevant', '관련순'); }}>관련순</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('popular', '조회순'); }}>조회순</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('trending', '인기순'); }}>인기순</a>
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
          🔍
        </div>
      </div>
      
      <div className="user-menu">
        <div className="user-dropdown">
          <div 
            className="user-icon" 
            onClick={() => toggleDropdown('user')}
          >
            👤
          </div>
          <div 
            id="user-dropdown" 
            className={`user-dropdown-content ${activeDropdown === 'user' ? 'show' : ''}`}
          >
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); setActiveDropdown(null); }}>로그인</a>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); setActiveDropdown(null); }}>회원가입</a>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/mypage'); setActiveDropdown(null); }}>마이페이지</a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
