import ToggleSwitch from './ToggleSwitch';

export default function ZoneLiveTile({ tile }) {
  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{tile.zone}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${tile.online ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>Live</span>
      </div>
      <p className="text-sm text-gray-600">Motion: <span className="font-medium">{tile.motion}</span></p>
      <p className="text-sm text-gray-600">Occupancy: <span className="font-medium">{tile.occupancy}</span></p>
      <p className="text-sm text-gray-600">Sensor: <span className="font-medium">{tile.online ? 'Online' : 'Offline'}</span></p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">Automation</span>
        <ToggleSwitch enabled={tile.automationEnabled} />
      </div>
    </div>
  );
}
