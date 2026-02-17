import { createInitialDb } from './dbSchema.js';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const ARR_COLS = [
  'customers',
  'suppliers',
  'products',
  'customerOrders',
  'supplierOrders',
  'customerDDTs',
  'supplierDDTs',
  'invoices'
];

const META_DOCS = {
  company: 'meta/company',
  counters: 'meta/counters',
  notes: 'meta/notes',
  users: 'meta/localUsers'
};

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

export function firestoreRepo(fs, rootPath) {
  const base = (sub) => (sub ? `${rootPath}/${sub}` : rootPath);

  async function loadMeta() {
    const db = createInitialDb();

    const companySnap = await getDoc(doc(fs, base(META_DOCS.company)));
    if (companySnap.exists()) db.company = companySnap.data();

    const countersSnap = await getDoc(doc(fs, base(META_DOCS.counters)));
    if (countersSnap.exists()) db.counters = countersSnap.data();

    const notesSnap = await getDoc(doc(fs, base(META_DOCS.notes)));
    if (notesSnap.exists()) db.notes = notesSnap.data();

    const usersSnap = await getDoc(doc(fs, base(META_DOCS.users)));
    if (usersSnap.exists()) db.users = usersSnap.data()?.users || [];

    return db;
  }

  async function loadAll() {
    const db = await loadMeta();
    for (const col of ARR_COLS) {
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
    // Scrive tutto (utile per migrazione / prima sincronizzazione)
    // Meta
    const metaOps = [];
    metaOps.push({ ref: doc(fs, base(META_DOCS.company)), data: dbObj.company || {} });
    metaOps.push({ ref: doc(fs, base(META_DOCS.counters)), data: dbObj.counters || {} });
    metaOps.push({ ref: doc(fs, base(META_DOCS.notes)), data: dbObj.notes || {} });
    metaOps.push({ ref: doc(fs, base(META_DOCS.users)), data: { users: dbObj.users || [] } });

    // Arrays
    const ops = [...metaOps];
    for (const col of ARR_COLS) {
      for (const item of (dbObj[col] || [])) {
        const id = item?.id || item?.code || Math.random().toString(36).slice(2);
        ops.push({ ref: doc(fs, base(`${col}/${id}`)), data: { ...item, id } });
      }
    }

    // commit in chunks (max 500 writes/batch)
    for (const part of chunk(ops, 450)) {
      const batch = writeBatch(fs);
      for (const o of part) batch.set(o.ref, o.data);
      await batch.commit();
    }
  }

  /**
   * Diff minimale per collezioni array basate su id.
   * Ritorna { toSet: item[], toDelete: id[] }
   */
  function diffCollection(prevMap, nextItems) {
    const nextMap = new Map();
    const toSet = [];
    const toDelete = [];

    for (const it of (nextItems || [])) {
      const id = it?.id;
      if (!id) continue;
      const json = JSON.stringify(it);
      nextMap.set(id, json);
      if (!prevMap || prevMap.get(id) !== json) {
        toSet.push(it);
      }
    }

    if (prevMap) {
      for (const id of prevMap.keys()) {
        if (!nextMap.has(id)) toDelete.push(id);
      }
    }

    return { nextMap, toSet, toDelete };
  }

  async function diffAndSync(nextDb, prevState) {
    const state = prevState || { metaHash: null, colHashes: {} };

    // Meta: company/counters/notes/users
    const nextMeta = {
      company: nextDb.company || {},
      counters: nextDb.counters || {},
      notes: nextDb.notes || {},
      users: nextDb.users || []
    };
    const nextMetaHash = JSON.stringify(nextMeta);
    const metaChanged = state.metaHash !== nextMetaHash;

    const ops = [];
    if (metaChanged) {
      ops.push({ ref: doc(fs, base(META_DOCS.company)), data: nextMeta.company });
      ops.push({ ref: doc(fs, base(META_DOCS.counters)), data: nextMeta.counters });
      ops.push({ ref: doc(fs, base(META_DOCS.notes)), data: nextMeta.notes });
      ops.push({ ref: doc(fs, base(META_DOCS.users)), data: { users: nextMeta.users } });
    }

    const nextState = { metaHash: nextMetaHash, colHashes: { ...(state.colHashes || {}) } };

    // Collections
    for (const col of ARR_COLS) {
      const prevMap = state.colHashes?.[col] || null;
      const { nextMap, toSet, toDelete } = diffCollection(prevMap ? new Map(Object.entries(prevMap)) : null, nextDb[col] || []);

      for (const it of toSet) {
        const id = it?.id;
        if (!id) continue;
        ops.push({ ref: doc(fs, base(`${col}/${id}`)), data: { ...it, id } });
      }
      for (const id of toDelete) {
        ops.push({ ref: doc(fs, base(`${col}/${id}`)), data: null, delete: true });
      }

      // store hashes as plain object (serializzabile)
      const obj = {};
      for (const [id, json] of nextMap.entries()) obj[id] = json;
      nextState.colHashes[col] = obj;
    }

    // Commit operations
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

  function buildState(db) {
    const meta = {
      company: db.company || {},
      counters: db.counters || {},
      notes: db.notes || {},
      users: db.users || []
    };
    const state = { metaHash: JSON.stringify(meta), colHashes: {} };
    for (const col of ARR_COLS) {
      const m = {};
      for (const it of (db[col] || [])) {
        if (it?.id) m[it.id] = JSON.stringify(it);
      }
      state.colHashes[col] = m;
    }
    return state;
  }

  
  async function wipeAll() {
    // Cancella tutto sotto rootPath (meta + collezioni)
    // NB: Firestore non ha "delete collection" lato client: iteriamo i documenti e li cancelliamo in batch.
    const ops = [];
    // Collezioni array
    for (const col of ARR_COLS) {
      const snap = await getDocs(collection(fs, base(col)));
      snap.forEach(d => {
        ops.push({ ref: doc(fs, base(`${col}/${d.id}`)), delete: true });
      });
    }
    // Meta docs
    for (const k of Object.values(META_DOCS)) {
      ops.push({ ref: doc(fs, base(k)), delete: true });
    }

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
    diffAndSync,
    buildState
  };
}
