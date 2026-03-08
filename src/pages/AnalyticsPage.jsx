import { useEffect, useState, useCallback } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getSelectedLabId } from '../data/labs';

export default function AnalyticsPage() {
  const [summaryStats, setSummaryStats] = useState([]);
  const [weeklyEnergyCostData, setWeeklyEnergyCostData] = useState([]);
  const [sixMonthConsumptionData, setSixMonthConsumptionData] = useState([]);
  const [topEnergyConsumers, setTopEnergyConsumers] = useState([]);
  const [peakUsageHours, setPeakUsageHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentLabId, setCurrentLabId] = useState('');

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
      console.log('Analytics: Fetching data for lab', labId);

      // Fetch all analytics data in parallel
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

      // Check all responses
      if (!summaryResponse.ok) throw new Error('Failed to fetch analytics summary');
      if (!weeklyResponse.ok) throw new Error('Failed to fetch weekly energy cost');
      if (!sixMonthResponse.ok) throw new Error('Failed to fetch six month consumption');
      if (!consumersResponse.ok) throw new Error('Failed to fetch top energy consumers');
      if (!peakHoursResponse.ok) throw new Error('Failed to fetch peak usage hours');

      // Parse all data
      const summaryData = await summaryResponse.json();
      const weeklyData = await weeklyResponse.json();
      const sixMonthData = await sixMonthResponse.json();
      const consumersData = await consumersResponse.json();
      const peakHoursData = await peakHoursResponse.json();

      console.log('Analytics data loaded:', { summaryData, weeklyData, consumersData });

      // Set state
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

  // Check for lab changes and fetch data
  useEffect(() => {
    const labId = getSelectedLabId();
    if (labId !== currentLabId) {
      console.log('Analytics: Lab changed from', currentLabId, 'to', labId);
      setCurrentLabId(labId || '');
      fetchData();
    }
  }, [getSelectedLabId(), currentLabId, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportReport = () => {
    // Simple export functionality
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

      <div className="grid gap-4 md:grid-cols-4">
        {summaryStats.map(([label, val]) => (
          <div key={label} className="card-surface p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold">{val}</p>
          </div>
        ))}
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Weekly Energy and Cost Analysis</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyEnergyCostData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="energy" fill="#3B82F6" name="Energy (kWh)" />
              <Bar dataKey="cost" fill="#10B981" name="Cost ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Six Month Consumption Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sixMonthConsumptionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" /><YAxis /><Tooltip />
              <Line type="monotone" dataKey="usage" stroke="#8B5CF6" strokeWidth={3} />
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
                  <span>{item.power} kWh</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${Math.min((item.power / Math.max(...topEnergyConsumers.map(c => c.power))) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-surface p-5">
          <h3 className="mb-1 font-semibold">Peak Usage Hours</h3>
          <div className="space-y-3">
            {peakUsageHours.map((item) => (
              <div key={item.time}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.time}</span>
                  <span>{item.power} kW</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${Math.min((parseFloat(item.power) / Math.max(...peakUsageHours.map(h => parseFloat(h.power)))) * 100, 100)}%` }}
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
