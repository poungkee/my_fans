import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommonData } from '../hooks/useCommonData';

const Header = ({ onSortChange, onSearch, selectedSort }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const navigate = useNavigate();
  const searchInputRef = useRef(null); // ✅ 검색창 참조
  
  // 공통 데이터 가져오기
  const { categories, mediaSources, searchOptions, loading, error } = useCommonData();

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
