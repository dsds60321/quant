CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_role_status ON users(role, status);

CREATE TABLE stocks (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    sector VARCHAR(100),
    industry VARCHAR(150),
    currency VARCHAR(16) NOT NULL,
    market_cap NUMERIC(24, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stocks_symbol_exchange ON stocks(symbol, exchange);
CREATE INDEX idx_stocks_exchange_sector ON stocks(exchange, sector);

CREATE TABLE prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    date DATE NOT NULL,
    open NUMERIC(20, 6) NOT NULL,
    high NUMERIC(20, 6) NOT NULL,
    low NUMERIC(20, 6) NOT NULL,
    close NUMERIC(20, 6) NOT NULL,
    adj_close NUMERIC(20, 6),
    volume BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prices_symbol_date UNIQUE(symbol, date)
);
CREATE INDEX idx_prices_symbol_date ON prices(symbol, date);

CREATE TABLE fundamentals (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    date DATE NOT NULL,
    per NUMERIC(20, 6),
    pbr NUMERIC(20, 6),
    roe NUMERIC(20, 6),
    eps NUMERIC(20, 6),
    dividend_yield NUMERIC(20, 6),
    market_cap NUMERIC(24, 4),
    revenue NUMERIC(24, 4),
    net_income NUMERIC(24, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fundamentals_symbol_date UNIQUE(symbol, date)
);
CREATE INDEX idx_fundamentals_symbol_date ON fundamentals(symbol, date);

CREATE TABLE factor_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    date DATE NOT NULL,
    momentum NUMERIC(20, 6),
    volatility NUMERIC(20, 6),
    value_score NUMERIC(20, 6),
    quality_score NUMERIC(20, 6),
    growth_score NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_factor_data_symbol_date UNIQUE(symbol, date)
);
CREATE INDEX idx_factor_data_symbol_date ON factor_data(symbol, date);

CREATE TABLE strategies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    roe_filter NUMERIC(20, 6),
    pbr_filter NUMERIC(20, 6),
    momentum_filter NUMERIC(20, 6),
    stock_count INTEGER,
    rebalance_period VARCHAR(50),
    weighting_method VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strategies_status ON strategies(status);

CREATE TABLE strategy_factors (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    factor_name VARCHAR(100) NOT NULL,
    factor_weight NUMERIC(12, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strategy_factors_strategy_id ON strategy_factors(strategy_id);

CREATE TABLE backtests (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cagr NUMERIC(20, 6),
    sharpe NUMERIC(20, 6),
    max_drawdown NUMERIC(20, 6),
    volatility NUMERIC(20, 6),
    win_rate NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_backtests_strategy_id ON backtests(strategy_id);

CREATE TABLE backtest_equity (
    id BIGSERIAL PRIMARY KEY,
    backtest_id BIGINT NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    equity_value NUMERIC(24, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_backtest_equity_backtest_id_date UNIQUE(backtest_id, date)
);
CREATE INDEX idx_backtest_equity_backtest_id_date ON backtest_equity(backtest_id, date);

CREATE TABLE portfolio (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    base_currency VARCHAR(16) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_portfolio_user_id ON portfolio(user_id);

CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    quantity NUMERIC(24, 6) NOT NULL,
    avg_price NUMERIC(20, 6) NOT NULL,
    current_price NUMERIC(20, 6),
    market_value NUMERIC(24, 6),
    unrealized_pnl NUMERIC(24, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX idx_positions_portfolio_symbol ON positions(portfolio_id, symbol);

CREATE TABLE portfolio_history (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    portfolio_value NUMERIC(24, 6) NOT NULL,
    daily_return NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_portfolio_history_portfolio_id_date UNIQUE(portfolio_id, date)
);
CREATE INDEX idx_portfolio_history_portfolio_id_date ON portfolio_history(portfolio_id, date);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    side VARCHAR(20) NOT NULL,
    order_type VARCHAR(30) NOT NULL,
    price NUMERIC(20, 6),
    quantity NUMERIC(24, 6) NOT NULL,
    status VARCHAR(30) NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_portfolio_id ON orders(portfolio_id);
CREATE INDEX idx_orders_status_submitted_at ON orders(status, submitted_at);

CREATE TABLE executions (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    price NUMERIC(20, 6) NOT NULL,
    quantity NUMERIC(24, 6) NOT NULL,
    execution_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_executions_order_id ON executions(order_id);

CREATE TABLE strategy_runs (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    portfolio_id BIGINT NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strategy_runs_strategy_portfolio ON strategy_runs(strategy_id, portfolio_id);
CREATE INDEX idx_strategy_runs_status ON strategy_runs(status);

CREATE TABLE strategy_allocations (
    id BIGSERIAL PRIMARY KEY,
    strategy_run_id BIGINT NOT NULL REFERENCES strategy_runs(id) ON DELETE CASCADE,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    weight NUMERIC(12, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strategy_allocations_run_id ON strategy_allocations(strategy_run_id);

CREATE TABLE market_indices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    last_price NUMERIC(20, 6),
    change_percent NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_market_indices_symbol ON market_indices(symbol);

CREATE TABLE news (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    source VARCHAR(255) NOT NULL,
    url VARCHAR(1000) NOT NULL UNIQUE,
    published_at TIMESTAMPTZ NOT NULL,
    sentiment_score NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_news_published_at ON news(published_at DESC);

CREATE TABLE news_symbols (
    id BIGSERIAL PRIMARY KEY,
    news_id BIGINT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_news_symbols_news_id ON news_symbols(news_id);
CREATE INDEX idx_news_symbols_symbol ON news_symbols(symbol);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES stocks(symbol),
    event_type VARCHAR(100) NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_symbol_event_date ON events(symbol, event_date DESC);
CREATE INDEX idx_events_event_type ON events(event_type);

CREATE TABLE event_analysis (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    price_t1 NUMERIC(20, 6),
    price_t5 NUMERIC(20, 6),
    price_t20 NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_event_analysis_event_id ON event_analysis(event_id);

CREATE TABLE risk_metrics (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    var NUMERIC(20, 6),
    beta NUMERIC(20, 6),
    volatility NUMERIC(20, 6),
    max_drawdown NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_risk_metrics_portfolio_id_date UNIQUE(portfolio_id, date)
);
CREATE INDEX idx_risk_metrics_portfolio_id_date ON risk_metrics(portfolio_id, date);

CREATE TABLE factor_exposure (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    value_exposure NUMERIC(20, 6),
    momentum_exposure NUMERIC(20, 6),
    quality_exposure NUMERIC(20, 6),
    growth_exposure NUMERIC(20, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_factor_exposure_portfolio_id_date UNIQUE(portfolio_id, date)
);
CREATE INDEX idx_factor_exposure_portfolio_id_date ON factor_exposure(portfolio_id, date);

CREATE TABLE benchmark_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    date DATE NOT NULL,
    price NUMERIC(20, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_benchmark_data_symbol_date UNIQUE(symbol, date)
);
CREATE INDEX idx_benchmark_data_symbol_date ON benchmark_data(symbol, date);

CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_jobs_status_started_at ON jobs(status, started_at DESC);

CREATE TABLE data_sources (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_sync_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_data_sources_status ON data_sources(status);

CREATE TABLE data_update_log (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    rows_updated BIGINT NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_data_update_log_source_id ON data_update_log(source_id);

CREATE TABLE api_keys (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(255) NOT NULL,
    api_key VARCHAR(1000) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_keys_provider_status ON api_keys(provider, status);

CREATE TABLE system_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_logs_user_id_created_at ON activity_logs(user_id, created_at DESC);
