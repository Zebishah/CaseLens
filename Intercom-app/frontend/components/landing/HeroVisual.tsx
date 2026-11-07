'use client';

import { useEffect, useRef, useState } from 'react';
import { IntelligenceMark, SignalIcon } from './LandingIcons';
import { NeuralCore } from './NeuralCore';

const stages = [
  { label: 'Classify the case', action: 'Understanding the conversation', detail: 'Attendance · Store 1042' },
  { label: 'Resolve identity', action: 'Connecting the employee', detail: 'Jordan → Jordan Hale' },
  { label: 'Connect history', action: 'Finding the relevant history', detail: 'Prior coaching · Evidence attached' },
  { label: 'Inform the reviewer', action: 'Putting your team in control', detail: 'Suggested stakeholder · Sam Patel' }
];

export function HeroVisual() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(0);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setMotionAllowed(!media.matches);
    syncMotion();
    media.addEventListener('change', syncMotion);
    let inView = true;
    const syncVisibility = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncVisibility(); });
    if (stageRef.current) observer.observe(stageRef.current);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      media.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || !motionAllowed || !visible) return;
    const timer = window.setInterval(() => setActive(current => (current + 1) % stages.length), 3600);
    return () => window.clearInterval(timer);
  }, [paused, motionAllowed, visible]);

  const stopped = paused || !motionAllowed || !visible;
  const stage = stages[active];
  return (
    <div ref={stageRef} className="intelligence-stage" data-paused={stopped} data-stage={active}>
      <div className="stage-grid" aria-hidden="true" />
      <div className="stage-orbit orbit-one" aria-hidden="true" />
      <div className="stage-orbit orbit-two" aria-hidden="true" />
      <svg className="stage-connections" viewBox="0 0 1200 480" fill="none" aria-hidden="true">
        <path className="signal-track" d="M315 162C450 162 410 236 600 236S890 150 965 160" />
        <path className="signal-track" d="M965 160C915 235 830 332 925 332" />
        <path className="signal-track" d="M925 332C750 420 500 390 350 355" />
        <path className="signal-travel signal-travel-one" d="M315 162C450 162 410 236 600 236S890 150 965 160" />
        <path className="signal-travel signal-travel-two" d="M965 160C915 235 830 332 925 332" />
        <path className="signal-travel signal-travel-three" d="M925 332C750 420 500 390 350 355" />
      </svg>
      <span className="stage-coordinate coordinate-left" aria-hidden="true">CONVERSATIONS IN.</span>
      <span className="stage-coordinate coordinate-right" aria-hidden="true">CASE INTELLIGENCE OUT.</span>
      <div className="core-container"><NeuralCore paused={stopped} /></div>
      <div className="core-label"><IntelligenceMark /><span>CASE LENS<span>AI + DIRECTORY EVIDENCE</span></span></div>
      <div className="core-process" aria-live="off"><span className="status-light" /><span key={active}>{stage.action}</span></div>

      <div className={`insight-float insight-input ${active === 0 ? 'is-processing' : ''}`}>
        <div className="insight-heading"><span className="insight-icon"><SignalIcon type="message" /></span><span>01 / Conversation → case</span><span className="insight-dots" aria-hidden="true">•••</span></div>
        <p>“Jordan has been late three times this week. What’s the next step?”</p>
        <div className="insight-meta"><span className="source-dot" /> Intercom <span className="case-category">Attendance · Store 1042</span></div>
      </div>
      <div className={`insight-float insight-identity ${active === 1 ? 'is-processing' : ''}`}>
        <div className="insight-heading"><span className="insight-icon"><SignalIcon type="person" /></span><span>02 / Employee identity</span><span className="tiny-check">✓</span></div>
        <div className="insight-person"><span className="person-avatar">JH</span><div><strong>Jordan Hale</strong><span>Directory match · Evidence attached</span></div><span className="match-lines" aria-hidden="true"><i /><i /><i /><i /><i /></span></div>
      </div>
      <div className={`insight-float insight-history ${active === 2 ? 'is-processing' : ''}`}>
        <span className="insight-icon"><SignalIcon type="history" /></span><div><strong>03 / Related history</strong><span>Prior coaching · Reason shown</span></div><span className="connection-dot" />
      </div>
      <div className={`insight-float insight-review ${active === 3 ? 'is-processing' : ''}`}><span className="review-avatars" aria-hidden="true"><i>HR</i><i>SP</i></span><div><strong>04 / Ready for human review</strong><span>Sam Patel · Suggested stakeholder</span></div></div>
      <div className="hero-stage-controls" role="group" aria-label="Explore a sample HR case">
        {stages.map((item, index) => <button key={item.label} type="button" aria-pressed={active === index} onClick={() => { setActive(index); setPaused(true); }}><span>0{index + 1}</span>{item.label}</button>)}
      </div>
      <div className="stage-bottom"><span><span className="status-light" /> Synthetic example · Your team makes the decision</span><button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Resume visual animation' : 'Pause visual animation'}><span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span> {paused ? 'Resume motion' : 'Pause motion'}</button></div>
    </div>
  );
}
