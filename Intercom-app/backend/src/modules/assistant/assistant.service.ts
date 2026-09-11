import { sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { employeeIdentities } from '../../database/schema/employee_identities.js';
import { storeDirectory } from '../../database/schema/store_directory.js';
import { companies } from '../../database/schema/companies.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { ingestionRepository } from '../ingestion/ingestion.repository.js';
import { runEvaluation } from '../evaluation/evaluation.runner.js';
import { AppError } from '../../utils/error.util.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import { generateAssistantAnswer } from './assistant.provider.js';

export type AssistantContext = {
  route: string;
  entityId?: number;
  workspace?: string;
  role?: string;
};

type Answer = {
  answer: string;
  tool: string;
  sources: string[];
  suggestedPrompts: string[];
  provider?: 'gemini' | 'deterministic-fallback';
};

type KnowledgeArticle = {
  terms: string[];
  answer: string;
  tool: string;
  suggestedPrompts?: string[];
};

const KNOWLEDGE: KnowledgeArticle[] = [
  {
    terms: ['what can this project do', 'what can this do', 'for clients', 'client value', 'customer value', 'business value', 'benefit'],
    tool: 'explainClientValue',
    answer: 'For clients, HR Intelligence reduces the time spent searching across HR conversations and systems. It turns incoming Intercom or email cases into structured topics, employee identity evidence, related history, store context, stakeholder guidance, and a traceable review snapshot. Teams keep working in Intercom while gaining faster context, safer matching, fewer duplicate-processing mistakes, and clearer human review.',
    suggestedPrompts: ['How does it reduce manual work?', 'Why does it integrate with Intercom?', 'How is sensitive HR data protected?']
  },
  {
    terms: ['what does the recruiter demo include', 'recruiter demo', 'demo session', 'demo include'],
    tool: 'getRecruiterDemoHelp',
    answer: 'The recruiter demo is a short-lived, read-only tour of the sanitized workspace. It includes Overview, case intelligence, employee and store context, related-case evidence, architecture, and reliability signals. It does not expose shared passwords, customer data, mutations, or administrator controls.',
    suggestedPrompts: ['How is HR data protected?', 'What can I inspect in a case?']
  },
  {
    terms: ['problem', 'before', 'manual', 'pain'],
    tool: 'getPlatformHelp',
    answer: 'Before HR Intelligence, operators had to read long conversations, identify the employee, search previous cases, determine store context, and find the right stakeholders manually. HR Intelligence centralizes those context-finding steps while Intercom remains the operator workspace.'
  },
  {
    terms: ['intercom', 'replace inbox', 'another system'],
    tool: 'getPlatformHelp',
    answer: 'HR Intelligence is an intelligence layer around Intercom, not a replacement inbox. It normalizes the conversation, adds identity, related-history, and routing context, then can write the result back beside the case so operators keep their existing workflow.'
  },
  {
    terms: ['identity', 'employee matching', 'match', 'alias', 'fuzzy'],
    tool: 'getPlatformHelp',
    answer: 'The deterministic identity engine uses evidence such as exact names, aliases, token matches, fuzzy matches, store context, and sender domain. Confidence and match method are preserved, and uncertain results can go to manual review. The assistant explains that evidence; it does not choose an employee.'
  },
  {
    terms: ['manual review', 'human review', 'uncertain'],
    tool: 'getPlatformHelp',
    answer: 'Manual review is a safety path for incomplete identity, store, or routing evidence. The system preserves the uncertainty and gives an operator a chance to confirm it instead of silently forcing a result.'
  },
  {
    terms: ['related case', 'history', 'previous conversation'],
    tool: 'getPlatformHelp',
    answer: 'Related-case retrieval brings relevant prior conversations into the current case context using the resolved employee, name variants, category, scope, and lookback window. This reduces repeated searching and makes the relationship inspectable.'
  },
  {
    terms: ['duplicate', 'idempot', 'retry'],
    tool: 'getPlatformHelp',
    answer: 'Inbound event identifiers and deterministic job handling protect against duplicate logical processing when providers retry delivery. The operations view exposes duplicate events prevented so the reliability behavior remains visible.'
  },
  {
    terms: ['outbox', 'queue dispatch', 'enqueue'],
    tool: 'getPlatformHelp',
    answer: 'The transactional outbox records pending delivery with the case transaction. If database persistence succeeds but queue dispatch fails, recovery can find and dispatch the pending outbox record instead of losing the work.'
  },
  {
    terms: ['gemini fail', 'ai unavailable', 'provider', 'fallback'],
    tool: 'getPlatformHelp',
    answer: 'Case processing has a deterministic fallback path and records processing state, errors, and review requirements. This assistant also has a deterministic knowledge fallback. Assistant availability must never be a dependency of Intercom, email, or demo case processing.'
  },
  {
    terms: ['how is ai quality measured', 'ai quality measured', 'ai quality', 'quality dashboard', 'evaluation dashboard', 'classification accuracy', 'employee precision', 'related case recall'],
    tool: 'getEvaluationHelp',
    answer: 'AI quality is measured with versioned, anonymized fixture cases rather than invented live-production claims. The evaluation view separates classification accuracy, employee-match precision, related-case recall, and safe manual-review behavior so each result can be inspected.',
    suggestedPrompts: ['Why is manual review important?', 'How does employee matching work?']
  },
  {
    terms: ['technology', 'stack', 'bullmq', 'postgres', 'redis', 'architecture'],
    tool: 'getPlatformHelp',
    answer: 'The platform uses a TypeScript/Express API, Next.js dashboard, PostgreSQL for durable case and directory state, BullMQ/Redis when distributed processing is enabled, Gemini for case extraction where configured, and Intercom Canvas/write-back for the operator experience.'
  },
  {
    terms: ['protect', 'security', 'sensitive', 'data', 'safe'],
    tool: 'getPlatformHelp',
    answer: 'The assistant is read-only, validates structured input, applies authentication and role checks before accessing case data, returns bounded fields, and never exposes tokens, raw provider payloads, SQL, shell access, or arbitrary browsing. Recruiter views use sanitized portfolio data.'
  },
  {
    terms: ['recruiter', 'inspect', 'demo'],
    tool: 'getPlatformHelp',
    answer: 'Recruiters can start with the public product story, then use their own read-only dashboard session to inspect cases, directory context, architecture, operations evidence when authorized, and fixture evaluation results. Intercom access is separately invitation-based and uses synthetic records.'
  }
];

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();
const hasAny = (text: string, terms: string[]): boolean => terms.some((term) => text.includes(term));
const isGreeting = (text: string): boolean => /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!. ,]*$/i.test(text);
const isThanks = (text: string): boolean => /^(thanks|thank you|thx|great|perfect)[!. ,]*$/i.test(text);

