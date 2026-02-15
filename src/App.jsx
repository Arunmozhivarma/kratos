import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import DeviceControlPage from './pages/DeviceControlPage';
import EnergyMonitoringPage from './pages/EnergyMonitoringPage';
import HelpPage from './pages/HelpPage';
import LoginPage from './pages/LoginPage';
import SensorMonitoringPage from './pages/SensorMonitoringPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="energy" element={<EnergyMonitoringPage />} />
        <Route path="sensors" element={<SensorMonitoringPage />} />
        <Route path="devices" element={<DeviceControlPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
