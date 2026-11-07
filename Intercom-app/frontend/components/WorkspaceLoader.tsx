import type { ReactNode } from 'react';
import { IntelligenceMark } from './landing/LandingIcons';

export function WorkspaceLoader({
  title = 'Loading Case Lens',
  description = 'Preparing your workspace and case context.',
  busy = true,
  children
}: {
  title?: string;
  description?: string;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="product-workspace theme-light workspace-loading-screen">
      <div className="workspace-loading-content">
        <div role={busy ? 'status' : undefined} aria-live="polite">
          <div className={`workspace-loader ${busy ? 'is-running' : 'is-idle'}`} aria-hidden="true">
            <span className="workspace-loader-glow" />
            <svg className="workspace-loader-orbit" viewBox="0 0 96 96" fill="none">
              <circle cx="48" cy="48" r="43" stroke="currentColor" strokeOpacity=".12" />
              <circle className="workspace-loader-outer-ring" cx="48" cy="48" r="43" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="68 202" />
              <circle className="workspace-loader-inner-ring" cx="48" cy="48" r="33" stroke="currentColor" strokeOpacity=".45" strokeWidth="1" strokeLinecap="round" strokeDasharray="24 184" />
            </svg>
            <IntelligenceMark className="workspace-loading-mark" />
          </div>
          <h1 className="workspace-loading-title">{title}</h1>
          <p className="workspace-loading-description">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
