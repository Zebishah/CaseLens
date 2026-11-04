CREATE INDEX IF NOT EXISTS conversations_created_at_idx
  ON conversations (created_at);

CREATE INDEX IF NOT EXISTS inbound_events_completed_at_idx
  ON inbound_events (completed_at);

CREATE INDEX IF NOT EXISTS inbound_events_failed_at_idx
  ON inbound_events (failed_at);
