import { firebase } from './firebase.js';
import { config } from './config.js';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

/**
 * Directory utenti globale (per gestione ruoli).
 *
 * Collezione: appUsers/{uid}
 * - ogni utente può leggere/scrivere solo il proprio documento (senza cambiare ruolo)
 * - Supervisor può leggere/scrivere anche gli altri (per promuovere/declassare)
 *
 * NOTE: richiede regole Firestore adeguate (vedi FIREBASE_SETUP.md).
 */
export const userDirectory = {
  async ensureMyProfile(email) {
    await firebase.init();
    if (!firebase.uid) throw new Error('Firebase non autenticato');
    const uid = firebase.uid;

    const emailLc = String(email || '').toLowerCase();
    const supList = (config.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
    const desiredRole = supList.includes(emailLc) ? 'Supervisor' : (config.DEFAULT_ROLE || 'User');

    const ref = doc(firebase.fs, `appUsers/${uid}`);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const payload = {
        uid,
        email: email || '',
        role: desiredRole,
        name: '',
        surname: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(ref, payload, { merge: true });
      return payload;
    }

    const data = snap.data() || {};
    // Se l'email è in whitelist Supervisor e il ruolo non è allineato, aggiorna.
    if (desiredRole === 'Supervisor' && data.role !== 'Supervisor') {
      try { await updateDoc(ref, { role: 'Supervisor', updatedAt: serverTimestamp() }); } catch {}
      data.role = 'Supervisor';
    }

    return data;
  },

  async getMyProfile() {
    await firebase.init();
    if (!firebase.uid) throw new Error('Firebase non autenticato');
    const uid = firebase.uid;
    const ref = doc(firebase.fs, `appUsers/${uid}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() || null) : null;
  },

  async listAll() {
    await firebase.init();
    if (!firebase.uid) throw new Error('Firebase non autenticato');
    const snap = await getDocs(collection(firebase.fs, 'appUsers'));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...(d.data() || {}) }));
    // ordinamento: email
    items.sort((a,b) => String(a.email||'').localeCompare(String(b.email||'')));
    return items;
  },

  async update(uid, patch) {
    await firebase.init();
    if (!uid) throw new Error('uid mancante');
    const ref = doc(firebase.fs, `appUsers/${uid}`);
    const safe = { ...(patch || {}), updatedAt: serverTimestamp() };
    await updateDoc(ref, safe);
  }
};
