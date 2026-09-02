-- Store-directory CC recipients (Milestone 2 — store-number lookup from Box Excel)

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_fixed_contacts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(128),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_fixed_contacts_company_id_idx
  ON company_fixed_contacts (company_id);

CREATE TABLE IF NOT EXISTS store_directory (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_number VARCHAR(64) NOT NULL,
  store_name VARCHAR(255),
  vp_name VARCHAR(255),
  vp_email VARCHAR(255),
  director_name VARCHAR(255),
  director_email VARCHAR(255),
  district_manager_name VARCHAR(255),
  district_manager_email VARCHAR(255),
  owner_name VARCHAR(255),
  owner_email VARCHAR(255),
  raw_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS store_directory_company_store_uidx
  ON store_directory (company_id, store_number);

CREATE INDEX IF NOT EXISTS store_directory_store_number_idx
  ON store_directory (store_number);

CREATE TABLE IF NOT EXISTS store_directory_sync_runs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'box',
  box_file_id VARCHAR(64),
  stores_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  meta JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
