import ToggleSwitch from '../components/ToggleSwitch';
import StatusBadge from '../components/StatusBadge';

const controlDevices = [
  { name: 'Main Lights', zone: 'Lab', status: 'Active', enabled: true },
  { name: 'Ventilation Fan', zone: 'Classroom', status: 'Active', enabled: false },
  { name: 'AC Unit', zone: 'Office', status: 'Inactive', enabled: false },
  { name: 'Security Lights', zone: 'Outdoor', status: 'Active', enabled: true }
];

export default function DeviceControlPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Device Control</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {controlDevices.map((device) => (
          <div key={device.name} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{device.name}</h3>
              <ToggleSwitch enabled={device.enabled} />
            </div>
            <p className="mt-2 text-sm text-gray-600">Zone: {device.zone}</p>
            <div className="mt-2"><StatusBadge status={device.status} /></div>
          </div>
        ))}
      </div>
      <div className="card-surface p-5">
        <h3 className="font-semibold">Schedule</h3>
        <p className="mt-2 text-sm text-gray-600">Scheduling controls will appear here (UI placeholder).</p>
      </div>
    </div>
  );
}
