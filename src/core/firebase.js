import { firebaseConfig } from './firebaseConfig.js';

// Firebase via CDN (modular SDK)
// Versione pin: 12.9.0 (aggiornabile quando vuoi)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';

const DEVICE_ID_KEY = 'gestionale_ol_device_id';

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Wrapper Firebase (Firestore + Auth).
 * - prova login anonimo (se abilitato in Firebase Console)
 * - fallback su "deviceId" (utile se non vuoi/puoi usare Auth in fase didattica)
 */
export const firebase = {
  app: null,
  fs: null,
  auth: null,
  uid: null,
  deviceId: getOrCreateDeviceId(),
  _initPromise: null,

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      this.app = initializeApp(firebaseConfig);
      this.fs = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Best-effort anonymous auth
      try {
        if (!this.auth.currentUser) {
          await signInAnonymously(this.auth);
        }
        this.uid = this.auth.currentUser?.uid || null;
      } catch {
        this.uid = null;
      }

      return this;
    })();
    return this._initPromise;
  },

  /**
   * Root path per i dati (SINGOLO UTENTE).
   * Richiede che Firebase Authentication sia attivo (es. Anonymous).
   */
  getRootPath() {
    if (!this.uid) {
      throw new Error('Firebase Auth non disponibile: abilita Authentication (Anonymous) e aggiungi il dominio tra gli Authorized domains.');
    }
    return `users/${this.uid}`;
  }
};
