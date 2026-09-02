import { CANVAS_COPY } from '../../../src/constants/canvas.constants.js';
import { toPublicCanvasErrorMessage } from '../../../src/modules/canvas/canvas-error-message.util.js';

describe('toPublicCanvasErrorMessage', () => {
  it('never shows Gemini or worker internals', () => {
    expect(toPublicCanvasErrorMessage('Gemini timed out')).toBe(CANVAS_COPY.FAILED_DETAIL);
    expect(toPublicCanvasErrorMessage(new Error('worker error'))).toBe(CANVAS_COPY.FAILED_DETAIL);
    expect(
      toPublicCanvasErrorMessage('Gemini API error 404: model is no longer available')
    ).toBe(CANVAS_COPY.FAILED_DETAIL);
  });

  it('maps quota errors to a wait-and-retry message', () => {
    expect(
      toPublicCanvasErrorMessage('Gemini API error 429: Your prepayment credits are depleted')
    ).toBe(CANVAS_COPY.FAILED_BUSY);
  });

  it('maps connection errors to a reopen message', () => {
    expect(toPublicCanvasErrorMessage(new Error('ECONNREFUSED 127.0.0.1:5432'))).toBe(
      CANVAS_COPY.DB_UNAVAILABLE
    );
  });

  it('uses the default next-step copy when no error is provided', () => {
    expect(toPublicCanvasErrorMessage()).toBe(CANVAS_COPY.FAILED_DETAIL);
  });
});
