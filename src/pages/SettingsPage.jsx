import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getSelectedDepartmentId, getSelectedUserIdentifier } from '../data/labs';
import { getSavedSettings, SETTINGS_STORAGE_KEY } from '../data/settings';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState(() => getSavedSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (securityOpen) {
        const identifier = getSelectedUserIdentifier();
        const departmentId = getSelectedDepartmentId();

        if (!identifier || !departmentId) {
          setError('User session not found. Please login again.');
          return;
        }

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
          setError('Fill all password fields before saving.');
          return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          setError('New password and confirm password do not match.');
          return;
        }

        const response = await fetch('http://localhost:5000/api/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier,
            department_id: Number(departmentId),
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Failed to update password.');
          return;
        }

        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setSecurityOpen(false);
        setMessage('Password updated successfully.');
      } else {
        setMessage('Settings saved.');
      }

      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(form));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-600">Configure preferences and options</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h3 className="font-semibold">General Settings</h3>
          <label className="mt-3 block text-sm text-gray-600 dark:text-gray-400">Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <label className="mt-3 block text-sm text-gray-600 dark:text-gray-400">System Name</label>
          <input value={form.systemName} onChange={(e) => setForm((p) => ({ ...p, systemName: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
          <label className="mt-3 block text-sm text-gray-600 dark:text-gray-400">Time Zone</label>
          <select value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <option>Asia/Kolkata (UTC+05:30)</option>
            <option>UTC (UTC+00:00)</option>
            <option>Asia/Dubai (UTC+04:00)</option>
            <option>Asia/Singapore (UTC+08:00)</option>
            <option>Europe/London (UTC+00:00)</option>
            <option>America/New_York (UTC-05:00)</option>
          </select>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold">Dashboard Preferences</h3>
          <label className="mt-3 block text-sm text-gray-600 dark:text-gray-400">Landing Page</label>
          <select value={form.landingPage} onChange={(e) => setForm((p) => ({ ...p, landingPage: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <option>Dashboard</option>
            <option>Energy Monitoring</option>
            <option>Analytics</option>
            <option>Device Control</option>
          </select>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold">Security</h3>
          <div className="mt-3 space-y-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setSecurityOpen((value) => !value);
                setError('');
                setMessage('');
              }}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left font-medium text-gray-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Change Password
            </button>
            {securityOpen && (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-gray-600 dark:bg-gray-800/60">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-sm text-rose-500">{error}</span>}
        {!error && saved && <span className="text-sm text-emerald-600">{message || 'Settings saved.'}</span>}
        <button onClick={onSave} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-emerald-500">{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  );
}
