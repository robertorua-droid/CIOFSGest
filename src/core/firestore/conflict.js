export class FirestoreRevisionConflictError extends Error {
  constructor({ expectedRevision, remoteRevision } = {}) {
    super(
      'I dati su Firebase sono cambiati da un altro browser o utente. ' +
      'Ricarica i dati prima di salvare.'
    );
    this.name = 'FirestoreRevisionConflictError';
    this.code = 'firestore/revision-conflict';
    this.expectedRevision = Number(expectedRevision || 0);
    this.remoteRevision = Number(remoteRevision || 0);
  }
}

export function toRevision(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function getExpectedRemoteRevision(syncState) {
  return syncState && Object.prototype.hasOwnProperty.call(syncState, 'remoteRevision')
    ? toRevision(syncState.remoteRevision)
    : null;
}

export function assertRevisionMatch(expectedRevision, remoteRevision) {
  if (expectedRevision == null) return true;
  const expected = toRevision(expectedRevision);
  const remote = toRevision(remoteRevision);
  if (expected !== remote) {
    throw new FirestoreRevisionConflictError({ expectedRevision: expected, remoteRevision: remote });
  }
  return true;
}
