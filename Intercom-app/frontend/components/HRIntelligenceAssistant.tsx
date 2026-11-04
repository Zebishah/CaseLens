'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';

type AssistantResponse = {
  answer: string;
  tool: string;
  provider: string;
  readOnly: boolean;
  sources: string[];
  suggestedPrompts: string[];
};

type Message = { role: 'assistant' | 'user'; text: string; meta?: string };

const renderInlineText = (text: string) => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
  if (part.startsWith('**') && part.endsWith('**')) {
    return <strong key={`${part}-${index}`} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
  }
  if (part.startsWith('`') && part.endsWith('`')) {
    return <code key={`${part}-${index}`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-primary">{part.slice(1, -1)}</code>;
  }
  return <span key={`${part}-${index}`}>{part}</span>;
});

function FormattedAssistantText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
        if (bullet) {
          return <div key={`${line}-${index}`} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" aria-hidden="true" /><span>{renderInlineText(bullet[1])}</span></div>;
        }
        if (!line.trim()) return null;
        return <p key={`${line}-${index}`}>{renderInlineText(line)}</p>;
      })}
    </div>
  );
}

const pagePrompts: Record<string, string[]> = {
  '/': ['What problem does HR Intelligence solve?', 'Why does it integrate with Intercom?', 'How are duplicates prevented?'],
  '/overview': ['Summarize this organization workspace', 'What requires attention?', 'Explain these metrics'],
  '/cases': ['Show attendance cases', 'Which cases need review?', 'What does related history mean?'],
  '/directory': ['Explain employee identity', 'How does store routing help?', 'What context is in this directory?'],
  '/architecture': ['Explain the system simply', 'Why BullMQ and Redis?', 'Why use a transactional outbox?'],
  '/operations': ['What is failing?', 'Why are jobs waiting?', 'How does outbox recovery work?'],
  '/evaluation': ['Explain classification accuracy', 'What does employee precision mean?', 'Which fixture cases failed?'],
  '/access': ['What can reviewers inspect?', 'How is HR data protected?', 'Why is Intercom access invitation-based?'],
  '/login': ['What does the product walkthrough include?', 'How is HR data protected?', 'What problem does this solve?']
};

const routePrompts = (pathname: string): string[] => {
  if (pathname.startsWith('/cases/')) return ['Summarize this case', 'Explain employee match', 'Why are these cases related?', 'Explain routing'];
  return pagePrompts[pathname] ?? pagePrompts['/overview']!;
};

export function HRIntelligenceAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const prompts = useMemo(() => routePrompts(pathname), [pathname]);
  const entityId = pathname.match(/^\/cases\/(\d+)/)?.[1];

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener('hr-assistant:open', openAssistant);
    return () => window.removeEventListener('hr-assistant:open', openAssistant);
  }, []);

  const ask = async (question = input) => {
    const message = question.trim();
    if (!message || loading) return;
    setOpen(true);
    setInput('');
    setError(null);
    setLastQuestion(message);
    setMessages((current) => current.at(-1)?.role === 'user' && current.at(-1)?.text === message
      ? current
      : [...current, { role: 'user', text: message }]);
    setLoading(true);
    try {
      const result = await api.post<AssistantResponse>('/api/assistant/ask', {
        message,
        route: pathname,
        workspace: 'hr-intelligence-workspace',
        ...(entityId ? { entityId: Number(entityId) } : {})
      });
      setMessages((current) => [...current, { role: 'assistant', text: result.answer, meta: `${result.tool} · ${result.provider}` }]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Sign in to inspect protected case context.');
      } else if (err instanceof ApiError && err.status === 404) {
        setError('The assistant route is not deployed on this API yet.');
      } else {
        setError('The assistant could not connect. Check the API connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-product-theme={pathname === '/engineering' ? 'light' : 'dark'} className="product-assistant fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm sm:bottom-6 sm:right-6" aria-live="polite">
      {open ? (
        <section id="hr-intelligence-assistant" className="overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-2xl" aria-label="Ask HR Intelligence">
          <div className="flex items-start justify-between gap-3 bg-[linear-gradient(135deg,#1e4e5c,#153a48)] px-4 py-4 text-white">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-300 shadow-inner" aria-hidden="true">✦</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Read-only assistant</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Grounded</span>
                </div>
                <h2 className="mt-1 text-base font-semibold">Ask HR Intelligence</h2>
                <p className="mt-1 text-xs text-white/65">Answers use authorized, bounded context.</p>
              </div>
            </div>
            <button type="button" className="rounded-md px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.length === 0 ? <p className="rounded-xl border border-primary/10 bg-white p-3 text-sm leading-6 text-slate-600">Ask about the platform, organization workflow, employee matching, related cases, access, reliability, evaluation, or the current screen.</p> : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8 rounded-xl bg-primary px-3 py-2 text-sm leading-5 text-white' : 'mr-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-700'}>
                {message.role === 'assistant' ? <FormattedAssistantText text={message.text} /> : message.text}
                {message.meta ? <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">{message.meta}</p> : null}
              </div>
            ))}
            {loading ? <p className="text-xs text-slate-500">Checking authorized context…</p> : null}
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            {error ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700" role="alert">
                <span className="mt-0.5 shrink-0" aria-hidden="true">!</span>
                <span className="min-w-0 flex-1">{error}</span>
                {lastQuestion ? <button type="button" className="shrink-0 font-semibold text-rose-800 underline decoration-rose-300 underline-offset-2 hover:text-rose-950" onClick={() => void ask(lastQuestion)}>Retry</button> : null}
              </div>
            ) : null}
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {prompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" className="whitespace-nowrap rounded-full border border-primary/15 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-paper" onClick={() => void ask(prompt)}>{prompt}</button>)}
            </div>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
              <label className="sr-only" htmlFor="assistant-question">Ask HR Intelligence</label>
              <input id="assistant-question" className="dash-field h-10 min-w-0" placeholder="Ask a question…" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1200} />
              <button type="submit" disabled={!input.trim() || loading} className="btn-primary shrink-0 rounded-lg px-3 text-sm font-semibold disabled:opacity-50">Ask</button>
            </form>
          </div>
        </section>
      ) : (
        <button type="button" className={`${pathname !== '/engineering' ? 'ai-assistant-launcher ' : ''}ml-auto flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2`} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="hr-intelligence-assistant" aria-label="Ask HR Intelligence">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs text-primary">✦</span>
          <span className="assistant-launcher-label">Ask HR Intelligence</span>
        </button>
      )}
    </div>
  );
}
