import { z } from 'zod';
import {
  INTERCOM_CASE_TYPE_SLUGS,
  INTERCOM_CASE_TYPES
} from '../../constants/intercom.constants.js';
import { geminiConfig } from '../../config/gemini.config.js';
import { logger } from '../../config/logger.config.js';
import { normalizeCaseTypeSlug } from '../conversation/case-type.util.js';
import {
  extractEmployeeNamesFromSubject,
  resolveSubjectEmployeeNames,
  sanitizeExtractedEmployeeNames
} from './employee.subject-name.util.js';
import { stripHtmlToText } from '../../utils/html.util.js';
import { isApplicationGeneratedContent } from '../intelligence/customer-conversation-content.util.js';

const employeeExtractionStatusSchema = z.enum([
  'EXPLICIT_NAME_FOUND',
  'NO_EMPLOYEE_MENTIONED',
  'AMBIGUOUS_EMPLOYEE',
  'INVALID_NAME'
]);

const extractionResponseSchema = z.object({
  names: z.array(z.string()).optional(),
  caseType: z.string().optional(),
  employee: z
    .object({
      name: z.string().nullable().optional(),
      evidence: z.string().nullable().optional(),
      status: employeeExtractionStatusSchema.optional(),
      confidence: z.number().optional()
    })
    .optional(),
  classification: z
    .object({
      category: z.string().optional(),
      confidence: z.number().optional()
    })
    .optional(),
  issueSummary: z.string().optional(),
  relatedCaseSearchTerms: z.array(z.string()).optional()
});

export type NameExtractionInput = {
  messageBodies: string[];
  subject?: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  processingMode?: 'live' | 'fixture';
};

export type NameExtractionResult = {
  names: string[];
  caseType: string | null;
  source: 'gemini' | 'fallback';
  employeeStatus?: z.infer<typeof employeeExtractionStatusSchema>;
  employeeConfidence?: number;
  issueSummary?: string;
  relatedCaseSearchTerms?: string[];
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const customerMessageBodies = (messageBodies: string[]): string[] =>
  messageBodies.filter((body) => !isApplicationGeneratedContent(body));

const buildCombinedText = (messageBodies: string[]): string =>
  customerMessageBodies(messageBodies)
    .map((body, index) => {
      const text = stripHtmlToText(body);
      if (!text) {
        return null;
      }

      return `--- Message ${index + 1} ---\n${text}`;
    })
    .filter((body): body is string => Boolean(body))
    .join('\n\n');

const parseGeminiResponse = (
  text: string
): {
  names: string[];
  caseType: string | null;
  employeeStatus?: NameExtractionResult['employeeStatus'];
  employeeConfidence?: number;
  issueSummary?: string;
  relatedCaseSearchTerms?: string[];
} => {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { names: [], caseType: null };
  }

  const parsed = extractionResponseSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) {
    return { names: [], caseType: null };
  }

  const nestedName = parsed.data.employee?.name?.trim();
  const nestedEvidence = parsed.data.employee?.evidence?.trim() ?? nestedName;
  const nestedStatus = parsed.data.employee?.status;
  const nestedNames =
    nestedStatus === 'EXPLICIT_NAME_FOUND' && nestedName && nestedEvidence
      ? [nestedName]
      : nestedStatus && nestedStatus !== 'EXPLICIT_NAME_FOUND'
        ? []
        : parsed.data.names ?? [];

  const names = sanitizeExtractedEmployeeNames(
    nestedNames.map((name) => name.trim()).filter((name) => name.length > 0)
  );

  const nestedCategory = parsed.data.classification?.category?.trim();
  const caseType = nestedCategory
    ? normalizeCaseTypeSlug(nestedCategory)
    : parsed.data.caseType?.trim()
      ? normalizeCaseTypeSlug(parsed.data.caseType)
      : null;

  return {
    names,
    caseType,
    employeeStatus: nestedStatus,
    employeeConfidence: parsed.data.employee?.confidence,
    issueSummary: parsed.data.issueSummary,
    relatedCaseSearchTerms: parsed.data.relatedCaseSearchTerms
  };
};

const isUsableGeminiCaseType = (caseType: string | null | undefined): boolean =>
  Boolean(caseType?.trim()) && normalizeCaseTypeSlug(caseType!) !== INTERCOM_CASE_TYPES.GENERAL;

const dedupeNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(name);
  }

  return result;
};

