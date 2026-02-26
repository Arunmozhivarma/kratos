import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (event) => {
    event.preventDefault();
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    // For now, both login and signup just navigate into the app
    navigate('/app/dashboard');
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
              placeholder="Username"
              className="mb-3 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
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
