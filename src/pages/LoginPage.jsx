import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const onSubmit = (event) => { event.preventDefault(); navigate('/app/dashboard'); };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-bg to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8">
        <h1 className="text-center text-3xl font-bold text-primary">KRATOS</h1>
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">Smart Energy Management System</p>
        <input required placeholder="Username" className="mb-3 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400" />
        <input required type="password" placeholder="Password" className="mb-4 w-full rounded-xl border border-emerald-100 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400" />
        <button className="w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-emerald-600 dark:hover:bg-emerald-500">Sign In</button>
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">Access restricted to authorized personnel</p>
      </form>
    </div>
  );
}