const shouldExcludeName = (
  name: string,
  reporterName: string | null,
  reporterEmail: string | null
): boolean => {
  const normalized = name.toLowerCase();
  const reporterNormalized = reporterName?.trim().toLowerCase() ?? '';

  if (reporterNormalized && (normalized === reporterNormalized || reporterNormalized.includes(normalized))) {
    return true;
  }

  if (reporterEmail) {
    const localPart = reporterEmail.split('@')[0]?.toLowerCase() ?? '';
    if (localPart && normalized.includes(localPart)) {
      return true;
    }
  }

  const botPatterns = ['hr bot', 'intercom', 'operator', 'fin bot'];
  return botPatterns.some((pattern) => normalized.includes(pattern));
};

const mergeExtractedNames = (
  primaryNames: string[],
  supplementalSubjectNames: string[],
  reporterName: string | null,
  reporterEmail: string | null
): string[] => {
  const filteredPrimary = primaryNames.filter(
    (name) => !shouldExcludeName(name, reporterName, reporterEmail)
  );

  // Subject-line employee names are authoritative — never drop them as "reporter".
  return dedupeNames([...filteredPrimary, ...supplementalSubjectNames]);
};

const GEMINI_RETRY_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [1000, 2000, 4000];
const GEMINI_REQUEST_TIMEOUT_MS = 20_000;

const isQuotaExhaustedError = (error: Error): boolean =>
  /Gemini API error 429|quota|depleted|credits are depleted/i.test(error.message);

const isRetryableGeminiError = (error: Error): boolean => {
  if (isQuotaExhaustedError(error)) {
    return false;
  }

  return (
    /Gemini API error (500|502|503|504)/.test(error.message) ||
    error.message === 'Gemini API returned empty response'
  );
};

