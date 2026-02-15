import { Bell, Menu, UserCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ onToggleSidebar }) {
  const [time, setTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <header data-app-navbar className="sticky top-0 z-20 border-b border-emerald-100 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
        <button onClick={onToggleSidebar} className="rounded-xl border border-emerald-200 bg-gray-50 p-2 text-gray-700 dark:border-gray-600 dark:bg-transparent dark:text-gray-300"><Menu size={18} /></button>
        <div className="flex-1 max-w-xl">
          <input placeholder="Search..." className="w-full rounded-full border-2 border-emerald-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400" />
        </div>
        <div className="ml-auto flex items-center gap-3" ref={profileRef}>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
            System Online
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-300">{time.toLocaleTimeString()}</span>
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowNotifications((v) => !v); setShowProfile(false); }} className="rounded-xl border border-emerald-200 bg-gray-50 p-2 text-gray-700 dark:border-gray-600 dark:bg-transparent dark:text-gray-300"><Bell size={18} /></button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-emerald-100 bg-white p-3 shadow-soft dark:border-gray-600 dark:bg-gray-800">
                <p className="text-sm font-semibold dark:text-gray-100">Notifications</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">No critical alerts.</p>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowProfile((v) => !v); setShowNotifications(false); }} className="h-9 w-9 rounded-full bg-emerald-200 text-sm font-semibold text-emerald-800 dark:bg-emerald-700 dark:text-emerald-100">AD</button>
            {showProfile && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-emerald-100 bg-white p-2 shadow-soft dark:border-gray-600 dark:bg-gray-800">
                <Link to="/app/profile" onClick={() => setShowProfile(false)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-gray-700"><UserCircle2 size={16} />View Profile</Link>
                <button className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30">Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
