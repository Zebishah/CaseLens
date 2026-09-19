import type { Metadata, Viewport } from 'next';
import './globals.css';
import { HRIntelligenceAssistant } from '../components/HRIntelligenceAssistant';

export const metadata: Metadata = {
  title: {
    default: 'HR Intelligence — AI-Powered B2B HR Intelligence Platform',
    template: '%s · HR Intelligence'
  },
  description:
    'AI-Powered B2B HR Intelligence Platform for explainable HR case intelligence across Intercom and email, with identity resolution, related history, stakeholder routing, auditable AI workflows, and operational reliability.',
  openGraph: {
    title: 'HR Intelligence — AI-Powered B2B HR Intelligence Platform',
    description:
      'Turn fragmented HR conversations into explainable case intelligence while keeping human reviewers in control.',
    type: 'website'
  }
};

export const viewport: Viewport = {
  themeColor: '#2b6777',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">{children}<HRIntelligenceAssistant /></body>
    </html>
  );
}