const callGeminiApiWithRetry = async (prompt: string): Promise<string> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt++) {
    try {
      return await callGeminiApi(prompt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt === GEMINI_RETRY_ATTEMPTS;

      if (isLastAttempt || !isRetryableGeminiError(lastError)) {
        throw lastError;
      }

      logger.warn('[name-extraction] Retrying Gemini extraction', {
        attempt,
        error: lastError.message
      });

      const delay = GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? GEMINI_RETRY_DELAYS_MS.at(-1) ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Gemini extraction failed');
};

const callGeminiApi = async (prompt: string): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiConfig.model}:generateContent?key=${geminiConfig.apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      })
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error(`Gemini API timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API returned empty response');
  }

  return text;
};

const CASE_TYPE_GUIDANCE = `
Choose the single best caseType for this HR case from the text provided.

Preferred categories (use these when the topic clearly fits):
- attendance — late, tardy, no-show, absent, missed shift, clock-in/out, attendance policy, "late again", coming in late
- schedule — shift swaps, scheduling conflicts, availability, requested hour changes (not lateness; lateness is attendance)
- leave — FMLA, medical leave, parental leave, bereavement, extended leave of absence (not short PTO)
- vacation — PTO, vacation request, holiday time off, planned time away
- payroll — paycheck, wages, overtime, salary, missing pay, pay errors, timesheet pay issues
- benefits — health insurance, 401k, benefits enrollment and coverage questions
- injury — workplace injury, workers compensation / workers' comp claims, on-the-job injury
- accommodation — ADA, disability accommodation, reasonable accommodation requests
- termination — resignation, separation, exit interview, offboarding, fired/terminated
- onboarding — new hire setup, orientation, first-week / first-day issues
- transfer — store transfer, role change, moving locations or positions
- coaching — performance, productivity, work quality, PIP, coaching plans, skill gaps
- misconduct — harassment, sexual harassment, discrimination, violence, assault, theft, drug use at work (weed/marijuana/drugs), intoxicated on the job, serious policy violations, formal discipline investigations
- conduct — ethics, integrity, compliance, workplace behavior/professionalism, behaviour/behavior problems or issues (NOT lateness; lateness is attendance; NOT drugs/harassment — those are misconduct)
- escalation — urgent executive, legal, or PR escalation that needs immediate elevation
- policy — handbook questions, company policy clarification (not formal misconduct investigations)

Custom category (important):
- If the text has a clear HR / workplace topic that does NOT fit any preferred category above, invent your own short caseType slug.
- Custom slug rules: lowercase snake_case, 1-3 words, describe the topic (examples: dress_code, uniform, background_check, safety, equipment, parking, childcare).
- Do NOT force an unrelated preferred category just to stay on the list.
- Do NOT use general when there is a real topic — invent a custom slug instead.

general — ONLY if the text has no HR topic at all (for example only an employee name with no issue)

Consistency rules (critical):
- If the text mentions late, tardy, absent, no-show, or missing work → attendance
- "late again" / "late again today" → attendance
- Shift swap / availability / schedule change → schedule (not attendance)
- Harassment / "harasses" / assault / theft → misconduct
- Smoking weed, marijuana, drugs, intoxicated at work → misconduct
- Vague "behaviour/behavior problem", "behaviour issue", "conduct issue" (no harassment/violence/theft/drugs) → conduct
- Spelling / typos (critical): map clearly misspelled category words to the intended category. Examples:
  - attndance, atendance, attendence, attendace → attendance
  - behavoir, bhavior, behviour, behavour, beahvior → conduct (unless harassment/violence/theft/drugs → misconduct)
  - miscondut, misonduct → misconduct
  - payrol, payrole → payroll
  - schedual, shedule → schedule
  - vacaton, vaccation → vacation
  - termiantion, terminaton → termination
  - onbording, onbaording → onboarding
  - accomodation, acommodation → accommodation
  Infer the intended word from context; do not invent a custom slug just because of a typo.
- Prefer a preferred category when it clearly fits; otherwise invent a custom slug
- Prefer the main HR topic, not the employee name
- Do not return general when a clear HR topic is present
- Return exactly one slug`.trim();

const buildCaseTypeList = (): string =>
  INTERCOM_CASE_TYPE_SLUGS.filter((slug) => slug !== INTERCOM_CASE_TYPES.GENERAL).join(', ');

const CASE_TYPE_SLUG_INSTRUCTION = (): string =>
  `caseType is required. Prefer one of: ${buildCaseTypeList()}. If none fit the topic, invent a short snake_case slug yourself. Use general ONLY when there is no HR topic at all.`;

const buildReporterLines = (input: NameExtractionInput): string =>
  [
    input.reporterName ? `Reporter name (EXCLUDE from employee names): ${input.reporterName}` : null,
    input.reporterEmail ? `Reporter email (EXCLUDE): ${input.reporterEmail}` : null
  ]
    .filter(Boolean)
    .join('\n');

const buildSubjectLine = (subject: string | null | undefined): string =>
  subject?.trim() ? `Subject: ${subject.trim()}` : 'Subject: (none provided)';

const NAME_EXTRACTION_RULES = `
Employee name extraction — be precise. Wrong names create fake employee records.

YOUR JOB
Return only the real human employee(s) the case is about.
Ignore pronouns, verbs, substances, issue wording, store numbers, and filler.

CORE RULE (most important)
Find the HUMAN NAME in the subject, no matter where it sits.
Subject shape is unpredictable — dash, comma, "for", "regarding", no separator, name in the middle.
Position does NOT matter. Person vs non-person DOES.

Ask yourself: "If I told an HR advisor who this ticket is about, which person name would I say?"
Return only that person (First, or First Last). Everything else is description.

DECISION PROCESS (follow in order)
1. Read the full subject as one English phrase.
2. Identify every token that could be a real person name a human would put on a badge.
3. Drop every token that is an issue, action, substance, pronoun, role, or abstract topic.
4. Keep 1–2 word person names only. Prefer First Last when both are clearly the person.
5. Self-check before answering:
   - Would HR search this exact string as an employee? If no, remove it.
   - Did I return an issue phrase like "Illegal Activities", "Legal Notice", "Using Drugs"? If yes, remove it.
   - Did I glue a verb/issue onto a name ("Taylor Teasing", "Ahsan Using")? If yes, keep only the person part.
   - If unsure person vs issue, DROP it. Empty names is better than a fake employee.

COMMON SUBJECT SHAPES (same rule for all — find the human)
A) "[Person] - [issue]"
   "Marc Jones - illegal activities" → ["Marc Jones"] NOT ["Illegal Activities"]
   "ahsan - using drugs" → ["Ahsan"]
   "Harvey Spectre - legal notice" → ["Harvey Spectre"]
B) "[issue] - [Person]"
   "illegal activities - Marc Jones" → ["Marc Jones"]
   "Poor attendance - zubair" → ["Zubair"]
   "legal notice - Mark Wells" → ["Mark Wells"]
C) No dash — person then issue
   "Taylor teasing other employees" → ["Taylor"]
   "Katy Jones attendance issue" → ["Katy Jones"]
   "izaac is doing lot of smoking" → ["Izaac"]
