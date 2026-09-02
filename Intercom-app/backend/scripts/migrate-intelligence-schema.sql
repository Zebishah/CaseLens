-- Safe manual migration for intelligence / reporter schema changes.
-- Run in Railway Postgres Query tab (or: psql $DATABASE_URL -f scripts/migrate-intelligence-schema.sql)
--
-- Drizzle db:push can fail with: "column id is in a primary key" (Postgres 42P16)
-- when it tries to auto-alter constraints. This script applies the same changes safely.

-- Trigram similarity is used by employee and alias fuzzy matching.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Reporter columns (rename only if old names still exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE conversations RENAME COLUMN contact_name TO reporter_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE conversations RENAME COLUMN contact_email TO reporter_email;
  END IF;
END $$;

-- 2) AI-extracted employee names on conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS extracted_names jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS case_type varchar(50);

-- 3) Junction: conversation ↔ matched employees
CREATE TABLE IF NOT EXISTS conversation_employees (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  employee_identity_id integer NOT NULL REFERENCES employee_identities(id) ON DELETE CASCADE,
  extracted_name varchar(255),
  confidence_score integer,
  match_method varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_employees_conversation_identity_idx
  ON conversation_employees (conversation_id, employee_identity_id);

CREATE INDEX IF NOT EXISTS conversation_employees_identity_conversation_idx
  ON conversation_employees (employee_identity_id, conversation_id);

CREATE INDEX IF NOT EXISTS employee_identities_canonical_name_trgm_idx
  ON employee_identities USING gin (canonical_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employee_aliases_alias_trgm_idx
  ON employee_aliases USING gin (alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employee_identities_lower_email_idx
  ON employee_identities (lower(email))
  WHERE email IS NOT NULL;
