'use client';

import { useEffect, useState } from 'react';

const SLOW_LOAD_DELAY_MS = 8_000;

export function DemoVideoEmbed({ videoUrl }: { videoUrl: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    if (isLoaded) return;

    const timeoutId = window.setTimeout(() => {
      setIsTakingLonger(true);
    }, SLOW_LOAD_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded]);

  return (
    <div
      className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
      aria-busy={!isLoaded}
    >
      {!isLoaded && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.12),transparent_55%)] px-6 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-xs">
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
            <p className="mt-4 text-sm font-semibold text-white">Loading the guided product walkthrough</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Preparing the five-minute subtitled demo with playback controls.
            </p>
            {isTakingLonger && (
              <p className="mt-3 text-xs leading-5 text-slate-300">
                The hosted video is taking a little longer than expected. The product screenshots below remain available while it loads.
              </p>
            )}
          </div>
        </div>
      )}

      <iframe
        src={videoUrl}
        title="HR Intelligence product walkthrough"
        className={`h-full w-full transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        allow="clipboard-write; fullscreen"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
