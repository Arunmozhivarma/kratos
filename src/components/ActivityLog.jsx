export default function ActivityLog({ logs }) {
  return <ul className="space-y-2">{logs.map((log)=> <li key={`${log.time}-${log.event}`} className="card-surface p-3 text-sm"><p className="font-medium">{log.event}</p><p className="text-xs text-gray-500">{log.time}</p></li>)}</ul>;
}
