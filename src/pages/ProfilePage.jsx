import { Link } from 'react-router-dom';
import { Mail, Shield, Calendar, Building2, Hash } from 'lucide-react';
import {
  getLastLoginAt,
  getSelectedDepartment,
  getSelectedUserEmail,
  getSelectedUsername,
} from '../data/labs';

export default function ProfilePage() {
  const username = getSelectedUsername() || 'User';
  const email = getSelectedUserEmail() || 'Not available';
  const department = getSelectedDepartment() || 'Not selected';
  const lastLoginAt = getLastLoginAt();
  const initials = username
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  const memberSince = 'Current session';
  const lastLogin = lastLoginAt
    ? new Date(lastLoginAt).toLocaleString()
    : 'Not available';

  return (
    <div className="profile-page mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Your account and preferences</p>
      </div>

      {/* Profile hero – soft gradient with more depth */}
      <div className="card-surface overflow-hidden p-0">
        <div className="profile-hero-inner relative bg-gradient-to-b from-emerald-200/90 via-emerald-100 to-emerald-50/80 px-6 pt-6 pb-6 dark:from-emerald-900/50 dark:via-gray-800 dark:to-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="profile-hero-avatar flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-300/90 text-2xl font-bold text-emerald-900 shadow-md dark:border-emerald-700 dark:bg-emerald-800 dark:text-emerald-100">
              {initials}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{username}</h2>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Authorized User</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/60 dark:bg-emerald-900/50 dark:text-emerald-300 dark:ring-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account details */}
        <div className="card-surface p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <Hash size={18} className="text-emerald-600 dark:text-emerald-400" />
            Account details
          </h3>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 border-b border-emerald-50 pb-3 dark:border-gray-600">
              <Mail size={18} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{email}</p>
              </div>
            </li>
            <li className="flex items-center gap-3 border-b border-emerald-50 pb-3 dark:border-gray-600">
              <Building2 size={18} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{department}</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <Calendar size={18} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Member since</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{memberSince}</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Activity & security */}
        <div className="card-surface p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <Shield size={18} className="text-emerald-600 dark:text-emerald-400" />
            Activity & security
          </h3>
          <div className="space-y-4">
            <div className="profile-last-login rounded-xl bg-emerald-50/80 p-4 dark:bg-gray-700/80 dark:border dark:border-gray-600">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Last login</p>
              <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{lastLogin}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences shortcut */}
      <div className="card-surface p-5">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage system preferences, notifications, and API settings from{' '}
          <Link to="/app/settings" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
