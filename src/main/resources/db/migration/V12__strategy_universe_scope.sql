ALTER TABLE strategies
ADD COLUMN IF NOT EXISTS universe_scope_json JSONB;
