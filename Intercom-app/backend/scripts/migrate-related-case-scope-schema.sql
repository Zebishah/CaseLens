-- Reporter store/domain on conversations for scoped related-case search.
-- Run: npm run db:migrate-related-case-scope

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS reporter_store_number varchar(50);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS reporter_company_domain varchar(255);

CREATE INDEX IF NOT EXISTS conversations_reporter_store_number_idx
  ON conversations (reporter_store_number);

CREATE INDEX IF NOT EXISTS conversations_reporter_company_domain_idx
  ON conversations (reporter_company_domain);

-- Backfill from reporter_email where local part is all digits (e.g. 3456@acmecorp.com)
UPDATE conversations
SET reporter_store_number = split_part(lower(trim(reporter_email)), '@', 1)
WHERE reporter_store_number IS NULL
  AND reporter_email IS NOT NULL
  AND reporter_email LIKE '%@%'
  AND split_part(lower(trim(reporter_email)), '@', 1) ~ '^\d{3,}$';

UPDATE conversations
SET reporter_company_domain = lower(split_part(trim(reporter_email), '@', 2))
WHERE reporter_company_domain IS NULL
  AND reporter_email IS NOT NULL
  AND reporter_email LIKE '%@%'
  AND position('@' in reporter_email) > 0;
