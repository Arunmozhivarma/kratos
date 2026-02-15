import { useState } from 'react';
import ActivityLog from '../components/ActivityLog';
import StatusBadge from '../components/StatusBadge';
import ToggleSwitch from '../components/ToggleSwitch';
import { activityLog, sensors } from '../data/mockData';

export default function SensorMonitoringPage() {
  const [automation, setAutomation] = useState(true);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sensor Monitoring</h1>
      <div className="grid gap-4 md:grid-cols-3">{sensors.map((sensor)=><div key={sensor.name} className="card-surface p-4"><h3 className="font-semibold">{sensor.name}</h3><div className="mt-2"><StatusBadge status={sensor.status} /></div><p className="mt-2 text-sm text-gray-600">Last Updated: {sensor.updated}</p><p className="text-sm text-gray-600">Zone: {sensor.zone}</p></div>)}</div>
      <div className="card-surface flex items-center justify-between p-4"><p className="font-medium">Enable occupancy automation</p><ToggleSwitch checked={automation} onChange={setAutomation} /></div>
      <div><h3 className="mb-3 text-lg font-semibold">Activity Log</h3><ActivityLog logs={activityLog} /></div>
    </div>
  );
}
