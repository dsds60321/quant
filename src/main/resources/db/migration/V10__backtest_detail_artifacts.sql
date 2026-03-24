ALTER TABLE backtests
ADD COLUMN IF NOT EXISTS stock_breakdown_json JSONB,
ADD COLUMN IF NOT EXISTS pattern_breakdown_json JSONB,
ADD COLUMN IF NOT EXISTS trade_log_json JSONB,
ADD COLUMN IF NOT EXISTS signal_timeline_json JSONB,
ADD COLUMN IF NOT EXISTS research_config_json JSONB;
