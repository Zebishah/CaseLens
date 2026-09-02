-- Store / domain columns for scoped employee matching.
-- Run: psql $DATABASE_URL -f scripts/migrate-employee-scope-schema.sql

ALTER TABLE employee_identities ADD COLUMN IF NOT EXISTS store_number varchar(50);
ALTER TABLE employee_identities ADD COLUMN IF NOT EXISTS company_domain varchar(255);

CREATE INDEX IF NOT EXISTS employee_identities_store_number_idx
  ON employee_identities (store_number);

CREATE INDEX IF NOT EXISTS employee_identities_company_domain_idx
  ON employee_identities (company_domain);
