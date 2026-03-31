export const SESSION_STORAGE_KEYS = {
  department: 'kratos_department',
  departmentId: 'kratos_department_id',
  lab: 'kratos_lab',
  labId: 'kratos_lab_id',
  userIdentifier: 'kratos_user_identifier',
  username: 'kratos_username',
  userEmail: 'kratos_user_email',
  lastLoginAt: 'kratos_last_login_at',
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

export function getSelectedUserIdentifier() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.userIdentifier) ?? '';
}

export function getSelectedUsername() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.username) ?? '';
}

export function getSelectedUserEmail() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.userEmail) ?? '';
}

export function getLastLoginAt() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.lastLoginAt) ?? '';
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

export function setSelectedUserIdentifier(identifier) {
  if (identifier !== undefined && identifier !== null && identifier !== '') {
    localStorage.setItem(SESSION_STORAGE_KEYS.userIdentifier, String(identifier));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.userIdentifier);
  }
}

export function setSelectedUserProfile({ username, email, identifier, lastLoginAt }) {
  setSelectedUserIdentifier(identifier ?? email ?? username ?? '');

  if (username !== undefined && username !== null && username !== '') {
    localStorage.setItem(SESSION_STORAGE_KEYS.username, String(username));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.username);
  }

  if (email !== undefined && email !== null && email !== '') {
    localStorage.setItem(SESSION_STORAGE_KEYS.userEmail, String(email));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.userEmail);
  }

  if (lastLoginAt !== undefined && lastLoginAt !== null && lastLoginAt !== '') {
    localStorage.setItem(SESSION_STORAGE_KEYS.lastLoginAt, String(lastLoginAt));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.lastLoginAt);
  }
}
