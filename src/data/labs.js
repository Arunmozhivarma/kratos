export const SESSION_STORAGE_KEYS = {
  department: 'kratos_department',
  departmentId: 'kratos_department_id',
  lab: 'kratos_lab',
  labId: 'kratos_lab_id',
};

export function clearLabSelection() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.lab);
  localStorage.removeItem(SESSION_STORAGE_KEYS.labId);
}

export function getSelectedDepartment() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.department) ?? '';
}

export function getSelectedDepartmentId() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.departmentId) ?? '';
}

export function getSelectedLab() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.lab) ?? '';
}

export function getSelectedLabId() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.labId) ?? '';
}

export function setSelectedDepartment(departmentName, departmentId) {
  localStorage.setItem(SESSION_STORAGE_KEYS.department, String(departmentName ?? ''));

  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    localStorage.setItem(SESSION_STORAGE_KEYS.departmentId, String(departmentId));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.departmentId);
  }

  // When department changes, clear lab selection
  clearLabSelection();
}

export function setSelectedLab(labName, labId) {
  localStorage.setItem(SESSION_STORAGE_KEYS.lab, String(labName ?? ''));

  if (labId !== undefined && labId !== null && labId !== '') {
    localStorage.setItem(SESSION_STORAGE_KEYS.labId, String(labId));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.labId);
  }
}