import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EngineeringPage from '../../app/engineering/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a>
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/engineering' }));

describe('engineering case study', () => {
  it('renders the public engineering narrative and current architecture labels', () => {
    render(<EngineeringPage />);

    expect(screen.getByRole('heading', { name: 'Engineering at Case Lense' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A durable path for bursty background work.' })).toBeInTheDocument();
    expect(screen.getAllByText('Current production', { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Architecture evolution/)).toBeInTheDocument();
    expect(screen.getByText('Redis / Upstash', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('API → Apify on-demand Actor', { exact: true })).toBeInTheDocument();
  });

  it('links recruiters to the demo and avoids sensitive configuration values', () => {
    const { container } = render(<EngineeringPage />);
    expect(screen.getAllByRole('link', { name: /reviewer walkthrough/i })[0]).toHaveAttribute('href', '/login?mode=demo');
    expect(screen.getByRole('link', { name: /Explore live demo/i })).toHaveAttribute('href', '/login?mode=demo');
    expect(container.textContent).not.toMatch(/DATABASE_URL|REDIS_URL|GEMINI_API_KEY|APIFY_API_TOKEN|postgresql:|rediss:\/\//i);
  });
});
