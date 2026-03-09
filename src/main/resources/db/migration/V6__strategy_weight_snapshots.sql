CREATE TABLE strategy_weight_snapshots (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    factor_weight_mode VARCHAR(20) NOT NULL,
    factor_weights_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strategy_weight_snapshots_strategy_id ON strategy_weight_snapshots(strategy_id);

ALTER TABLE backtests
ADD COLUMN IF NOT EXISTS snapshot_id BIGINT REFERENCES strategy_weight_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backtests_snapshot_id ON backtests(snapshot_id);
