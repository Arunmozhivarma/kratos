import { useEffect, useState, useCallback } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { getSelectedLabId } from '../data/labs';

function getEnergyDisplayScale(values) {
  const totalKwh = values.reduce((sum, value) => sum + Number(value || 0), 0);

  return totalKwh > 0 && totalKwh < 0.01
    ? { unit: 'Wh', multiplier: 1000, digits: 3 }
    : { unit: 'kWh', multiplier: 1, digits: 3 };
}

function formatScaledEnergy(value, scale) {
  return `${(Number(value || 0) * scale.multiplier).toFixed(scale.digits)} ${scale.unit}`;
}

export default function AnalyticsPage() {
  const [summaryStats, setSummaryStats] = useState([]);
  const [weeklyEnergyCostData, setWeeklyEnergyCostData] = useState([]);
  const [sixMonthConsumptionData, setSixMonthConsumptionData] = useState([]);
  const [topEnergyConsumers, setTopEnergyConsumers] = useState([]);
  const [peakUsageHours, setPeakUsageHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    const labId = getSelectedLabId();

    if (!labId) {
      setError('Please select a lab to view analytics data.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        summaryResponse,
        weeklyResponse,
        sixMonthResponse,
        consumersResponse,
        peakHoursResponse
      ] = await Promise.all([
        fetch(`http://localhost:5000/api/analytics-summary/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/weekly-energy-cost/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/six-month-consumption/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/top-energy-consumers/${encodeURIComponent(labId)}`),
        fetch(`http://localhost:5000/api/peak-usage-hours/${encodeURIComponent(labId)}`)
      ]);

      if (!summaryResponse.ok) throw new Error('Failed to fetch analytics summary');
      if (!weeklyResponse.ok) throw new Error('Failed to fetch weekly energy cost');
      if (!sixMonthResponse.ok) throw new Error('Failed to fetch six month consumption');
      if (!consumersResponse.ok) throw new Error('Failed to fetch top energy consumers');
      if (!peakHoursResponse.ok) throw new Error('Failed to fetch peak usage hours');

      const summaryData = await summaryResponse.json();
      const weeklyData = await weeklyResponse.json();
      const sixMonthData = await sixMonthResponse.json();
      const consumersData = await consumersResponse.json();
      const peakHoursData = await peakHoursResponse.json();

      setSummaryStats(summaryData);
      setWeeklyEnergyCostData(weeklyData);
      setSixMonthConsumptionData(sixMonthData);
      setTopEnergyConsumers(consumersData);
      setPeakUsageHours(peakHoursData);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
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

  const handleExportReport = () => {
    const labId = getSelectedLabId();
    const reportData = {
      labId,
      summaryStats,
      weeklyEnergyCostData,
      sixMonthConsumptionData,
      topEnergyConsumers,
      peakUsageHours,
      exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `energy-report-lab-${labId}-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics / Report</h1>
            <p className="text-sm text-gray-600">Weekly and long-term energy performance analysis</p>
          </div>
        </div>
        <div className="card-surface p-8">
          <div className="text-center text-gray-500">Loading analytics data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics / Report</h1>
            <p className="text-sm text-gray-600">Weekly and long-term energy performance analysis</p>
          </div>
        </div>
        <div className="card-surface p-8">
          <div className="text-center text-rose-500">{error}</div>
        </div>
      </div>
    );
  }

  const weeklyEnergyScale = getEnergyDisplayScale(weeklyEnergyCostData.map((item) => item.energy));
  const weeklyChartData = weeklyEnergyCostData.map((item) => ({
    ...item,
    energyDisplay: Number(item.energy || 0) * weeklyEnergyScale.multiplier,
    cost: Number(item.cost || 0),
  }));

  const sixMonthEnergyScale = getEnergyDisplayScale(
    sixMonthConsumptionData.map((item) => item.consumption)
  );
  const sixMonthChartData = sixMonthConsumptionData.map((item) => ({
    ...item,
    consumptionDisplay: Number(item.consumption || 0) * sixMonthEnergyScale.multiplier,
  }));

  const peakHourEnergyScale = getEnergyDisplayScale(peakUsageHours.map((item) => item.usage));
  const maxPeakUsage = Math.max(...peakUsageHours.map((item) => Number(item.usage || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics / Report</h1>
          <p className="text-sm text-gray-600">Weekly and long-term energy performance analysis</p>
        </div>
        <button
          onClick={handleExportReport}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Export Report
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryStats.map((stat) => (
          <div key={stat.metric} className="card-surface p-4">
            <p className="text-sm text-gray-500">{stat.metric}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Weekly Energy and Cost Analysis</h3>
        <div style={{ height: '320px', width: '100%', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  name === 'Energy'
                    ? `${Number(value).toFixed(weeklyEnergyScale.digits)} ${weeklyEnergyScale.unit}`
                    : `$${Number(value).toFixed(2)}`,
                  name,
                ]}
              />
              <Legend />
              <Bar dataKey="energyDisplay" fill="#3B82F6" name="Energy" />
              <Bar dataKey="cost" fill="#10B981" name="Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Six Month Energy Consumption Trend</h3>
        <div style={{ height: '320px', width: '100%', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sixMonthChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(sixMonthEnergyScale.digits)} ${sixMonthEnergyScale.unit}`,
                  'Energy',
                ]}
              />
              <Line type="monotone" dataKey="consumptionDisplay" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-surface p-5">
          <h3 className="mb-1 font-semibold">Top Energy Consumers</h3>
          <div className="space-y-3">
            {topEnergyConsumers.map((item) => (
              <div key={item.device}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.device}</span>
                  <span>{item.consumption}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{
                      width: `${Math.min(
                        (Number(item.percentage || 0)),
                        100
                      )}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface p-5">
          <h3 className="mb-1 font-semibold">Peak Energy Hours</h3>
          <div className="space-y-3">
            {peakUsageHours.map((item) => (
              <div key={item.hour}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.hour}</span>
                  <span>{formatScaledEnergy(item.usage, peakHourEnergyScale)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${maxPeakUsage > 0 ? Math.min((Number(item.usage || 0) / maxPeakUsage) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}