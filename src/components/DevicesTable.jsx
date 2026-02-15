import { Eye, Pencil, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function DevicesTable({ devices }) {
  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Devices</h3>
        <input placeholder="Search device..." className="rounded-xl border border-emerald-100 px-3 py-2 text-sm outline-none" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500">
            <tr>
              <th className="py-2">Device</th><th className="py-2">Location</th><th className="py-2">On Time</th><th className="py-2">Status</th><th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.name} className="border-t border-gray-100">
                <td className="py-3 font-medium">{device.name}</td>
                <td>{device.location}</td>
                <td>{device.onTime}</td>
                <td><StatusBadge status={device.status} /></td>
                <td className="flex gap-2 py-3 text-gray-500">
                  <button><Eye size={16} /></button><button><Pencil size={16} /></button><button><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
