import { INTERCOM_CASE_TYPE_KEYWORDS } from '../../constants/intercom.constants.js';
import {
  subjectHasNoPersonToken,
  validateEmployeeMention
} from './employee.mention-validation.util.js';

/**
 * Small closed set of pronouns / verbs / HR filler.
 * Topic nouns are also caught by morphology below so we do not need every issue word here.
 */
const SUBJECT_CASE_STOP_WORDS = new Set([
  'a',
  'am',
  'an',
  'and',
  'absent',
  'absenteeism',
  'again',
  'allegation',
  'allegations',
  'are',
  'arguing',
  'associate',
  'attendance',
  'at',
  'bad',
  'be',
  'been',
  'beer',
  'behavior',
  'behavioral',
  'behaviour',
  'behavioural',
  'being',
  'benefits',
  'bullying',
  'bully',
  'case',
  'coaching',
  'complaint',
  'complaints',
  'concern',
  'concerns',
  'conduct',
  'counsel',
  'coworker',
  'coworkers',
  'crime',
  'crimes',
  'criminal',
  'day',
  'days',
  'did',
  'disciplinary',
  'discipline',
  'discrimination',
  'do',
  'does',
  'doing',
  'done',
  'drank',
  'drink',
  'drinking',
  'drug',
  'drugs',
  'drunk',
  'due',
  'employee',
  'employees',
  'escalation',
  'ethics',
  'fmla',
  'follow',
  'following',
  'followup',
  'for',
  'formal',
  'found',
  'from',
  'getting',
  'guidance',
  'had',
  'harassment',
  'harrasment',
  'harrassment',
  'harasses',
  'harass',
  'has',
  'have',
  'he',
  'her',
  'hers',
  'him',
  'his',
  'hitting',
  'illegal',
  'in',
  'integrity',
  'investigation',
  'is',
  'issue',
  'issues',
  'late',
  'leave',
  'legal',
  'letter',
  'lawsuit',
  'lot',
  'lots',
  'many',
  'memo',
  'misconduct',
  'much',
  'notice',
  'not',
  'of',
  'office',
  'onboarding',
  'other',
  'others',
  'out',
  'payroll',
  'people',
  'person',
  'performance',
  'pip',
  'planner',
  'poor',
  'pto',
  'really',
  'record',
  'regarding',
  'reminder',
  'reprimand',
  'request',
  'resignation',
  'salary',
  'selling',
  'separation',
  'serious',
  'she',
  'showing',
  'smoking',
  'so',
  'somebody',
  'someone',
  'staff',
  'stealing',
  'tardiness',
  'tease',
  'teased',
  'teasing',
  'termination',
  'the',
  'their',
  'them',
  'these',
  'they',
  'this',
  'those',
  'today',
  'update',
  'up',
  'urgent',
  'use',
  'used',
  'using',
  'vacation',
  'very',
  'violation',
  'warning',
  'wages',
  'wrong',
  'was',
  'weed',
  'were',
  'with',
  'work',
  'workplace',
  'writeup',
  'yelling',
  'activity',
  'activities'
]);

/** First words that usually start an action/issue phrase, not a person name. */
const ACTION_PHRASE_STARTERS = new Set([
  'doing',
  'done',
  'using',
  'smoking',
  'drinking',
  'teasing',
  'being',
  'getting',
  'showing',
  'following',
  'was',
  'is',
  'are',
  'has',
  'have',
  'had',
  'not',
  'no',
  'poor',
  'late',
  'about',
  'regarding',
  'request',
  'illegal',
  'criminal'
]);

const BLOCKED_NAME_PHRASES = new Set([
  'done wrong',
  'work done',
  'legal notice',
  'legal issue',
  'legal warning',
  'illegal activities',
  'illegal activity',
  'criminal activities',
  'criminal activity',
  'harassment concern',
  'harassment concerns',
  'harrasment concern',
  'harrasment concerns',
  'harrasment warning',
  'harassment warning',
  'attendance issue',
  'attendance warning',
  'behaviour concern',
  'behavior concern',
  'conduct issue',
  'performance concern',
  'performance concerns',
  'follow-up',
  'follow up',
  'person ui'
]);

