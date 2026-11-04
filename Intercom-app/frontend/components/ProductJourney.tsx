import { IntelligenceMark, SignalIcon } from './landing/LandingIcons';

/** The same product story appears at entry and inside the workspace. */
export function ProductJourney({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={`product-journey ${compact ? 'is-compact' : ''}`} aria-label="How HR Intelligence works">
      <li><SignalIcon type="message" /><span>Conversations<small>Intercom + email</small></span></li>
      <li><IntelligenceMark /><span>AI intelligence<small>Identity + related history</small></span></li>
      <li><SignalIcon type="shield" /><span>Informed review<small>Your team decides</small></span></li>
    </ol>
  );
}
