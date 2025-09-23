import React, { useState } from 'react';
import { useMediaSources } from '../hooks/useCommonData';

const AgencySection = ({ selectedAgency, onAgencySelect }) => {
  const { mediaSources, loading, error } = useMediaSources();
  const [activeAgency, setActiveAgency] = useState(mediaSources[0]?.name || '연합뉴스');
  const [selectedLogo, setSelectedLogo] = useState(null);

  // 기존 하드코딩된 데이터는 백업용으로 유지
  const fallbackAgencies = [
    '연합뉴스', '조선일보', '중앙일보', '동아일보',
    '한겨레', '경향신문', '한국경제', '전자신문'
  ];

  const agencies = mediaSources.length > 0 ? mediaSources.map(source => source.name) : fallbackAgencies;

  const agencyDescriptions = {
    '연합뉴스': '연합뉴스는 1980년 설립된 대한민국의 대표적인 통신사입니다.\n\n정치, 경제, 사회, 문화 등 전 분야의 뉴스를 빠르고 정확하게 전달하며, 국내외 주요 언론사에 뉴스를 공급하고 있습니다.',
    '조선일보': '조선일보는 1920년 창간된 대한민국의 대표적인 종합일간지입니다.\n\n보수적 성향의 신문으로 정치, 경제, 사회 전반에 걸친 심층 보도와 분석을 제공합니다.',
    '중앙일보': '중앙일보는 1965년 창간된 대한민국의 주요 종합일간지입니다.\n\n중도적 성향으로 균형 잡힌 시각의 뉴스와 깊이 있는 분석을 제공합니다.',
    '동아일보': '동아일보는 1920년 창간된 대한민국의 대표적인 종합일간지입니다.\n\n진보적 성향의 신문으로 사회적 이슈와 정책에 대한 다양한 관점을 제시합니다.',
    '한겨레': '한겨레는 1988년 창간된 대한민국의 진보적 성향 종합일간지입니다.\n\n인권, 민주주의, 평화를 중시하는 보도로 독자들의 사랑을 받고 있습니다.',
    '경향신문': '경향신문은 1946년 창간된 대한민국의 종합일간지입니다.\n\n진보적 성향으로 사회적 약자와 소수자의 목소리에 극 기울이는 보도를 합니다.',
    '한국경제': '한국경제는 1964년 창간된 대한민국의 대표적인 경제 전문지입니다.\n\n경제, 금융, 기업 뉴스에 특화된 전문적인 보도를 제공합니다.',
    '전자신문': '전자신문은 1999년 창간된 대한민국의 IT 전문지입니다.\n\n정보통신 기술과 디지털 산업에 특화된 전문 뉴스를 제공합니다.'
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

      const response = await fetch('/api/user/subscribe', {
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
        <div className="agency-list-title">언론사 목록</div>
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
      
      <div className="agency-info">
        <div className="agency-logo-area">
          {selectedLogo ? (
            <img
              src={selectedLogo}
              alt={`${activeAgency} 로고`}
              className="agency-logo-image-full"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : (
            <div className="logo-placeholder">
              <h4>언론사별 로고</h4>
              <p>언론사를 선택하면 로고가 표시됩니다</p>
            </div>
          )}
          <div className="logo-fallback" style={{display: 'none'}}>
            로고를 불러올 수 없습니다
          </div>
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
