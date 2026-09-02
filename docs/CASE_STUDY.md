# Case study

An HR operations team received unstructured conversations in **Intercom** and needed employee matching, related-case retrieval, and store stakeholder routing without leaving the inbox.

The product keeps Intercom as the operator workspace. A Canvas Kit Inbox App shows identity, evidence, classification, related cases, and recommended stakeholders. The Express backend performs durable ingestion, directory resolution, AI-assisted analysis, and optional internal-note write-back. A separate dashboard is for records, operations, evaluation, and directory — not a second mailbox.

Demo form and inbound email are optional adapters on the same `processCaseIntelligence` pipeline so the portfolio can run without Intercom credentials.

Design constraints: no extra brokers or Kubernetes, optional adapters only, generated directory data, and no unverifiable production metrics. Live Intercom Developer Workspace verification remains a manual step; the Canvas Kit Hub page rendering blank is an external blocker.

