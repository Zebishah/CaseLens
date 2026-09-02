-- Persistent error/warn logs for live debugging when Render logs are gone.
CREATE TABLE IF NOT EXISTS app_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  conversation_id VARCHAR(64),
  intercom_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_logs_created_at_idx ON app_logs (created_at);
CREATE INDEX IF NOT EXISTS app_logs_level_idx ON app_logs (level);
