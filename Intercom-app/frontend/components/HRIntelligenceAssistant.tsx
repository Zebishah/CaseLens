'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { ArrowIcon, IntelligenceMark, SignalIcon } from './landing/LandingIcons';

type AssistantResponse = {
  answer: string;
  tool: string;
  provider: string;
  readOnly: boolean;
  sources: string[];
  suggestedPrompts: string[];
};

type Message = { role: 'assistant' | 'user'; text: string; context: string; sourceCount?: number };

const pagePrompts: Record<string, string[]> = {
  '/': ['What problem does Case Lense solve?', 'Why does it integrate with Intercom?', 'How is HR data protected?'],
  '/overview': ['Summarize this organization workspace', 'What requires attention?', 'Explain these metrics'],
  '/cases': ['Show attendance cases', 'Which cases need review?', 'What does related history mean?'],
  '/directory': ['Explain employee identity', 'How does store routing help?', 'What context is in this directory?'],
  '/architecture': ['Explain the system simply', 'Why use on-demand Apify Actors?', 'Why use a transactional outbox?'],
  '/operations': ['What is failing?', 'Why are jobs waiting?', 'How does outbox recovery work?'],
  '/evaluation': ['Explain classification accuracy', 'What does employee precision mean?', 'Which fixture cases failed?'],
  '/access': ['What can reviewers inspect?', 'How is HR data protected?', 'Why is Intercom access invitation-based?'],
  '/login': ['What does the product walkthrough include?', 'How is HR data protected?', 'What problem does this solve?']
};

const routePrompts = (pathname: string): string[] => pathname.startsWith('/cases/')
  ? ['Summarize this case', 'Explain employee match', 'Why are these cases related?']
  : pagePrompts[pathname] ?? pagePrompts['/']!;

const contextNames: Record<string, string> = {
  '/': 'Product guide', '/login': 'Workspace access', '/access': 'Product & reviewer access',
  '/forgot-password': 'Account recovery', '/set-password': 'Your invitation',
  '/overview': 'Organization overview', '/cases': 'Case operations', '/directory': 'Directory intelligence',
  '/operations': 'Operational health', '/evaluation': 'AI quality', '/architecture': 'System architecture',
  '/engineering': 'Engineering guide', '/demo': 'Product walkthrough', '/access-requests': 'Access management'
};

function renderInlineText(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function FormattedAssistantText({ text }: { text: string }) {
  return <div className="assistant-answer-text">{text.split(/\r?\n/).map((line, index) => {
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) return <div key={index} className="assistant-answer-bullet"><span aria-hidden="true" /> <span>{renderInlineText(bullet[1])}</span></div>;
    return line.trim() ? <p key={index}>{renderInlineText(line)}</p> : null;
  })}</div>;
}

