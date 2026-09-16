CREATE TABLE IF NOT EXISTS intelligence_actor_runs (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  intercom_id varchar(255) NOT NULL,
  source_revision varchar(160),
  job_type varchar(48) NOT NULL,
  dedupe_key varchar(200) NOT NULL,
  apify_run_id varchar(128),
  status varchar(24) NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 1,
  force_reprocess boolean NOT NULL DEFAULT false,
  skip_sync boolean NOT NULL DEFAULT false,
  skip_peer_refresh boolean NOT NULL DEFAULT false,
  retryable boolean NOT NULL DEFAULT false,
  retry_after timestamptz,
  safe_error_code varchar(64),
  last_error text,
  input jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intelligence_actor_runs_dedupe_uidx UNIQUE (conversation_id, job_type, dedupe_key)
);

ALTER TABLE intelligence_actor_runs ADD COLUMN IF NOT EXISTS retry_after timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS intelligence_actor_runs_apify_run_uidx
  ON intelligence_actor_runs (apify_run_id) WHERE apify_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS intelligence_actor_runs_status_created_idx
  ON intelligence_actor_runs (status, created_at);
CREATE INDEX IF NOT EXISTS intelligence_actor_runs_retry_idx
  ON intelligence_actor_runs (status, retry_after);
CREATE INDEX IF NOT EXISTS intelligence_actor_runs_revision_idx
  ON intelligence_actor_runs (conversation_id, source_revision);
