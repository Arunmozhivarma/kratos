import { Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { getSelectedDepartment, getSelectedLab } from '../data/labs';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const selectedDepartment = getSelectedDepartment();
  const selectedLab = getSelectedLab();

  if (!selectedDepartment) {
    return <Navigate to="/login" replace />;
  }

  if (!selectedLab) {
    return <Navigate to="/lab-select" replace />;
  }

  return (
    <div data-app-layout className="flex min-h-screen bg-[#F6FAF7] dark:bg-gray-900">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1">
        <Navbar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
        <main className="p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
