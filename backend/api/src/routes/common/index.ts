import { Router } from 'express';

const router = Router();

// 뉴스 카테고리 목록
const NEWS_CATEGORIES = [
  '정치',
  '경제', 
  '사회',
  '생활/문화',
  'IT/과학',
  '세계',
  '스포츠',
  '연예'
];

// 언론사 목록
const MEDIA_SOURCES = [
  { name: '조선일보', domain: 'chosun.com', oid: '023' },
  { name: 'KBS', domain: 'kbs.co.kr', oid: '056' },
  { name: 'SBS', domain: 'sbs.co.kr', oid: '055' },
  { name: 'MBC', domain: 'mbc.co.kr', oid: '214' },
  { name: '한겨레', domain: 'hani.co.kr', oid: '028' },
  { name: '중앙일보', domain: 'joongang.co.kr', oid: '025' },
  { name: '동아일보', domain: 'donga.com', oid: '020' },
  { name: '경향신문', domain: 'khan.co.kr', oid: '032' },
  { name: '연합뉴스', domain: 'yna.co.kr', oid: '001' },
  { name: 'YTN', domain: 'ytn.co.kr', oid: '052' }
];

// 검색 정렬 옵션
const SEARCH_OPTIONS = [
  { value: 'date', label: '최신순' },
  { value: 'sim', label: '정확도순' },
  { value: 'relevance', label: '관련도순' }
];

// 카테고리 목록 API
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: NEWS_CATEGORIES,
    timestamp: new Date().toISOString()
  });
});

// 언론사 목록 API
router.get('/media-sources', (req, res) => {
  res.json({
    success: true,
    data: MEDIA_SOURCES,
    timestamp: new Date().toISOString()
  });
});

// 검색 옵션 API
router.get('/search-options', (req, res) => {
  res.json({
    success: true,
    data: {
      sort: SEARCH_OPTIONS,
      pageSize: [10, 20, 30, 50, 100]
    },
    timestamp: new Date().toISOString()
  });
});

// 모든 공통 데이터 한번에 가져오기
router.get('/all', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: NEWS_CATEGORIES,
      mediaSources: MEDIA_SOURCES,
      searchOptions: {
        sort: SEARCH_OPTIONS,
        pageSize: [10, 20, 30, 50, 100]
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;