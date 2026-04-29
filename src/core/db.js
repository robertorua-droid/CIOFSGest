import { config } from './config.js';
import { createInitialDb, normalizeDb } from './dbSchema.js';
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
    _syncTsKey: `${config.DB_KEY}__lastSyncedAt`,
    _syncEnabled: false,
    _syncStatus: { state: 'idle', lastError: null, lastSyncedAt: null },
    _syncState: null,
    _syncQueued: null,
    _syncRunning: false,
    _syncWaiters: [],

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

      // Local-first: carica sempre la cache locale (utile se refresh prima della sync)
      let local = this.load();
      if (local) {
        local = normalizeDb(local);
        this._cache = local;
        localStorage.setItem(this._key, JSON.stringify(local));
      }

      if (mode === 'firebase') {
        try {
          await firebase.init();
          const repo = firestoreRepo(firebase.fs, firebase.getRootPath());

          // Se la cache locale è più recente dell'ultima sync completata, non sovrascrivere con remoto:
          const lastSyncedAt = parseInt(localStorage.getItem(this._syncTsKey) || '0', 10) || 0;
          const localUpdatedAt = this._cache?.meta?.updatedAt || 0;

          if (this._cache && localUpdatedAt > lastSyncedAt) {
            // tenta di riallineare subito il remoto dalla cache locale
            await repo.writeAll(this._cache);
            this._syncState = repo.buildState(this._cache);
            this._syncEnabled = true;
            this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: Date.now() };
            try { localStorage.setItem(this._syncTsKey, String(this._syncStatus.lastSyncedAt)); } catch {}
            events?.emit?.('sync:status', this._syncStatus);
            return this._cache;
          }

          const remote = await repo.loadAll();
          if (remote) {
            const norm = normalizeDb(remote);
            this._cache = norm;
            // fallback locale per offline
            localStorage.setItem(this._key, JSON.stringify(norm));
            this._syncEnabled = true;
            this._syncStatus = { ...this._syncStatus, state: 'idle', lastError: null };
            try { localStorage.setItem(this._syncTsKey, String(Date.now())); } catch {}
            events?.emit?.('sync:status', this._syncStatus);
            return norm;
          }
        } catch (e) {
          // fallback locale
          this._syncEnabled = false;
          this._syncStatus = { ...this._syncStatus, state: 'error', lastError: String(e?.message || e) };
          events?.emit?.('sync:status', this._syncStatus);
          if (this._cache) return this._cache;
        }
      }

      // Local mode or fallback
      let db = this.load();
      if (!db) {
        db = createInitialDb();
        this.save(db);
      } else {
        db = normalizeDb(db);
        this._cache = db;
        // persisti eventuali default aggiunti
        localStorage.setItem(this._key, JSON.stringify(db));
      }
      return this._cache;
    },

    save(db) {
      db = normalizeDb(db);
      // aggiorna timestamp modifiche
      db.meta = (db.meta && typeof db.meta === 'object') ? db.meta : {};
      db.meta.updatedAt = Date.now();
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
        db = normalizeDb(db);
        this._cache = db;
        // persisti eventuali default aggiunti
        localStorage.setItem(this._key, JSON.stringify(db));
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
      const local = normalizeDb(this.load() || this.ensure());
      await firebase.init();
      const repo = firestoreRepo(firebase.fs, firebase.getRootPath());
      this._syncStatus = { ...this._syncStatus, state: 'syncing', lastError: null };
      events?.emit?.('sync:status', this._syncStatus);
      await repo.writeAll(local);
      this._syncState = null; // reset diff state
      this.setMode('firebase');
      this._syncStatus = { state: 'idle', lastError: null, lastSyncedAt: Date.now() };
      try { localStorage.setItem(this._syncTsKey, String(this._syncStatus.lastSyncedAt)); } catch {}
          try { localStorage.setItem(this._syncTsKey, String(this._syncStatus.lastSyncedAt)); } catch {}
      events?.emit?.('sync:status', this._syncStatus);
      return true;
    },

    async pullFirebaseToLocal() {
      await firebase.init();
      const repo = firestoreRepo(firebase.fs, firebase.getRootPath());
      const remote = await repo.loadAll();
      if (remote) {
        const norm = normalizeDb(remote);
        this.save(norm);
        return norm;
      }
      return null;
    },

    async syncNow() {
      if (this.getMode() !== 'firebase') return true;
      return this._enqueueSync(this._cache || this.ensure(), true);
    },

    _enqueueSync(db, force = false) {
      // Mantieni sempre l'ultima versione da sincronizzare
      this._syncQueued = { snapshot: JSON.parse(JSON.stringify(db)), force };
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
          try { localStorage.setItem(this._syncTsKey, String(this._syncStatus.lastSyncedAt)); } catch {}
          events?.emit?.('sync:status', this._syncStatus);
          lastError = null;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e?.message || e));
          this._syncStatus = { ...this._syncStatus, state: 'error', lastError: String(lastError?.message || lastError) };
          events?.emit?.('sync:status', this._syncStatus);
        }
      }
      this._syncRunning = false;
      this._flushSyncWaiters(lastError);
    }
  };
}
