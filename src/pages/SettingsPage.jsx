import { useState } from 'react';
import ToggleSwitch from '../components/ToggleSwitch';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({
    systemName: 'KRATOS Energy System',
    timezone: 'UTC+00:00',
    endpoint: 'https://api.kratos.local',
    interval: '5'
  });
  const [notif, setNotif] = useState({ email: true, alert: true, updates: false });
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
          <div className="mt-3 flex items-center justify-between border-b border-emerald-100 pb-3 dark:border-gray-600">
            <div>
              <p className="text-sm font-medium">Dark mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark theme</p>
            </div>
            <ToggleSwitch checked={theme === 'dark'} onChange={(on) => setTheme(on ? 'dark' : 'light')} />
          </div>
          <label className="mt-3 block text-sm text-gray-600 dark:text-gray-400">System Name</label>
          <input value={form.systemName} onChange={(e) => setForm((p) => ({ ...p, systemName: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" />
          <label className="mt-3 block text-sm text-gray-600 dark:text-gray-400">Time Zone</label>
          <select value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"><option>UTC+00:00</option><option>UTC+07:00</option></select>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold">Notification</h3>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm">Email</span><ToggleSwitch checked={notif.email} onChange={(v) => setNotif((p) => ({ ...p, email: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Alert</span><ToggleSwitch checked={notif.alert} onChange={(v) => setNotif((p) => ({ ...p, alert: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">System Update</span><ToggleSwitch checked={notif.updates} onChange={(v) => setNotif((p) => ({ ...p, updates: v }))} /></div>
          </div>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold">Security</h3>
          <div className="mt-3 space-y-2 text-sm">
            <button className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left font-medium text-gray-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Change Password</button>
            <button className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left font-medium text-gray-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Two-Factor Authentication</button>
            <button className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left font-medium text-gray-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Session Management</button>
          </div>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold">Network Settings</h3>
          <label className="mt-3 block text-sm text-gray-600">API End Point</label>
          <input value={form.endpoint} onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2" />
          <label className="mt-3 block text-sm text-gray-600">Update Interval</label>
          <input value={form.interval} onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value }))} className="mt-1 w-full rounded-xl border border-emerald-100 px-3 py-2" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-600">Settings saved (UI only)</span>}
        <button onClick={onSave} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-emerald-600 dark:hover:bg-emerald-500">Save Changes</button>
      </div>
    </div>
  );
}
