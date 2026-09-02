import {
  scoreExtractedNameMatch,
  scorePossibleDuplicateNameMatch,
  scorePossibleSamePersonCandidate,
  scoreStoreSameFirstNicknameMatch,
  scoreSwappedTokenNameMatch,
  scoreTokenNameMatch,
  shouldRejectExtractedNameMatch
} from '../../../src/modules/employee/employee.token-match.util.js';
import { tokenizeContactName } from '../../../src/modules/employee/employee.name.util.js';

const expectEmployeeMatch = (extracted: string, candidate: string, minScore = 60) => {
  expect(shouldRejectExtractedNameMatch(extracted, candidate)).toBe(false);
  const score = scoreExtractedNameMatch(extracted, candidate);
  expect(score).not.toBeNull();
  expect(score!.confidenceScore).toBeGreaterThanOrEqual(minScore);
  return score!;
};

const expectNoEmployeeMatch = (extracted: string, candidate: string) => {
  expect(scoreExtractedNameMatch(extracted, candidate)).toBeNull();
};

describe('employee.token-match.util', () => {
  it('tokenizes contact names into comparable parts', () => {
    expect(tokenizeContactName('Syed Zohaib Haider')).toEqual(
      expect.arrayContaining(['syed', 'zohaib', 'haider'])
    );
    expect(tokenizeContactName('Zohaib shah')).toEqual(['zohaib', 'shah']);
  });

  it('scores Zohaib shah as possible match to Syed Zohaib Haider', () => {
    const score = scoreTokenNameMatch(
      'Zohaib shah',
      'Syed Zohaib Haider',
      'zohaibhaider151@gmail.com',
      'zebihaider123@gmail.com'
    );

    expect(score).not.toBeNull();
    expect(score?.sharedTokens).toContain('zohaib');
    expect(score?.confidenceScore).toBeGreaterThanOrEqual(50);
  });

  it('returns null for clearly different names', () => {
    expect(scoreTokenNameMatch('Mohammad Nehaal', 'Jonathan Fritz')).toBeNull();
  });

  it('scores typo employee names when surnames match', () => {
    const junaidScore = scoreExtractedNameMatch('Jonad Ahmid', 'Junaid Ahmad');

    expect(junaidScore).not.toBeNull();
    expect(junaidScore?.confidenceScore).toBeGreaterThanOrEqual(60);
  });

  it('does not match different people who only share a similar first name', () => {
    expectNoEmployeeMatch('Ahsan Pervaiz', 'Hassan Memon');
    expectNoEmployeeMatch('Hassan Memon', 'Ahsan Pervaiz');
    expectNoEmployeeMatch('Ahsan', 'Hassan Memon');
    expectNoEmployeeMatch('ahsan', 'Hassan Memon');
  });

  it('does not match when first and last names both refer to different people', () => {
    expect(shouldRejectExtractedNameMatch('asad shah', 'faisal khan')).toBe(true);
    expectNoEmployeeMatch('asad shah', 'faisal khan');
  });

  it('does not employee-match same surname with clearly different first names', () => {
    expect(shouldRejectExtractedNameMatch('asad shah', 'Zebi Shah')).toBe(true);
    expectNoEmployeeMatch('asad shah', 'Zebi Shah');
  });

  it('does not match different surnames even when first names look similar', () => {
    expectNoEmployeeMatch('Juhan Lebron', 'Johan Liebert');
  });

  it('scores same-surname first-name typos like Murabi Nagumo to Miyabi Nagumo', () => {
    const score = expectEmployeeMatch('Murabi Nagumo', 'Miyabi Nagumo', 75);

    expect(score.sharedTokens).toEqual(expect.arrayContaining(['nagumo']));
  });

  it('matches a single last name to the same full roster name', () => {
    const score = expectEmployeeMatch('Watkins', 'Darren Watkins', 80);

    expect(score.confidenceScore).toBe(88);
    expect(score.sharedTokens).toEqual(expect.arrayContaining(['darren', 'watkins']));
    expectEmployeeMatch('Watkins', 'Darin Wakins', 75);
    expectEmployeeMatch('Ayesha', 'Ayesha Sophie', 80);
  });

  it('matches a single first name to the same full roster name', () => {
    const score = expectEmployeeMatch('zebi', 'zebi shah', 80);

    expect(score.confidenceScore).toBe(88);
    expect(score.sharedTokens).toEqual(expect.arrayContaining(['zebi', 'shah']));
  });

  it('matches a single first-name typo to a full roster name', () => {
    expectEmployeeMatch('miyabi', 'mirabi nagumo', 75);
    expectEmployeeMatch('faisal', 'faysal khan', 75);
  });

  it('does not match unrelated single-token identities', () => {
    expectNoEmployeeMatch('zebi', 'zubair');
    expectNoEmployeeMatch('nagumo', 'naruto');
  });

  it('still scores short typo names against a single-name identity', () => {
    expectEmployeeMatch('Ahsuun', 'Ahsan', 60);
    expectEmployeeMatch('fasal', 'faisal', 75);
  });

  it('scores close first-name typos higher when surnames match exactly', () => {
    const jonScore = expectEmployeeMatch('Jon Smith', 'John Smith', 75);
    const johnathanScore = expectEmployeeMatch('Johnathan Smith', 'John Smith', 60);

    expect(jonScore.confidenceScore).toBeGreaterThan(johnathanScore.confidenceScore);
  });

  it('matches full-name surname typos like Johnathan Frish to Jonathan Fritsch', () => {
    expectEmployeeMatch('Johnathan Frish', 'Jonathan Fritsch', 60);
  });

  it('auto-links silent-e and y surname spellings like Sophie and Sophy', () => {
    expectEmployeeMatch('Ayesha Sophy', 'Ayesha Sophie', 75);
    expectEmployeeMatch('Ayesha Sophie', 'Ayesha Sophy', 75);
    expectEmployeeMatch('Ayisha Sophie', 'Ayesha Sophie', 75);
    expectEmployeeMatch('Ayisha Sophie', 'Ayesha Sophy', 75);
  });

  it('scores possible duplicate hints when surnames are close but below auto-link', () => {
    expect(scorePossibleDuplicateNameMatch('Jonathan Thompson', 'Jonathan Thomas')).toMatchObject({
      confidenceScore: 63,
      sharedTokens: expect.arrayContaining(['jonathan', 'thompson~thomas'])
    });
    expect(scoreExtractedNameMatch('Jonathan Thompson', 'Jonathan Thomas')).toBeNull();
  });

  it('does not emit possible duplicate hints when auto-linking would succeed', () => {
    expect(scorePossibleDuplicateNameMatch('Johnathan Frish', 'Jonathan Fritsch')).toBeNull();
    expectEmployeeMatch('Johnathan Frish', 'Jonathan Fritsch', 60);
  });

  it('scores same-first short-last nickname pairs for store roster linking', () => {
    expect(scoreStoreSameFirstNicknameMatch('Cooper Joe', 'Cooper Salt')).toMatchObject({
      confidenceScore: 68,
      sharedTokens: ['cooper']
    });
    expect(scoreExtractedNameMatch('Cooper Joe', 'Cooper Salt')).toBeNull();
    expect(shouldRejectExtractedNameMatch('Cooper Joe', 'Cooper Salt')).toBe(true);
  });

  it('does not score long-surname pairs as store nicknames', () => {
    expect(scoreStoreSameFirstNicknameMatch('John Smith', 'John Anderson')).toBeNull();
  });

  it('scores initial plus last name to full roster name at auto-link confidence', () => {
    const mSloan = expectEmployeeMatch('M Sloan', 'Mike Sloan', 75);
    expect(mSloan.confidenceScore).toBeGreaterThanOrEqual(88);

    const mSmith = expectEmployeeMatch('M Smith', 'Mike Smith', 75);
    expect(mSmith.confidenceScore).toBeGreaterThanOrEqual(88);

    expectEmployeeMatch('Mike S', 'Mike Smith', 75);
    expectEmployeeMatch('Mike S', 'Mike Sloan', 75);
  });

  it('matches full name to initial plus last name both ways at auto-link confidence', () => {
    const forward = expectEmployeeMatch('M Fortunada', 'Mary Fortunata', 75);
    expect(forward.confidenceScore).toBeGreaterThanOrEqual(75);

    const reverse = expectEmployeeMatch('Mary Fortunata', 'M Fortunada', 75);
    expect(reverse.confidenceScore).toBeGreaterThanOrEqual(75);

    expectEmployeeMatch('Mike Smith', 'M Smith', 75);
    expectEmployeeMatch('Mary Fortunata', 'M Fortunata', 75);
  });

  it('does not match full name to initial plus last when initial or surname disagree', () => {
    expectNoEmployeeMatch('Mary Fortunata', 'J Fortunada');
    expectNoEmployeeMatch('Mary Fortunata', 'M Smith');
    expectNoEmployeeMatch('Sara Patel', 'M Fortunada');
    expectNoEmployeeMatch('Mary Fortunata', 'Fortunada');
  });

  it('does not auto-link similar first names with different surnames below alias threshold', () => {
    const hint = scorePossibleSamePersonCandidate('Mike Smith', 'Mike Sloan');
    expect(hint).not.toBeNull();
    expect(hint!.confidenceScore).toBeLessThan(75);
    expectNoEmployeeMatch('Mike Smith', 'Mike Sloan');
  });

  it('scores Mike family names above possible-match threshold', () => {
    expect(scorePossibleSamePersonCandidate('Mike', 'Mike John')).toMatchObject({
      confidenceScore: expect.any(Number),
      sharedTokens: expect.arrayContaining(['mike'])
    });
    expect(scorePossibleSamePersonCandidate('Mike', 'Mike John')!.confidenceScore).toBeGreaterThanOrEqual(
      60
    );

    expect(scorePossibleSamePersonCandidate('Mike John', 'Mike J.')).toMatchObject({
      confidenceScore: expect.any(Number),
      sharedTokens: expect.arrayContaining(['mike'])
    });
    expect(scorePossibleSamePersonCandidate('Mike John', 'Mike J.')!.confidenceScore).toBeGreaterThanOrEqual(
      60
    );

    expect(scorePossibleSamePersonCandidate('Mike John', 'Mike')!.confidenceScore).toBeGreaterThanOrEqual(
      60
    );
  });

  it('boosts swapped-token name matches like Jhonson Charles vs Charles Johnson', () => {
    const swapped = scoreSwappedTokenNameMatch('Jhonson Charles', 'Charles Johnson');
    expect(swapped).not.toBeNull();
    expect(swapped!.confidenceScore).toBeGreaterThanOrEqual(72);
    expect(swapped!.sharedTokens).toHaveLength(2);

    const candidate = scorePossibleSamePersonCandidate('Jhonson Charles', 'Charles Johnson');
    expect(candidate).not.toBeNull();
    expect(candidate!.confidenceScore).toBeGreaterThanOrEqual(72);
  });

  it('does not match unrelated names as swapped tokens', () => {
    expect(scoreSwappedTokenNameMatch('Mike Smith', 'Charles Johnson')).toBeNull();
    expect(scoreSwappedTokenNameMatch('Mike', 'Charles Johnson')).toBeNull();
  });

  it('scores exact swapped tokens higher than typo swapped tokens', () => {
    const exact = scoreSwappedTokenNameMatch('Johnson Charles', 'Charles Johnson');
    const typo = scoreSwappedTokenNameMatch('Jhonson Charles', 'Charles Johnson');
    expect(exact).not.toBeNull();
    expect(typo).not.toBeNull();
    expect(exact!.confidenceScore).toBeGreaterThanOrEqual(typo!.confidenceScore);
  });
});
