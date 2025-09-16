// API 기본 설정
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-api-domain.com' 
  : 'http://localhost:3000';

// 공통 fetch 함수
const fetchApi = async (endpoint) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

// 공통 데이터 API 호출 함수들
export const commonAPI = {
  // 모든 공통 데이터 한번에 가져오기
  getAll: () => fetchApi('/api/common/all'),
  
  // 개별 데이터 가져오기
  getCategories: () => fetchApi('/api/common/categories'),
  getMediaSources: () => fetchApi('/api/common/media-sources'),
  getSearchOptions: () => fetchApi('/api/common/search-options')
};

// 뉴스 API 호출 함수들
export const newsAPI = {
  // 뉴스 검색
  search: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchApi(`/api/search?${queryString}`);
  },
  
  // 최신 뉴스
  getLatest: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchApi(`/api/latest?${queryString}`);
  }
};

export default { commonAPI, newsAPI };