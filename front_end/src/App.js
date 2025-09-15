import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StockSection from './components/StockSection';
import NewsGrid from './components/NewsGrid';
import Sidebar from './components/Sidebar';
import AgencySection from './components/AgencySection';
import Footer from './components/Footer';

function App() {
  const [selectedSort, setSelectedSort] = useState('최신순');
  const [selectedAgency, setSelectedAgency] = useState('연합뉴스');
  const [searchQuery, setSearchQuery] = useState('');
  const [newsData, setNewsData] = useState([
    {
      id: 1,
      title: '주요 뉴스 제목이 여기에 표시됩니다',
      summary: '뉴스 요약 내용이 여기에 표시되며, 사용자가 빠르게 내용을 파악할 수 있도록 도와줍니다.',
      source: '연합뉴스',
      time: '2시간 전',
      views: '조회 1,234',
      category: '정치',
      agency: '연합뉴스',
      timeValue: 2
    },
    {
      id: 2,
      title: '경제 관련 주요 소식을 전해드립니다',
      summary: '경제 동향과 관련된 최신 소식을 빠르게 확인하실 수 있습니다.',
      source: '한국경제',
      time: '4시간 전',
      views: '조회 2,567',
      category: '경제',
      agency: '한국경제',
      timeValue: 4
    },
    {
      id: 3,
      title: '스포츠 소식을 전해드립니다',
      summary: '오늘의 스포츠 경기 결과와 주요 스포츠 뉴스를 확인하세요.',
      source: '스포츠조선',
      time: '6시간 전',
      views: '조회 3,891',
      category: '스포츠',
      agency: '스포츠조선',
      timeValue: 6
    },
    {
      id: 4,
      title: 'IT 기술 동향 및 최신 소식',
      summary: '최신 기술 트렌드와 IT 업계의 주요 소식들을 모아서 전해드립니다.',
      source: '전자신문',
      time: '8시간 전',
      views: '조회 1,567',
      category: 'IT/과학',
      agency: '전자신문',
      timeValue: 8
    },
    {
      id: 5,
      title: '문화 예술 관련 소식',
      summary: '문화계와 예술계의 다양한 소식과 이벤트 정보를 제공합니다.',
      source: '문화일보',
      time: '10시간 전',
      views: '조회 892',
      category: '생활/문화',
      agency: '문화일보',
      timeValue: 10
    },
    {
      id: 6,
      title: '사회 이슈 및 시사 뉴스',
      summary: '사회 전반의 주요 이슈와 시사 상식을 다루는 뉴스입니다.',
      source: '조선일보',
      time: '12시간 전',
      views: '조회 4,123',
      category: '사회',
      agency: '조선일보',
      timeValue: 12
    },
    {
      id: 7,
      title: '정치 동향 및 국정 현황',
      summary: '국정 운영과 정치계의 주요 동향을 분석하고 전해드립니다.',
      source: '중앙일보',
      time: '14시간 전',
      views: '조회 2,876',
      category: '정치',
      agency: '중앙일보',
      timeValue: 14
    },
    {
      id: 8,
      title: '과학 기술의 새로운 발견',
      summary: '최신 과학 연구 성과와 기술 혁신 소식을 전해드립니다.',
      source: '동아일보',
      time: '16시간 전',
      views: '조회 1,543',
      category: '과학',
      agency: '동아일보',
      timeValue: 16
    },
    {
      id: 9,
      title: 'IT 업계 동향 및 스타트업 소식',
      summary: 'IT 업계의 최신 트렌드와 스타트업들의 성장 스토리를 소개합니다.',
      source: '경향신문',
      time: '18시간 전',
      views: '조회 3,267',
      category: 'IT',
      agency: '경향신문',
      timeValue: 18
    },
    {
      id: 10,
      title: '금융 시장 동향 및 투자 전망',
      summary: '주식, 채권, 외환 시장의 최신 동향과 투자 전망을 분석합니다.',
      source: '매일경제',
      time: '20시간 전',
      views: '조회 2,145',
      category: '경제',
      agency: '매일경제',
      timeValue: 20
    },
    {
      id: 11,
      title: '프로야구 경기 결과 및 선수 소식',
      summary: 'KBO 리그 경기 결과와 주요 선수들의 활약상을 전해드립니다.',
      source: '스포츠동아',
      time: '22시간 전',
      views: '조회 4,678',
      category: '스포츠',
      agency: '스포츠동아',
      timeValue: 22
    },
    {
      id: 12,
      title: '문화 예술 행사 및 전시회 소식',
      summary: '다양한 문화 예술 행사와 전시회 정보를 제공합니다.',
      source: '헤럴드경제',
      time: '24시간 전',
      views: '조회 1,892',
      category: '생활/문화',
      agency: '헤럴드경제',
      timeValue: 24
    }
  ]);

  const [stockData, setStockData] = useState([
    { label: '코스피', value: '2,456.78', change: '+12.34 (+0.50%)', type: 'positive' },
    { label: '나스닥', value: '14,567.89', change: '-23.45 (-0.16%)', type: 'negative' },
    { label: '환율 (USD/KRW)', value: '1,234.56', change: '+5.67 (+0.46%)', type: 'positive' },
    { label: '비트코인', value: '$43,567.89', change: '+1,234.56 (+2.92%)', type: 'positive' }
  ]);

  // 주식 데이터 업데이트 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      setStockData(prevData => 
        prevData.map(item => {
          const currentValue = parseFloat(item.value.replace(/[^0-9.-]/g, ''));
          const change = (Math.random() - 0.5) * 10;
          const newValue = (currentValue + change).toFixed(2);
          return {
            ...item,
            value: item.value.replace(/[0-9.-]+/, newValue)
          };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSortChange = (sortType, displayText) => {
    setSelectedSort(displayText);
    // 정렬 로직 구현
    const sortedNews = [...newsData].sort((a, b) => {
      switch(sortType) {
        case 'latest':
          return a.timeValue - b.timeValue;
        case 'popular':
          return Math.random() - 0.5;
        case 'relevant':
          return Math.random() - 0.5;
        case 'trending':
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });
    setNewsData(sortedNews);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleAgencyFilter = (agency) => {
    const filteredNews = newsData.filter(news => news.agency === agency);
    setNewsData(filteredNews);
  };

  const handleCategoryFilter = (category) => {
    const filteredNews = newsData.filter(news => news.category === category);
    setNewsData(filteredNews);
  };

  const handleAgencySelect = (agency) => {
    setSelectedAgency(agency);
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
