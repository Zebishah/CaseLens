export function StepArrow({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center ${vertical ? 'py-1 md:hidden' : 'hidden px-0.5 md:flex'}`}
      aria-hidden="true"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-secondary shadow-lift">
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${vertical ? 'rotate-90' : ''}`} fill="none" aria-hidden="true">
          <path
            d="M5 12h12m0 0-5-5m5 5-5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
