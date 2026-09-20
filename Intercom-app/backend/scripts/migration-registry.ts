export const PORTFOLIO_MIGRATIONS = [
  { id: '001-intelligence', file: 'migrate-intelligence-schema.sql' },
  { id: '002-portfolio-ingestion', file: 'migrate-portfolio-ingestion-schema.sql' },
  { id: '003-intercom-sync', file: 'migrate-intercom-sync-schema.sql' },
  { id: '004-intercom-source-revision', file: 'migrate-intercom-source-revision-schema.sql' },
  { id: '005-employee-scope', file: 'migrate-employee-scope-schema.sql' },
  { id: '006-related-case-scope', file: 'migrate-related-case-scope-schema.sql' },
  { id: '007-store-directory', file: 'migrate-store-directory-schema.sql' },
  { id: '008-app-logs', file: 'migrate-app-logs-schema.sql' },
  { id: '009-apify-actor-runs', file: 'migrate-apify-actor-runs-schema.sql' },
  { id: '010-recruiter-access', file: 'migrate-recruiter-access-schema.sql' },
  { id: '011-refresh-sessions', file: 'migrate-refresh-sessions-schema.sql' },
  { id: '012-analytics-trends-indexes', file: 'migrate-analytics-trends-indexes.sql' },
  { id: '013-reviewer-workspace-id', file: 'migrate-reviewer-workspace-id.sql' }
] as const;
