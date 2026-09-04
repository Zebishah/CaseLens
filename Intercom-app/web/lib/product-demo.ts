export const PRODUCT_DEMO_URL =
  process.env.NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL?.trim() ||
  'https://embed.app.guidde.com/playbooks/t7C9ZYEfhucV5Bh2iwYw14?mode=videoOnly';

export const PRODUCT_DEMO_HIGHLIGHTS = [
  { title: 'Structured case analysis', description: 'Category and employee signals are extracted beside the Intercom conversation.' },
  { title: 'Identity resolution', description: 'Misspelled, shortened, and mid-subject names are matched to directory records with evidence.' },
  { title: 'Related-case evidence', description: 'Prior cases are ranked with an explanation of the employee, category, topic, and time-window match.' },
  { title: 'Operational routing', description: 'Store-aware CC suggestions and review requirements keep the operator workflow actionable.' }
] as const;
