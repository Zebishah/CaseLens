import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character] ?? character);

export const sendWorkspaceInviteEmail = async (input: {
  email: string;
  name: string;
  setupUrl: string;
  expiresAt: Date;
}): Promise<{ sent: boolean }> => {
  if (!env.BREVO_ENABLED || !env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Brevo invitation email is not configured');
    }
    logger.warn('[auth] Brevo disabled; workspace invite was created without sending email');
    return { sent: false };
  }

  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.setupUrl);
  const expires = escapeHtml(input.expiresAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }));
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: input.email, name: input.name }],
      subject: 'Your HR Intelligence workspace access',
      textContent: `Hi ${input.name},\n\nYour HR Intelligence workspace request was approved. Set your password here: ${input.setupUrl}\n\nThis one-time link expires ${expires} UTC. Your account has read-only reviewer access; administrator tools are not included.\n`,
      htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px"><p>Hi ${safeName},</p><p>Your HR Intelligence workspace request was approved.</p><p><a href="${safeUrl}" style="display:inline-block;background:#1e4e5c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Set your password</a></p><p style="color:#64748b;font-size:14px">This one-time link expires ${expires} UTC. Your account has read-only reviewer access; administrator tools are not included.</p></div>`
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('[auth] Brevo invitation failed', { status: response.status, detail: detail.slice(0, 240) });
    throw new Error(`Brevo invitation failed with HTTP ${response.status}`);
  }

  return { sent: true };
};
