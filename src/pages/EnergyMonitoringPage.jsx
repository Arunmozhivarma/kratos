import { useEffect, useState, useCallback } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getSelectedLabId } from '../data/labs';

export default function EnergyMonitoringPage() {
  const [energyComparisons, setEnergyComparisons] = useState([]);
  const [powerLineData, setPowerLineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentLabId, setCurrentLabId] = useState('');

  const fetchData = useCallback(async () => {
    const labId = getSelectedLabId();

    if (!labId) {
      setError('Please select a lab to view energy monitoring data.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Energy Monitoring: Fetching data for lab', labId);

      // Fetch energy comparisons
      const comparisonsResponse = await fetch(`http://localhost:5000/api/energy-comparisons/${encodeURIComponent(labId)}`);
      if (!comparisonsResponse.ok) throw new Error('Failed to fetch energy comparisons');
      const comparisonsData = await comparisonsResponse.json();
      console.log('Energy comparisons:', comparisonsData);
      setEnergyComparisons(comparisonsData);

      // Fetch power trend
      const powerResponse = await fetch(`http://localhost:5000/api/power-trend/${encodeURIComponent(labId)}`);
      if (!powerResponse.ok) throw new Error('Failed to fetch power trend');
      const powerData = await powerResponse.json();
      console.log('Power trend:', powerData);
      setPowerLineData(powerData);

    } catch (err) {
      console.error('Error fetching energy monitoring data:', err);
      setError('Failed to load energy monitoring data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for lab changes and fetch data
  useEffect(() => {
    const labId = getSelectedLabId();
    if (labId !== currentLabId) {
      console.log('Energy Monitoring: Lab changed from', currentLabId, 'to', labId);
      setCurrentLabId(labId || '');
      fetchData();
    }
  }, [getSelectedLabId(), currentLabId, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Energy Monitoring</h1>
          <p className="text-sm text-gray-600">Comparison of usage against yesterday, last week and last month</p>
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
          <p className="text-sm text-gray-600">Comparison of usage against yesterday, last week and last month</p>
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
        <p className="text-sm text-gray-600">Comparison of usage against yesterday, last week and last month</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {energyComparisons.map((item) => (
          <div key={item.label} className="card-surface p-4">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-2xl font-bold">{item.usage}</p>
            <p className={`text-sm ${item.positive ? 'text-emerald-600' : 'text-rose-600'}`}>{item.compare}</p>
          </div>
        ))}
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Power Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={powerLineData}>
              <XAxis dataKey="minute" />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${value} W`, 'Power']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line type="monotone" dataKey="power" stroke="#22C55E" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
