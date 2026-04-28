import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FirestoreRevisionConflictError,
  assertRevisionMatch,
  getExpectedRemoteRevision,
  toRevision
} from '../src/core/firestore/conflict.js';

test('toRevision normalizza revision non valide a zero', () => {
  assert.equal(toRevision(undefined), 0);
  assert.equal(toRevision(null), 0);
  assert.equal(toRevision('5'), 5);
  assert.equal(toRevision(-1), 0);
  assert.equal(toRevision('abc'), 0);
});

test('getExpectedRemoteRevision legge la revision nota dallo stato di sync', () => {
  assert.equal(getExpectedRemoteRevision(null), null);
  assert.equal(getExpectedRemoteRevision({}), null);
  assert.equal(getExpectedRemoteRevision({ remoteRevision: 7 }), 7);
});

test('assertRevisionMatch accetta revision uguali o assenza di baseline', () => {
  assert.equal(assertRevisionMatch(null, 99), true);
  assert.equal(assertRevisionMatch(4, '4'), true);
});

test('assertRevisionMatch segnala conflitto se Firebase è avanzato', () => {
  assert.throws(
    () => assertRevisionMatch(4, 5),
    (error) => {
      assert.ok(error instanceof FirestoreRevisionConflictError);
      assert.equal(error.code, 'firestore/revision-conflict');
      assert.equal(error.expectedRevision, 4);
      assert.equal(error.remoteRevision, 5);
      assert.match(error.message, /Ricarica i dati prima di salvare/);
      return true;
    }
  );
});
