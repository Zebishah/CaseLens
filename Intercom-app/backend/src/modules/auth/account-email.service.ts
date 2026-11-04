import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { AppError } from '../../utils/error.util.js';

export const escapeEmailHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character] ?? character);

export const sendAccountEmail = async (input: {
  email: string; subject: string; text: string; html: string;
}): Promise<{ sent: true }> => {
  if (!env.RESEND_AUTH_EMAIL_ENABLED || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw AppError.serviceUnavailable('Account email is not configured. Contact your workspace administrator.');
  }
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
        to: [input.email], subject: input.subject, text: input.text, html: input.html })
    });
  } catch {
    throw AppError.serviceUnavailable('Email delivery is temporarily unavailable. Please try again shortly.');
  }
  if (!response.ok) {
    // Provider responses may contain account details. Never log tokens or email bodies.
    logger.error('[auth] Resend account email failed', { status: response.status });
    throw AppError.serviceUnavailable('Email delivery is temporarily unavailable. Please try again shortly.');
  }
  return { sent: true };
};

export const sendVerificationEmail = async (input: {
  email: string; name: string; verificationUrl: string; expiresAt: Date;
}) => {
  const expiry = input.expiresAt.toISOString();
  return sendAccountEmail({
    email: input.email,
    subject: 'Verify your HR Intelligence email',
    text: `Hi ${input.name},\n\nVerify your email address: ${input.verificationUrl}\n\nThis one-time link expires ${expiry}. If you did not request it, you can ignore this email.`,
    html: `<p>Hi ${escapeEmailHtml(input.name)},</p><p>Verify your HR Intelligence email address.</p><p><a href="${escapeEmailHtml(input.verificationUrl)}">Verify email address</a></p><p>This one-time link expires ${expiry}. If you did not request it, you can ignore this email.</p>`
  });
};
