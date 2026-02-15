import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { energyComparisons, powerLineData } from '../data/mockData';

export default function EnergyMonitoringPage() {
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
            <p className="mt-1 text-xs text-gray-500">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="card-surface p-5">
        <h3 className="mb-1 font-semibold">Power Trend</h3>
        <p className="mb-3 text-xs text-gray-500">Short-interval power usage trend for operational monitoring.</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={powerLineData}>
              <XAxis dataKey="minute" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="power" stroke="#22C55E" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
