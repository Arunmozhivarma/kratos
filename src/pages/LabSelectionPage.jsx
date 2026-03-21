import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSelectedDepartment,
  getSelectedDepartmentId,
  setSelectedLab,
} from '../data/labs';

export default function LabSelectionPage() {
  const navigate = useNavigate();
  const department = getSelectedDepartment();
  const departmentId = getSelectedDepartmentId();

  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!departmentId) {
      setLabs([]);
      setLoading(false);
      setError('No department selected. Please login again.');
      return;
    }

    fetch(`http://localhost:5000/api/labs/${departmentId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load labs');
        }
        return res.json();
      })
      .then((data) => {
        console.log('Labs list from backend:', data);

        // Add test lab for testing purposes
        const testLab = {
          id: 'test-lab',
          lab_id: 'test-lab',
          name: 'Test Lab (Simulation)'
        };

        setLabs([testLab, ...data]);
        setError('');
      })
      .catch((err) => {
        console.error('Error loading labs:', err);
        setError('Could not load labs. Make sure backend is running.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [departmentId]);

  const handleLabClick = (lab) => {
    const selectedLabId = lab.lab_id ?? lab.id ?? null;

    console.log('CLICKED LAB:', lab);
    console.log('Resolved labId:', selectedLabId);

    if (!selectedLabId) {
      console.error('Lab ID missing. Cannot continue.');
      return;
    }

    // Save selection
    setSelectedLab(lab.name, selectedLabId);

    // Verify storage
    const storedLab = localStorage.getItem('kratos_lab');
    const storedLabId = localStorage.getItem('kratos_lab_id');

    console.log('Stored lab:', storedLab);
    console.log('Stored lab id:', storedLabId);

    if (!storedLabId) {
      console.error('Lab ID failed to store in localStorage');
      return;
    }

    // Navigate after confirming storage
    navigate('/app/dashboard');
  };

  const handleCameraClick = (lab) => {
    const selectedLabId = lab.lab_id ?? lab.id ?? null;

    if (!selectedLabId) {
      console.error('Lab ID missing. Cannot open camera.');
      return;
    }

    // Navigate to camera live view with lab info
    navigate('/camera-live', {
      state: {
        labId: selectedLabId,
        labName: lab.name
      }
    });
  };

  const handleCreateLab = () => {
    navigate('/lab-create');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-bg to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <div className="card-surface w-full max-w-4xl p-8">
        <h1 className="text-3xl font-bold text-primary">Select Lab</h1>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Department:{' '}
          <span className="font-semibold">
            {department || 'Not selected'}
          </span>
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        ) : loading ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            Loading labs...
          </div>
        ) : labs.length === 0 ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Labs are not configured for this department yet.
            </div>
            <button
              onClick={handleCreateLab}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
            >
              Create New Lab
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {labs.map((lab) => (
                <div key={lab.lab_id ?? lab.id ?? lab.name} className="rounded-xl border border-emerald-100 p-4 dark:border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-semibold">{lab.name}</p>
                    <button
                      onClick={() => handleCameraClick(lab)}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs font-medium text-white transition"
                      title="Open Camera"
                    >
                      📷 Camera
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLabClick(lab)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-left transition hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 text-sm"
                  >
                    Enter Dashboard
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 dark:border-gray-600">
              <button
                onClick={handleCreateLab}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
              >
                Create New Lab
              </button>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                Add a new lab to the {department} department
              </p>
            </div>
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