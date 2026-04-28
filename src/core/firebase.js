import { firebaseConfig } from './firebaseConfig.js';

// Firebase via CDN (modular SDK)
// Versione pin: 12.9.0 (aggiornabile quando vuoi)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';


/**
 * Wrapper Firebase (Firestore + Auth).
 * Supporta:
 * - login Email/Password (consigliato)
 * - registrazione Email/Password
 * - login anonimo (fallback per uso didattico/temporaneo)
 */
export const firebase = {
  app: null,
  fs: null,
  auth: null,
  uid: null,
  deviceId: null,
  _initPromise: null,

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      this.app = initializeApp(firebaseConfig);
      this.fs = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Attendi che Firebase ripristini l'eventuale sessione (persistenza)
      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(this.auth, (u) => {
          this.uid = u?.uid || null;
          unsub();
          resolve();
        });
      });

      return this;
    })();
    return this._initPromise;
  },

  async loginEmail(email, password) {
    await this.init();
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    this.uid = cred.user?.uid || this.auth.currentUser?.uid || null;
    return cred;
  },

  async registerEmail(email, password) {
    await this.init();
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    this.uid = cred.user?.uid || this.auth.currentUser?.uid || null;
    return cred;
  },

  async ensureAnonymous() {
    await this.init();
    if (!this.auth.currentUser) {
      await signInAnonymously(this.auth);
    }
    this.uid = this.auth.currentUser?.uid || null;
    return this.uid;
  },

  async logout() {
    await this.init();
    try { await signOut(this.auth); } catch {}
    this.uid = null;
  },

  /**
   * Root path per i dati (SINGOLO UTENTE).
   * Richiede che Firebase Authentication sia attivo e l'utente sia autenticato.
   */
  getRootPath() {
    if (!this.uid) {
      throw new Error('Utente Firebase non autenticato: fai login (Email/Password o Anonymous) prima di usare Firestore.');
    }
    return `users/${this.uid}`;
  }
};
