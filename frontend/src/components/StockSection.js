import React from "react";

const StockSection = ({ stockData }) => {
  return (
    <div className="stock-api-section" style={{ margin: "20px 0" }}>
      <div className="stock-api-title" style={{ fontWeight: "bold", marginBottom: "10px" }}>
        주식 API (코스피/나스닥/환율/비트코인)
      </div>
      <div className="stock-data" style={{ display: "flex", gap: "20px" }}>
        {stockData && stockData.length > 0 ? (
          stockData.map((stock, index) => (
            <div key={index} className="stock-item" style={{ minWidth: "150px" }}>
              <div className="stock-label">{stock.name}</div>
              <div className="stock-value">
                {stock.price !== null ? stock.price.toLocaleString() : "-"}
              </div>
              <div
                className={`stock-change ${
                  stock.change > 0 ? "positive" : stock.change < 0 ? "negative" : ""
                }`}
              >
                {stock.changePercent !== null && stock.change !== null && !isNaN(stock.change)
                  ? `${Number(stock.change).toFixed(2)} (${Number(stock.changePercent).toFixed(2)}%)`
                  : "-"}
              </div>
            </div>
          ))
        ) : (
          <div>📉 데이터 없음</div>
        )}
      </div>
    </div>
  );
};

export default StockSection;
