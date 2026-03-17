import { App } from '../../core/app.js';
import { createInitialDb } from '../../core/dbSchema.js';

function applyMenuForRole(user) {
  const isUser = (user?.role === 'User');

  // Statistiche: nascoste per gli studenti
  const statLink = document.querySelector('.nav-link[data-target="statistiche"]');
  if (statLink) statLink.closest('.nav-item')?.classList.toggle('d-none', isUser);

  // Per il ruolo User nascondiamo solo le voci “amministrative”
  const restrictedForUser = new Set([
    'menu-anagrafica-azienda',
    'menu-anagrafica-utenti',
    'menu-avanzate'
  ]);

  document.querySelectorAll('.menu-item').forEach(el => {
    const hide = isUser && restrictedForUser.has(el.id);
    el.classList.toggle('d-none', hide);
  });
}


function setError(msg) {
  const box = document.getElementById('error-message');
  if (!box) return;
  if (!msg) { box.classList.add('d-none'); box.textContent = ''; return; }
  box.textContent = msg;
  box.classList.remove('d-none');
}

function friendlyAuthError(e) {
  const code = e?.code || '';
  switch (code) {
    case 'auth/invalid-email': return 'Email non valida.';
    case 'auth/missing-password': return 'Inserisci la password.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found': return 'Utente non trovato.';
    case 'auth/wrong-password': return 'Password errata.';
    case 'auth/email-already-in-use': return 'Esiste già un account con questa email. Usa “Accedi”.';
    case 'auth/weak-password': return 'Password troppo debole (minimo 6 caratteri).';
    case 'auth/operation-not-allowed': return 'Metodo di accesso non abilitato in Firebase (Email/Password).';
    case 'auth/unauthorized-domain': return 'Dominio non autorizzato in Firebase (Authorized domains).';
    default: return e?.message ? String(e.message) : 'Errore di autenticazione.';
  }
}

async function enterApp({ user, db, isFirebaseUser }) {
  // Show app
  document.getElementById('login-container')?.classList.add('d-none');
  document.getElementById('main-app')?.classList.remove('d-none');

  // Labels + welcome
  App.ui.setSidebarUserLabel(user);
  App.ui.setCompanySidebarName(db);
  const welcome = document.getElementById('welcome-message');
  if (welcome) welcome.textContent = 'Benvenuto, ' + (user.name || '') + (user.surname && user.surname !== user.name ? (' ' + user.surname) : '');

  // Menu visibilità
  applyMenuForRole(user);

  // Router
  App.ui.showSection('home');
  document.querySelectorAll('.sidebar .nav-link[data-target]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-target');
      if (id) App.ui.showSection(id);
      App.events.emit('section:changed', id);
      if (id === 'statistiche') App.stats.renderForRole(user);
    });
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      if (isFirebaseUser) {
        await App.firebase.logout();
      }
    } catch {}
    // Torna in modalità Local per evitare che all'avvio l'app provi Firestore senza sessione
    try { App.db.setMode('local'); } catch {}
    location.reload();
  });

  // Home widgets + stats
  App.home.start(user);
  App.stats.renderForRole(user);

  // Emit event for modules
  App.events.emit('logged-in', { user, db });

  // Help (F1)
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) helpBtn.addEventListener('click', () => { window.open('Manuale Utente.txt', '_blank'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') { e.preventDefault(); helpBtn?.click(); }
  });
}

export function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const submitBtn = document.getElementById('login-submit-btn');
  const confirmWrap = document.getElementById('confirm-wrapper');

  let mode = 'login';

  function setMode(m) {
    mode = m;
    tabLogin?.classList.toggle('active', mode === 'login');
    tabRegister?.classList.toggle('active', mode === 'register');
    confirmWrap?.classList.toggle('d-none', mode !== 'register');
    if (submitBtn) submitBtn.textContent = (mode === 'register') ? 'Registrati' : 'Accedi';
    setError('');
  }

  tabLogin?.addEventListener('click', () => setMode('login'));
  tabRegister?.addEventListener('click', () => setMode('register'));
  setMode('login');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('');

    const email = document.getElementById('login-email')?.value?.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const password2 = document.getElementById('login-password-confirm')?.value || '';

    // Emergency local login always allowed
    if (email.toLowerCase() === 'admin' && password === 'gestionale') {
      try { App.db.setMode('local'); } catch {}
      const db = App.db.ensure();
      const user = { id: 'admin', name: 'Admin', surname: 'admin', role: 'Admin', password: 'gestionale' };
      // compat: salva admin in users se non esiste
      try {
        const exists = (db.users || []).some(u => (u.surname || '').toLowerCase() === 'admin');
        if (!exists) { db.users = db.users || []; db.users.push({ ...user }); App.db.save(db); }
      } catch {}
      await enterApp({ user, db, isFirebaseUser: false });
      return;
    }

    if (!email) { setError('Inserisci la tua email.'); return; }
    if (!password) { setError('Inserisci la password.'); return; }
    if (mode === 'register' && password !== password2) { setError('Le password non coincidono.'); return; }

    // Firebase Auth (Email/Password)
    try {
      if (mode === 'register') {
        await App.firebase.registerEmail(email, password);
      } else {
        await App.firebase.loginEmail(email, password);
      }
    } catch (e) {
      setError(friendlyAuthError(e));
      return;
    }

    // Dopo login Firebase: usa Firestore come archivio principale
    try { App.db.setMode('firebase'); } catch {}

    // Carica dati remoti; se non esistono ancora, inizializza uno schema vuoto e sincronizza
    let db = null;
    try {
      db = await App.db.pullFirebaseToLocal();
    } catch (e) {
      setError('Login ok, ma non riesco a leggere Firestore: ' + String(e?.message || e));
      return;
    }

    if (!db) {
      const fresh = createInitialDb();
      App.db.save(fresh);
      try { await App.db.syncNow(); } catch {}
      db = App.db.ensure();
    }

    const uid = App.firebase.uid || email;
    const emailLc = String(email || '').toLowerCase();
    const sup = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
    let role = sup.includes(emailLc) ? 'Supervisor' : (App.config?.DEFAULT_ROLE || 'User');

    // Manteniamo un record utente nel DB applicativo per mostrare/gestire ruoli
    db.users = Array.isArray(db.users) ? db.users : [];
    let appUser = db.users.find(u => String(u?.email || '').toLowerCase() === emailLc);

    if (!appUser) {
      appUser = {
        id: uid,
        email,
        name: (email.split('@')[0] || email),
        surname: '',
        role
      };
      db.users.push(appUser);
      App.db.save(db);
    } else {
      // Se l'email è in lista Supervisor, forziamo il ruolo
      if (sup.includes(emailLc) && appUser.role !== 'Supervisor') {
        appUser.role = 'Supervisor';
        App.db.save(db);
      }
      role = appUser.role || role;
    }

    const user = {
      id: appUser.id || uid,
      email: appUser.email || email,
      name: appUser.name || email,
      surname: appUser.surname || '',
      role
    };

    await enterApp({ user, db, isFirebaseUser: true });
  });
}
