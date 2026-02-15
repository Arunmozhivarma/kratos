import { CircleGauge } from 'lucide-react';

export default function StatCard({ label, value }) {
  return (
    <div className="card-surface p-4 transition hover:-translate-y-0.5">
      <div className="mb-3 inline-flex rounded-full border border-emerald-200 p-2 text-primary">
        <CircleGauge size={16} />
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
