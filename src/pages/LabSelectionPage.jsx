import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDepartmentLabs,
  getSelectedDepartment,
  setSelectedLab,
} from '../data/labs';

export default function LabSelectionPage() {
  const navigate = useNavigate();
  const department = getSelectedDepartment();
  const labs = useMemo(() => getDepartmentLabs(department), [department]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-bg to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <div className="card-surface w-full max-w-4xl p-8">
        <h1 className="text-3xl font-bold text-primary">Select Lab</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Department: <span className="font-semibold">{department || 'Not selected'}</span>
        </p>

        {labs.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Labs are not configured for this department yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {labs.map((lab) => (
              <button
                key={lab}
                type="button"
                onClick={() => {
                  setSelectedLab(lab);
                  navigate('/app/dashboard');
                }}
                className="rounded-xl border border-emerald-100 p-4 text-left transition hover:bg-emerald-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <p className="font-semibold">{lab}</p>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