D) Comma / for / regarding / about
   "Marc Jones, illegal activities" → ["Marc Jones"]
   "Attendance concern for Sara Patel" → ["Sara Patel"]
   "Warning regarding Ryan Burke" → ["Ryan Burke"]
E) Only a person name
   "Mark Sloan" → ["Mark Sloan"]
F) No person name
   "Attendance concern" / "Need help today" → []
G) Several people listed, then a topic
   "Tammy, Maureen, and Pam Request for Guidance ..." → ["Tammy"] NOT ["Pam Request"] / not all three
   "Taylor and Jordan fighting" → ["Taylor"]

HARD RULES
- NEVER return pronouns as names: he, she, they, him, her, his, theirs, them, this, that, these, those, someone, somebody.
- NEVER return verbs/actions as names or surnames: using, teasing, smoking, bullying, yelling, stealing, hitting, arguing, doing, late, etc.
- NEVER return issue/topic phrases as names: illegal activities, legal notice, criminal activity, attendance warning, drugs, weed, behavior, misconduct, harassment, payroll, leave, etc.
- NEVER return role/group words as names: employee, employees, staff, coworkers, manager, team, person, people.
- NEVER treat ticket labels or system codes as names: follow-up, reminder, update, planner, UI, HR.
- NEVER treat product/social notifications as names: "and 7 others", "recently added", "to their stories", "newly posted".
- Prefer exactly 1 name. If the subject lists several people ("Tammy, Maureen, and Pam ..."), return only the FIRST person.
- Names are 1-2 words (first, optional last). Do not return long descriptive phrases.
- NEVER glue a topic word onto a name: not "Pam Request", not "Taylor Teasing" — only the person.
- Typos/spellings: keep the person spelling from the subject (e.g. "Rayan burk" → "Rayan Burk", "izaac" → "Izaac").
- If unsure whether a token is a person vs an issue word, DROP it.

GOLDEN EXAMPLES
- "Marc Jones - illegal activities" → ["Marc Jones"] NOT ["Illegal Activities"]
- "illegal activities - Marc Jones" → ["Marc Jones"]
- "Marc Jones, illegal activities" → ["Marc Jones"]
- "he was so smoking these days - Rayan burk" → ["Rayan Burk"] NOT ["He"]
- "Taylor teasing other employees" → ["Taylor"] NOT ["Taylor Teasing"]
- "ahsan - using drugs" → ["Ahsan"] NOT ["Using"] / ["Ahsan Using"]
- "isaac - doing lot of smoking" → ["Isaac"] NOT ["Doing Lot"]
- "Attendance concern for Sara Patel" → ["Sara Patel"]
- "Harvey Spectre - legal notice" → ["Harvey Spectre"] NOT ["Legal Notice"]
- "Poor attendance - zubair" → ["Zubair"]
- "messi behavior issue" → ["Messi"]
- "Katy Jones attendance issue" → ["Katy Jones"]
- "Due 8/17/26 Cydney Person UI" → ["Cydney"] NOT ["Cydney Person"]
- "Follow-up - Planner for Management Progress Meeting" → [] NOT ["Follow-up"]
- "srecord1 and 7 others recently added to their stories" → [] NOT ["Recently Added"]
- "Tammy, Maureen, and Pam Request for Guidance on Team Communication and Conflict Resolution 7/29/26" → ["Tammy"] NOT ["Pam Request"]
- "weed smoked by the Watkins and this is issue now" → ["Watkins"] NOT ["Weed"]
- "Attendance issues with Ayesha today" → ["Ayesha"]
`.trim();

const buildSubjectOnlyPrompt = (input: NameExtractionInput): string => {
  return `You analyze HR support email conversations for an employee relations team.

${buildReporterLines(input)}
${buildSubjectLine(input.subject)}

Return JSON only:
{"names":["Full Name", ...], "caseType":"slug"}

IMPORTANT:
- HR uses the Subject line to define which employee this case is about.
- Message body text is intentionally omitted because it may still mention an outdated employee name.
- Extract employee names ONLY from the Subject line above.
- Follow the decision process below carefully. Prefer returning [] over a fake name.
${NAME_EXTRACTION_RULES}
- Parse messy subjects (typos, odd order, missing punctuation) using the same person-vs-issue logic.

${CASE_TYPE_GUIDANCE}

For caseType from the Subject only:
- If the subject includes a clear HR topic that fits a preferred category, return that category.
- If the subject has a clear topic that does not fit any preferred category, invent a short snake_case slug.
- If the subject is only a person name or otherwise has no HR topic, return "caseType":"general".

