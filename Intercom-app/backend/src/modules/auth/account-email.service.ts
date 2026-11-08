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
    subject: 'Verify your Case Lense email',
    text: `Hi ${input.name},\n\nVerify your email address: ${input.verificationUrl}\n\nThis one-time link expires ${expiry}. If you did not request it, you can ignore this email.`,
    html: `<p>Hi ${escapeEmailHtml(input.name)},</p><p>Verify your Case Lense email address.</p><p><a href="${escapeEmailHtml(input.verificationUrl)}">Verify email address</a></p><p>This one-time link expires ${expiry}. If you did not request it, you can ignore this email.</p>`
  });
};

export const sendVerificationCodeEmail = async (input: {
  email: string; name: string; code: string; expiresAt: Date;
}): Promise<{ sent: true }> => {
  const expiryMinutes = Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60_000));
  return sendAccountEmail({
    email: input.email,
    subject: 'Your CaseLens verification code',
    text: `Hi ${input.name},\n\nYour CaseLens verification code is: ${input.code}\n\nIt expires in ${expiryMinutes} minutes. If you did not request this, ignore this email.`,
    html: `<p>Hi ${escapeEmailHtml(input.name)},</p><p>Use this code to verify your CaseLens email address:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${input.code}</p><p>This code expires in ${expiryMinutes} minutes. Do not share it with anyone.</p>`
  });
};
