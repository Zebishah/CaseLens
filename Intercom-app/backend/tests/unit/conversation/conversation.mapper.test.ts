import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mapApiConversationToConversation,
  mapWebhookToConversation
} from '../../../src/modules/conversation/conversation.mapper.js';
import { resolveConversationSubject } from '../../../src/modules/conversation/conversation-subject.util.js';
import { parseIntercomWebhook } from '../../../src/modules/intercom/intercom.types.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/intercom');

describe('conversation.mapper', () => {
  it('maps conversation.created webhook to conversation fields', () => {
    const raw = readFileSync(path.join(fixturesDir, 'webhook.conversation.created.json'), 'utf8');
    const envelope = parseIntercomWebhook(JSON.parse(raw));
    const { conversation, messages } = mapWebhookToConversation(envelope);

    expect(conversation).toMatchObject({
      intercomId: '123456789',
      subject: 'Attendance concern',
      status: 'open',
      reporterName: 'Jon Fritz',
      reporterEmail: 'jon@example.com'
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      intercomPartId: '123456789-initial',
      messageBody: 'I was late today',
      senderType: 'user'
    });
  });

  it('maps Intercom API conversation using contacts when source author is missing', () => {
    const { conversation } = mapApiConversationToConversation({
      id: '215474091120045',
      title: 'employee issue',
      state: 'open',
      source: { type: 'email', body: 'hello from email' },
      contacts: {
        type: 'contact.list',
        contacts: [
          {
            type: 'contact',
            id: 'contact_1',
            name: 'Mohammad Nehaal',
            email: 'nehaal@demoops.co'
          }
        ]
      }
    });

    expect(conversation).toMatchObject({
      intercomId: '215474091120045',
      subject: 'employee issue',
      reporterName: 'Mohammad Nehaal',
      reporterEmail: 'nehaal@demoops.co',
      intercomContactId: 'contact_1'
    });
  });

  it('extracts store number from contact email when source author email is not a store inbox', () => {
    const { conversation } = mapApiConversationToConversation({
      id: '215475999999999',
      title: 'Jason Bucciarelli Termination 8/26/25',
      state: 'open',
      source: {
        type: 'email',
        body: '<p>Hello, this is Alfredo from store #78.</p>',
        author: {
          type: 'user',
          id: 'lead-1',
          name: 'JJ 78',
          email: 'mailer@northwind.co'
        }
      },
      contacts: {
        type: 'contact.list',
        contacts: [
          {
            type: 'contact',
            id: 'contact_78',
            name: 'JJ 78',
            email: '78@northwind.co'
          }
        ]
      }
    });

    expect(conversation).toMatchObject({
      reporterName: 'JJ 78',
      reporterEmail: 'mailer@northwind.co',
      reporterStoreNumber: '78',
      reporterCompanyDomain: 'northwind.co'
    });
  });

  it('maps subject from Intercom custom attributes when title is absent', () => {
    const { conversation } = mapApiConversationToConversation({
      id: '215474884584768',
      state: 'open',
      custom_attributes: {
        Subject: 'bad attendance - zebi'
      },
      source: { type: 'email', body: 'Dear HR Team' },
      contacts: {
        contacts: [
          {
            id: 'contact_1',
            name: 'Mohammad Nehaal',
            email: 'nehaal@demoops.co'
          }
        ]
      }
    });

    expect(conversation.subject).toBe('bad attendance - zebi');
    expect(
      resolveConversationSubject({
        subject: null,
        rawPayload: conversation.rawPayload
      })
    ).toBe('bad attendance - zebi');
  });

  it('maps source and conversation_parts comment messages', () => {
    const { messages } = mapApiConversationToConversation({
      id: '999',
      title: 'Vacation requests',
      state: 'open',
      source: {
        type: 'email',
        body: '<p>Good morning</p>',
        author: { type: 'user', id: 'rep-1', name: 'Ellis', email: 'ellis@example.com' }
      },
      conversation_parts: {
        type: 'conversation_part.list',
        total_count: 2,
        conversation_parts: [
          {
            type: 'conversation_part',
            id: 'part-2',
            part_type: 'comment',
            body: '<p>Luis Castillo will be on vacation</p>',
            author: { type: 'user', id: 'rep-1', name: 'Ellis', email: 'ellis@example.com' }
          },
          {
            type: 'conversation_part',
            id: 'part-3',
            part_type: 'assignment',
            body: 'assigned'
          }
        ]
      }
    });

    expect(messages.map((message) => message.intercomPartId)).toEqual(['999-initial', 'part-2']);
    expect(messages[0]?.messageBody).toContain('Good morning');
    expect(messages[1]?.messageBody).toContain('Luis Castillo will be on vacation');
  });

  it('keeps later customer comments and drops notes, tags, and operator messages', () => {
    const { messages } = mapApiConversationToConversation({
      id: '1000',
      title: 'this si the issue that is faced and test workspace',
      state: 'open',
      tags: { tags: [{ name: 'hr-intelligence-processed' }] },
      source: {
        type: 'email',
        body: '<p>this si the issue that is faced and test workspace</p>',
        author: { type: 'user', id: 'rep-1', name: 'Ellis', email: 'ellis@example.com' }
      },
      conversation_parts: {
        type: 'conversation_part.list',
        total_count: 5,
        conversation_parts: [
          {
            type: 'conversation_part',
            id: 'part-2',
            part_type: 'comment',
            body: '<p>Second customer reply</p>',
            author: { type: 'user', id: 'rep-1' }
          },
          {
            type: 'conversation_part',
            id: 'part-3',
            part_type: 'note',
            body: '<p>HR Intelligence · sync:abcdef123456</p><p>Employee mentioned: Si</p>',
            author: { type: 'admin', id: 'admin-1' }
          },
          {
            type: 'conversation_part',
            id: 'part-4',
            part_type: 'comment',
            body: '<p>Operator comment with Ayesha Khan</p>',
            author: { type: 'admin', id: 'admin-1' }
          },
          {
            type: 'conversation_part',
            id: 'part-5',
            part_type: 'assignment',
            body: 'assigned'
          }
        ]
      }
    });

    expect(messages.map((message) => message.intercomPartId)).toEqual(['1000-initial', 'part-2']);
    expect(messages.map((message) => message.messageBody)).toEqual([
      '<p>this si the issue that is faced and test workspace</p>',
      '<p>Second customer reply</p>'
    ]);
    expect(JSON.stringify(messages)).not.toContain('Employee mentioned: Si');
    expect(JSON.stringify(messages)).not.toContain('HR Intelligence');
  });
});