${CASE_TYPE_SLUG_INSTRUCTION()}`;
};

const buildMessagesOnlyCaseTypePrompt = (combinedText: string): string => {
  return `You classify the HR case category from conversation messages only.

Do NOT use a subject line. Classify only from the messages below.

Return JSON only:
{"caseType":"slug"}

${CASE_TYPE_GUIDANCE}

${CASE_TYPE_SLUG_INSTRUCTION()}

Conversation messages:
${combinedText}`;
};

const buildFullConversationPrompt = (
  input: NameExtractionInput,
  combinedText: string,
  messageCount: number
): string => {
  return `You analyze HR support email conversations for an employee relations team.

${buildReporterLines(input)}
${buildSubjectLine(input.subject)}

Return JSON only:
{"names":["Full Name", ...], "caseType":"slug"}

Employee names:
- Start with the Subject line. Read it as a full phrase and separate person vs issue/action.
${NAME_EXTRACTION_RULES}
- If the subject and messages disagree on who the case is about, trust the Subject.
- Then read all ${messageCount} message(s) for additional employee names not already in the subject.
- Use full names when visible in the text.
- Still never treat verbs, substances, or issue words from messages as employee names.

${CASE_TYPE_GUIDANCE}

${CASE_TYPE_SLUG_INSTRUCTION()}

