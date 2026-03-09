CREATE TABLE universes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_universes_category_active ON universes(category, is_active);

CREATE TABLE universe_constituents (
    id BIGSERIAL PRIMARY KEY,
    universe_id BIGINT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
    symbol VARCHAR(32) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_universe_constituents_universe_symbol UNIQUE (universe_id, symbol)
);

CREATE INDEX idx_universe_constituents_universe_order ON universe_constituents(universe_id, sort_order);
CREATE INDEX idx_universe_constituents_symbol ON universe_constituents(symbol);

INSERT INTO universes (code, name, category, description)
VALUES
    ('strategy_core_equities', '전략 기본 주식 유니버스', 'STRATEGY', '퀀트 전략 기본 주식 유니버스'),
    ('etf_universe', 'ETF 유니버스', 'ETF', '자산 배분 및 ETF 전략 유니버스'),
    ('benchmark_default', '기본 벤치마크 유니버스', 'BENCHMARK', '기본 지수 및 벤치마크 유니버스');

INSERT INTO universe_constituents (universe_id, symbol, sort_order)
SELECT u.id, v.symbol, v.sort_order
FROM universes u
JOIN (
    VALUES
        ('AAPL', 1), ('MSFT', 2), ('NVDA', 3), ('AMZN', 4), ('GOOGL', 5), ('META', 6), ('TSLA', 7), ('AVGO', 8), ('AMD', 9), ('TSM', 10),
        ('NFLX', 11), ('COST', 12), ('JPM', 13), ('V', 14), ('MA', 15), ('XOM', 16), ('JNJ', 17), ('PG', 18), ('WMT', 19), ('HD', 20),
        ('ORCL', 21), ('CRM', 22), ('ADBE', 23), ('QCOM', 24), ('ASML', 25), ('PLTR', 26), ('MU', 27), ('INTC', 28), ('CSCO', 29), ('IBM', 30),
        ('TXN', 31), ('AMAT', 32), ('LRCX', 33), ('KLAC', 34), ('NOW', 35), ('PANW', 36), ('SNOW', 37), ('SHOP', 38), ('UBER', 39), ('ABNB', 40),
        ('LLY', 41), ('MRK', 42), ('ABBV', 43), ('PFE', 44), ('TMO', 45), ('DHR', 46), ('ISRG', 47), ('UNH', 48), ('CVS', 49), ('ABT', 50),
        ('BAC', 51), ('WFC', 52), ('GS', 53), ('MS', 54), ('BLK', 55), ('SCHW', 56), ('AXP', 57), ('BRK-B', 58), ('SPGI', 59), ('ICE', 60),
        ('CAT', 61), ('DE', 62), ('GE', 63), ('HON', 64), ('UNP', 65), ('RTX', 66), ('LMT', 67), ('NOC', 68), ('ETN', 69), ('PH', 70),
        ('KO', 71), ('PEP', 72), ('MCD', 73), ('SBUX', 74), ('DIS', 75), ('CMCSA', 76), ('TMUS', 77), ('T', 78), ('VZ', 79), ('CHTR', 80),
        ('CVX', 81), ('COP', 82), ('SLB', 83), ('EOG', 84), ('MPC', 85), ('PSX', 86), ('OXY', 87), ('APD', 88), ('LIN', 89), ('SHW', 90),
        ('005930.KS', 91), ('000660.KS', 92), ('035420.KS', 93), ('005380.KS', 94), ('051910.KS', 95), ('066570.KS', 96),
        ('035720.KS', 97), ('105560.KS', 98), ('207940.KS', 99), ('068270.KS', 100), ('012330.KS', 101), ('017670.KS', 102),
        ('028260.KS', 103), ('034730.KS', 104), ('015760.KS', 105), ('018260.KS', 106), ('086790.KS', 107), ('329180.KS', 108),
        ('010130.KS', 109), ('009540.KS', 110), ('003550.KS', 111), ('096770.KS', 112), ('000270.KS', 113), ('402340.KS', 114),
        ('042660.KS', 115), ('034020.KS', 116), ('267250.KS', 117), ('036570.KS', 118), ('247540.KQ', 119), ('293490.KQ', 120)
) AS v(symbol, sort_order)
    ON u.code = 'strategy_core_equities';

INSERT INTO universe_constituents (universe_id, symbol, sort_order)
SELECT u.id, v.symbol, v.sort_order
FROM universes u
JOIN (
    VALUES
        ('SPY', 1), ('QQQ', 2), ('DIA', 3), ('IWM', 4), ('IVV', 5), ('VOO', 6), ('VTI', 7), ('VEA', 8), ('VWO', 9), ('TSLL', 10), ('NVDL', 11),
        ('GLD', 12), ('SLV', 13), ('TLT', 14), ('IEF', 15), ('DBC', 16), ('DBA', 17), ('DJP', 18), ('DOG', 19), ('DXJ', 20), ('DGRO', 21), ('DGRW', 22)
) AS v(symbol, sort_order)
    ON u.code = 'etf_universe';

INSERT INTO universe_constituents (universe_id, symbol, sort_order)
SELECT u.id, v.symbol, v.sort_order
FROM universes u
JOIN (
    VALUES
        ('SPY', 1), ('QQQ', 2), ('DIA', 3), ('IWM', 4), ('^GSPC', 5), ('^IXIC', 6), ('^KS11', 7), ('^KQ11', 8)
) AS v(symbol, sort_order)
    ON u.code = 'benchmark_default';
