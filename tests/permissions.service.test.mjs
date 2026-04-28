import assert from 'node:assert/strict';
import test from 'node:test';
import { canDeleteDocuments, canManageUsers, getUserRole, hasAnyRole } from '../src/domain/permissions.service.js';

test('permessi centralizzati per ruoli applicativi', () => {
  assert.equal(getUserRole(null), 'User');
  assert.equal(hasAnyRole({ role: 'Supervisor' }, ['Supervisor']), true);
  assert.equal(canDeleteDocuments({ role: 'Admin' }), true);
  assert.equal(canDeleteDocuments({ role: 'User' }), false);
  assert.equal(canManageUsers({ role: 'Admin' }), true);
  assert.equal(canManageUsers({ role: 'Supervisor' }), false);
});
