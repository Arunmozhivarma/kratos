import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function getDisplayScale(totalKwh) {
  return totalKwh > 0 && totalKwh < 0.01
    ? { unit: 'Wh', multiplier: 1000, digits: 3 }
    : { unit: 'kWh', multiplier: 1, digits: 3 };
}

export default function EnergyChartCard({ data }) {
  // Calculate total consumption from data
  const totalConsumption = data.reduce((sum, item) => sum + (item.kWh || 0), 0);
  const displayScale = getDisplayScale(totalConsumption);
  const chartData = data.map((item) => ({
    ...item,
    energyDisplay: (item.kWh || 0) * displayScale.multiplier,
  }));
  const totalDisplayValue = totalConsumption * displayScale.multiplier;

  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Energy Consumption</p>
          <p className="text-2xl font-bold">
            {totalDisplayValue.toFixed(displayScale.digits)} {displayScale.unit}
          </p>
        </div>
        <select className="rounded-xl border border-emerald-100 px-3 py-1.5 text-sm">
          <option>Day</option>
          <option>Week</option>
          <option>Month</option>
        </select>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis />
            <Tooltip
              formatter={(value) => [
                `${Number(value).toFixed(displayScale.digits)} ${displayScale.unit}`,
                'Energy',
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Bar dataKey="energyDisplay" fill="#22C55E" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
