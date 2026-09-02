import {
  INTERCOM_CASE_TYPE_KEYWORDS,
  INTERCOM_CASE_TYPES,
  INTERCOM_MATCH,
  INTERCOM_WEBHOOK_TOPICS,
  isConversationCreatedTopic
} from '../../../src/constants/intercom.constants.js';

describe('intercom.constants', () => {
  it('defines real Intercom conversation-created topics', () => {
    expect(INTERCOM_WEBHOOK_TOPICS.CONVERSATION_USER_CREATED).toBe('conversation.user.created');
    expect(INTERCOM_WEBHOOK_TOPICS.CONVERSATION_ADMIN_SINGLE_CREATED).toBe(
      'conversation.admin.single.created'
    );
    expect(isConversationCreatedTopic('conversation.user.created')).toBe(true);
    expect(isConversationCreatedTopic('conversation.admin.single.created')).toBe(true);
    expect(isConversationCreatedTopic('conversation.user.replied')).toBe(false);
  });

  it('defines match thresholds', () => {
    expect(INTERCOM_MATCH.CONFIDENCE_THRESHOLD).toBe(60);
    expect(INTERCOM_MATCH.FUZZY_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(INTERCOM_MATCH.FUZZY_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it('maps case types to keywords', () => {
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.MISCONDUCT]).toContain('misconduct');
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.SCHEDULE]).toContain('shift swap');
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.INJURY]).toContain('workers compensation');
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.ACCOMMODATION]).toContain('ada');
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.TRANSFER]).toContain('store transfer');
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.POLICY]).toContain('handbook');
    expect(INTERCOM_CASE_TYPE_KEYWORDS[INTERCOM_CASE_TYPES.GENERAL]).toEqual([]);
  });
});
