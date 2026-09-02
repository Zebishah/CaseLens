ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS intercom_sync_status varchar(32),
  ADD COLUMN IF NOT EXISTS intercom_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS intercom_sync_error text,
  ADD COLUMN IF NOT EXISTS intercom_intelligence_note_id varchar(100),
  ADD COLUMN IF NOT EXISTS intercom_sync_fingerprint varchar(64),
  ADD COLUMN IF NOT EXISTS intercom_sync_tags jsonb;

CREATE INDEX IF NOT EXISTS conversations_intercom_sync_status_idx
  ON conversations (intercom_sync_status);
