import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function EnergyChartCard({ data }) {
  // Calculate total consumption from data
  const totalConsumption = data.reduce((sum, item) => sum + (item.kWh || 0), 0);

  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Energy Consumption</p>
          <p className="text-2xl font-bold">{totalConsumption.toFixed(1)} kWh</p>
        </div>
        <select className="rounded-xl border border-emerald-100 px-3 py-1.5 text-sm">
          <option>Day</option>
          <option>Week</option>
          <option>Month</option>
        </select>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value) => [`${value} kWh`, 'Energy']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Bar dataKey="kWh" fill="#22C55E" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
