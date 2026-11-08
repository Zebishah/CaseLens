ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS kind varchar(12) NOT NULL DEFAULT 'link';
ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS email_verifications_otp_lookup_idx
  ON email_verifications (user_id, kind, created_at DESC);
