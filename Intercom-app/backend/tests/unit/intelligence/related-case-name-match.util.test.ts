import {
  buildRelatedCaseNameBag,
  collectRelatedCaseSearchTerms,
  findMentionedEmployeeNamesInConversation,
  textContainsNamePartsAsWholeWords,
  textContainsNameTerm
} from '../../../src/modules/intelligence/related-case-name-match.util.js';

describe('related-case-name-match.util', () => {
  it('builds full names and tokens from employee spellings', () => {
    const bag = buildRelatedCaseNameBag(['zebi shah', 'zubi shah']);

    expect(bag.fullNames).toEqual(expect.arrayContaining(['zebi shah', 'zubi shah']));
    expect(bag.tokens).toEqual(expect.arrayContaining(['zebi', 'zubi', 'shah']));
    expect(collectRelatedCaseSearchTerms(bag)).toEqual(
      expect.arrayContaining(['zebi shah', 'zubi shah', 'zebi', 'zubi', 'shah'])
    );
  });

  it('matches first-name-only subjects using tokens', () => {
    const bag = buildRelatedCaseNameBag(['zebi shah', 'zubi shah']);

    expect(
      findMentionedEmployeeNamesInConversation({
        subject: 'bad attendance - zebi',
        nameBag: bag
      })
    ).toEqual(expect.arrayContaining(['zebi shah']));
  });

  it('matches extracted names even when subject is abbreviated', () => {
    const bag = buildRelatedCaseNameBag(['zebi shah', 'zubi shah']);

    expect(
      findMentionedEmployeeNamesInConversation({
        subject: 'bad attendance - zebi',
        extractedNames: ['zubi shah'],
        nameBag: bag
      })
    ).toEqual(expect.arrayContaining(['zebi shah', 'zubi shah']));
  });

  it('uses linked extracted name from conversation_employees', () => {
    const bag = buildRelatedCaseNameBag(['zebi shah']);

    expect(
      findMentionedEmployeeNamesInConversation({
        subject: 'bad attendance - zebi',
        linkedExtractedName: 'zubi shah',
        nameBag: bag
      })
    ).toEqual(expect.arrayContaining(['zubi shah', 'zebi shah']));
  });

  it('matches token terms on word boundaries only', () => {
    expect(textContainsNameTerm('bad attendance - zebi', 'zebi', { tokenMatch: true })).toBe(true);
    expect(textContainsNameTerm('zebian problem', 'zebi', { tokenMatch: true })).toBe(false);
  });

  it('does not match ella inside Daniella, Isabella, or Arellano', () => {
    const bag = buildRelatedCaseNameBag(['Ella Gideon']);

    expect(textContainsNamePartsAsWholeWords('Daniella Barrios - quit', 'ella')).toBe(false);
    expect(textContainsNamePartsAsWholeWords('William Finn, Isabella Pardo', 'ella')).toBe(false);
    expect(textContainsNamePartsAsWholeWords('Marc Arellano quit personal reasons', 'ella')).toBe(false);

    expect(textContainsNamePartsAsWholeWords('Ella Gideon attendance issue', 'ella')).toBe(true);
    expect(textContainsNamePartsAsWholeWords('Ella Bornietr termination', 'ella')).toBe(true);
    expect(textContainsNamePartsAsWholeWords('Ella Gideon attendance', 'Ella Gideon')).toBe(true);
    expect(textContainsNamePartsAsWholeWords('Ella Gideon attendance', 'gideon')).toBe(true);

    expect(
      findMentionedEmployeeNamesInConversation({
        subject: 'Daniella Barrios - quit due to w/ notice',
        nameBag: bag
      })
    ).toEqual([]);

    expect(
      findMentionedEmployeeNamesInConversation({
        subject: 'Ella Bornietr - leave request',
        nameBag: bag
      })
    ).toEqual(expect.arrayContaining(['Ella Gideon']));
  });
});
