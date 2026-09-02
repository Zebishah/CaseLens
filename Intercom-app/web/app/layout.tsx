import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HR Intelligence — AI-Powered Case Intelligence',
    template: '%s · HR Intelligence'
  },
  description:
    'Portfolio demonstration of an HR case operations platform. Ingest cases, resolve employee identity, find related conversations, surface stakeholders, and inspect a shared intelligence pipeline.',
  openGraph: {
    title: 'HR Intelligence — AI-Powered Case Intelligence',
    description:
      'Ingest HR cases, identify employees, connect related conversations, and inspect intelligence results through a durable processing workflow.',
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
