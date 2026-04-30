import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertClassResetConfirmation,
  isClassResetSupervisor,
  removeClassUsersExceptSupervisors,
  splitClassUsers,
  wipeClassDatasets
} from '../src/domain/classReset.service.js';

test('riconosce solo il supervisor autorizzato', () => {
  assert.equal(isClassResetSupervisor({ email: 'roberto.rua@gmail.com', role: 'Supervisor' }, ['roberto.rua@gmail.com']), true);
  assert.equal(isClassResetSupervisor({ email: 'roberto.rua@gmail.com', role: 'User' }, ['roberto.rua@gmail.com']), false);
  assert.equal(isClassResetSupervisor({ email: 'altro@example.com', role: 'Supervisor' }, ['roberto.rua@gmail.com']), false);
});

test('divide utenti da mantenere e rimuovere', () => {
  const result = splitClassUsers([
    { id: 'sup', email: 'roberto.rua@gmail.com' },
    { id: 'u1', email: 'a@example.com' },
    { uid: 'u2', email: 'b@example.com' }
  ], ['roberto.rua@gmail.com']);
  assert.equal(result.keep.length, 1);
  assert.deepEqual(result.remove.map(u => u.uid || u.id), ['u1', 'u2']);
});

test('richiede conferma testuale forte', () => {
  assert.equal(assertClassResetConfirmation('SVUOTA CLASSE', 'SVUOTA CLASSE'), true);
  assert.throws(() => assertClassResetConfirmation('svuota classe', 'SVUOTA CLASSE'), /Conferma non valida/);
});

test('cancella dataset classe creando repo per ciascun uid', async () => {
  const wiped = [];
  const result = await wipeClassDatasets({
    users: [{ uid: 'u1' }, { id: 'u2' }],
    createRepoForUid: (uid) => ({ wipeAll: async () => wiped.push(uid) }),
    resetCurrentCache: () => wiped.push('cache-reset')
  });
  assert.equal(result.wiped, 2);
  assert.deepEqual(wiped, ['u1', 'u2', 'cache-reset']);
});

test('rimuove utenti classe mantenendo supervisor', async () => {
  let deleted = [];
  const result = await removeClassUsersExceptSupervisors({
    users: [
      { id: 'sup', email: 'roberto.rua@gmail.com' },
      { id: 'u1', email: 'a@example.com' },
      { uid: 'u2', email: 'b@example.com' }
    ],
    supervisorEmails: ['roberto.rua@gmail.com'],
    deleteUsersByUid: async (uids) => { deleted = uids; }
  });
  assert.equal(result.kept, 1);
  assert.equal(result.removed, 2);
  assert.deepEqual(deleted, ['u1', 'u2']);
});
