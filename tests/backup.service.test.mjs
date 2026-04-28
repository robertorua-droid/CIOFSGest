import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBackupSnapshotAligned,
  createBackupPreviewText,
  findBackupAlignmentMismatches,
  importBackupToFirebase,
  loadFirebaseSnapshotForBackup,
  prepareBackupFromText,
  wipeFirebaseDataset
} from '../src/domain/backup.service.js';

const sample = {
  company: { name: 'Azienda Test' },
  products: [{ id: 'p1' }],
  customers: [{ id: 'c1' }],
  suppliers: [],
  customerOrders: [],
  customerDDTs: [],
  invoices: [],
  supplierOrders: [],
  supplierDDTs: [],
  supplierQuarantine: [],
  supplierReturnDDTs: [],
  users: []
};

test('prepareBackupFromText normalizza JSON e crea preview leggibile', () => {
  const db = prepareBackupFromText(JSON.stringify(sample));
  assert.equal(db.company.name, 'Azienda Test');
  assert.equal(db.products.length, 1);
  const preview = createBackupPreviewText(db, 'backup.json');
  assert.match(preview, /Fonte: backup\.json/);
  assert.match(preview, /Azienda: Azienda Test/);
  assert.match(preview, /Prodotti: 1/);
  assert.equal(createBackupPreviewText(null), '(nessun file caricato)');
});

test('assertBackupSnapshotAligned segnala mismatch tra remoto e cache corrente', () => {
  const remote = { ...sample, products: [{ id: 'p1' }, { id: 'p2' }] };
  const mismatches = findBackupAlignmentMismatches(remote, sample);
  assert.deepEqual(mismatches, ['products']);
  assert.throws(() => assertBackupSnapshotAligned(remote, sample), /Differenze in: products/);
  assert.equal(assertBackupSnapshotAligned(sample, sample).products.length, 1);
});

test('loadFirebaseSnapshotForBackup forza sync, carica remoto e controlla allineamento', async () => {
  const calls = [];
  const snapshot = await loadFirebaseSnapshotForBackup({
    syncNow: async () => calls.push('sync'),
    loadAll: async () => { calls.push('load'); return sample; },
    currentDb: () => sample
  });
  assert.deepEqual(calls, ['sync', 'load']);
  assert.equal(snapshot.company.name, 'Azienda Test');
});

test('importBackupToFirebase e wipeFirebaseDataset orchestrano repository Firebase', async () => {
  const calls = [];
  const repo = {
    wipeAll: async () => calls.push('wipe'),
    writeAll: async (db) => calls.push(['write', db.company.name])
  };
  await importBackupToFirebase({ repo, backupDb: sample, wipe: true, reload: async () => calls.push('reload') });
  assert.deepEqual(calls, ['wipe', ['write', 'Azienda Test'], 'reload']);

  await wipeFirebaseDataset({ repo, resetCache: () => calls.push('reset') });
  assert.deepEqual(calls.slice(-2), ['wipe', 'reset']);
});
