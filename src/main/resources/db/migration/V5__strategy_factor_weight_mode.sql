ALTER TABLE strategies
ADD COLUMN IF NOT EXISTS factor_weight_mode VARCHAR(20) NOT NULL DEFAULT 'AUTO';

CREATE INDEX IF NOT EXISTS idx_strategies_factor_weight_mode ON strategies(factor_weight_mode);
