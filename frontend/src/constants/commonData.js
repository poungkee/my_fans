// 공통 카테고리 및 언론사 데이터
export const CATEGORIES = [
  '정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예'
];

export const MEDIA_SOURCES = [
  '연합뉴스', '동아일보', '문화일보', '세계일보', '조선일보',
  '중앙일보', '한겨레', '경향신문', '한국일보', '매일경제',
  '한국경제', '머니투데이', 'YTN', 'JTBC', '기타'
];

// 메인페이지 헤더에서 사용할 언론사 정보 (도메인 포함)
export const MEDIA_SOURCES_WITH_DOMAIN = [
  { name: '연합뉴스', domain: 'yna.co.kr' },
  { name: '동아일보', domain: 'donga.com' },
  { name: '문화일보', domain: 'munhwa.com' },
  { name: '세계일보', domain: 'segye.com' },
  { name: '조선일보', domain: 'chosun.com' },
  { name: '중앙일보', domain: 'joongang.co.kr' },
  { name: '한겨레', domain: 'hani.co.kr' },
  { name: '경향신문', domain: 'khan.co.kr' },
  { name: '한국일보', domain: 'hankookilbo.com' },
  { name: '매일경제', domain: 'mk.co.kr' },
  { name: '한국경제', domain: 'hankyung.com' },
  { name: '머니투데이', domain: 'mt.co.kr' },
  { name: 'YTN', domain: 'ytn.co.kr' },
  { name: 'JTBC', domain: 'jtbc.co.kr' },
  { name: '기타', domain: 'etc.com' }
];

// 메인페이지에서 사용할 카테고리 (전체 포함)
export const CATEGORIES_WITH_ALL = ['전체', ...CATEGORIES];

// 검색 옵션
export const SEARCH_OPTIONS = {
  sort: [
    { value: 'date', label: '최신순' },
    { value: 'sim', label: '정확도순' }
  ],
  pageSize: [10, 20, 30, 50]
};