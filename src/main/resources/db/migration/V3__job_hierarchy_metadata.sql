ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS parent_job_id BIGINT NULL REFERENCES jobs(id);

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS metadata_json JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id ON jobs(parent_job_id);
