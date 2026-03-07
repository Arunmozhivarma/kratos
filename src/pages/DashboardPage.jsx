import { useEffect, useState } from 'react';
import DevicesTable from '../components/DevicesTable';
import EnergyChartCard from '../components/EnergyChartCard';
import StatCard from '../components/StatCard';
import SummaryCard from '../components/SummaryCard';
import ToggleSwitch from '../components/ToggleSwitch';
import { devices, energyDailyData } from '../data/mockData';
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

  useEffect(() => {
    const labId = getSelectedLabId();
    const departmentId = getSelectedDepartmentId();
    const labName = getSelectedLab();

    const applyDashboardData = (data) => {
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
    };

    if (labId) {
      fetch(`http://localhost:5000/api/dashboard/${encodeURIComponent(labId)}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to load dashboard values by lab ID');
          }
          return res.json();
        })
        .then((data) => {
          console.log('Dashboard response by lab ID:', data);
          applyDashboardData(data);
        })
        .catch((error) => {
          console.error('Error fetching dashboard by lab ID:', error);
          setDashboardError('Could not load dashboard values.');
        });
      return;
    }

    if (departmentId && labName) {
      fetch(
        `http://localhost:5000/api/dashboard?departmentId=${encodeURIComponent(
          departmentId
        )}&labName=${encodeURIComponent(labName)}`
      )
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to load dashboard values by lab name');
          }
          return res.json();
        })
        .then((data) => {
          console.log('Dashboard response by lab name:', data);
          if (data.lab_id !== undefined && data.lab_id !== null) {
            setSelectedLab(labName, data.lab_id);
          }
          applyDashboardData(data);
        })
        .catch((error) => {
          console.error('Error fetching dashboard by lab name:', error);
          setDashboardError('Could not load dashboard values.');
        });
      return;
    }

    setDashboardError('No lab selected.');
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <SummaryCard />
        <EnergyChartCard data={energyDailyData} />
        <DevicesTable devices={devices} />
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
