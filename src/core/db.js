import { config } from './config.js';
import { createInitialDb } from './dbSchema.js';
import { firebase } from './firebase.js';
import { firestoreRepo } from './firestoreRepo.js';

/**
 * DB wrapper con cache in memoria (singleton).
 * Emissione evento 'db:changed' ad ogni salvataggio.
 */
export function createDb(events) {
  return {
    _key: config.DB_KEY,
    _cache: null,
    _modeKey: config.PERSISTENCE_KEY,
    _syncEnabled: false,
    _syncStatus: { state: 'idle', lastError: null, lastSyncedAt: null },
    _syncState: null,
    _syncQueued: null,
    _syncRunning: false,

    load() {
      try {
        const raw = localStorage.getItem(this._key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    getMode() {
      return localStorage.getItem(this._modeKey) || 'local';
    },

    setMode(mode) {
      localStorage.setItem(this._modeKey, mode);
    },

    async init() {
      // carica il DB nel cache prima che la UI venga inizializzata
      const mode = this.getMode();
      if (mode === 'firebase') {
        try {
          await firebase.init();
          const repo = firestoreRepo(firebase.fs, firebase.getRootPath());
          const remote = await repo.loadAll();
          if (remote) {
            this._cache = remote;
            // fallback locale per offline
            localStorage.setItem(this._key, JSON.stringify(remote));
            this._syncEnabled = true;
            this._syncStatus = { ...this._syncStatus, state: 'idle', lastError: null };
            events?.emit?.('sync:status', this._syncStatus);
            return remote;
          }
        } catch (e) {
          // fallback locale
          this._syncEnabled = false;
          this._syncStatus = { ...this._syncStatus, state: 'error', lastError: String(e?.message || e) };
          events?.emit?.('sync:status', this._syncStatus);
        }
      }

      // Local mode or fallback
      let db = this.load();
      if (!db) {
        db = createInitialDb();
        this.save(db);
      } else {
        this._cache = db;
      }
      return this._cache;
    },

    save(db) {
      // cache -> garantisce che tutti i moduli lavorino sulla stessa reference
      this._cache = db;
      localStorage.setItem(this._key, JSON.stringify(db));
      events?.emit?.('db:changed', db);

      // Se Firebase è attivo: sincronizza in background
      if (this.getMode() === 'firebase') {
        this._syncEnabled = true;
        this._enqueueSync(db);
      }
      return db;
    },

    ensure() {
      if (this._cache) return this._cache;

      let db = this.load();
      if (!db) {
        db = createInitialDb();
        this.save(db);
      } else {
        this._cache = db;
      }
      return db;
    },

    resetCache() {
      this._cache = null;
    },

    getSyncStatus() {
      return { ...this._syncStatus };
    },

    async migrateLocalToFirebase() {
      const local = this.load() || this.ensure();
      await firebase.init();
      const repo = firestoreRepo(firebase.fs, firebase.getRootPath());
      this._syncStatus = { ...this._syncStatus, state: 'syncing', lastError: null };
      events?.emit?.('sync:status', this._syncStatus);
      await repo.writeAll(local);
      this._syncState = null; // reset diff state
      this.setMode('firebase');
      this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: Date.now() };
      events?.emit?.('sync:status', this._syncStatus);
      return true;
    },

    async pullFirebaseToLocal() {
      await firebase.init();
      const repo = firestoreRepo(firebase.fs, firebase.getRootPath());
      const remote = await repo.loadAll();
      if (remote) {
        this.save(remote);
        return remote;
      }
      return null;
    },

    async syncNow() {
      if (this.getMode() !== 'firebase') return;
      return this._enqueueSync(this._cache || this.ensure(), true);
    },

    _enqueueSync(db, force = false) {
      // Mantieni sempre l'ultima versione da sincronizzare
      this._syncQueued = { snapshot: JSON.parse(JSON.stringify(db)), force };
      if (this._syncRunning) return;
      this._syncRunning = true;
      void this._runSyncLoop();
    },

    async _runSyncLoop() {
      while (this._syncQueued) {
        const { snapshot, force } = this._syncQueued;
        this._syncQueued = null;

        try {
          await firebase.init();
          const repo = firestoreRepo(firebase.fs, firebase.getRootPath());

          this._syncStatus = { ...this._syncStatus, state: 'syncing', lastError: null };
          events?.emit?.('sync:status', this._syncStatus);

          if (force || !this._syncState) {
            await repo.writeAll(snapshot);
            // ricostruisci stato hash da snapshot (senza ulteriori scritture)
            this._syncState = repo.buildState(snapshot);
          } else {
            this._syncState = await repo.diffAndSync(snapshot, this._syncState);
          }

          this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: Date.now() };
          events?.emit?.('sync:status', this._syncStatus);
        } catch (e) {
          this._syncStatus = { ...this._syncStatus, state: 'error', lastError: String(e?.message || e) };
          events?.emit?.('sync:status', this._syncStatus);
        }
      }
      this._syncRunning = false;
    }
  };
}
