/* login.js - emergency login and menu visibility */
(function (global) {
  'use strict';
  const { App } = global;

  function applyMenuForRole(user){
    // Hide statistics for User
    const statLink = document.querySelector('.nav-link[data-target="statistiche"]');
    if (statLink) statLink.closest('.nav-item').classList.toggle('d-none', user.role === 'User');

    const WL = [
      'menu-anagrafica-prodotti',
      'menu-carico-manuale','menu-scarico-manuale','menu-giacenze','menu-inventario',
      'menu-elenco-ordini-cliente','menu-nuovo-ddt-cliente','menu-elenco-ddt-cliente',
      'menu-elenco-ordini-fornitore','menu-nuovo-ddt-fornitore','menu-elenco-ddt-fornitore',
      'menu-anagrafica-azienda','menu-anagrafica-utenti','menu-avanzate'
    ];
    document.querySelectorAll('.menu-item').forEach(el => {
      const keep = (user.role !== 'User') || WL.includes(el.id);
      el.classList.toggle('d-none', !keep);
    });
  }

  const Login = {
    init() {
      const form = document.getElementById('login-form');
      if (!form) return;
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const db = App.db.ensure();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        let user = (db.users || []).find(u => (u.surname||'').toLowerCase() === username.toLowerCase() && u.password === password);

        // Emergency login always allowed
        if (!user && username.toLowerCase() === 'admin' && password === 'gestionale') {
          user = { id:'admin', name:'Admin', surname:'admin', role:'Admin', password:'gestionale' };
          try {
            const exists = (db.users || []).some(u => (u.surname||'').toLowerCase() === 'admin');
            if (!exists) { db.users = db.users || []; db.users.push({ ...user }); App.db.save(db); }
          } catch(e){}
        }

        const err = document.getElementById('error-message');
        if (!user) { err && err.classList.remove('d-none'); return; }
        err && err.classList.add('d-none');

        // Show app
        document.getElementById('login-container')?.classList.add('d-none');
        document.getElementById('main-app')?.classList.remove('d-none');

        // Labels + welcome
        App.ui.setSidebarUserLabel(user);
        App.ui.setCompanySidebarName(App.db.ensure());
        const welcome = document.getElementById('welcome-message');
        if (welcome) welcome.textContent = 'Benvenuto, ' + (user.name||'') + ' ' + (user.surname||'');

        // Menu visibilità
        applyMenuForRole(user);

        // Router
        App.ui.showSection('home');
        document.querySelectorAll('.sidebar .nav-link[data-target]').forEach(a => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const id = a.getAttribute('data-target');
            if (id) App.ui.showSection(id);
            if (id === 'statistiche') App.stats.renderForRole(user);
          });
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });

        // Home widgets + stats
        App.home.start(user);
        App.stats.renderForRole(user);

        // Emit event for modules
        App.events.emit('logged-in', { user, db });

        // Help (F1)
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) helpBtn.addEventListener('click', () => { window.open('Manuale Utente.txt', '_blank'); });
        document.addEventListener('keydown', (e) => { if (e.key === 'F1') { e.preventDefault(); helpBtn?.click(); } });
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => Login.init());
  App.Login = Login;
})(window);