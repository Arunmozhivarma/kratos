import { useEffect, useState, useCallback } from 'react';
import EnergyChartCard from '../components/EnergyChartCard';
import StatCard from '../components/StatCard';
import ToggleSwitch from '../components/ToggleSwitch';
import {
  getSelectedDepartmentId,
  getSelectedLab,
  getSelectedLabId,
  setSelectedLab,
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
  const [currentLabId, setCurrentLabId] = useState('');

  // Function to fetch dashboard data
  const fetchDashboardData = useCallback(() => {
    const labId = getSelectedLabId();
    const departmentId = getSelectedDepartmentId();
    const labName = getSelectedLab();

    console.log('Fetching dashboard data...');
    console.log('Lab ID:', labId);
    console.log('Department ID:', departmentId);
    console.log('Lab Name:', labName);

    if (!labId) {
      console.log('No lab selected, skipping data fetch.');
      setDashboardStats([
        { label: 'Current Power', value: '--' },
        { label: 'Energy Today', value: '--' },
        { label: 'Active Devices', value: '--' },
        { label: 'Last Updated', value: '--' },
      ]);
      setDashboardError('Please select a lab to view dashboard data.');
      setEnergyData([]);
      return;
    }

    // Fetch dashboard stats
    fetch(`http://localhost:5000/api/dashboard/${encodeURIComponent(labId)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load dashboard values by lab ID');
        }
        return res.json();
      })
      .then((data) => {
        console.log('Dashboard response by lab ID:', data);
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
      .catch((error) => {
        console.error('Error fetching dashboard by lab ID:', error);
        setDashboardError('Could not load dashboard values.');
      });

    // Fetch energy consumption data
    fetch(`http://localhost:5000/api/energy-consumption/${encodeURIComponent(labId)}?days=7`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load energy consumption data');
        }
        return res.json();
      })
      .then((data) => {
        console.log('Energy consumption data:', data);
        // Format data for chart: [{date: '2024-03-01', kWh: 25.5}, ...]
        const formattedData = data.map(item => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          kWh: parseFloat(item.daily_total)
        }));
        setEnergyData(formattedData);
      })
      .catch((error) => {
        console.error('Error fetching energy consumption:', error);
        setEnergyData([]);
      });
  }, []);

  // Check for lab changes and fetch data
  useEffect(() => {
    const labId = getSelectedLabId();
    if (labId !== currentLabId) {
      console.log('Lab changed from', currentLabId, 'to', labId);
      setCurrentLabId(labId || '');
      fetchDashboardData();
    }
  }, [getSelectedLabId(), currentLabId, fetchDashboardData]);

  // Add a refresh mechanism when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing data...');
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboardData]);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <EnergyChartCard data={energyData} />
      </div>
      <div className="space-y-6 xl:col-span-4">
        {dashboardError ? <p className="text-sm text-rose-500">{dashboardError}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">{dashboardStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} />)}</div>
        <div className="card-surface p-5">
          <h3 className="mb-4 font-semibold">Quick Device Control</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>Main Lights</span><ToggleSwitch checked={mainLights} onChange={setMainLights} /></div>
            <div className="flex items-center justify-between"><span>Fan</span><ToggleSwitch checked={fan} onChange={setFan} /></div>
          </div>
          <button onClick={() => { setMainLights(false); setFan(false); }} className="mt-4 w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600">Emergency OFF</button>
          <p className="mt-2 text-xs text-gray-500">Manual override enabled</p>
        </div>
      </div>
    </div>
  );
}
