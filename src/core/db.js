import { createInitialDb, normalizeDb } from './dbSchema.js';
import { firebase } from './firebase.js';
import { firestoreRepo } from './firestoreRepo.js';
import { createMutationRunner } from './dbMutation.js';
import { getExpectedRemoteRevision } from './firestore/conflict.js';

function cloneDb(db) {
  return JSON.parse(JSON.stringify(db));
}

function createMemoryStore() {
  let current = null;
  let syncState = null;

  return {
    hasData() {
      return Boolean(current);
    },
    get() {
      return current;
    },
    set(db, nextSyncState = syncState) {
      current = normalizeDb(db || createInitialDb());
      syncState = nextSyncState;
      return current;
    },
    clear() {
      current = null;
      syncState = null;
    },
    getSyncState() {
      return syncState;
    },
    setSyncState(nextSyncState) {
      syncState = nextSyncState;
    },
    snapshot() {
      if (!current) return null;
      return cloneDb(current);
    }
  };
}

/**
 * DB wrapper Firebase-only con cache esclusivamente in memoria.
 * Firestore è l'unica persistenza dei dati applicativi; la cache serve solo
 * a condividere lo stato normalizzato tra i moduli durante la sessione.
 */
export function createDb(events) {
  const memory = createMemoryStore();
  let mutateWithDraft = null;

  function setSyncStatus(target, patch) {
    target._syncStatus = { ...target._syncStatus, ...patch };
    events?.emit?.('sync:status', target._syncStatus);
  }

  return {
    _syncStatus: { state: 'idle', lastError: null, lastSyncedAt: null },
    _syncQueued: null,
    _syncRunning: false,
    _syncWaiters: [],

    getMode() {
      return 'firebase';
    },

    setMode(mode = 'firebase') {
      if (mode && mode !== 'firebase') {
        throw new Error('Modalità locale disabilitata: il gestionale è Firebase-only.');
      }
      return 'firebase';
    },

    async init() {
      await firebase.init();

      // Prima del login non esiste ancora un rootPath Firestore utente.
      // La cache applicativa resta vuota finché loadFromFirebase() non completa.
      if (!firebase.uid) {
        memory.clear();
        this._syncQueued = null;
        this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: null };
        events?.emit?.('sync:status', this._syncStatus);
        return null;
      }

      return this.loadFromFirebase();
    },

    async loadFromFirebase() {
      try {
        await firebase.init();
        if (!firebase.uid) throw new Error('Firebase Auth non disponibile: effettua il login prima di caricare i dati.');

        const repo = firestoreRepo(firebase.fs, firebase.getRootPath());
        const remote = await repo.loadAll();
        const db = memory.set(remote || createInitialDb());
        memory.setSyncState(repo.buildState(db));

        this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: Date.now() };
        events?.emit?.('sync:status', this._syncStatus);
        events?.emit?.('db:changed', db);
        return db;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e?.message || e));
        memory.clear();
        this._syncQueued = null;
        this._syncStatus = { state: 'error', lastError: String(err.message || err), lastSyncedAt: null };
        events?.emit?.('sync:status', this._syncStatus);
        throw err;
      }
    },

    save(db) {
      const normalized = normalizeDb(db);
      normalized.meta = (normalized.meta && typeof normalized.meta === 'object') ? normalized.meta : {};
      normalized.meta.updatedAt = Date.now();
      normalized.meta.revision = Number(normalized.meta.revision || 0) + 1;

      // Stato sessione: reference condivisa in memoria, non persistenza locale.
      const current = memory.set(normalized);
      events?.emit?.('db:changed', current);

      this._enqueueSync(current);
      return current;
    },

    mutate(label, updater) {
      if (!mutateWithDraft) {
        mutateWithDraft = createMutationRunner({
          ensure: () => this.ensure(),
          save: draft => this.save(draft),
          emit: (eventName, payload) => events?.emit?.(eventName, payload)
        });
      }
      return mutateWithDraft(label, updater);
    },

    ensure() {
      if (memory.hasData()) return memory.get();
      throw new Error('Dati non ancora caricati da Firebase. Effettua il login e attendi il caricamento Firestore.');
    },

    resetCache() {
      memory.clear();
      this._syncQueued = null;
      this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: null };
      events?.emit?.('sync:status', this._syncStatus);
    },

    getSyncStatus() {
      return { ...this._syncStatus };
    },

    async syncNow() {
      const current = this.ensure();
      return this._enqueueSync(current, true);
    },

    _enqueueSync(db, force = false) {
      const snapshot = cloneDb(normalizeDb(db));
      const expectedRemoteRevision = getExpectedRemoteRevision(memory.getSyncState());
      this._syncQueued = { snapshot, force, expectedRemoteRevision };
      const waiter = new Promise((resolve, reject) => {
        this._syncWaiters.push({ resolve, reject });
      });
      if (!this._syncRunning) {
        this._syncRunning = true;
        void this._runSyncLoop();
      }
      return waiter;
    },

    _flushSyncWaiters(error = null) {
      const waiters = this._syncWaiters.splice(0, this._syncWaiters.length);
      for (const w of waiters) {
        try {
          if (error) w.reject(error);
          else w.resolve(true);
        } catch {}
      }
    },

    async _runSyncLoop() {
      let lastError = null;
      while (this._syncQueued) {
        const { snapshot, force, expectedRemoteRevision } = this._syncQueued;
        this._syncQueued = null;

        try {
          await firebase.init();
          if (!firebase.uid) throw new Error('Firebase Auth non disponibile: impossibile sincronizzare.');
          const repo = firestoreRepo(firebase.fs, firebase.getRootPath());

          setSyncStatus(this, { state: 'syncing', lastError: null });

          const prevState = memory.getSyncState();
          await repo.assertRemoteRevision(expectedRemoteRevision);
          if (force || !prevState) {
            await repo.writeAll(snapshot);
            memory.setSyncState(repo.buildState(snapshot));
          } else {
            memory.setSyncState(await repo.diffAndSync(snapshot, prevState));
          }

          this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: Date.now() };
          events?.emit?.('sync:status', this._syncStatus);
          lastError = null;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e?.message || e));
          setSyncStatus(this, { state: 'error', lastError: String(lastError?.message || lastError) });
        }
      }
      this._syncRunning = false;
      this._flushSyncWaiters(lastError);
    }
  };
}
