import DevicesTable from '../components/DevicesTable';
import EnergyChartCard from '../components/EnergyChartCard';
import StatCard from '../components/StatCard';
import SummaryCard from '../components/SummaryCard';
import ToggleSwitch from '../components/ToggleSwitch';
import ZoneLiveTile from '../components/ZoneLiveTile';
import { devices, energyDailyData, quickStats, statusTiles } from '../data/mockData';

export default function DashboardPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <SummaryCard />
        <EnergyChartCard data={energyDailyData} />
        <DevicesTable devices={devices} />
      </div>
      <div className="space-y-6 xl:col-span-4">
        <div className="space-y-4">
          {statusTiles.map((tile) => <ZoneLiveTile key={tile.zone} tile={tile} />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {quickStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} />)}
        </div>
        <div className="card-surface p-5">
          <h3 className="mb-4 font-semibold">Quick Device Control</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>Main Lights</span><ToggleSwitch enabled /></div>
            <div className="flex items-center justify-between"><span>Ventilation Fan</span><ToggleSwitch enabled={false} /></div>
          </div>
          <button className="mt-4 w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600">Emergency OFF</button>
          <p className="mt-2 text-xs text-gray-500">Manual override enabled</p>
        </div>
      </div>
    </div>
  );
}
