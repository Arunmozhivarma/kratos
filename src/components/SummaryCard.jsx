export default function SummaryCard() {
  const stats = [
    ['Current Power', '1,240W'],
    ['Energy Today', '38.4 kWh'],
    ['Active Devices', '18'],
    ['Occupancy (Est.)', '12']
  ];

  return (
    <div className="card-surface rounded-3xl bg-gradient-to-br from-white to-emerald-50 p-6">
      <h1 className="text-2xl font-bold">Hi, Admin</h1>
      <p className="mt-1 text-gray-600">Welcome back — here’s today’s energy summary</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-emerald-100 bg-white/70 p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
