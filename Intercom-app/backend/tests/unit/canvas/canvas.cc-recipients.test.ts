import { CANVAS_COPY } from '../../../src/constants/canvas.constants.js';
import { canvasBuilder } from '../../../src/modules/canvas/canvas.builder.js';
import type { CcRecipientsResult } from '../../../src/modules/store-directory/cc-recipients.service.js';

describe('canvasBuilder CC recipients section', () => {
  it('shows Edit store number when store is missing (field hidden until Edit)', () => {
    const cc: CcRecipientsResult = {
      status: 'no_store',
      storeNumber: null,
      companyName: null,
      recipients: [],
      message: CANVAS_COPY.CC_NO_STORE
    };

    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { ccRecipients: cc }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.CC_RECIPIENTS_HEADER }),
        expect.objectContaining({ text: CANVAS_COPY.CC_NO_STORE }),
        expect.objectContaining({
          type: 'button',
          id: 'edit-manual-store-number',
          label: CANVAS_COPY.CC_STORE_EDIT,
          action: { type: 'submit' }
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'input', id: 'manual-store-number' })
      ])
    );
  });

  it('shows store number field after Edit is clicked (editingStore)', () => {
    const cc: CcRecipientsResult = {
      status: 'no_store',
      storeNumber: null,
      companyName: null,
      recipients: [],
      message: CANVAS_COPY.CC_NO_STORE
    };

    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { ccRecipients: cc, editingStore: true }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'input',
          id: 'manual-store-number',
          label: CANVAS_COPY.CC_STORE_INPUT_LABEL,
          placeholder: CANVAS_COPY.CC_STORE_INPUT_PLACEHOLDER
        }),
        expect.objectContaining({
          type: 'button',
          id: 'submit-manual-store-number',
          label: CANVAS_COPY.CC_STORE_SUBMIT,
          action: { type: 'submit' }
        })
      ])
    );
  });

  it('shows Edit when store was not found so the number can be corrected', () => {
    const cc: CcRecipientsResult = {
      status: 'not_found',
      storeNumber: '99999',
      companyName: null,
      recipients: [],
      message: null
    };

    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { ccRecipients: cc }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: `${CANVAS_COPY.CC_NOT_FOUND_PREFIX} 99999. ${CANVAS_COPY.CC_NOT_FOUND_HINT}`
        }),
        expect.objectContaining({
          type: 'button',
          id: 'edit-manual-store-number',
          label: CANVAS_COPY.CC_STORE_EDIT
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'input', id: 'manual-store-number' })
      ])
    );
  });

  it('shows Edit when store exists but no CC recipients are listed', () => {
    const cc: CcRecipientsResult = {
      status: 'ok',
      storeNumber: '78',
      companyName: 'Northwind Bakery',
      recipients: [],
      message: null
    };

    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { ccRecipients: cc }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.CC_EMPTY_FOR_STORE }),
        expect.objectContaining({
          type: 'button',
          id: 'edit-manual-store-number',
          label: CANVAS_COPY.CC_STORE_EDIT
        })
      ])
    );
  });

  it('lists CC recipients with role and email and still offers Edit', () => {
    const cc: CcRecipientsResult = {
      status: 'ok',
      storeNumber: '413',
      companyName: 'Northwind Bakery',
      recipients: [
        {
          name: 'Pat Ventura',
          email: 'pat.quinn@northwind.co',
          role: 'VP of Ops',
          source: 'store'
        }
      ],
      message: null
    };

    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { ccRecipients: cc }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'list',
          items: expect.arrayContaining([
            expect.objectContaining({
              title: 'Pat Ventura (VP of Ops)',
              subtitle: 'pat.quinn@northwind.co'
            })
          ])
        }),
        expect.objectContaining({
          type: 'button',
          id: 'edit-manual-store-number',
          label: CANVAS_COPY.CC_STORE_EDIT
        })
      ])
    );
  });

  it('keeps refreshed CC recipients on the updating/reopen refresh screen', () => {
    const cc: CcRecipientsResult = {
      status: 'ok',
      storeNumber: '10206',
      companyName: 'Northwind Bakery',
      recipients: [
        {
          name: 'Dev DM',
          email: '10206@demoops.co',
          role: 'District Manager',
          source: 'store'
        }
      ],
      message: null
    };

    const canvas = canvasBuilder.buildUpdatingIntelligence(cc);

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATING_INTELLIGENCE }),
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.REFRESH_STILL_UPDATING_HINT }),
        expect.objectContaining({ text: CANVAS_COPY.CC_RECIPIENTS_HEADER }),
        expect.objectContaining({
          type: 'list',
          items: expect.arrayContaining([
            expect.objectContaining({
              title: 'Dev DM (District Manager)',
              subtitle: '10206@demoops.co'
            })
          ])
        })
      ])
    );
  });

  it('shows a clear message when duplicate stores cannot be resolved by domain', () => {
    const cc: CcRecipientsResult = {
      status: 'ambiguous',
      storeNumber: '413',
      companyName: null,
      recipients: [],
      message: 'Multiple companies found for store 413 — cannot choose CC recipients'
    };

    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { ccRecipients: cc }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Multiple companies found for store 413 — cannot choose CC recipients'
        }),
        expect.objectContaining({
          type: 'button',
          id: 'edit-manual-store-number',
          label: CANVAS_COPY.CC_STORE_EDIT
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'list' })])
    );
  });
});
