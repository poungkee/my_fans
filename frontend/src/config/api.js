// API 기본 URL 설정
export const API_BASE_URL = process.env.REACT_APP_API_BASE ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.fans.ai.kr'
    : 'http://localhost:3000');
