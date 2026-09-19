'use client';

import { useState } from 'react';

export function DemoVideoEmbed({ videoUrl }: { videoUrl: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!videoUrl || failed) {
    return (
      <div className="flex aspect-video flex-col justify-center rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_55%),#0f172a] p-6 text-white shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Product walkthrough</p>
        <h4 className="mt-3 text-lg font-semibold">Explore the workflow in three moves</h4>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {['Conversation arrives', 'Identity + history', 'Review in Intercom'].map((step, index) => <div key={step} className="rounded-lg border border-white/10 bg-white/[0.06] p-3"><span className="text-xs text-emerald-300">0{index + 1}</span><p className="mt-2 text-xs font-medium leading-5 text-slate-200">{step}</p></div>)}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-400">The hosted video is unavailable right now. Product screenshots below provide the same recruiter walkthrough.</p>
      </div>
    );
  }

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
        loading="eager"
        onLoad={() => setIsLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
