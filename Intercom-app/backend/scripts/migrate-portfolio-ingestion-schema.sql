-- Portfolio ingestion, demo sessions, review audit, and conversation source columns.
-- Safe to run more than once (IF NOT EXISTS / additive columns).

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'intercom';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS correlation_id varchar(128);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS demo_session_id integer;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS processing_mode varchar(16) NOT NULL DEFAULT 'live';

CREATE INDEX IF NOT EXISTS conversations_source_idx ON conversations (source);
CREATE INDEX IF NOT EXISTS conversations_demo_session_id_idx ON conversations (demo_session_id);
CREATE INDEX IF NOT EXISTS conversations_correlation_id_idx ON conversations (correlation_id);

CREATE TABLE IF NOT EXISTS inbound_events (
  id serial PRIMARY KEY,
  source varchar(32) NOT NULL,
  external_event_id varchar(255) NOT NULL,
  received_email_id varchar(255),
  event_type varchar(64) NOT NULL,
  payload_hash varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'received',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code varchar(64),
  last_error_message text,
  correlation_id varchar(128) NOT NULL,
  conversation_id integer,
  demo_session_id integer,
  processing_mode varchar(16) NOT NULL DEFAULT 'fixture',
  payload jsonb,
  received_at timestamptz NOT NULL,
  queued_at timestamptz,
  processing_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inbound_events_source_external_uidx
  ON inbound_events (source, external_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS inbound_events_email_received_uidx
  ON inbound_events (source, received_email_id)
  WHERE received_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inbound_events_status_idx ON inbound_events (status);
CREATE INDEX IF NOT EXISTS inbound_events_correlation_idx ON inbound_events (correlation_id);

CREATE TABLE IF NOT EXISTS outbox_events (
  id serial PRIMARY KEY,
  inbound_event_id integer NOT NULL REFERENCES inbound_events(id) ON DELETE CASCADE,
  job_name varchar(64) NOT NULL,
  job_id varchar(255) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_message text,
  correlation_id varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);

CREATE INDEX IF NOT EXISTS outbox_events_status_idx ON outbox_events (status);
CREATE INDEX IF NOT EXISTS outbox_events_job_id_idx ON outbox_events (job_id);

CREATE TABLE IF NOT EXISTS demo_sessions (
  id serial PRIMARY KEY,
  token_hash varchar(64) NOT NULL UNIQUE,
  receiving_address varchar(320) NOT NULL,
  email_count integer NOT NULL DEFAULT 0,
  max_emails integer NOT NULL,
  case_submission_count integer NOT NULL DEFAULT 0,
  max_case_submissions integer NOT NULL,
  live_llm_count integer NOT NULL DEFAULT 0,
  max_live_llm integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS demo_sessions_expires_at_idx ON demo_sessions (expires_at);
CREATE INDEX IF NOT EXISTS demo_sessions_receiving_address_idx ON demo_sessions (receiving_address);

CREATE TABLE IF NOT EXISTS case_corrections (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  field_name varchar(64) NOT NULL,
  original_value text,
  corrected_value text,
  actor_role varchar(32) NOT NULL DEFAULT 'demo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_feedback (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  rating varchar(32) NOT NULL,
  comment text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
  id serial PRIMARY KEY,
  dataset_version varchar(64) NOT NULL,
  prompt_version varchar(64) NOT NULL,
  model_version varchar(64) NOT NULL,
  metrics jsonb NOT NULL,
  environment varchar(32) NOT NULL,
  git_commit varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hot paths used by case hydration and the outbox dispatcher.
CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_idx
  ON conversation_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS outbox_events_pending_created_idx
  ON outbox_events (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS inbound_events_source_received_idx
  ON inbound_events (source, received_at DESC);
