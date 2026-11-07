'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowIcon, IntelligenceMark, SignalIcon } from './LandingIcons';

const screens = [
  {
    label: 'Employee identity',
    file: 'sarah-identity-resolution.webp',
    width: 1690,
    height: 1037,
    title: 'A first name becomes a person.',
    description: 'The conversation mentions “Sarah.” Case Lens surfaces Sarah Saffari with directory-matching evidence and connected case history.',
    alt: 'Intercom conversation with Case Lens showing Sarah matched to Sarah Saffari, a similar-spelling confidence explanation, and related coaching cases.',
    findings: ['Reported name and directory identity stay visible.', 'The matching method explains the connection.', 'Relevant conversations appear beside the case.'],
    icon: 'person' as const
  },
  {
    label: 'Related history',
    file: 'ayesha-related-case-evidence.webp',
    width: 1704,
    height: 1014,
    title: 'The history comes with a reason.',
    description: 'An attendance report uses the spelling “Ayesha Sophy.” The panel surfaces Ayesha Sophie, a possible same-person warning, and the evidence linking earlier conversations.',
    alt: 'Synthetic Intercom attendance case showing an Ayesha Sophy name variant, a possible same-person warning, and related cases explained by employee, category, topic, and time window.',
    findings: ['Name variants are surfaced for review.', 'Related cases explain why they are relevant.', 'Uncertain identity stays a human decision.'],
    icon: 'history' as const
  },
  {
    label: 'Case intelligence',
    file: 'darren-exact-match.webp',
    width: 1704,
    height: 1014,
    title: 'One case. A structured picture.',
    description: 'An employee report becomes a Conduct case with an exact Darren Watkins directory match, connected conversations, and inspectable processing context.',
    alt: 'Case Lens inside a synthetic Intercom conversation showing Darren Watkins matched exactly to the directory alongside a Conduct category and related conversations.',
    findings: ['The conversation has a clear case category.', 'Exact directory evidence is inspectable.', 'Case context stays beside the operator’s inbox.'],
    icon: 'spark' as const
  }
];

export function ProductEvidence() {
  const [active, setActive] = useState(0);
  const screen = screens[active];
  return (
    <div className="product-proof" data-reveal>
      <div className="proof-toolbar">
        <span className="proof-product-label"><IntelligenceMark /> CASE LENS <span>INSIDE INTERCOM</span></span>
        <div className="proof-tabs" role="tablist" aria-label="Explore actual product screens">
          {screens.map((item, index) => <button key={item.file} type="button" role="tab" id={`proof-tab-${index}`} aria-controls={`proof-panel-${index}`} aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % screens.length : event.key === 'ArrowLeft' ? (index + screens.length - 1) % screens.length : event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : null;
            if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(`proof-tab-${next}`)?.focus(); }
          }}><SignalIcon type={item.icon} />{item.label}</button>)}
        </div>
      </div>
      {screens.map((item, index) => <div key={item.file} id={`proof-panel-${index}`} className="proof-panel" role="tabpanel" aria-labelledby={`proof-tab-${index}`} hidden={active !== index} tabIndex={0}>
        {active === index && <>
          <div className="proof-screen"><div className="proof-window-chrome"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span>Intercom inbox + Case Lens panel</span><span className="proof-screen-tag">PRODUCT SCREEN</span></div>
            <a key={screen.file} href={`/product-screenshots/${screen.file}`} target="_blank" rel="noreferrer" aria-label={`Open full-size product screenshot: ${screen.label}`}><Image src={`/product-screenshots/${screen.file}`} alt={screen.alt} width={screen.width} height={screen.height} sizes="(max-width: 900px) 90vw, 900px" /><span className="proof-zoom"><ArrowIcon diagonal /><span>Open full size</span></span></a>
          </div>
          <div className="proof-explanation" key={screen.label}>
            <span className="proof-feature-icon"><SignalIcon type={screen.icon} /></span>
            <p className="ai-eyebrow">WHAT YOU’RE SEEING / 0{active + 1}</p>
            <h3>{screen.title}</h3><p>{screen.description}</p>
            <ul>{screen.findings.map(finding => <li key={finding}><span aria-hidden="true">✓</span>{finding}</li>)}</ul>
            <Link href="/login?mode=demo" className="proof-demo-link">Explore the product yourself <ArrowIcon diagonal /></Link>
          </div>
        </>}
      </div>)}
      <div className="proof-footer"><span><span className="status-light" /> Actual product screens · Synthetic evaluation records</span><span>Intercom stays your inbox. Intelligence appears alongside it.</span></div>
    </div>
  );
}
