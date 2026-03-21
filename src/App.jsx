import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import DeviceControlPage from './pages/DeviceControlPage';
import EnergyMonitoringPage from './pages/EnergyMonitoringPage';
import HelpPage from './pages/HelpPage';
import LoginPage from './pages/LoginPage';
import SensorMonitoringPage from './pages/SensorMonitoringPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import LabSelectionPage from './pages/LabSelectionPage';
import LabCreationPage from './pages/LabCreationPage';
import ZoneConfigurationPage from './pages/ZoneConfigurationPage';
import CameraLivePage from './pages/CameraLivePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lab-select" element={<LabSelectionPage />} />
      <Route path="/lab-create" element={<LabCreationPage />} />
      <Route path="/zone-config" element={<ZoneConfigurationPage />} />
      <Route path="/camera-live" element={<CameraLivePage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="energy" element={<EnergyMonitoringPage />} />
        <Route path="sensors" element={<SensorMonitoringPage />} />
        <Route path="devices" element={<DeviceControlPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
