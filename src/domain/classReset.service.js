/* classReset.service.js - azioni amministrative di pulizia classe Firebase-only */

export const DEFAULT_CLASS_SUPERVISOR_EMAILS = ['roberto.rua@gmail.com'];

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeSupervisorEmails(emails = DEFAULT_CLASS_SUPERVISOR_EMAILS) {
  return (emails || []).map(normalizeEmail).filter(Boolean);
}

export function isClassResetSupervisor(user, supervisorEmails = DEFAULT_CLASS_SUPERVISOR_EMAILS) {
  const email = normalizeEmail(user?.email);
  const role = String(user?.role || '').toLowerCase();
  const allowed = normalizeSupervisorEmails(supervisorEmails);
  return !!email && allowed.includes(email) && (role === 'supervisor' || role === 'admin');
}

export function splitClassUsers(users = [], supervisorEmails = DEFAULT_CLASS_SUPERVISOR_EMAILS) {
  const allowed = normalizeSupervisorEmails(supervisorEmails);
  const keep = [];
  const remove = [];
  for (const user of users || []) {
    const email = normalizeEmail(user?.email);
    const uid = String(user?.uid || user?.id || '').trim();
    const normalized = { ...user, uid: uid || user?.id, id: user?.id || uid };
    if (email && allowed.includes(email)) keep.push(normalized);
    else if (uid || user?.id) remove.push(normalized);
  }
  return { keep, remove };
}

export function assertClassResetConfirmation(value, expected) {
  if (String(value || '').trim() !== expected) {
    throw new Error(`Conferma non valida: per procedere devi scrivere ${expected}.`);
  }
  return true;
}

export async function wipeClassDatasets({ users = [], createRepoForUid, resetCurrentCache } = {}) {
  if (typeof createRepoForUid !== 'function') throw new Error('createRepoForUid mancante');
  const targets = (users || [])
    .map((u) => String(u?.uid || u?.id || '').trim())
    .filter(Boolean);
  let wiped = 0;
  const errors = [];
  for (const uid of targets) {
    try {
      const repo = createRepoForUid(uid);
      if (!repo || typeof repo.wipeAll !== 'function') throw new Error('repo.wipeAll non disponibile');
      await repo.wipeAll();
      wiped += 1;
    } catch (e) {
      errors.push({ uid, error: e?.message || String(e) });
    }
  }
  if (errors.length) {
    const details = errors.map((e) => `${e.uid}: ${e.error}`).join('; ');
    throw new Error(`Pulizia dati classe incompleta. ${details}`);
  }
  if (typeof resetCurrentCache === 'function') resetCurrentCache();
  return { wiped, targets };
}

export async function removeClassUsersExceptSupervisors({ users = [], supervisorEmails = DEFAULT_CLASS_SUPERVISOR_EMAILS, deleteUsersByUid } = {}) {
  if (typeof deleteUsersByUid !== 'function') throw new Error('deleteUsersByUid mancante');
  const { keep, remove } = splitClassUsers(users, supervisorEmails);
  const uids = remove.map((u) => String(u?.uid || u?.id || '').trim()).filter(Boolean);
  await deleteUsersByUid(uids);
  return { kept: keep.length, removed: uids.length, keptUsers: keep, removedUids: uids };
}
