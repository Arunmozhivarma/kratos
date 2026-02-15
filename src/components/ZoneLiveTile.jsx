import { useState } from 'react';
import ToggleSwitch from './ToggleSwitch';
export default function ZoneLiveTile({ tile }) {
  const [on, setOn] = useState(tile.automationEnabled);
  return <div className="card-surface p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{tile.zone}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Live</span></div><p className="text-sm text-gray-600">Motion: <span className="font-medium">{tile.motion}</span></p><p className="text-sm text-gray-600">Occupancy: <span className="font-medium">{tile.occupancy}</span></p><p className="text-sm text-gray-600">Sensor: <span className="font-medium">{tile.online ? 'Online' : 'Offline'}</span></p><div className="mt-3 flex items-center justify-between"><span className="text-xs text-gray-500">Automation</span><ToggleSwitch checked={on} onChange={setOn} /></div></div>;
}
