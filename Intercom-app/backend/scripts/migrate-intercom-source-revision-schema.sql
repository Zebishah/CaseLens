ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS intercom_source_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS conversations_intercom_source_updated_at_idx
  ON conversations (intercom_source_updated_at);
