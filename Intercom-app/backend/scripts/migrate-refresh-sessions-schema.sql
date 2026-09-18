CREATE TABLE IF NOT EXISTS refresh_sessions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS refresh_sessions_user_revoked_idx
  ON refresh_sessions (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS refresh_sessions_expires_at_idx
  ON refresh_sessions (expires_at);
