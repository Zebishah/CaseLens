ALTER TABLE recruiter_access_requests
  ADD COLUMN IF NOT EXISTS workspace_id varchar(64);
