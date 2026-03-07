import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearLabSelection,
  setSelectedDepartment as saveSelectedDepartment,
} from '../data/labs';

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/departments')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load departments');
        }
        return res.json();
      })
      .then((data) => {
        setDepartments(data);
      })
      .catch((err) => {
        console.error('Error loading departments:', err);
        setError('Could not load departments. Make sure backend is running.');
      });
  }, []);

  const getSelectedDepartmentName = () => {
    const selectedDept = departments.find(
      (dept) => String(dept.department_id) === String(selectedDepartmentId)
    );
    return selectedDept ? selectedDept.name : '';
  };

  const handleSignup = async (event) => {
    event.preventDefault();

    if (!signupUsername || !signupEmail || !selectedDepartmentId || !signupPassword || !confirmPassword) {
      setError('Please fill all signup fields.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('http://localhost:5000/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          department_id: Number(selectedDepartmentId),
          password: signupPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Signup failed.');
        return;
      }

      const departmentName = getSelectedDepartmentName();
      saveSelectedDepartment(departmentName, selectedDepartmentId);
      clearLabSelection();

      navigate('/lab-select');
    } catch (err) {
      console.error('Signup error:', err);
      setError('Server error during signup.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!loginIdentifier || !selectedDepartmentId || !loginPassword) {
      setError('Please fill all login fields.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: loginIdentifier,
          department_id: Number(selectedDepartmentId),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed.');
        return;
      }

      const departmentName = getSelectedDepartmentName();
      saveSelectedDepartment(departmentName, selectedDepartmentId);
      clearLabSelection();

      navigate('/lab-select');
    } catch (err) {
      console.error('Login error:', err);
      setError('Server error during login.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event) => {
    if (mode === 'login') {
      handleLogin(event);
    } else {
      handleSignup(event);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-bg to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8">
        <h1 className="text-center text-3xl font-bold text-primary">KRATOS</h1>
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Smart Energy Management System
        </p>

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
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
            />

            <select
              required
              className="mb-3 w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.department_id} value={dept.department_id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <input
              required
              type="email"
              placeholder="Email ID"
              className="mb-3 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
            />

            <div className="mb-4 flex gap-3">
              <input
                required
                type="password"
                placeholder="Password"
                className="w-1/2 rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
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
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
            />

            <select
              required
              className="mb-3 w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.department_id} value={dept.department_id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <input
              required
              type="password"
              placeholder="Password"
              className="mb-4 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </>
        )}

        {error && (
          <p className="mb-3 text-sm text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-emerald-500"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Access restricted to authorized personnel
        </p>
      </form>
    </div>
  );
}
