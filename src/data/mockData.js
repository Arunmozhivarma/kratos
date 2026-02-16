export const navItems = [
  { name: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard' },
  { name: 'Energy Monitoring', path: '/app/energy', icon: 'LineChart' },
  { name: 'Device Control', path: '/app/devices', icon: 'SlidersHorizontal' },
  { name: 'Analytics / Report', path: '/app/analytics', icon: 'BarChart3' },
  { name: 'Users', path: '/app/users', icon: 'Users' },
  { name: 'Settings', path: '/app/settings', icon: 'Settings' },
  { name: 'Help', path: '/app/help', icon: 'CircleHelp' }
];

export const energyDailyData = [
  { day: 'Mon', usage: 24 }, { day: 'Tue', usage: 31 }, { day: 'Wed', usage: 27 }, { day: 'Thu', usage: 35 },
  { day: 'Fri', usage: 28 }, { day: 'Sat', usage: 33 }, { day: 'Sun', usage: 29 }
];

export const powerLineData = Array.from({ length: 12 }).map((_, i) => ({
  minute: `${i * 5}m`,
  power: 420 + Math.round(Math.sin(i / 2) * 80 + i * 5)
}));

export const statusTiles = [
  { zone: 'Lab Zone', motion: 'Detected', occupancy: 2, online: true, automationEnabled: true },
  { zone: 'Classroom', motion: 'Idle', occupancy: 0, online: true, automationEnabled: false }
];

export const quickStats = [
  { label: 'Connected Devices', value: 24 },
  { label: 'Operators Online', value: 6 },
  { label: 'Alerts This Week', value: 4 },
  { label: 'Peak Power Today', value: '4.1kW' }
];

export const devices = [
  { name: 'Main Lights', location: 'Lab', onTime: '08:20h', status: 'Active' },
  { name: 'Fan', location: 'Classroom', onTime: '06:40h', status: 'Active' },
  { name: 'Heater Unit A', location: 'Office', onTime: '03:15h', status: 'Inactive' }
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
  { username: 'admin01', role: 'Admin', lastLogin: 'Today, 08:58', status: 'Active' },
  { username: 'operator2', role: 'Operator', lastLogin: 'Today, 08:12', status: 'Active' },
  { username: 'jane', role: 'Operator', lastLogin: 'Yesterday, 19:30', status: 'Inactive' }
];

export const energyComparisons = [
  { label: 'Yesterday', usage: '38.4 kWh', compare: '+7% vs yesterday avg', positive: true },
  { label: 'Last Week', usage: '249 kWh', compare: '-3% vs previous week', positive: false },
  { label: 'Last Month', usage: '1,028 kWh', compare: '+5% vs previous month', positive: true }
];

export const weeklyEnergyCostData = [
  { day: 'Mon', energy: 92, cost: 26 },
  { day: 'Tue', energy: 98, cost: 29 },
  { day: 'Wed', energy: 87, cost: 24 },
  { day: 'Thu', energy: 101, cost: 31 },
  { day: 'Fri', energy: 95, cost: 28 },
  { day: 'Sat', energy: 75, cost: 21 },
  { day: 'Sun', energy: 70, cost: 20 }
];

export const sixMonthConsumptionData = [
  { month: 'Jan', usage: 2650 },
  { month: 'Feb', usage: 2520 },
  { month: 'Mar', usage: 2780 },
  { month: 'Apr', usage: 2710 },
  { month: 'May', usage: 2990 },
  { month: 'Jun', usage: 3210 }
];

export const topEnergyConsumers = [
  { device: 'Conference AC', power: 42 },
  { device: 'Lab Ventilation', power: 33 },
  { device: 'Server Rack', power: 29 },
  { device: 'Hallway Lights', power: 17 }
];

export const peakUsageHours = [
  { time: '12:00 - 14:00', power: 18 },
  { time: '09:00 - 11:00', power: 15 },
  { time: '15:00 - 17:00', power: 13 },
  { time: '18:00 - 20:00', power: 9 }
];

export const faqs = [
  { q: 'How do I toggle automation?', a: 'Use the switch in zone tiles or sensor page to enable occupancy automation.' },
  { q: 'Can I export energy reports?', a: 'Use the Export button on Analytics / Report page.' },
  { q: 'What does Emergency OFF do?', a: 'It instantly disables critical devices in manual override mode.' }
];