/**
 * Abstract / process nouns that are almost never surnames.
 * Catches brand-new issue phrases without listing every topic word.
 */
const TOPIC_MORPHOLOGY =
  /^(?:.+?(?:tions?|sions?|ments?|ances?|ences?|ivities?|nesses?|ings?)|issues?|concerns?|warnings?|violations?|complaints?|activities?|crimes?|drugs?|records?)$/i;

/** Short codes that sit after a name in subjects (Cydney Person UI). */
const SHORT_LABEL_CODES = new Set(['ui', 'hr', 'it']);

const MAX_NAME_WORDS = 2;

/** Separators that often split person vs issue in HR subjects. Never split inside Follow-up. */
const SUBJECT_SEPARATOR =
  /(?:\s+[-–—]\s+|,(?=\s)|(?:\s+for\s+)|(?:\s+regarding\s+)|(?:\s+about\s+))/i;

const CASE_STOP_WORDS = (() => {
  const words = new Set(SUBJECT_CASE_STOP_WORDS);

  for (const keywords of Object.values(INTERCOM_CASE_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      const normalized = keyword.trim().toLowerCase();
      if (normalized) {
        BLOCKED_NAME_PHRASES.add(normalized);
      }

      for (const part of normalized.split(/\s+/)) {
        if (part.length >= 2) {
          words.add(part);
        }
      }
    }
  }

  return words;
})();

const splitSubjectWords = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((word) => word.replace(/^[-–—,:;]+|[-–—,:;]+$/g, '').trim())
    .filter(Boolean)
    .filter((word) => !/^[-–—]+$/.test(word));

const normalizePhrase = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const isCaseStopWord = (word: string): boolean => CASE_STOP_WORDS.has(word.toLowerCase());

const isShortLabelCode = (word: string): boolean => SHORT_LABEL_CODES.has(word.toLowerCase());

const isDateOrNumericToken = (word: string): boolean => /\d/.test(word);

/** Follow-up / write-up / check-in — process labels, not surnames. */
const isHyphenatedProcessLabel = (word: string): boolean => {
  const parts = word
    .toLowerCase()
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return false;
  }

  if (parts.some((part) => part === 'up' || part === 'in')) {
    return true;
  }

  return parts.some(
    (part) => isCaseStopWord(part) || ACTION_PHRASE_STARTERS.has(part) || isShortLabelCode(part)
  );
};

/** Short given names that really end in -ly — do not treat these as English adverbs. */
const GIVEN_NAMES_ENDING_LY = new Set([
  'ashly',
  'beverly',
  'billy',
  'carly',
  'emily',
  'holly',
  'kelly',
  'kimberly',
  'lilly',
  'lily',
  'molly',
  'polly',
  'sally',
  'tilly',
  'willy'
]);

/** Western given names ending in -ed that are people, not verbs. */
const GIVEN_NAMES_ENDING_ED = new Set(['alfred', 'jared', 'mildred']);

/** True for recently/currently/newly — not Emily/Kelly. */
const isAdverbLyWord = (word: string): boolean => {
  const lower = word.toLowerCase();
  return lower.endsWith('ly') && lower.length >= 5 && !GIVEN_NAMES_ENDING_LY.has(lower);
};

/**
 * True for added/posted/shared/hired — not Ahmed/Saeed/Alfred.
 * New English event verbs keep matching this shape without a growing junk list.
 */
const isEnglishEventVerbWord = (word: string): boolean => {
  const lower = word.toLowerCase();
  if (lower.length < 5 || !lower.endsWith('ed')) {
    return false;
  }

  if (GIVEN_NAMES_ENDING_ED.has(lower)) {
    return false;
  }

  // Ahmed, Hamed, Saeed, Waleed, Rasheed — common person names in this workspace.
  return !/(?:aeed|eed|med|hed)$/.test(lower);
};

