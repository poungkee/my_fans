import React, { useState, useEffect } from 'react';
import './SourceBiasChart.css';

function SourceBiasChart({ sourceName, articleSource }) {
  const [biasData, setBiasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || '';
  const source = sourceName || articleSource;

  useEffect(() => {
    if (!source) {
      setLoading(false);
      return;
    }

    const fetchBiasData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/ai/bias/source/${encodeURIComponent(source)}`);

        if (!response.ok) {
          throw new Error('데이터를 불러올 수 없습니다');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setBiasData(result.data);
        } else {
          setError('분석 데이터가 없습니다');
        }
      } catch (err) {
        console.error('편향성 데이터 로드 실패:', err);
        setError('데이터를 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchBiasData();
  }, [source, API_BASE]);

  if (loading) {
    return <div className="bias-chart-loading">분석 데이터 로딩 중...</div>;
  }

  if (error) {
    return <div className="bias-chart-error">{error}</div>;
  }

  if (!biasData || biasData.message) {
    return (
      <div className="bias-chart-empty">
        <p>{biasData?.message || '최근 30일간 분석된 기사가 없습니다'}</p>
      </div>
    );
  }

  // 편향성 점수를 시각적 위치로 변환 (-10 ~ +10 -> 0% ~ 100%)
  const getPositionPercentage = (value) => {
    return ((value + 10) / 20) * 100;
  };

  // 편향성 점수에 따른 색상
  const getColorByBias = (value) => {
    if (value < -3) return '#1976d2'; // 진보 - 파란색
    if (value > 3) return '#d32f2f'; // 보수 - 빨간색
    return '#757575'; // 중도 - 회색
  };

  // 일관성 점수에 따른 색상
  const getConsistencyColor = (value) => {
    if (value >= 80) return '#4caf50'; // 높음 - 초록색
    if (value >= 60) return '#ff9800'; // 중간 - 주황색
    return '#f44336'; // 낮음 - 빨간색
  };

  return (
    <div className="source-bias-chart">
      <div className="bias-header">
        <h3>{biasData.sourceName} 편향성 분석</h3>
        <span className="analysis-period">{biasData.period} 기준 ({biasData.articleCount}개 기사)</span>
      </div>

      {/* 종합 편향성 스코어 카드 */}
      <div className="overall-score-card">
        <div className="score-main">
          <div className="score-value" style={{ color: getColorByBias(biasData.biasScore) }}>
            {biasData.biasScore > 0 ? '+' : ''}{biasData.biasScore}
          </div>
          <div className="score-label">편향성 점수</div>
        </div>
        <div className="score-stance">
          <span className={`stance-badge stance-${biasData.stance}`}>
            {biasData.stance}
          </span>
        </div>
      </div>

      {/* 편향성 척도 시각화 */}
      <div className="bias-scales">
        <div className="scale-item">
          <div className="scale-header">
            <span className="scale-title">정치적 편향성</span>
            <span className="scale-value">{biasData.biasScore > 0 ? '+' : ''}{biasData.biasScore}</span>
          </div>
          <div className="scale-bar">
            <div className="scale-track">
              <div className="scale-labels">
                <span>진보</span>
                <span>중도</span>
                <span>보수</span>
              </div>
              <div className="scale-line">
                <div className="scale-center-mark"></div>
                <div
                  className="scale-indicator"
                  style={{
                    left: `${getPositionPercentage(biasData.biasScore)}%`,
                    backgroundColor: getColorByBias(biasData.biasScore)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 일관성 및 신뢰도 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">보도 일관성</div>
          <div className="stat-value-container">
            <div
              className="stat-value"
              style={{ color: getConsistencyColor(biasData.consistency) }}
            >
              {biasData.consistency}%
            </div>
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{
                  width: `${biasData.consistency}%`,
                  backgroundColor: getConsistencyColor(biasData.consistency)
                }}
              />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">분석 신뢰도</div>
          <div className="stat-value-container">
            <div className="stat-value">
              {Math.round(biasData.avgConfidence * 100)}%
            </div>
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{
                  width: `${biasData.avgConfidence * 100}%`,
                  backgroundColor: '#4caf50'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 표준편차 정보 (접을 수 있는 상세정보) */}
      <details className="advanced-stats">
        <summary>상세 통계 정보</summary>
        <div className="stats-table">
          <table>
            <thead>
              <tr>
                <th>항목</th>
                <th>값</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>평균 편향성 점수</td>
                <td>{biasData.biasScore}</td>
              </tr>
              <tr>
                <td>표준편차</td>
                <td>{biasData.standardDeviation}</td>
              </tr>
              <tr>
                <td>범위</td>
                <td>{biasData.range ? `${biasData.range.min} ~ ${biasData.range.max}` : 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <div className="bias-footer">
        <p className="disclaimer">
          * 편향성 점수는 -10(진보) ~ +10(보수) 척도로 측정됩니다<br/>
          * AI 분석 결과이며 참고용으로만 활용하시기 바랍니다
        </p>
      </div>
    </div>
  );
}

export default SourceBiasChart;