import type { Metadata, Viewport } from 'next';
import './globals.css';
import { HRIntelligenceAssistant } from '../components/HRIntelligenceAssistant';

export const metadata: Metadata = {
  title: {
    default: 'HR Intelligence — AI-Powered HR Case Intelligence Platform',
    template: '%s · HR Intelligence'
  },
  description:
    'Intercom-integrated HR case intelligence with employee identity resolution, related-case discovery, stakeholder routing, auditable AI workflows, and operational reliability.',
  openGraph: {
    title: 'HR Intelligence — AI-Powered Case Intelligence',
    description:
      'Turn fragmented HR conversations into explainable identity, history, routing, and auditable operator context.',
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
    <html lang="en">
      <body className="antialiased">{children}<HRIntelligenceAssistant /></body>
    </html>
  );
}
