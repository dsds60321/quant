ALTER TABLE news
    ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE news_symbols
    ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(12, 6);

CREATE TABLE IF NOT EXISTS news_impact (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    news_id BIGINT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    impact_score NUMERIC(12, 6) NOT NULL,
    distance NUMERIC(12, 6) NOT NULL,
    node_color VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_news_impact_symbol_news UNIQUE(symbol, news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_symbol_published_at
    ON news_symbols(symbol, news_id);

CREATE INDEX IF NOT EXISTS idx_news_symbols_symbol_relevance
    ON news_symbols(symbol, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_news_impact_symbol_created_at
    ON news_impact(symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_impact_news_id
    ON news_impact(news_id);
