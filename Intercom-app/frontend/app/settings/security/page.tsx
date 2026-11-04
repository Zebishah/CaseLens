'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) { setError('Passwords do not match.'); return; }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('Use a password no longer than 72 UTF-8 bytes.'); return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      router.replace('/login?reason=password-changed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change your password.');
    } finally { setSaving(false); }
  };

  return <AppShell title="Account security" description="Manage the password for your administrator account.">
    <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary">Change password</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Enter your current password to continue. After changing it, all existing sessions will end and you will need to sign in again.</p>
      {error ? <div role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <form onSubmit={submit} className="mt-6 space-y-5">
        <label className="block text-sm font-medium text-slate-700">Current password<input type="password" required maxLength={200} autoComplete="current-password" className="dash-field mt-2" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">New password<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" className="dash-field mt-2" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><span className="mt-1.5 block text-xs font-normal text-muted">Use at least 12 characters, up to 72 UTF-8 bytes.</span></label>
        <label className="block text-sm font-medium text-slate-700">Confirm new password<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" className="dash-field mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button type="submit" disabled={saving} className="btn-primary rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60">{saving ? 'Changing password…' : 'Change password'}</button>
      </form>
    </section>
  </AppShell>;
}
