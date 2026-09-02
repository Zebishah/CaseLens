import { EMPLOYEE_MATCH_METHOD } from '../../constants/intelligence.constants.js';
import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { logger } from '../../config/logger.config.js';
import type {
  IntelligenceEmployeeMatch,
  IntelligenceNameVariant
} from '../../types/intelligence.types.js';
import { conversationEmployeesRepository } from '../conversation/conversation-employees.repository.js';
import { normalizeForMatch } from './employee.name.util.js';
import { similarityToConfidence } from './employee.matching.util.js';
import { scoreTokenNameMatch } from './employee.token-match.util.js';
import { employeeRepository } from './employee.repository.js';

const parseStoredConfidence = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const scoreVariantName = (
  canonicalName: string,
  variantName: string
): { confidenceScore: number; matchMethod: string } | null => {
  const tokenScore = scoreTokenNameMatch(variantName, canonicalName);
  if (tokenScore) {
    return {
      confidenceScore: tokenScore.confidenceScore,
      matchMethod: EMPLOYEE_MATCH_METHOD.TOKEN
    };
  }

  const normalizedCanonical = normalizeForMatch(canonicalName);
  const normalizedVariant = normalizeForMatch(variantName);
  if (!normalizedCanonical || !normalizedVariant || normalizedCanonical === normalizedVariant) {
    return null;
  }

  const shorter =
    normalizedCanonical.length <= normalizedVariant.length ? normalizedCanonical : normalizedVariant;
  const longer =
    normalizedCanonical.length > normalizedVariant.length ? normalizedCanonical : normalizedVariant;

  if (longer.includes(shorter) && shorter.length >= 4) {
    return {
      confidenceScore: Math.min(
        INTERCOM_MATCH.POSSIBLE_MATCH_MAX_CONFIDENCE,
        similarityToConfidence(shorter.length / longer.length)
      ),
      matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
    };
  }

  return null;
};

const upsertVariant = (
  variants: Map<string, IntelligenceNameVariant>,
  variantName: string,
  confidenceScore: number,
  matchMethod: string
): void => {
  const key = normalizeForMatch(variantName);
  if (!key) {
    return;
  }

  const existing = variants.get(key);
  if (!existing || confidenceScore > existing.confidenceScore) {
    variants.set(key, {
      variantName: variantName.trim(),
      confidenceScore,
      matchMethod
    });
  }
};

export const employeeNameVariantService = {
  async enrichMatches(
    matches: IntelligenceEmployeeMatch[],
    options?: { reportExtractedNames?: string[] }
  ): Promise<IntelligenceEmployeeMatch[]> {
    if (matches.length === 0) {
      return matches;
    }

    const reportNameKeys =
      options?.reportExtractedNames && options.reportExtractedNames.length > 0
        ? new Set(options.reportExtractedNames.map((name) => normalizeForMatch(name)))
        : null;

    const isInCurrentReport = (name: string): boolean => {
      if (!reportNameKeys) {
        return true;
      }

      const key = normalizeForMatch(name);
      return key.length > 0 && reportNameKeys.has(key);
    };

    const identityIds = matches.map((match) => match.employeeIdentityId);
    const [mentions, aliases] = await Promise.all([
      conversationEmployeesRepository.findMentionsByEmployeeIdentityIds(identityIds),
      employeeRepository.findAliasesByEmployeeIdentityIds(identityIds)
    ]);

    const enriched = matches.map((match) => {
      const variants = new Map<string, IntelligenceNameVariant>();
      const canonicalKey = normalizeForMatch(match.canonicalName);

      for (const mention of mentions) {
        if (mention.employeeIdentityId !== match.employeeIdentityId || !mention.extractedName) {
          continue;
        }

        if (!isInCurrentReport(mention.extractedName)) {
          continue;
        }

        const mentionKey = normalizeForMatch(mention.extractedName);
        if (!mentionKey || mentionKey === canonicalKey) {
          continue;
        }

        const storedConfidence = parseStoredConfidence(mention.confidenceScore);
        const scored =
          storedConfidence !== null
            ? {
                confidenceScore: storedConfidence,
                matchMethod: mention.matchMethod ?? EMPLOYEE_MATCH_METHOD.ALIAS
              }
            : scoreVariantName(match.canonicalName, mention.extractedName);

        if (
          scored &&
          scored.confidenceScore >= INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE
        ) {
          upsertVariant(
            variants,
            mention.extractedName,
            scored.confidenceScore,
            scored.matchMethod
          );
        }
      }

      for (const aliasRow of aliases) {
        if (aliasRow.employeeIdentityId !== match.employeeIdentityId || !aliasRow.alias) {
          continue;
        }

        if (!isInCurrentReport(aliasRow.alias)) {
          continue;
        }

        const aliasKey = normalizeForMatch(aliasRow.alias);
        if (!aliasKey || aliasKey === canonicalKey) {
          continue;
        }

        const storedConfidence = parseStoredConfidence(aliasRow.confidenceScore);
        const scored =
          storedConfidence !== null
            ? {
                confidenceScore: storedConfidence,
                matchMethod: aliasRow.matchMethod ?? EMPLOYEE_MATCH_METHOD.ALIAS
              }
            : scoreVariantName(match.canonicalName, aliasRow.alias);

        if (
          scored &&
          scored.confidenceScore >= INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE
        ) {
          upsertVariant(variants, aliasRow.alias, scored.confidenceScore, scored.matchMethod);
        }
      }

      const nameVariants = [...variants.values()].sort(
        (left, right) => right.confidenceScore - left.confidenceScore
      );

      return nameVariants.length > 0 ? { ...match, nameVariants } : match;
    });

    const variantCount = enriched.reduce(
      (count, match) => count + (match.nameVariants?.length ?? 0),
      0
    );

    logger.info('[name-variant] Enriched employee matches with name variants', {
      employeeMatchCount: matches.length,
      variantCount
    });

    return enriched;
  }
};
