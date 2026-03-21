import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSelectedDepartmentId } from '../data/labs';

export default function LabCreationPage() {
  const navigate = useNavigate();
  const departmentId = getSelectedDepartmentId();

  const [labName, setLabName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdLab, setCreatedLab] = useState(null);

  const handleCreateLab = async (e) => {
    e.preventDefault();

    if (!labName.trim()) {
      setError('Lab name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:5000/api/labs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: labName.trim(),
          department_id: departmentId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create lab');
      }

      setCreatedLab(data.lab);
      setSuccess(`Lab "${data.lab.name}" created successfully!`);
      setLabName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureZones = () => {
    if (!createdLab) return;

    // Navigate to web-based zone configuration page
    navigate('/zone-config', {
      state: {
        labId: createdLab.lab_id,
        labName: createdLab.name
      }
    });
  };

  const handleBackToLabs = () => {
    navigate('/lab-select');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-bg to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <div className="card-surface w-full max-w-2xl p-8">
        <h1 className="text-3xl font-bold text-primary">Create New Lab</h1>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Department ID: <span className="font-semibold">{departmentId}</span>
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {!createdLab ? (
          <form onSubmit={handleCreateLab} className="mt-6 space-y-4">
            <div>
              <label htmlFor="labName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Lab Name
              </label>
              <input
                type="text"
                id="labName"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-4 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Enter lab name"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Lab'}
              </button>
              <button
                type="button"
                onClick={handleBackToLabs}
                disabled={loading}
                className="rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200 disabled:opacity-50"
              >
                Back to Labs
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-semibold text-emerald-800">Lab Created Successfully!</h3>
              <p className="text-sm text-emerald-700">
                Lab ID: {createdLab.lab_id}<br />
                Name: {createdLab.name}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Next Steps:</h3>

              <button
                onClick={handleConfigureZones}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Configuring Zones...' : 'Configure Zones'}
              </button>

              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                This will open the zone configuration tool to set up detection zones and devices.
              </p>

              <button
                onClick={handleBackToLabs}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200 disabled:opacity-50"
              >
                Back to Labs List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
