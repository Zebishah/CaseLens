import type { IntelligenceEmployeeMatch } from '../../types/intelligence.types.js';
import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { employeeRepository } from '../employee/employee.repository.js';
import { getNameMatchVariants } from '../employee/employee.name.util.js';
import { scoreExtractedNameMatch } from '../employee/employee.token-match.util.js';
import {
  buildRelatedCaseNameBag,
  collectRelatedCaseSearchTerms,
  type RelatedCaseNameBag
} from './related-case-name-match.util.js';

const MIN_TERM_LENGTH = 3;

const addNameVariants = (names: Set<string>, name: string | null | undefined): void => {
  if (!name?.trim()) {
    return;
  }

  for (const variant of getNameMatchVariants(name)) {
    const trimmed = variant.trim();
    if (trimmed.length >= MIN_TERM_LENGTH) {
      names.add(trimmed);
    }
  }
};

const expandTypoSiblingIdentityIds = async (
  seedIds: number[],
  sourceNames: Set<string>
): Promise<number[]> => {
  const names = [...sourceNames];
  if (names.length === 0) {
    return seedIds;
  }

  const roster =
    typeof employeeRepository.findAll === 'function' ? await employeeRepository.findAll() : [];
  const ids = new Set(seedIds);

  for (const identity of roster) {
    if (ids.has(identity.id)) {
      continue;
    }

    const linked = names.some((name) => {
      const scored = scoreExtractedNameMatch(name, identity.canonicalName);
      return Boolean(scored && scored.confidenceScore >= INTERCOM_MATCH.ALIAS_LEARNING_MIN_CONFIDENCE);
    });

    if (linked) {
      ids.add(identity.id);
    }
  }

  return [...ids];
};

export type RelatedCaseSearchInput = {
  searchTerms: string[];
  employeeNames: string[];
  employeeIdentityIds: number[];
  nameBag: RelatedCaseNameBag;
};

export const resolveRelatedCaseSearchInput = async (input: {
  employeeMatches: IntelligenceEmployeeMatch[];
  extractedNames?: string[];
  searchTerms?: string[];
}): Promise<RelatedCaseSearchInput> => {
  let employeeIdentityIds = [
    ...new Set(input.employeeMatches.map((match) => match.employeeIdentityId).filter((id) => id > 0))
  ];

  const sourceNames = new Set<string>();

  for (const name of input.extractedNames ?? []) {
    addNameVariants(sourceNames, name);
  }

  for (const term of input.searchTerms ?? []) {
    addNameVariants(sourceNames, term);
  }

  for (const match of input.employeeMatches) {
    addNameVariants(sourceNames, match.canonicalName);
    addNameVariants(sourceNames, match.extractedName);
    for (const variant of match.nameVariants ?? []) {
      addNameVariants(sourceNames, variant.variantName);
    }
  }

  employeeIdentityIds = await expandTypoSiblingIdentityIds(employeeIdentityIds, sourceNames);

  if (employeeIdentityIds.length > 0) {
    const roster =
      typeof employeeRepository.findAll === 'function' ? await employeeRepository.findAll() : [];
    const expandedIds = new Set(employeeIdentityIds);
    for (const identity of roster) {
      if (expandedIds.has(identity.id)) {
        addNameVariants(sourceNames, identity.canonicalName);
      }
    }

    const aliasRows = await employeeRepository.findAliasesByEmployeeIdentityIds(employeeIdentityIds);
    for (const row of aliasRows) {
      addNameVariants(sourceNames, row.alias);
    }
  }

  const nameBag = buildRelatedCaseNameBag(sourceNames);

  return {
    searchTerms: collectRelatedCaseSearchTerms(nameBag),
    employeeNames: nameBag.fullNames,
    employeeIdentityIds,
    nameBag
  };
};
