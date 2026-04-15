import { useEffect, useState, useCallback } from 'react';
import EnergyChartCard from '../components/EnergyChartCard';
import StatCard from '../components/StatCard';
import { getSelectedLabId } from '../data/labs';

function formatEnergyValue(kwh) {
  const numericKwh = Number(kwh ?? 0);

  if (numericKwh > 0 && numericKwh < 0.01) {
    return `${(numericKwh * 1000).toFixed(3)} Wh`;
  }

  return `${numericKwh.toFixed(3)} kWh`;
}

export default function DashboardPage() {
  const [dashboardStats, setDashboardStats] = useState([
    { label: 'Current Power', value: '--' },
    { label: 'Energy Today', value: '--' },
    { label: 'Active Devices', value: '--' },
    { label: 'Last Updated', value: '--' },
  ]);
  const [dashboardError, setDashboardError] = useState('');
  const [energyData, setEnergyData] = useState([]);
  const [devices, setDevices] = useState([]);

  const resetDashboard = () => {
    setDashboardStats([
      { label: 'Current Power', value: '--' },
      { label: 'Energy Today', value: '--' },
      { label: 'Active Devices', value: '--' },
      { label: 'Last Updated', value: '--' },
    ]);
    setEnergyData([]);
    setDevices([]);
  };

  const fetchDashboardData = useCallback(async () => {
    const labId = getSelectedLabId();

    if (!labId) {
      setDashboardError('Please select a lab.');
      resetDashboard();
      return;
    }

    try {
      const [dashboardRes, energyRes, devicesRes] = await Promise.all([
        fetch(`http://localhost:5000/api/dashboard/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/energy-consumption/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/devices/${encodeURIComponent(labId)}`),
      ]);

      if (!dashboardRes.ok) throw new Error('Failed to load dashboard data');
      if (!energyRes.ok) throw new Error('Failed to load energy data');
      if (!devicesRes.ok) throw new Error('Failed to load device data');

      const dashboardData = await dashboardRes.json();
      const energyRaw = await energyRes.json();
      const devicesData = await devicesRes.json();

      const formattedUpdatedAt = dashboardData.last_updated
        ? new Date(dashboardData.last_updated).toLocaleString()
        : '--';

      setDashboardStats([
        {
          label: 'Current Power',
          value: `${Number(dashboardData.current_power_watts ?? 0).toFixed(2)} W`,
        },
        {
          label: 'Energy Today',
          value: formatEnergyValue(dashboardData.energy_today_kwh),
        },
        {
          label: 'Active Devices',
          value: String(dashboardData.active_devices ?? 0),
        },
        {
          label: 'Last Updated',
          value: formattedUpdatedAt,
        },
      ]);

      const formattedEnergyData = energyRaw
        .map((item) => ({
          dateObj: new Date(item.date),
          kWh: parseFloat(item.total ?? 0),
        }))
        .sort((a, b) => a.dateObj - b.dateObj)
        .map((item) => ({
          date: item.dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          kWh: item.kWh,
        }));

      setEnergyData(formattedEnergyData);
      setDevices(devicesData);
      setDashboardError('');
    } catch (err) {
      console.error(err);
      setDashboardError('Failed to load dashboard stats');
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboardData]);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <EnergyChartCard data={energyData} />

        <div className="card-surface p-5">
          <h3 className="mb-3 font-semibold">Live Device Status</h3>
          {devices.length === 0 ? (
            <p className="text-sm text-gray-500">No devices available</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {devices.map((device) => (
                <div
                  key={`${device.lab_id}-${device.device_id}`}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <p className="text-sm text-gray-500">Device {device.device_id}</p>
                  <p className="text-lg font-semibold">
                    {device.device_status ? 'ON' : 'OFF'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Current: {Number(device.sensor_reading ?? 0).toFixed(3)} A
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
      </div>
    </div>
  );
}