export const SESSION_STORAGE_KEYS = {
  department: 'kratos_department',
  lab: 'kratos_lab',
};

export const CSE_DEPARTMENT_NAME = 'Computer Science & Engineering';

export const CSE_LABS = [
  'GRD Lab',
  'Hardware lab',
  'PG lab I',
  'Programming lab II',
  'PG lab II',
  'Programming Lab I',
  '3AI',
  'AIR',
  'SCPS',
  'CS&P',
];

const DEPARTMENT_LABS = {
  [CSE_DEPARTMENT_NAME]: CSE_LABS,
};

export function getDepartmentLabs(departmentName) {
  return DEPARTMENT_LABS[departmentName] ?? [];
}

export function clearLabSelection() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.lab);
}

export function getSelectedDepartment() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.department) ?? '';
}

export function getSelectedLab() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.lab) ?? '';
}

export function setSelectedDepartment(departmentName) {
  localStorage.setItem(SESSION_STORAGE_KEYS.department, departmentName);
}

export function setSelectedLab(labName) {
  localStorage.setItem(SESSION_STORAGE_KEYS.lab, labName);
}
