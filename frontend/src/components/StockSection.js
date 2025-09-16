import React from 'react';

const StockSection = ({ stockData }) => {
  return (
    <div className="stock-api-section">
      <div className="stock-api-title">주식 API (코스피/나스닥/환율/주식)</div>
      <div className="stock-data">
        {stockData.map((stock, index) => (
          <div key={index} className="stock-item">
            <div className="stock-label">{stock.label}</div>
            <div className="stock-value">{stock.value}</div>
            <div className={`stock-change ${stock.type}`}>{stock.change}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockSection;
