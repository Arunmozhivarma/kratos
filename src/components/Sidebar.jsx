import { NavLink } from 'react-router-dom';
import { BarChart3, CircleHelp, LayoutDashboard, LineChart, LogOut, Radar, Settings, SlidersHorizontal, Users } from 'lucide-react';
import { navItems } from '../data/mockData';

const icons = { LayoutDashboard, LineChart, Radar, SlidersHorizontal, BarChart3, Users, Settings, CircleHelp };

export default function Sidebar({ collapsed }) {
  return (
    <aside className={`sticky top-0 h-screen border-r border-emerald-100 bg-white px-3 py-4 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="mb-8 px-2">
        <p className="text-xl font-bold text-primary">KRATOS</p>
        {!collapsed && <p className="text-xs text-gray-500">Energy System</p>}
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = icons[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'border-l-4 border-primary bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-emerald-50'}`}
            >
              <Icon size={18} />
              {!collapsed && <span className="font-medium">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="absolute bottom-5 left-3 right-3 space-y-2">
        <button className="flex w-full items-center gap-3 rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-600"><LogOut size={18} />{!collapsed && 'Logout'}</button>
      </div>
    </aside>
  );
}
