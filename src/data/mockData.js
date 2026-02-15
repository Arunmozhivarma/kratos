export const navItems = [
  { name: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard' },
  { name: 'Energy Monitoring', path: '/app/energy', icon: 'LineChart' },
  { name: 'Sensor Monitoring', path: '/app/sensors', icon: 'Radar' },
  { name: 'Device Control', path: '/app/devices', icon: 'SlidersHorizontal' },
  { name: 'Users (Admin)', path: '/app/users', icon: 'Users' },
  { name: 'Help', path: '/app/help', icon: 'CircleHelp' }
];

export const energyDailyData = [
  { day: 'D-9', usage: 24 }, { day: 'D-8', usage: 31 }, { day: 'D-7', usage: 27 }, { day: 'D-6', usage: 35 },
  { day: 'D-5', usage: 28 }, { day: 'D-4', usage: 33 }, { day: 'D-3', usage: 29 }, { day: 'D-2', usage: 36 },
  { day: 'D-1', usage: 34 }, { day: 'Today', usage: 35 }
];

export const powerLineData = Array.from({ length: 12 }).map((_, i) => ({
  minute: `${i * 5}m`,
  power: 420 + Math.round(Math.sin(i / 2) * 80 + i * 5)
}));

export const statusTiles = [
  { zone: 'Lab Zone', motion: 'Detected', occupancy: 2, online: true, automationEnabled: true },
  { zone: 'Classroom', motion: 'Idle', occupancy: 0, online: true, automationEnabled: false },
  { zone: 'Office', motion: 'Detected', occupancy: 1, online: true, automationEnabled: true }
];

export const quickStats = [
  { label: 'Connected Devices', value: 24 },
  { label: 'Operators Online', value: 6 },
  { label: 'Alerts This Week', value: 4 },
  { label: 'Peak Power Today', value: '4.1kW' }
];

export const devices = [
  { name: 'Main Lights', location: 'Lab', onTime: '08:20h', status: 'Active' },
  { name: 'Ventilation Fan', location: 'Classroom', onTime: '06:40h', status: 'Active' },
  { name: 'Heater Unit A', location: 'Office', onTime: '03:15h', status: 'Inactive' },
  { name: 'Water Pump', location: 'Utility', onTime: '01:05h', status: 'Fault' }
];

export const sensors = [
  { name: 'PIR Sensor', status: 'Online', updated: '1 min ago', zone: 'Lab' },
  { name: 'IR Beam', status: 'Online', updated: '3 min ago', zone: 'Classroom' },
  { name: 'Energy Meter', status: 'Offline', updated: '10 min ago', zone: 'Office' }
];

export const activityLog = [
  { time: '09:10', event: 'Motion detected in Lab Zone' },
  { time: '09:08', event: 'Room empty in Classroom' },
  { time: '08:55', event: 'Energy spike alert acknowledged' }
];

export const users = [
  { username: 'admin01', role: 'Admin', lastLogin: 'Today, 08:58' },
  { username: 'operator2', role: 'Operator', lastLogin: 'Today, 08:12' }
];

export const faqs = [
  { q: 'How do I toggle automation?', a: 'Use the switch in zone tiles or sensor page to enable occupancy automation.' },
  { q: 'Can I export energy reports?', a: 'Use the Export button on Energy Monitoring page (UI placeholder).' },
  { q: 'What does Emergency OFF do?', a: 'It instantly disables critical devices in manual override mode.' }
];
