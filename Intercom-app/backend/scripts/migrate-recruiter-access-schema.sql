CREATE TABLE IF NOT EXISTS recruiter_access_requests (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  work_email VARCHAR(255) NOT NULL,
  organization VARCHAR(160),
  role VARCHAR(120),
  purpose VARCHAR(800) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'invited', 'declined', 'expired')),
  review_note VARCHAR(500),
  consent_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recruiter_access_requests_status_created_idx
  ON recruiter_access_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS recruiter_access_requests_email_idx
  ON recruiter_access_requests (work_email);
