import { Bell, Menu } from 'lucide-react';

export default function Navbar({ onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
        <button onClick={onToggleSidebar} className="rounded-xl border border-emerald-100 p-2 text-gray-600"><Menu size={18} /></button>
        <div className="hidden flex-1 md:flex justify-center">
          <input placeholder="Search..." className="w-full max-w-lg rounded-full border border-emerald-100 bg-app-bg px-4 py-2 text-sm shadow-sm outline-none" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">● System Online</span>
          <button className="rounded-xl border border-emerald-100 p-2 text-gray-600"><Bell size={18} /></button>
          <button className="h-9 w-9 rounded-full bg-emerald-200 text-sm font-semibold text-emerald-800">AD</button>
        </div>
      </div>
    </header>
  );
}
