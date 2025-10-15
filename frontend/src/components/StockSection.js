import React, { useEffect, useState } from "react";
import "./StockSection.css";

const StockSection = ({ stockData }) => {
  const [displayData, setDisplayData] = useState([]);

  // props 변경 시 로그 및 상태 업데이트
  useEffect(() => {
    console.log('[StockSection] Props 변경됨, stockData:', stockData);
    if (stockData && stockData.length > 0) {
      setDisplayData(stockData);
    }
  }, [stockData]);

  // 한글 이름 매핑
  const getKoreanName = (item) => {
    const nameMap = {
      'KOSPI': '코스피',
      'NASDAQ': '나스닥',
      'USD/KRW': '달러',
      'EUR/KRW': '유로',
      'JPY/KRW': '엔화',
      'CNY/KRW': '위안',
      'Bitcoin': '비트코인',
      'Ethereum': '이더리움',
      'Dogecoin': '도지코인',
      'Tesla': '테슬라',
      'Apple': '애플',
      'Microsoft': '마이크로소프트',
      '삼성전자': '삼성전자',
      'SK하이닉스': 'SK하이닉스',
      'NAVER': '네이버'
    };
    return nameMap[item.name] || item.name;
  };

  // 단위 표시
  const getUnit = (item) => {
    if (item.marketType === 'INDEX') {
      return ''; // 지수는 단위 없음
    } else if (item.marketType === 'FX') {
      return '원';
    } else if (item.marketType === 'CRYPTO') {
      return '달러';
    } else if (item.marketType === 'US_STOCK') {
      return '달러';
    } else if (item.marketType === 'KR_STOCK') {
      return '원';
    }
    return '';
  };

  const formatPrice = (item) => {
    const value = item.currentValue;
    if (!value || value === 0) return '0.00';

    // 코인은 소수점 2자리, 나머지는 정수 또는 소수점 2자리
    if (item.marketType === 'CRYPTO' && value < 1) {
      return value.toLocaleString('ko-KR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else if (item.marketType === 'INDEX' || item.marketType === 'KR_STOCK') {
      return value.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } else {
      return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  const formatChange = (item) => {
    const change = item.changeValue || 0;
    const changePercent = item.changePercent || 0;
    const sign = change >= 0 ? '+' : '';

    // 변동폭 표시 (소수점 2자리)
    const changeStr = `${sign}${change.toFixed(2)}`;
    // 변동률 표시
    const percentStr = `${sign}${changePercent.toFixed(2)}%`;

    return `${changeStr} ${percentStr}`;
  };

  const getIsPositive = (item) => {
    const change = item.changeValue || 0;
    if (change > 0) return true;
    if (change < 0) return false;
    return null;
  };

  // 데이터가 없으면 로딩 메시지
  if (!displayData || displayData.length === 0) {
    return (
      <div className="stock-ticker-container">
        <div className="stock-ticker-header">
          <span className="stock-ticker-title">오늘의 증시현황</span>
          <span className="stock-ticker-time">데이터 로딩 중...</span>
        </div>
        <div className="stock-ticker-wrapper">
          <div className="stock-ticker-loading">시장 데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-ticker-container">
      <div className="stock-ticker-header">
        <span className="stock-ticker-title">오늘의 증시현황</span>
        <span className="stock-ticker-time">
          {new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
      <div className="stock-ticker-wrapper">
        <div className="stock-ticker-track">
          {/* 첫 번째 세트 */}
          {displayData.map((item, index) => {
            const isPositive = getIsPositive(item);
            const koreanName = getKoreanName(item);
            const unit = getUnit(item);
            return (
              <div key={`set1-${index}`} className="stock-ticker-item">
                <span className="stock-name">{koreanName}</span>
                <span className="stock-price">
                  {formatPrice(item)} {unit}
                </span>
                <span className={`stock-change ${
                  isPositive === true ? 'positive' :
                  isPositive === false ? 'negative' : 'neutral'
                }`}>
                  {item.changeValue !== 0 ? formatChange(item) : '-'}
                </span>
              </div>
            );
          })}
          {/* 두 번째 세트 (자연스러운 연속성을 위해) */}
          {displayData.map((item, index) => {
            const isPositive = getIsPositive(item);
            const koreanName = getKoreanName(item);
            const unit = getUnit(item);
            return (
              <div key={`set2-${index}`} className="stock-ticker-item">
                <span className="stock-name">{koreanName}</span>
                <span className="stock-price">
                  {formatPrice(item)} {unit}
                </span>
                <span className={`stock-change ${
                  isPositive === true ? 'positive' :
                  isPositive === false ? 'negative' : 'neutral'
                }`}>
                  {item.changeValue !== 0 ? formatChange(item) : '-'}
                </span>
              </div>
            );
          })}
          {/* 세 번째 세트 (더 매끄러운 연속성을 위해) */}
          {displayData.map((item, index) => {
            const isPositive = getIsPositive(item);
            const koreanName = getKoreanName(item);
            const unit = getUnit(item);
            return (
              <div key={`set3-${index}`} className="stock-ticker-item">
                <span className="stock-name">{koreanName}</span>
                <span className="stock-price">
                  {formatPrice(item)} {unit}
                </span>
                <span className={`stock-change ${
                  isPositive === true ? 'positive' :
                  isPositive === false ? 'negative' : 'neutral'
                }`}>
                  {item.changeValue !== 0 ? formatChange(item) : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StockSection;
