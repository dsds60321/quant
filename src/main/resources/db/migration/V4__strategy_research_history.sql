CREATE TABLE strategy_optimization_runs (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    start_value NUMERIC(20, 6) NOT NULL,
    end_value NUMERIC(20, 6) NOT NULL,
    step_value NUMERIC(20, 6) NOT NULL,
    objective VARCHAR(100) NOT NULL,
    benchmark_symbol VARCHAR(32),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL,
    best_parameters_json JSONB,
    result_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strategy_optimization_runs_strategy_id_created_at ON strategy_optimization_runs(strategy_id, created_at DESC);

CREATE TABLE strategy_comparison_runs (
    id BIGSERIAL PRIMARY KEY,
    benchmark_symbol VARCHAR(32) NOT NULL,
    strategy_ids_json JSONB NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL,
    result_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strategy_comparison_runs_created_at ON strategy_comparison_runs(created_at DESC);
