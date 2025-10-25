import React, { useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { useMediaSources } from '../hooks/useCommonData';
import './AgencySection.css';

const AgencySection = ({ selectedAgency, onAgencySelect }) => {
  const { mediaSources, loading, error } = useMediaSources();
  const [activeAgency, setActiveAgency] = useState(mediaSources[0]?.name || '연합뉴스');
  const [selectedLogo, setSelectedLogo] = useState(null);

  // 카테고리별 언론사 목록 (주요 14개 언론사만 표시)
  const fallbackAgencies = {
    '종합일간지': ['연합뉴스', '조선일보', '중앙일보', '동아일보', '한겨레', '경향신문', '한국일보', '문화일보', '세계일보'],
    '방송사': ['YTN', 'JTBC'],
    '경제전문': ['한국경제', '매일경제', '머니투데이']
  };

  // 카테고리별로 구조화된 언론사 데이터 생성
  const getStructuredAgencies = () => {
    if (mediaSources.length > 0) {
      // API에서 데이터를 받은 경우
      return {
        '전체': mediaSources.map(source => source.name)
      };
    } else {
      // fallback 데이터 사용
      return fallbackAgencies;
    }
  };

  const structuredAgencies = getStructuredAgencies();

  const agencyDescriptions = {
    // 종합일간지
    '연합뉴스': '연합뉴스는 1980년 설립된 대한민국의 대표적인 통신사입니다.\n\n정치, 경제, 사회, 문화 등 전 분야의 뉴스를 빠르고 정확하게 전달하며, 국내외 주요 언론사에 뉴스를 공급하고 있습니다.',
    '조선일보': '조선일보는 1920년 창간된 대한민국의 대표적인 종합일간지입니다.\n\n보수적 성향의 신문으로 정치, 경제, 사회 전반에 걸친 심층 보도와 분석을 제공합니다.',
    '중앙일보': '중앙일보는 1965년 창간된 대한민국의 주요 종합일간지입니다.\n\n중도적 성향으로 균형 잡힌 시각의 뉴스와 깊이 있는 분석을 제공합니다.',
    '동아일보': '동아일보는 1920년 창간된 대한민국의 대표적인 종합일간지입니다.\n\n진보적 성향의 신문으로 사회적 이슈와 정책에 대한 다양한 관점을 제시합니다.',
    '한겨레': '한겨레는 1988년 창간된 대한민국의 진보적 성향 종합일간지입니다.\n\n인권, 민주주의, 평화를 중시하는 보도로 독자들의 사랑을 받고 있습니다.',
    '경향신문': '경향신문은 1946년 창간된 대한민국의 종합일간지입니다.\n\n진보적 성향으로 사회적 약자와 소수자의 목소리에 귀 기울이는 보도를 합니다.',

    // 방송사
    'KBS': 'KBS는 1927년 설립된 대한민국의 공영방송입니다.\n\n공정하고 균형 잡힌 뉴스로 국민의 알 권리를 보장하며, 다양한 프로그램을 제공합니다.',
    'MBC': 'MBC는 1961년 설립된 대한민국의 공영방송입니다.\n\n시사교양부터 오락까지 다양한 장르의 프로그램과 신속한 뉴스를 제공합니다.',
    'SBS': 'SBS는 1991년 설립된 대한민국 최초의 상업방송입니다.\n\n경쟁력 있는 프로그램과 신속한 뉴스 서비스로 시청자들의 사랑을 받고 있습니다.',
    'YTN': 'YTN은 1993년 설립된 대한민국 최초의 24시간 뉴스 전문 채널입니다.\n\n실시간 뉴스와 심층 분석으로 정확한 정보를 전달합니다.',
    'JTBC': 'JTBC는 2011년 개국한 종합편성채널입니다.\n\n탐사보도와 시사 프로그램으로 언론의 사회적 책임을 다하고 있습니다.',
    '채널A': '채널A는 2011년 개국한 종합편성채널입니다.\n\n정치, 경제, 사회 전반의 이슈를 다루며 다양한 시각의 뉴스를 제공합니다.',

    // 경제전문
    '한국경제': '한국경제는 1964년 창간된 대한민국의 대표적인 경제 전문지입니다.\n\n경제, 금융, 기업 뉴스에 특화된 전문적인 보도를 제공합니다.',
    '매일경제': '매일경제는 1966년 창간된 경제 전문지입니다.\n\n주식, 부동산, 기업 정보 등 실용적인 경제 뉴스를 제공합니다.',
    '서울경제': '서울경제는 1960년 창간된 경제 전문지입니다.\n\n중소기업과 서민 경제에 관심을 가지며 실생활과 밀접한 경제 뉴스를 다룹니다.',
    '헤럴드경제': '헤럴드경제는 1953년 창간된 경제 전문지입니다.\n\n국제 경제와 글로벌 트렌드에 특화된 뉴스를 제공합니다.',
    '아시아경제': '아시아경제는 2002년 창간된 인터넷 경제 전문지입니다.\n\n빠른 경제 뉴스와 투자 정보를 온라인으로 제공합니다.',

    // IT/과학
    '전자신문': '전자신문은 1999년 창간된 대한민국의 IT 전문지입니다.\n\n정보통신 기술과 디지털 산업에 특화된 전문 뉴스를 제공합니다.',
    'ZDNet Korea': 'ZDNet Korea는 글로벌 IT 전문 미디어입니다.\n\n최신 기술 트렌드와 IT 업계 동향을 신속하게 전달합니다.',
    '디지털타임스': '디지털타임스는 IT와 디지털 분야 전문 언론사입니다.\n\n4차 산업혁명 시대의 기술 혁신과 디지털 전환을 다룹니다.',
    '블로터': '블로터는 IT와 스타트업 전문 미디어입니다.\n\n혁신 기업과 기술 트렌드를 깊이 있게 분석합니다.',
    'AI타임스': 'AI타임스는 인공지능 전문 미디어입니다.\n\nAI 기술과 산업 동향을 전문적으로 다루며 미래 기술을 조망합니다.'
  };

  const recentNews = {
    '연합뉴스': '최근 주요 정치 동향과 경제 지표 발표, 사회 이슈 등에 대한 심층 보도를 진행하고 있습니다.',
    '조선일보': '국정 운영과 정책 방향에 대한 분석 기사와 경제 동향을 집중 보도하고 있습니다.',
    '중앙일보': '균형 잡힌 시각으로 사회 전반의 이슈를 다루며, 깊이 있는 분석을 제공하고 있습니다.',
    '동아일보': '사회적 약자와 소수자 관점에서 다양한 이슈를 다루는 보도를 진행하고 있습니다.',
    '한겨레': '인권과 민주주의 관련 이슈를 중심으로 사회적 가치를 중시하는 보도를 하고 있습니다.',
    '경향신문': '사회적 약자와 소수자의 목소리에 귀 기울이는 보도와 분석을 제공하고 있습니다.',
    '한국경제': '경제 지표, 기업 실적, 금융 시장 동향 등 경제 전문 뉴스를 집중 보도하고 있습니다.',
    '전자신문': 'IT 업계 동향, 스타트업 소식, 기술 혁신 등 IT 전문 뉴스를 제공하고 있습니다.'
  };

  const handleAgencyClick = (agency) => {
    try {
      setActiveAgency(agency);
      if (onAgencySelect) {
        onAgencySelect(agency);
      }

      // 해당 언론사의 로고 URL 찾기
      const selectedSource = mediaSources.find(source => source.name === agency);
      if (selectedSource && selectedSource.logo_url) {
        setSelectedLogo(selectedSource.logo_url);
      } else {
        setSelectedLogo(null);
      }
    } catch (error) {
      console.warn('Agency selection error:', error);
      // 에러가 발생해도 기본 동작은 계속 수행
      setActiveAgency(agency);
      setSelectedLogo(null);
    }
  };

  const handleSubscribe = async () => {
    try {
      if (!confirm(`${activeAgency}을(를) 구독하시겠습니까?`)) {
        return;
      }

      // localStorage와 sessionStorage 모두 확인
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/user/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceName: activeAgency
        })
      });

      const data = await response.json();

      if (data.ok) {
        alert(data.message || `${activeAgency} 구독이 완료되었습니다!`);
      } else {
        alert(data.error || '구독에 실패했습니다.');
      }
    } catch (error) {
      console.error('구독 요청 실패:', error);
      alert('구독 요청 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="agency-section">
      <div className="agency-list">
        <div className="agency-list-title">📰 언론사 목록</div>
        {Object.entries(structuredAgencies).map(([category, agencies]) => (
          <div key={category} className="agency-category">
            <div className="agency-category-title">{category}</div>
            <div className="agency-category-items">
              {agencies.map(agency => (
                <div
                  key={agency}
                  className={`agency-list-item ${activeAgency === agency ? 'active' : ''}`}
                  onClick={() => handleAgencyClick(agency)}
                >
                  {agency}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="agency-info">
        <div className="agency-logo-area">
          {selectedLogo ? (
            <>
              <img
                src={selectedLogo}
                alt={`${activeAgency} 로고`}
                className="agency-logo-image-full"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = e.target.parentElement.querySelector('.logo-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
                onLoad={(e) => {
                  // 로고가 성공적으로 로드되면 fallback 숨김
                  const fallback = e.target.parentElement.querySelector('.logo-fallback');
                  if (fallback) fallback.style.display = 'none';
                }}
              />
              <div className="logo-fallback" style={{display: 'none'}}>
                <div className="fallback-content">
                  <div className="fallback-icon">📰</div>
                  <span>{activeAgency}</span>
                  <small>로고를 불러올 수 없습니다</small>
                </div>
              </div>
            </>
          ) : (
            <div className="logo-placeholder">
              <div className="placeholder-icon">🏢</div>
              <h4>{activeAgency}</h4>
              <p>선택된 언론사</p>
            </div>
          )}
        </div>
        <div className="agency-details">
          <div className="agency-info-box">
            <div className="agency-info-title">언론사 정보</div>
            <div className="agency-info-content">
              {agencyDescriptions[activeAgency] || agencyDescriptions['연합뉴스']}
            </div>
          </div>
          <div className="agency-info-box">
            <div className="agency-info-title">최근 보도</div>
            <div className="agency-info-content">
              {recentNews[activeAgency] || recentNews['연합뉴스']}
            </div>
          </div>
          <div className="agency-info-box">
            <div className="agency-info-title">구독 혜택</div>
            <div className="agency-info-content">
              구독 시 실시간 뉴스 알림, 특별 기사, 분석 리포트 등 다양한 혜택을 제공합니다.
            </div>
          </div>
          <button className="subscribe-btn" onClick={handleSubscribe}>
            구독
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgencySection;
