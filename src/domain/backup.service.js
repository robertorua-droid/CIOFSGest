/* backup.service.js - logica di dominio per backup, import/export e dataset esempio Firebase-only */
import { isLegacyBackup, mapBackupToDb, summarizeDb } from './backupMapper.js';
import { normalizeDb } from '../core/dbSchema.js';

export const BACKUP_ALIGNMENT_FIELDS = [
  'products',
  'customers',
  'suppliers',
  'customerOrders',
  'customerDDTs',
  'invoices',
  'supplierOrders',
  'supplierDDTs',
  'supplierQuarantine',
  'supplierReturnDDTs',
  'users'
];

export function prepareBackupFromText(text) {
  const obj = JSON.parse(text);
  const normalized = isLegacyBackup(obj) ? mapBackupToDb(obj) : obj;
  return normalizeDb(normalized);
}

export function createBackupPreviewText(dbObj, label = '') {
  if (!dbObj) return '(nessun file caricato)';
  const s = summarizeDb(dbObj);
  return [
    label ? ('Fonte: ' + label) : 'Fonte: (file)',
    'Azienda: ' + (s.company || '—'),
    'Prodotti: ' + s.products,
    'Clienti: ' + s.customers,
    'Fornitori: ' + s.suppliers,
    'Ordini clienti: ' + s.customerOrders,
    'DDT clienti: ' + s.customerDDTs,
    'Fatture: ' + s.invoices,
    'Ordini fornitori: ' + s.supplierOrders,
    'DDT fornitori: ' + s.supplierDDTs,
    'Quarantena fornitori: ' + s.supplierQuarantine,
    'Resi fornitori: ' + s.supplierReturnDDTs,
    'Utenti (gestionale): ' + s.users
  ].join('\n');
}

export function findBackupAlignmentMismatches(remoteDb, currentDb, fields = BACKUP_ALIGNMENT_FIELDS) {
  const remoteSummary = summarizeDb(normalizeDb(remoteDb));
  const currentSummary = summarizeDb(normalizeDb(currentDb));
  return fields.filter((k) => Number(remoteSummary[k] || 0) !== Number(currentSummary[k] || 0));
}

export function assertBackupSnapshotAligned(remoteDb, currentDb) {
  const mismatches = findBackupAlignmentMismatches(remoteDb, currentDb);
  if (mismatches.length) {
    throw new Error('Firebase non allineato ai dati correnti. Differenze in: ' + mismatches.join(', '));
  }
  return normalizeDb(remoteDb);
}

export async function loadFirebaseSnapshotForBackup({ syncNow, loadAll, currentDb }) {
  await syncNow();
  const remote = normalizeDb(await loadAll());
  return assertBackupSnapshotAligned(remote, currentDb());
}

export async function importBackupToFirebase({ repo, backupDb, wipe = true, reload }) {
  if (wipe) await repo.wipeAll();
  await repo.writeAll(normalizeDb(backupDb));
  if (reload) await reload();
}

export async function wipeFirebaseDataset({ repo, resetCache }) {
  await repo.wipeAll();
  if (resetCache) resetCache();
}