/** Instagram/Slack-style subjects: "handle and 7 others recently added to their stories". */
const looksLikeNotificationOrEventSubject = (subject: string): boolean => {
  const lower = subject.toLowerCase();
  if (/\band\s+\d+\s+others\b/.test(lower)) {
    return true;
  }

  if (/\bto their\s+[a-z]{3,}\b/.test(lower)) {
    return true;
  }

  const adverbVerb = lower.match(/\b([a-z]+ly)\s+([a-z]+ed)\b/);
  const adverb = adverbVerb?.[1];
  const verb = adverbVerb?.[2];
  return Boolean(adverb && verb && isAdverbLyWord(adverb) && isEnglishEventVerbWord(verb));
};
const isTopicMorphologyWord = (word: string): boolean => {
  const lower = word.toLowerCase();
  if (
    isCaseStopWord(lower) ||
    ACTION_PHRASE_STARTERS.has(lower) ||
    isShortLabelCode(lower) ||
    isHyphenatedProcessLabel(word) ||
    isAdverbLyWord(word) ||
    isEnglishEventVerbWord(word)
  ) {
    return true;
  }

  return TOPIC_MORPHOLOGY.test(lower);
};

const isSkippableLeadingToken = (word: string): boolean =>
  isDateOrNumericToken(word) || isTopicMorphologyWord(word) || isCaseStopWord(word);

const isIssueOnlyPhrase = (phrase: string): boolean => {
  const normalized = normalizePhrase(phrase);
  if (!normalized) {
    return true;
  }

  if (BLOCKED_NAME_PHRASES.has(normalized)) {
    return true;
  }

  const words = splitSubjectWords(phrase);
  if (words.length === 0) {
    return true;
  }

  return words.every((word) => isTopicMorphologyWord(word));
};

/** True for phrases like "doing lot of smoking", "was drinking beer", "using drugs". */
const looksLikeActionOrIssuePhrase = (phrase: string): boolean => {
  if (isIssueOnlyPhrase(phrase)) {
    return true;
  }

  const words = splitSubjectWords(phrase);
  if (words.length === 0) {
    return true;
  }

  const first = words[0]?.toLowerCase() ?? '';
  if (ACTION_PHRASE_STARTERS.has(first)) {
    return true;
  }

  const topicCount = words.filter((word) => isTopicMorphologyWord(word)).length;
  return topicCount / words.length >= 0.5;
};

const toTitleCaseWords = (value: string): string =>
  splitSubjectWords(value)
    .map((word) =>
      word
        .split(/(['’-])/)
        .map((part) =>
          part === "'" || part === '’' || part === '-'
            ? part
            : part
              ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
              : part
        )
        .join('')
    )
    .join(' ');

/**
 * Lightweight person check — protects real names, rejects topic phrases.
 * Fast: no API, no dictionaries beyond morphology + small stop sets.
 */
export const looksLikePersonNameFragment = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return false;
  }

  if (!/^[\p{L}\s'.-]+$/u.test(trimmed)) {
    return false;
  }

  const words = splitSubjectWords(trimmed);
  if (words.length === 0 || words.length > MAX_NAME_WORDS) {
    return false;
  }

  if (isIssueOnlyPhrase(trimmed) || looksLikeActionOrIssuePhrase(trimmed)) {
    return false;
  }

  // At least one word must look like a name token (not topic morphology).
  const nameLikeWords = words.filter((word) => !isTopicMorphologyWord(word));
  return nameLikeWords.length > 0;
};

/**
 * Strip HR case-type tail words Gemini sometimes includes (e.g. "Messi Behavior Issue" → "Messi").
 */
export const sanitizeExtractedEmployeeName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed || isIssueOnlyPhrase(trimmed)) {
    return '';
  }

  const words = splitSubjectWords(trimmed);
  const nameWords: string[] = [];

  for (const word of words) {
    if (isSkippableLeadingToken(word)) {
      if (nameWords.length === 0) {
        continue;
      }
      break;
    }

    if (nameWords.length >= MAX_NAME_WORDS) {
      break;
    }

    nameWords.push(word);
  }

  while (
    nameWords.length > 0 &&
    (isTopicMorphologyWord(nameWords[nameWords.length - 1] ?? '') ||
      isCaseStopWord(nameWords[nameWords.length - 1] ?? ''))
  ) {
    nameWords.pop();
  }

  if (nameWords.length === 0) {
    return '';
  }

  const candidate = toTitleCaseWords(nameWords.join(' '));
  return looksLikePersonNameFragment(candidate) ? candidate : '';
};

export const sanitizeExtractedEmployeeNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const sanitized = sanitizeExtractedEmployeeName(name);
    if (!sanitized) {
      continue;
    }

    const key = sanitized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(sanitized);
  }

  return result;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the candidate is actually written in the subject (not invented from the body). */
const nameAppearsInSubject = (name: string, subject: string): boolean => {
  const subjectLower = subject.toLowerCase();
  const nameLower = name.trim().toLowerCase();
  if (!nameLower) {
    return false;
  }

  if (subjectLower.includes(nameLower)) {
    return true;
  }

  const tokens = nameLower.split(/[^\p{L}0-9]+/u).filter((token) => token.length >= 2);
  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}0-9])${escapeRegExp(token)}(?:[^\\p{L}0-9]|$)`,
      'iu'
    );
    return pattern.test(subject);
  });
};

/** Keep only extracted names that are actually written in the subject. Prevents creating a wrong employee. */
export const filterEmployeeNamesToSubject = (
  names: string[],
  subject: string | null | undefined
): string[] => {
  const trimmed = subject?.trim() ?? '';
  const cleaned = sanitizeExtractedEmployeeNames(names);
  if (!trimmed) {
    return cleaned;
  }

  if (looksLikeNotificationOrEventSubject(trimmed)) {
    return [];
  }

  return pickPrimarySubjectEmployeeName(
    cleaned.filter((name) => nameAppearsInSubject(name, trimmed)),
    trimmed
  );
};

/** One employee per case: first real person in the subject. Allows Pam or John Smith, never Pam Request. */
export const pickPrimarySubjectEmployeeName = (
  names: string[],
  subject: string | null | undefined
): string[] => {
  const trimmed = subject?.trim() ?? '';
  const cleaned = sanitizeExtractedEmployeeNames(names).filter(
    (name) => looksLikePersonNameFragment(name) && (!trimmed || nameAppearsInSubject(name, trimmed))
  );

  if (cleaned.length <= 1) {
    return cleaned;
  }

  const subjectLower = trimmed.toLowerCase();
  let best: { name: string; index: number } | null = null;
  for (const name of cleaned) {
    const index = subjectLower.indexOf(name.toLowerCase());
    if (index < 0) {
      continue;
    }

    if (!best || index < best.index) {
      best = { name, index };
    }
  }

  return best ? [best.name] : [cleaned[0]!];
};

const scorePersonCandidate = (name: string, subject: string): number => {
  const sanitized = sanitizeExtractedEmployeeName(name);
  if (!sanitized || !looksLikePersonNameFragment(sanitized)) {
    return -1;
  }

  let score = sanitized.split(/\s+/).length; // prefer First Last over single token when both valid
  if (nameAppearsInSubject(sanitized, subject)) {
    score += 5;
  }

  // Prefer candidates that are not dominated by topic morphology.
  if (!looksLikeActionOrIssuePhrase(sanitized)) {
    score += 2;
  }

  return score;
};

/**
 * Prefer Gemini person names when they look real; fall back to manual subject people.
 * Never keeps topic phrases. Fast sync merge — no extra API calls.
 */
export const resolveSubjectEmployeeNames = (
  subject: string | null | undefined,
  geminiNames: string[]
): string[] => {
  const trimmed = subject?.trim() ?? '';
  const geminiPeople = sanitizeExtractedEmployeeNames(geminiNames).filter(
    (name) =>
      looksLikePersonNameFragment(name) &&
      nameAppearsInSubject(name, trimmed) &&
      validateEmployeeMention({ subject: trimmed, name, evidence: name }).valid
  );
  const manualPeople = extractEmployeeNamesFromSubject(trimmed);

  if (geminiPeople.length === 0) {
    return pickPrimarySubjectEmployeeName(manualPeople, trimmed);
  }

  if (manualPeople.length === 0) {
    return pickPrimarySubjectEmployeeName(geminiPeople, trimmed);
  }

  const manualKeys = new Set(manualPeople.map((name) => name.toLowerCase()));
  const compatible = geminiPeople.filter((name) => {
    const lower = name.toLowerCase();
    if (manualKeys.has(lower)) {
      return true;
    }

    return manualPeople.some(
      (manual) =>
        lower.startsWith(`${manual.toLowerCase()} `) ||
        manual.toLowerCase().startsWith(`${lower} `)
    );
  });

  if (compatible.length > 0) {
    return pickPrimarySubjectEmployeeName([...compatible, ...manualPeople], trimmed);
  }

  // Disagreement: pick the first real person in the subject, not a later name glued to the topic.
  return pickPrimarySubjectEmployeeName([...geminiPeople, ...manualPeople], trimmed);
};

const parseNameAfterDash = (subject: string): string | null => {
  const dashParts = subject.split(/\s+[-–—]\s+/);
  if (dashParts.length < 2) {
    return null;
  }

  const head = dashParts[0]?.trim() ?? '';
  const tail = dashParts[dashParts.length - 1]?.trim() ?? '';
  if (!tail || looksLikeActionOrIssuePhrase(tail) || !looksLikePersonNameFragment(tail)) {
    return null;
  }

  // Prefer a clear person on the left over a weak/ambiguous right-side phrase.
  if (looksLikePersonNameFragment(head) && scorePersonCandidate(head, subject) >= scorePersonCandidate(tail, subject)) {
    return null;
  }

  // Left is issue / not a person → person is on the right.
  if (looksLikeActionOrIssuePhrase(head) || !looksLikePersonNameFragment(head)) {
    return sanitizeExtractedEmployeeName(tail) || null;
  }

  return null;
};

/**
 * "Isaac - doing lot of smoking" / "Marc Jones - illegal activities" — name left, issue right.
 */
const parseNameBeforeDash = (subject: string): string | null => {
  const dashParts = subject.split(/\s+[-–—]\s+/);
  if (dashParts.length < 2) {
    return null;
  }

  const head = dashParts[0]?.trim() ?? '';
  const tail = dashParts.slice(1).join(' - ').trim();
  const sanitizedHead = sanitizeExtractedEmployeeName(head);
  if (!sanitizedHead || looksLikeActionOrIssuePhrase(sanitizedHead) || !looksLikePersonNameFragment(sanitizedHead)) {
    return null;
  }

  // Right side is clearly a person and left is not stronger → let after-dash handle it.
  if (
    tail &&
    looksLikePersonNameFragment(tail) &&
    !looksLikeActionOrIssuePhrase(tail) &&
    scorePersonCandidate(tail, subject) > scorePersonCandidate(sanitizedHead, subject)
  ) {
    return null;
  }

  // Right side is issue/description, empty, or weaker → keep left-side person.
  return sanitizeExtractedEmployeeName(sanitizedHead) || null;
};

/** Name at the start of the subject before case-type words (e.g. "messi behavior issue"). */
const parseLeadingNameFromSubject = (subject: string): string | null => {
  const sanitized = sanitizeExtractedEmployeeName(subject);
  if (!sanitized) {
    return null;
  }

  const validated = validateEmployeeMention({
    subject,
    name: sanitized,
    evidence: sanitized
  });
  return validated.valid ? validated.normalizedName : null;
};

/**
 * Comma / "for" / "regarding" / "about" — pick the segment that looks most like a person.
 */
const parsePersonFromSeparatedSubject = (subject: string): string | null => {
  if (!SUBJECT_SEPARATOR.test(subject)) {
    return null;
  }

  const parts = subject
    .split(SUBJECT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const people: string[] = [];
  for (const part of parts) {
    const sanitized = sanitizeExtractedEmployeeName(part);
    if (!sanitized || scorePersonCandidate(sanitized, subject) < 0) {
      continue;
    }

    people.push(sanitized);
  }

  return pickPrimarySubjectEmployeeName(people, subject)[0] ?? null;
};

/**
 * Supplemental fallback when Gemini misses or returns a topic phrase.
 * Tries common subject shapes only — never invents a person from issue text.
 */
const keepValidatedSubjectNames = (names: string[], subject: string): string[] =>
  pickPrimarySubjectEmployeeName(
    names.filter(
      (name) =>
        validateEmployeeMention({
          subject,
          name,
          evidence: name
        }).valid
    ),
    subject
  );

export const extractEmployeeNamesFromSubject = (
  subject: string | null | undefined
): string[] => {
  const trimmed = subject?.trim();
  if (!trimmed) {
    return [];
  }

  if (looksLikeNotificationOrEventSubject(trimmed) || subjectHasNoPersonToken(trimmed)) {
    return [];
  }

  if (/\breported by\b/i.test(trimmed) && !/\b(for|concerning|regarding)\b/i.test(trimmed)) {
    return [];
  }

  if (/\bbetween\b.+\band\b/i.test(trimmed)) {
    return [];
  }

  const beforeDash = parseNameBeforeDash(trimmed);
  const afterDash = parseNameAfterDash(trimmed);
  if (beforeDash || afterDash) {
    return keepValidatedSubjectNames(
      [beforeDash, afterDash].filter((candidate): candidate is string => Boolean(candidate)),
      trimmed
    );
  }

  // "Follow-up - meeting title" has a dash but no person — do not pick random title words.
  if (/\s+[-–—]\s+/.test(trimmed)) {
    return [];
  }

  const separated = parsePersonFromSeparatedSubject(trimmed);
  if (separated) {
    return keepValidatedSubjectNames([separated], trimmed);
  }

  const leading = parseLeadingNameFromSubject(trimmed);
  const embedded = parseEmbeddedPersonFromSubject(trimmed);
  return keepValidatedSubjectNames(
    [leading, embedded].filter((candidate): candidate is string => Boolean(candidate)),
    trimmed
  );
};

const NAME_CUE_WORDS = new Set([
  'the',
  'by',
  'with',
  'for',
  'involving',
  'concerning',
  'regarding',
  'about',
  'of'
]);

/**
 * First name or surname sitting in the middle of a sentence:
 * "weed smoked by the Watkins" / "Attendance issues with Ayesha today".
 */
const parseEmbeddedPersonFromSubject = (subject: string): string | null => {
  const words = splitSubjectWords(subject);
  const candidates: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const previous = words[index - 1]?.toLowerCase() ?? '';
    const current = words[index] ?? '';
    const next = words[index + 1] ?? '';
    const twoWord = next ? sanitizeExtractedEmployeeName(`${current} ${next}`) : '';
    const oneWord = sanitizeExtractedEmployeeName(current);
    const twoWordCandidate =
      twoWord && splitSubjectWords(twoWord).length === 2 ? twoWord : '';
    const candidateOptions = [
      ...(twoWordCandidate ? [twoWordCandidate] : []),
      ...(oneWord && oneWord.toLowerCase() !== twoWordCandidate.toLowerCase() ? [oneWord] : [])
    ];

    for (const candidate of candidateOptions) {
      if (scorePersonCandidate(candidate, subject) < 0) {
        continue;
      }

      const originalSpan = candidate.includes(' ') ? `${current} ${next}` : current;
      const isCapitalized = /\p{Lu}/u.test(originalSpan);
      const afterCue = NAME_CUE_WORDS.has(previous);
      if (index > 0 && !isCapitalized && !afterCue) {
        continue;
      }

      if (
        !validateEmployeeMention({
          subject,
          name: candidate,
          evidence: candidate
        }).valid
      ) {
        continue;
      }

      candidates.push(candidate);
      if (candidate === twoWordCandidate) {
        index += 1;
      }
      break;
    }
  }

  return pickPrimarySubjectEmployeeName(candidates, subject)[0] ?? null;
};
