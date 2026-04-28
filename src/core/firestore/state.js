import { ARRAY_COLLECTIONS } from './constants.js';
import { toRevision } from './conflict.js';

export function diffCollection(prevMap, nextItems) {
  const nextMap = new Map();
  const toSet = [];
  const toDelete = [];

  for (const it of (nextItems || [])) {
    const id = it?.id;
    if (!id) continue;
    const json = JSON.stringify(it);
    nextMap.set(id, json);
    if (!prevMap || prevMap.get(id) !== json) toSet.push(it);
  }

  if (prevMap) {
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) toDelete.push(id);
    }
  }

  return { nextMap, toSet, toDelete };
}

export function buildFirestoreSyncState(db) {
  const meta = {
    app: db.meta || {},
    company: db.company || {},
    counters: db.counters || {},
    notes: db.notes || {},
    settings: db.settings || {},
    users: db.users || []
  };
  const state = {
    metaHash: JSON.stringify(meta),
    remoteRevision: toRevision(db?.meta?.revision),
    colHashes: {}
  };
  for (const col of ARRAY_COLLECTIONS) {
    const m = {};
    for (const it of (db[col] || [])) {
      if (it?.id) m[it.id] = JSON.stringify(it);
    }
    state.colHashes[col] = m;
  }
  return state;
}
