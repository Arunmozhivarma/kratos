export const SETTINGS_STORAGE_KEY = 'kratos_settings_preferences';

export const DEFAULT_SETTINGS_FORM = {
  systemName: 'KRATOS Energy System',
  timezone: 'Asia/Kolkata (UTC+05:30)',
  landingPage: 'Dashboard',
};

const LANDING_PAGE_ROUTE_MAP = {
  Dashboard: '/app/dashboard',
  'Energy Monitoring': '/app/energy',
  Analytics: '/app/analytics',
  'Device Control': '/app/devices',
};

export function getSavedSettings() {
  const savedForm = localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (!savedForm) {
    return DEFAULT_SETTINGS_FORM;
  }

  try {
    return { ...DEFAULT_SETTINGS_FORM, ...JSON.parse(savedForm) };
  } catch {
    return DEFAULT_SETTINGS_FORM;
  }
}

export function getLandingPageRoute() {
  const settings = getSavedSettings();
  return LANDING_PAGE_ROUTE_MAP[settings.landingPage] ?? '/app/dashboard';
}
