import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './product-system.css';
import './assistant.css';
import { HRIntelligenceAssistant } from '../components/HRIntelligenceAssistant';

const bodyFont = localFont({
  src: './fonts/Manrope-Variable.ttf',
  variable: '--font-body',
  weight: '200 800',
  display: 'swap'
});

const displayFont = localFont({
  src: './fonts/Sora-Variable.ttf',
  variable: '--font-display',
  weight: '100 800',
  display: 'swap'
});

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
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`} data-scroll-behavior="smooth">
      <body className="antialiased">{children}<HRIntelligenceAssistant /></body>
    </html>
  );
}
