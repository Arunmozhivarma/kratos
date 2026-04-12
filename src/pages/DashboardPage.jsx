import { useEffect, useState, useCallback } from 'react';
import EnergyChartCard from '../components/EnergyChartCard';
import StatCard from '../components/StatCard';
import { getSelectedLabId } from '../data/labs';

function formatEnergyValue(kwh) {
  const numericKwh = Number(kwh ?? 0);

  if (numericKwh > 0 && numericKwh < 0.01) {
    return `${(numericKwh * 1000).toFixed(3)} Wh`;
  }

  return `${numericKwh.toFixed(2)} kWh`;
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

  const fetchDashboardData = useCallback(() => {
    const labId = getSelectedLabId();

    if (!labId) {
      setDashboardError('Please select a lab.');
      setDashboardStats([
        { label: 'Current Power', value: '--' },
        { label: 'Energy Today', value: '--' },
        { label: 'Active Devices', value: '--' },
        { label: 'Last Updated', value: '--' },
      ]);
      setEnergyData([]);
      return;
    }

    fetch(`http://localhost:5000/api/dashboard/${encodeURIComponent(labId)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load dashboard data');
        }
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
            value: formatEnergyValue(data.energy_today_kwh),
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

    fetch(
      `http://localhost:5000/api/energy-consumption/${encodeURIComponent(
        labId
      )}?days=7`
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load energy data');
        }
        return res.json();
      })
      .then((data) => {
        const formattedData = data
          .map((item) => ({
            dateObj: new Date(item.date),
            kWh: parseFloat(item.total),
          }))
          .sort((a, b) => a.dateObj - b.dateObj)
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

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
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
