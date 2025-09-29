-- market_summary 테이블 생성
CREATE TABLE IF NOT EXISTS market_summary (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(20, 2) NOT NULL,
    change DECIMAL(20, 2) DEFAULT 0,
    change_percent DECIMAL(10, 2) DEFAULT 0,
    market VARCHAR(50),
    currency VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 초기 데이터 삽입
INSERT INTO market_summary (symbol, name, price, market, currency)
VALUES
    ('^KS11', 'KOSPI', 2600.00, 'KOSPI', 'KRW'),
    ('^IXIC', 'NASDAQ', 15000.00, 'NASDAQ', 'USD'),
    ('USD/KRW', 'USD/KRW', 1350.00, 'FX', 'KRW'),
    ('BTC-USD', 'Bitcoin (USD)', 65000.00, 'CRYPTO', 'USD')
ON CONFLICT (symbol) DO NOTHING;