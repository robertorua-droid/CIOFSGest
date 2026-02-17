/* impostazioni.js - company data, users, advanced */
(function (global) {
  'use strict';
  const { App } = global;

  const Impostazioni = {
    initCompany() {
      const form = document.getElementById('company-info-form');
      if (!form) return;
      const db = App.db.ensure();
      document.getElementById('company-name').value = db.company?.name || '';
      document.getElementById('company-address').value = db.company?.address || '';
      document.getElementById('company-city').value = db.company?.city || '';
      document.getElementById('company-zip').value = db.company?.zip || '';
      document.getElementById('company-province').value = db.company?.province || '';

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const c = db.company || (db.company = {});
        c.name = document.getElementById('company-name').value.trim();
        c.address = document.getElementById('company-address').value.trim();
        c.city = document.getElementById('company-city').value.trim();
        c.zip = document.getElementById('company-zip').value.trim();
        c.province = document.getElementById('company-province').value.trim();
        App.db.save(db);
        App.ui.setCompanySidebarName(db);
        App.ui.showToast('Dati azienda salvati', 'success');
      });
    },

    initUsers() {
      const db = App.db.ensure();
      const tbody = document.getElementById('users-table-body');
      const saveBtn = document.getElementById('saveUserBtn');
      if (!tbody || !saveBtn) return;

      const render = () => {
        tbody.innerHTML = (db.users || []).map(u => `
          <tr>
            <td>${u.id || ''}</td>
            <td>${u.surname || ''}</td>
            <td>${u.name || ''}</td>
            <td>${u.role || ''}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${u.id}">Modifica</button>
              <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${u.id}">Elimina</button>
            </td>
          </tr>`).join('');
      };

      saveBtn.addEventListener('click', () => {
        const id = document.getElementById('user-id').value || App.utils.uuid();
        const surname = document.getElementById('user-surname').value.trim();
        const name = document.getElementById('user-name').value.trim();
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        if (!surname || !name || !password) return App.ui.showToast('Compila i campi obbligatori.', 'warning');
        const idx = (db.users || []).findIndex(u => u.id === id);
        const payload = { id, surname, name, password, role };
        if (idx >= 0) db.users[idx] = payload; else db.users.push(payload);
        App.db.save(db);
        render();
        App.ui.showToast('Utente salvato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide(); } catch {}
      });

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action === 'edit') {
          const u = db.users.find(x => x.id === id); if (!u) return;
          document.getElementById('user-id').value = u.id;
          document.getElementById('user-surname').value = u.surname || '';
          document.getElementById('user-name').value = u.name || '';
          document.getElementById('user-password').value = u.password || '';
          document.getElementById('user-role').value = u.role || 'User';
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show(); } catch {}
        } else if (action === 'del') {
          const i = db.users.findIndex(x => x.id === id);
          if (i >= 0 && confirm('Eliminare l’utente?')) {
            db.users.splice(i,1); App.db.save(db); render();
          }
        }
      });

      // Toggle password visibility
      document.getElementById('togglePassword')?.addEventListener('click', () => {
        const inp = document.getElementById('user-password');
        if (!inp) return;
        inp.type = (inp.type === 'password') ? 'text' : 'password';
      });

      render();
    },

    initAdvanced() {
      const db = App.db.ensure();
      const btnSend = document.getElementById('send-data-btn');
      const btnExport = document.getElementById('export-data-btn');
      const inputImport = document.getElementById('import-file-input');
      const btnDelete = document.getElementById('delete-all-data-btn');

      btnSend?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dati_gestionale.json';
        a.click();
        URL.revokeObjectURL(a.href);
        const mailto = 'mailto:docente@example.com?subject=' + encodeURIComponent('Revisione dati gestionale') +
                       '&body=' + encodeURIComponent('In allegato i dati esportati del gestionale.');
        window.location.href = mailto;
      });

      btnExport?.addEventListener('click', () => {
        const side = document.getElementById('user-name-sidebar')?.textContent || '';
        const m = side.match(/Utente:\s*([^\s]+)/);
        const surname = m ? m[1] : 'export';
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${surname}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });

      inputImport?.addEventListener('change', async () => {
        const file = inputImport.files?.[0]; if (!file) return;
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          App.db.save(imported);
          App.ui.showToast('Dati importati. Ricarico...', 'success');
          setTimeout(()=>location.reload(), 600);
        } catch { App.ui.showToast('File non valido.', 'danger'); }
      });

      btnDelete?.addEventListener('click', () => {
        if (confirm('Questa operazione cancellerà tutti i dati. Procedere?')) {
          localStorage.removeItem(App.config.DB_KEY);
          App.ui.showToast('Dati cancellati. Ricarico...', 'warning');
          setTimeout(()=>location.reload(), 600);
        }
      });
    },

    init() {
      App.events.on('logged-in', () => {
        this.initCompany();
        this.initUsers();
        this.initAdvanced();
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => Impostazioni.init());
  App.Impostazioni = Impostazioni;

})(window);
