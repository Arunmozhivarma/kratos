import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearLabSelection,
  setSelectedDepartment,
} from '../data/labs';

const DEPARTMENTS = [
  'Apparel & Fashion Design',
  'Applied Mathematics & Computational Sciences',
  'Applied Science',
  'Automobile Engineering',
  'Biotechnology',
  'Biomedical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'English',
  'Fashion Technology',
  'Humanities',
  'Instrumentation & Control Systems Engineering',
  'Information Technology',
  'Mathematics',
  'Computer Applications',
  'Mechanical Engineering',
  'Metallurgical Engineering',
  'Physics',
  'Production Engineering',
  'Robotics & Automation Engineering',
  'Textile Technology',
  'Management Sciences',
  'Library',
  'Physical Education',
  'Network Maintenance Cell',
  'Computer Maintenance Cell',
  'Power House',
  'Main Office',
  'Accounts Section',
  'Academic Section',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (event) => {
    event.preventDefault();
    if (!department) {
      setError('Please select your department.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSelectedDepartment(department);
    clearLabSelection();
    navigate('/lab-select');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-bg to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8">
        <h1 className="text-center text-3xl font-bold text-primary">KRATOS</h1>
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">Smart Energy Management System</p>
        <div className="mb-5 flex rounded-full bg-gray-100 p-1 text-sm dark:bg-gray-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${
              mode === 'login'
                ? 'bg-white text-primary shadow-sm dark:bg-gray-900'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
            }}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${
              mode === 'signup'
                ? 'bg-white text-primary shadow-sm dark:bg-gray-900'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Signup
          </button>
        </div>

        {mode === 'signup' && (
          <>
            <input
              required
              placeholder="Username"
              className="mb-3 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
            <select
              required
              className="mb-3 w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map((departmentName) => (
                <option key={departmentName} value={departmentName}>
                  {departmentName}
                </option>
              ))}
            </select>
            <input
              required
              type="email"
              placeholder="Email ID"
              className="mb-3 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
            <div className="mb-4 flex gap-3">
              <input
                required
                type="password"
                placeholder="Password"
                className="w-1/2 rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                required
                type="password"
                placeholder="Confirm Password"
                className="w-1/2 rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </>
        )}

        {mode === 'login' && (
          <>
            <input
              required
              placeholder="Username or Email ID"
              className="mb-3 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
            <select
              required
              className="mb-3 w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map((departmentName) => (
                <option key={departmentName} value={departmentName}>
                  {departmentName}
                </option>
              ))}
            </select>
            <input
              required
              type="password"
              placeholder="Password"
              className="mb-4 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
          </>
        )}

        {error && (
          <p className="mb-3 text-sm text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <button className="w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-emerald-600 dark:hover:bg-emerald-500">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Access restricted to authorized personnel
        </p>
      </form>
    </div>
  );
}
