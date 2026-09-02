import {
  resolveConversationSubject,
  resolveConversationSubjectFromIntercomPayload
} from '../../../src/modules/conversation/conversation-subject.util.js';

describe('conversation-subject.util', () => {
  it('prefers custom attribute subject from raw payload over stored DB column', () => {
    expect(
      resolveConversationSubject({
        subject: 'Attendance - zebi shah',
        rawPayload: {
          title: 'bad attendance - zebi',
          custom_attributes: { Subject: 'NEW updated subject' }
        }
      })
    ).toBe('NEW updated subject');
  });

  it('prefers custom attribute over title when both differ', () => {
    expect(
      resolveConversationSubjectFromIntercomPayload({
        title: 'old email subject line',
        custom_attributes: {
          Subject: 'edited in Intercom'
        }
      })
    ).toBe('edited in Intercom');
  });

  it('falls back to stored subject when payload has no subject signals', () => {
    expect(
      resolveConversationSubject({
        subject: 'Attendance - zebi shah',
        rawPayload: { id: '123' }
      })
    ).toBe('Attendance - zebi shah');
  });

  it('falls back to title from raw payload when custom attribute is absent', () => {
    expect(
      resolveConversationSubjectFromIntercomPayload({
        title: 'Attendance issue - zubi'
      })
    ).toBe('Attendance issue - zubi');

    expect(
      resolveConversationSubjectFromIntercomPayload({
        custom_attributes: {
          Subject: 'bad attendance - zebi'
        }
      })
    ).toBe('bad attendance - zebi');
  });

  it('returns null when no subject signals exist', () => {
    expect(resolveConversationSubject({ subject: null, rawPayload: {} })).toBeNull();
  });
});
