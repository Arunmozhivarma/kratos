export default function StatusBadge({ status }) {
  const styles = {
    Active: 'bg-emerald-100 text-emerald-700',
    Online: 'bg-emerald-100 text-emerald-700',
    Inactive: 'bg-gray-100 text-gray-700',
    Offline: 'bg-gray-100 text-gray-700',
    Fault: 'bg-rose-100 text-rose-700'
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.Inactive}`}>{status}</span>;
}