export function HRIntelligenceAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const inFlightRef = useRef(false);
  const prompts = useMemo(() => routePrompts(pathname), [pathname]);
  const entityId = pathname.match(/^\/cases\/(\d+)/)?.[1];
  const context = entityId ? `Case #${entityId}` : contextNames[pathname] ?? 'HR workspace';
  const publicPage = ['/', '/login', '/access', '/engineering', '/forgot-password', '/set-password'].includes(pathname);

  const openAssistant = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('hr-assistant:open', openAssistant);
    return () => window.removeEventListener('hr-assistant:open', openAssistant);
  }, [openAssistant]);

  useEffect(() => {
    if (open) composerRef.current?.focus({ preventScroll: true });
    else if (wasOpenRef.current) {
      const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : launcherRef.current;
      target?.focus({ preventScroll: true });
    }
    wasOpenRef.current = open;
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = messages.length || loading ? transcript.scrollHeight : 0;
  }, [messages, loading, open]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const root = rootRef.current;
    if (!open || !viewport || !root) return;
    const resize = () => {
      root.style.setProperty('--assistant-viewport-height', `${viewport.height}px`);
      root.style.setProperty('--assistant-keyboard-offset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
      root.style.removeProperty('--assistant-viewport-height');
      root.style.removeProperty('--assistant-keyboard-offset');
    };
  }, [open]);

  useEffect(() => { setFollowUps([]); }, [pathname]);

  const ask = async (question = input) => {
    const message = question.trim();
    if (!message || message.length > 1200 || inFlightRef.current) return;
    inFlightRef.current = true;
    setOpen(true);
    setInput('');
    setError(null);
    setLastQuestion(message);
    setMessages(current => current.at(-1)?.role === 'user' && current.at(-1)?.text === message
      ? current : [...current, { role: 'user', text: message, context }]);
    setLoading(true);
    try {
      const result = await api.post<AssistantResponse>('/api/assistant/ask', {
        message, route: pathname, workspace: 'hr-intelligence-workspace', ...(entityId ? { entityId: Number(entityId) } : {})
      });
      setMessages(current => [...current, { role: 'assistant', text: result.answer, context, sourceCount: Array.isArray(result.sources) ? result.sources.length : 0 }]);
      setFollowUps((result.suggestedPrompts ?? []).filter(prompt => typeof prompt === 'string' && prompt.trim() && prompt.length <= 140 && prompt !== message).slice(0, 3));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('Sign in to explore protected case and workspace information.');
      else if (err instanceof ApiError && err.status === 404) setError('The assistant is not available in this environment yet. Please try again later.');
      else setError('I couldn’t connect to the assistant. Your question is saved here so you can try again.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const newConversation = () => {
    if (inFlightRef.current) return;
    setMessages([]); setError(null); setFollowUps([]); setLastQuestion(''); setInput('');
    composerRef.current?.focus();
  };

  const nextPrompts = followUps.length ? followUps : prompts.filter(prompt => prompt !== lastQuestion).slice(0, 2);

  return (
    <div ref={rootRef} className={`hr-assistant ${open ? 'is-open' : ''}`}>
      {open ? (
        <section id="hr-intelligence-assistant" className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
          <header className="assistant-header">
            <div className="assistant-header-brand"><span className="assistant-brand-symbol"><IntelligenceMark /></span><div><p>YOUR AI CONTEXT GUIDE</p><h2 id="assistant-title">Ask Case Lense</h2></div></div>
            <div className="assistant-header-actions"><button type="button" onClick={newConversation} disabled={loading || messages.length === 0} aria-label="Start a new conversation" title="Start a new conversation"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 8M4 4v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button><button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" title="Close assistant"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button></div>
          </header>
          <div className="assistant-context"><span><SignalIcon type="spark" />{context}</span><span><SignalIcon type="shield" /> Read-only</span></div>
          <div ref={transcriptRef} className="assistant-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? <div className="assistant-welcome"><div className="assistant-welcome-orb" aria-hidden="true"><span /><IntelligenceMark /><span /></div><p className="assistant-welcome-eyebrow">A LITTLE CONTEXT GOES A LONG WAY</p><h3>Your HR questions.<br /><span>A clearer picture.</span></h3><p>{publicPage ? 'Discover how Case Lense connects conversations, people, and case history for your team.' : 'Explore this workspace, understand employee matches, or find out what needs your attention.'}</p><div className="assistant-starter-prompts" aria-label="Suggested questions">{prompts.slice(0, 3).map(prompt => <button key={prompt} type="button" disabled={loading} onClick={() => void ask(prompt)}><SignalIcon type="message" /><span>{prompt}</span><ArrowIcon diagonal /></button>)}</div></div> : messages.map((message, index) => <article key={`${message.role}-${index}`} className={`assistant-message from-${message.role}`} aria-label={message.role === 'user' ? 'Your question' : 'Assistant answer'}>
              <div className="assistant-message-author">{message.role === 'assistant' ? <IntelligenceMark /> : <span className="assistant-you-dot" />}<span>{message.role === 'user' ? 'You' : 'Case Lense'}</span>{message.role === 'assistant' && <span className="assistant-message-context">{message.context}</span>}</div>
              <div className="assistant-message-bubble">{message.role === 'assistant' ? <FormattedAssistantText text={message.text} /> : <p>{message.text}</p>}</div>
              {message.role === 'assistant' && !!message.sourceCount && <span className="assistant-evidence"><SignalIcon type="shield" /> {message.sourceCount} permitted context {message.sourceCount === 1 ? 'source' : 'sources'}</span>}
            </article>)}
            {loading ? <div className="assistant-thinking" role="status"><span className="assistant-thinking-mark"><IntelligenceMark /></span><span>Connecting the context<span className="assistant-thinking-dots" aria-hidden="true"><i /><i /><i /></span></span></div> : null}
            {error ? <div className="assistant-error" role="alert"><span>{error}</span><button type="button" disabled={loading} onClick={() => void ask(lastQuestion)}>Try again <ArrowIcon /></button></div> : null}
          </div>
          {messages.length > 0 && !loading && !error ? <div className="assistant-follow-ups"><p>KEEP EXPLORING</p><div>{nextPrompts.map(prompt => <button key={prompt} type="button" onClick={() => void ask(prompt)}>{prompt}<ArrowIcon diagonal /></button>)}</div></div> : null}
          <form className="assistant-composer" onSubmit={event => { event.preventDefault(); void ask(); }} aria-busy={loading}>
            <div className="assistant-input-wrap"><label className="sr-only" htmlFor="assistant-question">Ask Case Lense</label><textarea ref={composerRef} id="assistant-question" rows={2} placeholder={entityId ? 'Ask about this case…' : 'What would you like to understand?'} value={input} onChange={event => setInput(event.target.value)} maxLength={1200} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(); } }} /><button type="submit" disabled={!input.trim() || loading} aria-label="Send question" title="Send question"><ArrowIcon /></button></div>
            <div className="assistant-composer-meta"><span><SignalIcon type="shield" /> Uses your permitted context</span><span>{input.length > 1000 ? `${input.length}/1200` : 'Enter ↵ to send'}</span></div>
          </form>
        </section>
      ) : <button ref={launcherRef} type="button" className="assistant-launcher" onClick={openAssistant} aria-expanded={false} aria-controls="hr-intelligence-assistant" aria-label="Ask Case Lense" title="Ask Case Lense"><span className="assistant-launcher-icon"><IntelligenceMark /></span><span className="assistant-launcher-label">Ask Case Lense</span><span className="assistant-launcher-badge">AI</span></button>}
    </div>
  );
}
