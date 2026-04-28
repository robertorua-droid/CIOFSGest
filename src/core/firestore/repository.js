import { createInitialDb } from '../dbSchema.js';
import { ARRAY_COLLECTIONS, META_DOCS } from './constants.js';
import { chunk } from './batch.js';
import { buildFirestoreSyncState, diffCollection } from './state.js';
import { assertRevisionMatch, toRevision } from './conflict.js';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

export function createFirestoreRepository(fs, rootPath) {
  const base = (sub) => (sub ? `${rootPath}/${sub}` : rootPath);

  async function loadMeta() {
    const db = createInitialDb();

    const appSnap = await getDoc(doc(fs, base(META_DOCS.app)));
    if (appSnap.exists()) db.meta = appSnap.data();

    const companySnap = await getDoc(doc(fs, base(META_DOCS.company)));
    if (companySnap.exists()) db.company = companySnap.data();

    const countersSnap = await getDoc(doc(fs, base(META_DOCS.counters)));
    if (countersSnap.exists()) db.counters = countersSnap.data();

    const notesSnap = await getDoc(doc(fs, base(META_DOCS.notes)));
    if (notesSnap.exists()) db.notes = notesSnap.data();

    const settingsSnap = await getDoc(doc(fs, base(META_DOCS.settings)));
    if (settingsSnap.exists()) db.settings = settingsSnap.data();

    const usersSnap = await getDoc(doc(fs, base(META_DOCS.users)));
    if (usersSnap.exists()) db.users = usersSnap.data()?.users || [];

    return db;
  }

  async function loadAll() {
    const db = await loadMeta();
    for (const col of ARRAY_COLLECTIONS) {
      const snap = await getDocs(collection(fs, base(col)));
      const items = [];
      snap.forEach(d => {
        const data = d.data() || {};
        if (!data.id) data.id = d.id;
        items.push(data);
      });
      db[col] = items;
    }
    return db;
  }

  async function writeAll(dbObj) {
    const ops = [
      { ref: doc(fs, base(META_DOCS.app)), data: dbObj.meta || {} },
      { ref: doc(fs, base(META_DOCS.company)), data: dbObj.company || {} },
      { ref: doc(fs, base(META_DOCS.counters)), data: dbObj.counters || {} },
      { ref: doc(fs, base(META_DOCS.notes)), data: dbObj.notes || {} },
      { ref: doc(fs, base(META_DOCS.settings)), data: dbObj.settings || {} },
      { ref: doc(fs, base(META_DOCS.users)), data: { users: dbObj.users || [] } }
    ];

    for (const col of ARRAY_COLLECTIONS) {
      for (const item of (dbObj[col] || [])) {
        const id = item?.id || item?.code || Math.random().toString(36).slice(2);
        ops.push({ ref: doc(fs, base(`${col}/${id}`)), data: { ...item, id } });
      }
    }

    for (const part of chunk(ops, 450)) {
      const batch = writeBatch(fs);
      for (const o of part) batch.set(o.ref, o.data);
      await batch.commit();
    }
  }

  async function diffAndSync(nextDb, prevState) {
    const state = prevState || { metaHash: null, colHashes: {} };
    const nextMeta = {
      app: nextDb.meta || {},
      company: nextDb.company || {},
      counters: nextDb.counters || {},
      notes: nextDb.notes || {},
      settings: nextDb.settings || {},
      users: nextDb.users || []
    };
    const nextMetaHash = JSON.stringify(nextMeta);
    const ops = [];

    if (state.metaHash !== nextMetaHash) {
      ops.push({ ref: doc(fs, base(META_DOCS.app)), data: nextMeta.app });
      ops.push({ ref: doc(fs, base(META_DOCS.company)), data: nextMeta.company });
      ops.push({ ref: doc(fs, base(META_DOCS.counters)), data: nextMeta.counters });
      ops.push({ ref: doc(fs, base(META_DOCS.notes)), data: nextMeta.notes });
      ops.push({ ref: doc(fs, base(META_DOCS.settings)), data: nextMeta.settings });
      ops.push({ ref: doc(fs, base(META_DOCS.users)), data: { users: nextMeta.users } });
    }

    const nextState = {
      metaHash: nextMetaHash,
      remoteRevision: toRevision(nextDb?.meta?.revision),
      colHashes: { ...(state.colHashes || {}) }
    };
    for (const col of ARRAY_COLLECTIONS) {
      const prevMap = state.colHashes?.[col] || null;
      const { nextMap, toSet, toDelete } = diffCollection(prevMap ? new Map(Object.entries(prevMap)) : null, nextDb[col] || []);

      for (const it of toSet) {
        const id = it?.id;
        if (!id) continue;
        ops.push({ ref: doc(fs, base(`${col}/${id}`)), data: { ...it, id } });
      }
      for (const id of toDelete) ops.push({ ref: doc(fs, base(`${col}/${id}`)), data: null, delete: true });

      const obj = {};
      for (const [id, json] of nextMap.entries()) obj[id] = json;
      nextState.colHashes[col] = obj;
    }

    for (const part of chunk(ops, 450)) {
      const batch = writeBatch(fs);
      for (const o of part) {
        if (o.delete) batch.delete(o.ref);
        else batch.set(o.ref, o.data);
      }
      await batch.commit();
    }

    return nextState;
  }

  async function getRemoteRevision() {
    const appSnap = await getDoc(doc(fs, base(META_DOCS.app)));
    return appSnap.exists() ? toRevision(appSnap.data()?.revision) : 0;
  }

  async function assertRemoteRevision(expectedRevision) {
    const remoteRevision = await getRemoteRevision();
    return assertRevisionMatch(expectedRevision, remoteRevision);
  }

  async function wipeAll() {
    const ops = [];
    for (const col of ARRAY_COLLECTIONS) {
      const snap = await getDocs(collection(fs, base(col)));
      snap.forEach(d => ops.push({ ref: doc(fs, base(`${col}/${d.id}`)), delete: true }));
    }
    for (const k of Object.values(META_DOCS)) ops.push({ ref: doc(fs, base(k)), delete: true });

    for (const part of chunk(ops, 450)) {
      const batch = writeBatch(fs);
      for (const o of part) batch.delete(o.ref);
      await batch.commit();
    }
    return true;
  }

  return {
    loadAll,
    writeAll,
    wipeAll,
    getRemoteRevision,
    assertRemoteRevision,
    diffAndSync,
    buildState: buildFirestoreSyncState
  };
}