Conversation messages:
${combinedText}`;
};

const extractNamesFromSubjectOnly = async (
  input: NameExtractionInput
): Promise<{
  names: string[];
  caseType: string | null;
  employeeStatus?: NameExtractionResult['employeeStatus'];
  employeeConfidence?: number;
  issueSummary?: string;
  relatedCaseSearchTerms?: string[];
}> => {
  if (!input.subject?.trim()) {
    return { names: [], caseType: null };
  }

  const responseText = await callGeminiApiWithRetry(buildSubjectOnlyPrompt(input));
  const parsed = parseGeminiResponse(responseText);

  return {
    ...parsed,
    names: parsed.names,
    employeeStatus:
      parsed.employeeStatus === 'AMBIGUOUS_EMPLOYEE' || parsed.employeeStatus === 'INVALID_NAME'
        ? parsed.employeeStatus
        : parsed.names.length > 0
          ? 'EXPLICIT_NAME_FOUND'
          : 'NO_EMPLOYEE_MENTIONED',
    employeeConfidence: parsed.names.length > 0 ? parsed.employeeConfidence : 0
  };
};

const extractCaseTypeFromMessagesOnly = async (
  input: NameExtractionInput
): Promise<string | null> => {
  const combinedText = buildCombinedText(input.messageBodies);
  if (!combinedText.trim()) {
    return null;
  }

  const responseText = await callGeminiApiWithRetry(
    buildMessagesOnlyCaseTypePrompt(combinedText)
  );
  return parseGeminiResponse(responseText).caseType;
};

const extractNamesFromFullConversation = async (
  input: NameExtractionInput
): Promise<{ names: string[]; caseType: string | null }> => {
  const messageTexts = input.messageBodies
    .map((body) => stripHtmlToText(body))
    .filter((body) => body.length > 0);
  const combinedText = buildCombinedText(input.messageBodies);

  if (!combinedText || messageTexts.length === 0) {
    throw new Error('No message text available for Gemini name extraction');
  }

  const responseText = await callGeminiApiWithRetry(
    buildFullConversationPrompt(input, combinedText, messageTexts.length)
  );
  return parseGeminiResponse(responseText);
};

const buildSubjectAuthoritativeNames = (
  input: NameExtractionInput,
  geminiSubjectNames: string[]
): string[] => resolveSubjectEmployeeNames(input.subject, geminiSubjectNames);

const resolveCaseTypeWithMessageFallback = async (
  input: NameExtractionInput,
  subjectCaseType: string | null
): Promise<string | null> => {
  if (isUsableGeminiCaseType(subjectCaseType)) {
    return subjectCaseType;
  }

  try {
    const fromMessages = await extractCaseTypeFromMessagesOnly(input);
    if (isUsableGeminiCaseType(fromMessages)) {
      logger.info('[name-extraction] Case type taken from conversation messages', {
        subject: input.subject,
        subjectCaseType,
        messageCaseType: fromMessages
      });
      return fromMessages;
    }
  } catch (error) {
    logger.warn('[name-extraction] Messages-only case type failed', {
      subject: input.subject,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return subjectCaseType;
};

export const employeeNameExtractionService = {
  async extract(input: NameExtractionInput): Promise<NameExtractionResult> {
    input = {
      ...input,
      messageBodies: customerMessageBodies(input.messageBodies)
    };
    const manualSubjectNames = extractEmployeeNamesFromSubject(input.subject);

    if (input.processingMode === 'fixture') {
      const names = mergeExtractedNames(
        [],
        manualSubjectNames,
        input.reporterName,
        input.reporterEmail
      );
      const fromSubject = input.subject ? normalizeCaseTypeSlug(input.subject) : null;
      return {
        names,
        caseType: fromSubject && fromSubject.length > 2 ? fromSubject : 'attendance',
        source: 'fallback'
      };
    }

    if (!geminiConfig.apiKey) {
      if (manualSubjectNames.length > 0 || input.subject?.trim()) {
        return {
          names: mergeExtractedNames(
            [],
            manualSubjectNames,
            input.reporterName,
            input.reporterEmail
          ),
          caseType: null,
          source: 'fallback'
        };
      }

      throw new Error('GEMINI_API_KEY is not configured');
    }

    if (input.subject?.trim()) {
      try {
        const subjectParsed = await extractNamesFromSubjectOnly(input);
        const namesFromSubject = buildSubjectAuthoritativeNames(input, subjectParsed.names);
        const caseType = await resolveCaseTypeWithMessageFallback(
          input,
          subjectParsed.caseType
        );

        logger.info('[name-extraction] Using subject-authoritative employee names', {
          subject: input.subject,
          geminiSubjectNameCount: subjectParsed.names.length,
          manualSubjectNameCount: manualSubjectNames.length,
          names: namesFromSubject,
          subjectCaseType: subjectParsed.caseType,
          caseType
        });

        return {
          names: namesFromSubject,
          caseType,
          source: 'gemini',
          employeeStatus:
            namesFromSubject.length > 0
              ? 'EXPLICIT_NAME_FOUND'
              : subjectParsed.employeeStatus === 'AMBIGUOUS_EMPLOYEE'
                ? 'AMBIGUOUS_EMPLOYEE'
                : 'NO_EMPLOYEE_MENTIONED',
          employeeConfidence: namesFromSubject.length > 0 ? subjectParsed.employeeConfidence : 0,
          issueSummary: subjectParsed.issueSummary,
          relatedCaseSearchTerms: subjectParsed.relatedCaseSearchTerms ?? []
        };
      } catch (error) {
        const fallbackNames = mergeExtractedNames(
          [],
          manualSubjectNames,
          input.reporterName,
          input.reporterEmail
        );

        logger.warn('[name-extraction] Subject-only Gemini failed — using subject names only', {
          subject: input.subject,
          names: fallbackNames,
          error: error instanceof Error ? error.message : String(error)
        });

        const caseType = await resolveCaseTypeWithMessageFallback(input, null);
        return {
          names: fallbackNames,
          caseType,
          source: fallbackNames.length > 0 && !caseType ? 'fallback' : 'gemini',
          employeeStatus: fallbackNames.length > 0 ? 'EXPLICIT_NAME_FOUND' : 'NO_EMPLOYEE_MENTIONED',
          employeeConfidence: 0,
          relatedCaseSearchTerms: []
        };
      }
    }

    try {
      const parsed = await extractNamesFromFullConversation(input);
      const names = mergeExtractedNames(
        parsed.names,
        manualSubjectNames,
        input.reporterName,
        input.reporterEmail
      );
      const caseType = isUsableGeminiCaseType(parsed.caseType)
        ? parsed.caseType
        : await resolveCaseTypeWithMessageFallback(input, parsed.caseType);

      logger.info('[name-extraction] Gemini extraction complete', {
        geminiNameCount: parsed.names.length,
        supplementalSubjectNameCount: manualSubjectNames.length,
        filteredNameCount: names.length,
        names,
        caseType
      });

      return { names, caseType, source: 'gemini' };
    } catch (error) {
      logger.error('[name-extraction] Gemini extraction failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      const fallbackNames = mergeExtractedNames(
        [],
        manualSubjectNames,
        input.reporterName,
        input.reporterEmail
      );

      if (fallbackNames.length > 0) {
        logger.warn('[name-extraction] Using subject-line names after Gemini failure', {
          names: fallbackNames
        });

        return { names: fallbackNames, caseType: null, source: 'fallback' };
      }

      throw error;
    }
  }
};
