import test from 'node:test';
import assert from 'node:assert/strict';
import { ARRAY_COLLECTIONS, META_DOCS } from '../src/core/firestore/constants.js';
import { buildFirestoreSyncState, diffCollection } from '../src/core/firestore/state.js';
import { chunk } from '../src/core/firestore/batch.js';

test('costanti Firestore includono tutte le collezioni operative Firebase-only', () => {
  assert.ok(ARRAY_COLLECTIONS.includes('supplierQuarantine'));
  assert.ok(ARRAY_COLLECTIONS.includes('supplierReturnDDTs'));
  assert.equal(META_DOCS.app, 'meta/app');
  assert.equal(META_DOCS.settings, 'meta/settings');
});

test('diffCollection calcola set e delete senza dipendere dal repository Firestore', () => {
  const prev = new Map([
    ['a', JSON.stringify({ id: 'a', qty: 1 })],
    ['b', JSON.stringify({ id: 'b', qty: 2 })]
  ]);
  const { nextMap, toSet, toDelete } = diffCollection(prev, [{ id: 'a', qty: 3 }, { id: 'c', qty: 1 }]);
  assert.deepEqual(toSet.map(x => x.id), ['a', 'c']);
  assert.deepEqual(toDelete, ['b']);
  assert.equal(nextMap.get('a'), JSON.stringify({ id: 'a', qty: 3 }));
});

test('buildFirestoreSyncState serializza meta e collezioni in modo stabile', () => {
  const state = buildFirestoreSyncState({
    meta: { revision: 12 },
    company: { name: 'Gestionale OL' },
    counters: { order: 1 },
    notes: {},
    settings: { language: 'it' },
    users: [{ uid: 'u1' }],
    products: [{ id: 'p1', code: 'A001' }],
    supplierReturnDDTs: [{ id: 'r1', number: 'RF-1' }]
  });
  assert.match(state.metaHash, /Gestionale OL/);
  assert.equal(state.remoteRevision, 12);
  assert.equal(state.colHashes.products.p1, JSON.stringify({ id: 'p1', code: 'A001' }));
  assert.equal(state.colHashes.supplierReturnDDTs.r1, JSON.stringify({ id: 'r1', number: 'RF-1' }));
});

test('chunk divide batch sotto il limite operativo', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
