export function IntelligenceMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M18 3 31 10.5v15L18 33 5 25.5v-15L18 3Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="m18 9 7.8 4.5v9L18 27l-7.8-4.5v-9L18 9Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 3v6m13 1.5-5.2 3M31 25.5l-5.2-3M18 33v-6M5 25.5l5.2-3M5 10.5l5.2 3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
    </svg>
  );
}

export function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function SignalIcon({ type }: { type: 'person' | 'history' | 'route' | 'shield' | 'spark' | 'message' }) {
  const paths = {
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2M17 5l2 2 3-3" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2" /></>,
    route: <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h4M16 16l3-3 3 3" /></>,
    shield: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4" /></>,
    message: <><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6Z" /><path d="M7 8h10M7 12h6" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}
