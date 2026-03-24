ALTER TABLE backtests
ADD COLUMN IF NOT EXISTS universe_scope_json JSONB;