const findKnowledgeArticle = (text: string): KnowledgeArticle | null => {
  const matches = KNOWLEDGE
    .map((article, index) => ({
      article,
      index,
      score: article.terms.reduce((score, term) => score + (text.includes(term) ? (term.includes(' ') ? 3 : 1) : 0), 0)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return matches[0]?.article ?? null;
};

const knowledgeAnswer = (article: KnowledgeArticle): Answer => ({
  answer: article.answer,
  tool: article.tool,
  sources: ['product:knowledge'],
  suggestedPrompts: article.suggestedPrompts ?? ['What problem does HR Intelligence solve?', 'How is HR data protected?']
});

const withNaturalLanguageAnswer = async (
  answer: Answer,
  question: string,
  context: AssistantContext
): Promise<Answer> => {
  const generated = await generateAssistantAnswer({
    question,
    deterministicAnswer: answer.answer,
    route: context.route,
    role: context.role
  });
  return generated ? { ...answer, answer: generated, provider: 'gemini' } : { ...answer, provider: 'deterministic-fallback' };
};

const safeCase = (row: NonNullable<Awaited<ReturnType<typeof conversationRepository.findById>>>) => {
  const snapshot = (row.intelligenceSnapshot ?? {}) as IntelligenceSnapshot;
  const match = snapshot.employeeMatches?.[0];
  return {
    id: row.id,
    subject: row.subject,
    source: row.source ?? 'intercom',
    status: row.intelligenceStatus,
    category: row.caseType,
    employee: match?.canonicalName ?? snapshot.unresolvedEmployeeMention ?? null,
    matchMethod: match?.matchMethod ?? null,
    confidence: match?.confidenceScore ?? snapshot.employeeMatchConfidence ?? null,
    mentionStatus: snapshot.employeeMentionStatus ?? null,
    relatedCaseCount: (snapshot.relatedCases?.length ?? 0) + (snapshot.fuzzyRelatedCases?.length ?? 0),
    stakeholderCount: snapshot.ccRecipients?.recipients?.length ?? 0,
    requiresManualReview: snapshot.requiresManualReview ?? false,
    processedAt: snapshot.processedAt ?? null
  };
};

const requireEntityId = (context: AssistantContext): number => {
  if (!context.entityId || !Number.isInteger(context.entityId) || context.entityId < 1) {
    throw AppError.badRequest('A valid case ID is required for this assistant action');
  }
  return context.entityId;
};

const caseAnswer = async (message: string, context: AssistantContext): Promise<Answer | null> => {
  if (!hasAny(message, ['case', 'match', 'related', 'routing', 'stakeholder', 'summarize', 'summary'])) {
    return null;
  }
  if (!context.role) throw AppError.unauthorized('Sign in to inspect case context');
  if (!['admin', 'viewer'].includes(context.role)) throw AppError.forbidden('Case assistant tools require reviewer access');
  const row = await conversationRepository.findById(requireEntityId(context));
  if (!row) throw AppError.notFound('Case not found');
  const snapshot = (row.intelligenceSnapshot ?? {}) as IntelligenceSnapshot;
  const match = snapshot.employeeMatches?.[0];
  const related = [...(snapshot.relatedCases ?? []), ...(snapshot.fuzzyRelatedCases ?? [])];
  if (hasAny(message, ['match', 'identity', 'employee'])) {
    const evidence = [
      match?.matchMethod ? `match method: ${match.matchMethod}` : null,
      match?.confidenceScore != null ? `confidence: ${match.confidenceScore}` : null,
      snapshot.employeeMentionStatus ? `mention status: ${snapshot.employeeMentionStatus}` : null,
      snapshot.employeeSearchPath ? `directory search path: ${snapshot.employeeSearchPath}` : null,
      snapshot.requiresManualReview ? 'manual review: required' : 'manual review: not required'
    ].filter(Boolean).join('; ');
    return { answer: `The deterministic identity result for case ${row.id} is ${match?.canonicalName ?? snapshot.unresolvedEmployeeMention ?? 'unresolved'}. ${evidence || 'No identity evidence was persisted for this case.'} The assistant explains the stored result; it cannot change the employee match.`, tool: 'explainEmployeeMatch', sources: [`case:${row.id}`], suggestedPrompts: ['Why are these cases related?', 'Summarize this case'] };
  }
  if (hasAny(message, ['related', 'history'])) {
    const relationship = related.slice(0, 8).map((item) => item.subject ?? `case ${item.conversationId}`).join(', ');
    return { answer: related.length ? `Case ${row.id} has ${related.length} stored related case${related.length === 1 ? '' : 's'}${relationship ? `: ${relationship}.` : '.'} The persisted relationship uses the deterministic employee/name/category and time-scope retrieval results.` : `No related cases are stored for case ${row.id}.`, tool: 'getRelatedCases', sources: [`case:${row.id}`], suggestedPrompts: ['Explain employee match', 'Explain routing'] };
  }
  if (hasAny(message, ['routing', 'stakeholder'])) {
    const recipients = snapshot.ccRecipients?.recipients ?? [];
    const names = recipients.slice(0, 8).map((recipient) => `${recipient.name} (${recipient.role})`).join(', ');
    return { answer: recipients.length ? `The stored routing context recommends ${names}. It is based on the persisted store/company directory result; the assistant does not invent or send stakeholder messages.` : 'No stakeholder recommendation is stored for this case. Check whether store context was available and whether the case needs review.', tool: 'getStakeholderContext', sources: [`case:${row.id}`], suggestedPrompts: ['Summarize this case', 'What requires attention?'] };
  }
  const item = safeCase(row);
  return { answer: `Case ${item.id}: ${item.subject ?? 'Untitled case'}. Category ${item.category ?? 'not classified'}; employee ${item.employee ?? 'unresolved'}; status ${item.status}; ${item.relatedCaseCount} related case${item.relatedCaseCount === 1 ? '' : 's'}; ${item.requiresManualReview ? 'manual review is required' : 'no manual review flag is stored'}.`, tool: 'getCaseSummary', sources: [`case:${row.id}`], suggestedPrompts: ['Explain employee match', 'Why are these cases related?', 'Explain routing'] };
};

export const assistantService = {
  async answer(message: string, context: AssistantContext): Promise<Answer> {
    const normalized = normalize(message);
    if (!normalized) throw AppError.badRequest('Ask a question to continue');

    if (isGreeting(normalized)) {
      return {
        answer: 'Hi — I’m the HR Intelligence assistant. I can explain the product, recruiter demo, identity matching, related cases, Intercom workflow, reliability, security, or evaluation approach. What would you like to explore?',
        tool: 'conversationGreeting',
        sources: ['product:knowledge'],
        suggestedPrompts: ['What problem does HR Intelligence solve?', 'What does the recruiter demo include?', 'How is HR data protected?']
      };
    }

    if (isThanks(normalized)) {
      return {
        answer: 'You’re welcome. Ask me about a product capability, a case explanation, the recruiter demo, or the system architecture whenever you’re ready.',
        tool: 'conversationCourtesy',
        sources: ['product:knowledge'],
        suggestedPrompts: ['How does employee matching work?', 'Why use a transactional outbox?', 'What can I inspect in the demo?']
      };
    }

    const contextual = context.entityId ? await caseAnswer(normalized, context) : null;
    if (contextual) return contextual;

    if (hasAny(normalized, ['search', 'show', 'find', 'attendance', 'conduct', 'payroll', 'leave']) || normalized.includes('which cases') || normalized.includes('need review')) {
      if (!context.role) throw AppError.unauthorized('Sign in to search case data');
      const category = ['attendance', 'conduct', 'payroll', 'leave'].find((value) => normalized.includes(value));
      const query = category;
      const result = await conversationRepository.listCases({ query, limit: 8, offset: 0 });
      const reviewOnly = hasAny(normalized, ['manual review', 'need review', 'needs review']);
      const rows = reviewOnly ? result.rows.filter((row) => (row.intelligenceSnapshot as IntelligenceSnapshot | null)?.requiresManualReview === true) : result.rows;
      return { answer: rows.length ? `Found ${reviewOnly ? rows.length : result.total} authorized case${rows.length === 1 ? '' : 's'}. Showing ${rows.length}: ${rows.map((row) => `${row.id} — ${row.subject ?? 'Untitled'}`).join('; ')}.` : 'No authorized cases matched that request. Try a category, employee name, or manual-review question.', tool: 'searchCases', sources: ['cases:list'], suggestedPrompts: ['Which cases need review?', 'Summarize this workspace'] };
    }

    if (hasAny(normalized, ['workspace', 'metric', 'overview', 'attention'])) {
      if (!context.role) throw AppError.unauthorized('Sign in to inspect workspace metrics');
      const [counts, duplicates, pendingOutbox, manualReview, related, matched] = await Promise.all([
        conversationRepository.countByIntelligenceStatus(),
        ingestionRepository.countDuplicatesPrevented(),
        ingestionRepository.countPendingOutbox(),
        conversationRepository.countRequiresManualReview(),
        conversationRepository.countCasesWithRelated(),
        conversationRepository.countMatchedEmployeeCases()
      ]);
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return { answer: `This workspace has ${total} processed case records, ${matched} with an employee match, ${related} with related history, and ${manualReview} flagged for manual review. Reliability evidence includes ${duplicates} duplicate events prevented and ${pendingOutbox} pending outbox records. These are live environment counts, not fabricated trends.`, tool: 'getWorkspaceSummary', sources: ['cases:overview'], suggestedPrompts: ['What requires attention?', 'Explain these metrics'] };
    }

    if (context.route.startsWith('/operations') && hasAny(normalized, ['operation', 'redis', 'postgres', 'failed job', 'waiting', 'recovery'])) {
      if (context.role !== 'admin') throw AppError.forbidden('Operations assistant tools require administrator access');
      const [counts, pendingOutbox, duplicates] = await Promise.all([
        conversationRepository.countByIntelligenceStatus(),
        ingestionRepository.countPendingOutbox(),
        ingestionRepository.countDuplicatesPrevented()
      ]);
      return { answer: `The authorized operations summary shows ${counts.pending ?? 0} pending, ${counts.processing ?? 0} processing, and ${counts.failed ?? 0} failed case records; ${pendingOutbox} outbox records await dispatch and ${duplicates} duplicate events have been prevented. Queue and readiness details remain available on the Operations page.`, tool: 'getOperationsSummary', sources: ['operations:summary'], suggestedPrompts: ['How does outbox recovery work?', 'What is failing?'] };
    }

    if (context.route.startsWith('/evaluation') && hasAny(normalized, ['evaluation', 'accuracy', 'precision', 'recall', 'fixture', 'quality'])) {
      if (context.role !== 'admin') throw AppError.forbidden('Evaluation assistant tools require administrator access');
      const metrics = runEvaluation();
      return { answer: `This is fixture evaluation, separate from live production quality: ${metrics.datasetSize} anonymized cases, ${Math.round(metrics.classificationAccuracy * 100)}% classification accuracy, ${Math.round(metrics.employeeMatchPrecision * 100)}% employee precision, and ${Math.round(metrics.relatedCaseRecall * 100)}% related-case recall. Investigate individual fixture outcomes on AI Quality.`, tool: 'getEvaluationSummary', sources: ['evaluation:fixture'], suggestedPrompts: ['Which fixture cases failed?', 'Explain classification accuracy'] };
    }

    if (hasAny(normalized, ['directory', 'store', 'people'])) {
      if (!context.role) throw AppError.unauthorized('Sign in to inspect directory context');
      const [employeeCount, storeCount, companyCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(employeeIdentities),
        db.select({ count: sql<number>`count(*)::int` }).from(storeDirectory),
        db.select({ count: sql<number>`count(*)::int` }).from(companies)
      ]);
      return { answer: `The authorized directory contains ${employeeCount[0]?.count ?? 0} employee identities, ${storeCount[0]?.count ?? 0} store records, and ${companyCount[0]?.count ?? 0} companies. Case routing uses this context to surface store and stakeholder evidence; it does not silently force uncertain identity matches.`, tool: 'getDirectorySummary', sources: ['directory:summary'], suggestedPrompts: ['Explain employee identity', 'Explain store routing'] };
    }

    const article = findKnowledgeArticle(normalized);
    if (article) return withNaturalLanguageAnswer(knowledgeAnswer(article), normalized, context);
    return withNaturalLanguageAnswer({
      answer: 'I can help with HR Intelligence product questions, but I’m not sure what you mean yet. Try asking about the recruiter demo, employee matching, related cases, Intercom, security, reliability, or AI quality.',
      tool: 'clarifyQuestion',
      sources: ['product:knowledge'],
      suggestedPrompts: ['What does the recruiter demo include?', 'How does employee matching work?', 'Why does it integrate with Intercom?']
    }, normalized, context);
  }
};
