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
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Labs are not configured for this department yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {labs.map((lab) => (
              <button
                key={lab.lab_id ?? lab.id ?? lab.name}
                type="button"
                onClick={() => handleLabClick(lab)}
                className="rounded-xl border border-emerald-100 p-4 text-left transition hover:bg-emerald-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <p className="font-semibold">{lab.name}</p>
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