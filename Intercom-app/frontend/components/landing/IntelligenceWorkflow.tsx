'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PRODUCT_DEMO_URL } from '../../lib/product-demo';
import { ArrowIcon, SignalIcon } from './LandingIcons';

const steps = [
  { title: 'Understand the conversation.', copy: 'From an unstructured message to a clear case category, employee signals, and the context your team needs.', label: 'Case extraction', subject: 'A conversation becomes a case.', tag: 'Attendance', name: 'Jordan Hale', detail: 'Late arrivals · Policy guidance requested', evidence: ['Case category identified', 'Employee mention extracted', 'Store context preserved'], icon: 'message' as const },
  { title: 'Connect the right context.', copy: 'Resolve names against the directory, find related conversations, and surface the evidence behind every connection.', label: 'Identity + history', subject: 'A name becomes a full picture.', tag: 'Evidence attached', name: 'Jordan Hale', detail: 'Store 1042 · Directory identity resolved', evidence: ['Directory record matched', 'Prior coaching connected', 'Match evidence preserved'], icon: 'person' as const },
  { title: 'Put people in control.', copy: 'Bring stakeholder suggestions and an auditable snapshot back to the operator. Uncertain evidence goes to human review.', label: 'Review + routing', subject: 'Context becomes a next step.', tag: 'Ready for review', name: 'Sam Patel', detail: 'Suggested stakeholder · District manager', evidence: ['Store-aware contact suggested', 'Case snapshot recorded', 'Human reviewer decides'], icon: 'route' as const }
];

export function IntelligenceWorkflow() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  return (
    <div className="workflow-explorer">
      <div className="workflow-steps" role="tablist" aria-label="Case intelligence workflow" aria-orientation="vertical">
        {steps.map((item, index) => <button key={item.title} type="button" role="tab" id={`workflow-tab-${index}`} aria-controls={`workflow-panel-${index}`} aria-selected={active === index} tabIndex={active === index ? 0 : -1} className={`workflow-step ${active === index ? 'is-active' : ''}`} onClick={() => setActive(index)} onKeyDown={event => {
          const next = event.key === 'ArrowDown' ? (index + 1) % steps.length : event.key === 'ArrowUp' ? (index + steps.length - 1) % steps.length : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null;
          if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(`workflow-tab-${next}`)?.focus(); }
        }}><span className="workflow-number">0{index + 1}</span><span><strong>{item.title}</strong><span>{item.copy}</span></span><ArrowIcon diagonal /></button>)}
      </div>
      {steps.map((_, index) => <div key={index} role="tabpanel" id={`workflow-panel-${index}`} aria-labelledby={`workflow-tab-${index}`} hidden={active !== index} className="workflow-panel" tabIndex={0}>
        {active === index && <>
          <div className="workspace-chrome"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span>Case Lense / case workspace</span><span className="workspace-lock"><SignalIcon type="shield" /></span></div>
          <div className="workspace-content" key={active}>
            <p className="ai-eyebrow">{step.label} <span>0{active + 1} / 03</span></p>
            <h3>{step.subject}</h3>
            <div className="sample-conversation"><span className="sample-avatar">JL</span><div><strong>Jamie Lee <span>· Store manager</span></strong><p>Jordan has been late three times this week. What’s the next step?</p></div></div>
            <div className="analysis-connector" aria-hidden="true"><span /><SignalIcon type="spark" /><span /></div>
            <div className="sample-result"><div className="sample-result-top"><span><SignalIcon type={step.icon} /> {step.label}</span><span>{step.tag}</span></div><strong>{step.name}</strong><p>{step.detail}</p><ul>{step.evidence.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></div>
            <p className="sample-disclaimer"><span className="status-light" /> Synthetic example · Human-reviewed workflow</p>
          </div>
        </>}
      </div>)}
    </div>
  );
}

export function ProductFilm() {
  const [playing, setPlaying] = useState(false);
  // Mount the external player only when the visitor requests it.
  return (
    <div className="product-film">
      {playing ? <div className="film-player"><iframe src={PRODUCT_DEMO_URL} title="Case Lense five-minute subtitled product walkthrough" allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><button onClick={() => setPlaying(false)} className="film-close">Close video ×</button></div> : <button type="button" className="film-poster" onClick={() => setPlaying(true)} aria-label="Play the five-minute product walkthrough">
        <Image src="/product-screenshots/sarah-identity-resolution.webp" alt="Case Lense resolving employee identity and related history alongside a synthetic Intercom conversation" width={1600} height={1000} sizes="(max-width: 800px) 95vw, 1100px" />
        <span className="film-overlay" /><span className="film-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7V5Z" fill="currentColor" /></svg></span><span className="film-caption"><span>LESS SEARCHING. MORE UNDERSTANDING.</span><strong>See the intelligence in action.</strong><span>5-minute walkthrough <span aria-hidden="true">↗</span> Captions included</span></span>
      </button>}
    </div>
  );
}
