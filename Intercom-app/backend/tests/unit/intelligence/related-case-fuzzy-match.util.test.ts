import {
  findBestFuzzyRelatedCaseMatch,
  scoreFuzzyRelatedCaseNameMatch,
  subjectMatchesExactRelatedCaseTerms
} from '../../../src/modules/intelligence/related-case-fuzzy-match.util.js';
import { buildRelatedCaseNameBag } from '../../../src/modules/intelligence/related-case-name-match.util.js';

describe('related-case-fuzzy-match.util', () => {
  it('matches charles boyles to charls boil as a fuzzy related case', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Charles Boyles', 'Charls Boil');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Charles Boyles',
        matchedName: 'Charls Boil',
        sharedTokens: expect.arrayContaining(['charles~charls', 'boyles~boil'])
      })
    );
  });

  it('does not treat an exact spelling as fuzzy', () => {
    expect(scoreFuzzyRelatedCaseNameMatch('Charles Boyles', 'Charles Boyles')).toBeNull();
  });

  it('matches Braden to Braeden as a one-word spelling variant', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Braden', 'Braeden');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Braden',
        matchedName: 'Braeden',
        sharedTokens: ['braden~braeden']
      })
    );
  });

  it('matches a last name only to a full name in another ticket', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Watkins', 'Darren Watkins');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Watkins',
        matchedName: 'Darren Watkins'
      })
    );
  });

  it('matches Watkins to Darin Wakins as a last-name spelling variant', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Watkins', 'Darin Wakins');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Watkins',
        matchedName: 'Darin Wakins'
      })
    );
  });

  it('matches a full name to a last-name-only subject', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Darren Watkins', 'Wakins');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Darren Watkins',
        matchedName: 'Wakins'
      })
    );
  });

  it('matches Ayesha to Aisha as a first-name spelling variant', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Ayesha', 'Aisha');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Ayesha',
        matchedName: 'Aisha'
      })
    );
  });

  it('matches Ayesha to a full name that uses a close first-name spelling', () => {
    const match = scoreFuzzyRelatedCaseNameMatch('Ayesha', 'Ayisha Sophie');

    expect(match).toEqual(
      expect.objectContaining({
        sourceName: 'Ayesha',
        matchedName: 'Ayisha Sophie'
      })
    );
  });

  it('does not match unrelated names', () => {
    expect(scoreFuzzyRelatedCaseNameMatch('Watkins', 'William Carter')).toBeNull();
  });

  it('finds fuzzy matches from a subject line', () => {
    const match = findBestFuzzyRelatedCaseMatch({
      sourceNames: ['Charles Boyles'],
      subject: 'Charls Boil attendance warnings'
    });

    expect(match).toEqual(
      expect.objectContaining({
        matchedName: 'Charls Boil'
      })
    );
  });

  it('finds a last-name-only mention in a full-name subject', () => {
    const match = findBestFuzzyRelatedCaseMatch({
      sourceNames: ['Watkins'],
      subject: 'Darren Watkins not behaving at work'
    });

    expect(match).toEqual(
      expect.objectContaining({
        matchedName: 'Darren Watkins'
      })
    );
  });

  it('finds a close last-name spelling in another subject', () => {
    const match = findBestFuzzyRelatedCaseMatch({
      sourceNames: ['Watkins'],
      subject: 'Attendance issue Darin Wakins'
    });

    expect(match).toEqual(
      expect.objectContaining({
        matchedName: 'Darin Wakins'
      })
    );
  });

  it('detects when a subject already matches exact related-case terms', () => {
    const nameBag = buildRelatedCaseNameBag(['Charles Boyles']);

    expect(
      subjectMatchesExactRelatedCaseTerms(
        'Charles Boile attendance warnings',
        ['Charles Boyles'],
        nameBag
      )
    ).toBe(true);

    expect(
      subjectMatchesExactRelatedCaseTerms(
        'Charls Boil attendance warnings',
        ['Charles Boyles'],
        nameBag
      )
    ).toBe(false);
  });
});
