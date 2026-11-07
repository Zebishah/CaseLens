import { escapeEmailHtml, sendAccountEmail } from './account-email.service.js';

export const sendWorkspaceInviteEmail = async (input: {
  email: string; name: string; setupUrl: string; expiresAt: Date;
}): Promise<{ sent: boolean }> => {
  const expires = input.expiresAt.toISOString();
  return sendAccountEmail({
    email: input.email,
    subject: 'Your Case Lense workspace access',
    text: `Hi ${input.name},\n\nYour workspace request was approved. Verify your email and set your password here: ${input.setupUrl}\n\nThis one-time link expires ${expires}. Your account has read-only reviewer access.`,
    html: `<p>Hi ${escapeEmailHtml(input.name)},</p><p>Your Case Lense workspace request was approved.</p><p><a href="${escapeEmailHtml(input.setupUrl)}">Verify email and set password</a></p><p>This one-time link expires ${expires}. Your account has read-only reviewer access; administrator tools are not included.</p>`
  });
};
