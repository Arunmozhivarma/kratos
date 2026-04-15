import { useEffect, useState, useCallback } from 'react';
import { getSelectedLabId } from '../data/labs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

function formatEnergyValue(kwh) {
  const numericKwh = Number(kwh || 0);

  if (numericKwh > 0 && numericKwh < 0.01) {
    return `${(numericKwh * 1000).toFixed(3)} Wh`;
  }

  return `${numericKwh.toFixed(3)} kWh`;
}

function formatCostValue(cost) {
  return `$${Number(cost || 0).toFixed(2)}`;
}

export default function EnergyMonitoringPage() {
  const [energyComparisons, setEnergyComparisons] = useState([]);
  const [powerLineData, setPowerLineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const labId = getSelectedLabId();

      if (!labId) {
        setError('Please select a lab from the dashboard to view energy monitoring data.');
        setEnergyComparisons([]);
        setPowerLineData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const [comparisonsResponse, powerResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/energy-comparisons/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/power-trend/${encodeURIComponent(labId)}`)
      ]);

      if (!comparisonsResponse.ok) throw new Error('Failed to fetch energy comparisons');
      if (!powerResponse.ok) throw new Error('Failed to fetch power trend');

      const comparisonsData = await comparisonsResponse.json();
      const powerData = await powerResponse.json();

      setEnergyComparisons(comparisonsData);
      setPowerLineData(powerData);
    } catch (err) {
      console.error('Error fetching energy monitoring data:', err);
      setError('Failed to load energy monitoring data. Please try again.');
      setEnergyComparisons([]);
      setPowerLineData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Energy Monitoring</h1>
          <p className="text-sm text-gray-600">Comparison of energy consumption against yesterday, last week and last month</p>
        </div>
        <div className="card-surface p-8">
          <div className="text-center text-gray-500">Loading energy monitoring data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Energy Monitoring</h1>
          <p className="text-sm text-gray-600">Comparison of energy consumption against yesterday, last week and last month</p>
        </div>
        <div className="card-surface p-8">
          <div className="text-center text-rose-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Energy Monitoring</h1>
        <p className="text-sm text-gray-600">Comparison of energy consumption against yesterday, last week and last month</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {energyComparisons.length > 0 ? (
          energyComparisons.map((item) => (
            <div key={item.period} className="card-surface p-4">
              <p className="text-sm text-gray-500">{item.period}</p>
              <p className="text-2xl font-bold">{formatEnergyValue(item.consumption)}</p>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center text-gray-500">
            No energy comparison data available
          </div>
        )}
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Power Trend</h3>
        {powerLineData.length > 0 ? (
          <div style={{ height: '320px', width: '100%', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerLineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="minute" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)} W`, 'Power']}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line type="monotone" dataKey="power" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No power trend data available
          </div>
        )}
      </div>
    </div>
  );
}