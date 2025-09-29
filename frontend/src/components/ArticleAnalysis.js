import React, { useState, useEffect } from 'react';
import './ArticleAnalysis.css';

function ArticleAnalysis({ articleId, articleContent }) {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || '';

  // AI 분석 요청
  const requestAnalysis = async () => {
    if (!articleContent || articleContent.length < 50) {
      setError('분석할 내용이 너무 짧습니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // AI 서비스에 직접 분석 요청
      const response = await fetch(`${API_BASE}/api/ai/analyze/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: articleContent,
          article_id: articleId
        })
      });

      if (!response.ok) {
        // 대체 분석 API 시도
        const fallbackResponse = await fetch(`http://localhost:8002/analyze/full`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: articleContent,
            article_id: articleId
          })
        });

        if (!fallbackResponse.ok) {
          throw new Error('AI 분석 서비스를 사용할 수 없습니다');
        }

        const fallbackData = await fallbackResponse.json();
        setAnalysisData(fallbackData);
      } else {
        const data = await response.json();
        setAnalysisData(data);
      }
    } catch (err) {
      console.error('AI 분석 오류:', err);
      setError('AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 감성 라벨 한글 변환
  const getSentimentLabel = (sentiment) => {
    const labels = {
      'positive': '긍정적',
      'negative': '부정적',
      'neutral': '중립적'
    };
    return labels[sentiment] || sentiment;
  };

  // 감성에 따른 색상
  const getSentimentColor = (sentiment) => {
    const colors = {
      'positive': '#4caf50',
      'negative': '#f44336',
      'neutral': '#9e9e9e'
    };
    return colors[sentiment] || '#9e9e9e';
  };

  // 정치 성향 라벨
  const getStanceLabel = (stance) => {
    const labels = {
      '진보': { text: '진보', color: '#1976d2' },
      '보수': { text: '보수', color: '#d32f2f' },
      '중도': { text: '중도', color: '#757575' },
      '중립': { text: '중립', color: '#9e9e9e' }
    };
    return labels[stance] || { text: stance, color: '#9e9e9e' };
  };

  return (
    <div className="article-analysis">
      <div className="analysis-header">
        <h4>AI 기사 분석</h4>
        {!loading && !analysisData && (
          <button className="analyze-btn" onClick={requestAnalysis}>
            분석 시작
          </button>
        )}
      </div>

      {loading && (
        <div className="analysis-loading">
          <div className="loading-spinner"></div>
          <p>AI가 기사를 분석하고 있습니다...</p>
        </div>
      )}

      {error && (
        <div className="analysis-error">
          <p>{error}</p>
          <button className="retry-btn" onClick={requestAnalysis}>
            다시 시도
          </button>
        </div>
      )}

      {analysisData && !loading && (
        <div className="analysis-results">
          {/* 감성 분석 섹션 */}
          {analysisData.sentiment && (
            <div className="analysis-section">
              <h5>감성 분석</h5>
              <div className="sentiment-result">
                <div className="sentiment-main">
                  <span
                    className="sentiment-label"
                    style={{ backgroundColor: getSentimentColor(analysisData.sentiment.sentiment) }}
                  >
                    {getSentimentLabel(analysisData.sentiment.sentiment)}
                  </span>
                  <span className="confidence-score">
                    신뢰도: {Math.round((analysisData.sentiment.confidence || 0) * 100)}%
                  </span>
                </div>

                <div className="sentiment-details">
                  <div className="sentiment-bar">
                    <div className="bar-container">
                      <div className="bar-label">긍정</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill positive"
                          style={{ width: `${(analysisData.sentiment.positive_count || 0) * 10}%` }}
                        />
                      </div>
                      <span className="bar-value">{analysisData.sentiment.positive_count || 0}</span>
                    </div>
                    <div className="bar-container">
                      <div className="bar-label">부정</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill negative"
                          style={{ width: `${(analysisData.sentiment.negative_count || 0) * 10}%` }}
                        />
                      </div>
                      <span className="bar-value">{analysisData.sentiment.negative_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 키워드 분석 섹션 */}
          {analysisData.keywords && analysisData.keywords.length > 0 && (
            <div className="analysis-section">
              <h5>주요 키워드</h5>
              <div className="keywords-cloud">
                {analysisData.keywords.slice(0, 10).map((keyword, index) => {
                  const item = keyword.word ? keyword : { word: keyword[0], score: keyword[1] };
                  const size = Math.max(12, Math.min(24, 12 + (item.score || 0) * 20));
                  const opacity = Math.max(0.6, Math.min(1, 0.6 + (item.score || 0)));

                  return (
                    <span
                      key={index}
                      className="keyword-tag"
                      style={{
                        fontSize: `${size}px`,
                        opacity: opacity
                      }}
                    >
                      {item.word}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 정치적 분석 섹션 */}
          {analysisData.political && (
            <div className="analysis-section">
              <h5>정치적 분석</h5>
              <div className="political-result">
                <div className="bias-meter">
                  <div className="meter-labels">
                    <span>진보</span>
                    <span>중도</span>
                    <span>보수</span>
                  </div>
                  <div className="meter-track">
                    <div
                      className="meter-pointer"
                      style={{
                        left: `${((analysisData.political.bias_score + 10) / 20) * 100}%`
                      }}
                    />
                  </div>
                  <div className="meter-value">
                    편향성 점수: {analysisData.political.bias_score > 0 ? '+' : ''}
                    {analysisData.political.bias_score}
                  </div>
                </div>

                <div className="political-stance">
                  <span
                    className="stance-badge"
                    style={{
                      backgroundColor: getStanceLabel(analysisData.political.stance).color,
                      color: '#fff'
                    }}
                  >
                    {getStanceLabel(analysisData.political.stance).text}
                  </span>
                </div>

                {/* 정당별 언급 분석 */}
                {analysisData.political.party_analysis &&
                 Object.keys(analysisData.political.party_analysis).length > 0 && (
                  <div className="party-analysis">
                    <h6>정당별 언급 분석</h6>
                    <div className="party-grid">
                      {Object.entries(analysisData.political.party_analysis).map(([party, data]) => (
                        <div key={party} className="party-card">
                          <div className="party-name">{party}</div>
                          <div className="party-stats">
                            <span className="stat-item">언급: {data.count}회</span>
                            <span className="stat-item">
                              감성: {data.avg_score > 0 ? '+' : ''}{data.avg_score.toFixed(2)}
                            </span>
                          </div>
                          <div className="party-sentiment-bar">
                            <div className="mini-bar positive" style={{ width: `${(data.positive / data.count) * 100}%` }} />
                            <div className="mini-bar neutral" style={{ width: `${(data.neutral / data.count) * 100}%` }} />
                            <div className="mini-bar negative" style={{ width: `${(data.negative / data.count) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 분석 시간 */}
          {analysisData.processed_at && (
            <div className="analysis-footer">
              <small>분석 시간: {new Date(analysisData.processed_at).toLocaleString('ko-KR')}</small>
            </div>
          )}
        </div>
      )}

      {!loading && !analysisData && !error && (
        <div className="analysis-empty">
          <p>AI 분석을 시작하려면 '분석 시작' 버튼을 클릭하세요</p>
          <p className="analysis-description">
            기사의 감성, 키워드, 정치적 편향성 등을 분석합니다
          </p>
        </div>
      )}
    </div>
  );
}

export default ArticleAnalysis;