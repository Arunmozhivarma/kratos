import { useEffect, useState, useCallback } from 'react';
import EnergyChartCard from '../components/EnergyChartCard';
import StatCard from '../components/StatCard';
import ToggleSwitch from '../components/ToggleSwitch';
import {
  getSelectedDepartmentId,
  getSelectedLab,
  getSelectedLabId,
} from '../data/labs';
export default function DashboardPage() {
  const [mainLights, setMainLights] = useState(true);
  const [fan, setFan] = useState(false);

  const [dashboardStats, setDashboardStats] = useState([
    { label: 'Current Power', value: '--' },
    { label: 'Energy Today', value: '--' },
    { label: 'Active Devices', value: '--' },
    { label: 'Last Updated', value: '--' },
  ]);

  const [dashboardError, setDashboardError] = useState('');
  const [energyData, setEnergyData] = useState([]);

  // 🔥 Main fetch function
  const fetchDashboardData = useCallback(() => {
    const labId = getSelectedLabId();
    const departmentId = getSelectedDepartmentId();
    const labName = getSelectedLab();

    console.log('Fetching dashboard data...');
    console.log('Lab ID:', labId);
    console.log('Department ID:', departmentId);
    console.log('Lab Name:', labName);

    if (!labId) {
      setDashboardError('Please select a lab.');
      setEnergyData([]);
      return;
    }

    // =========================
    // 📊 Dashboard Stats
    // =========================
    fetch(`http://localhost:5000/api/dashboard/${encodeURIComponent(labId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard data');
        return res.json();
      })
      .then((data) => {
        const formattedUpdatedAt = data.last_updated
          ? new Date(data.last_updated).toLocaleString()
          : '--';

        setDashboardStats([
          {
            label: 'Current Power',
            value: `${Number(data.current_power_watts ?? 0).toFixed(2)} W`,
          },
          {
            label: 'Energy Today',
            value: `${Number(data.energy_today_kwh ?? 0).toFixed(2)} kWh`,
          },
          {
            label: 'Active Devices',
            value: String(data.active_devices ?? 0),
          },
          {
            label: 'Last Updated',
            value: formattedUpdatedAt,
          },
        ]);

        setDashboardError('');
      })
      .catch((err) => {
        console.error(err);
        setDashboardError('Failed to load dashboard stats');
      });

    // =========================
    // 📈 Energy Chart Data
    // =========================
    fetch(
      `http://localhost:5000/api/energy-consumption/${encodeURIComponent(
        labId
      )}?days=7`
    )
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load energy data');
        return res.json();
      })
      .then((data) => {
        console.log('Energy consumption data:', data);

        const formattedData = data
          .map((item) => ({
            dateObj: new Date(item.date),
            kWh: parseFloat(item.total), // ✅ FIXED
          }))
          .sort((a, b) => a.dateObj - b.dateObj) // ✅ SORT
          .map((item) => ({
            date: item.dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            kWh: item.kWh,
          }));

        setEnergyData(formattedData);
      })
      .catch((err) => {
        console.error(err);
        setEnergyData([]);
      });
  }, []);

  // ✅ Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ✅ Refresh when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Tab active → refreshing...');
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboardData]);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      {/* 📈 Chart */}
      <div className="space-y-6 xl:col-span-8">
        <EnergyChartCard data={energyData} />
      </div>

      {/* 📊 Stats + Controls */}
      <div className="space-y-6 xl:col-span-4">
        {dashboardError && (
          <p className="text-sm text-rose-500">{dashboardError}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {dashboardStats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>

        {/* ⚡ Controls */}
        <div className="card-surface p-5">
          <h3 className="mb-4 font-semibold">Quick Device Control</h3>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Main Lights</span>
              <ToggleSwitch
                checked={mainLights}
                onChange={setMainLights}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Fan</span>
              <ToggleSwitch checked={fan} onChange={setFan} />
            </div>
          </div>

          <button
            onClick={() => {
              setMainLights(false);
              setFan(false);
            }}
            className="mt-4 w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600"
          >
            Emergency OFF
          </button>

          <p className="mt-2 text-xs text-gray-500">
            Manual override enabled
          </p>
        </div>
      </div>
    </div>
  );
}
