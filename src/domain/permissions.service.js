export function getUserRole(user) {
  return user?.role || 'User';
}

export function hasAnyRole(user, roles = []) {
  return roles.includes(getUserRole(user));
}

export function canDeleteDocuments(user) {
  return hasAnyRole(user, ['Supervisor', 'Admin']);
}

export function canManageUsers(user) {
  return getUserRole(user) === 'Admin';
}
