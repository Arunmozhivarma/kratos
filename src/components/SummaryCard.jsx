export default function SummaryCard() {
  const stats = [['Current Power', '1,240W'], ['Energy Today', '38.4 kWh'], ['Active Devices', '18'], ['Occupancy (Est.)', '12']];
  return (
    <div className="summary-card card-surface rounded-3xl bg-gradient-to-br from-white to-emerald-50 p-6 dark:from-gray-800 dark:to-gray-800/90">
      <h1 className="text-2xl font-bold text-gray-900">Welcome</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">Here’s today’s energy summary</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {stats.map(([label, value]) => (
          <div key={label} className="summary-card-stat rounded-xl border border-emerald-100 bg-white/80 p-3 dark:border-gray-600 dark:bg-gray-700/50">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
