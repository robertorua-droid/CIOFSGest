/* impostazioni/index.js - azienda, utenti, avanzate (MODULARE) */
import { App } from '../../core/app.js';
import { isLegacyBackup, mapBackupToDb, summarizeDb } from '../../domain/backupMapper.js';
import { normalizeDb } from '../../core/dbSchema.js';

  const Impostazioni = {
    initCompany() {
      const form = document.getElementById('company-info-form');
      if (!form) return;
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
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
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
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
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const btnSend = document.getElementById('send-data-btn');
      const btnExport = document.getElementById('export-data-btn');
      const inputImport = document.getElementById('import-file-input');
      const btnDelete = document.getElementById('delete-all-data-btn');

      // Backup test/import (JSON legacy -> schema corrente)
      const btnLoadSample = document.getElementById('backup-load-sample-btn');
      const inputBackup = document.getElementById('backup-file-input');
      const preBackup = document.getElementById('backup-preview');
      const btnImportLocal = document.getElementById('backup-import-local-btn');
      const btnImportFirebase = document.getElementById('backup-import-firebase-btn');
      const chkWipe = document.getElementById('backup-wipe-checkbox');
      let _loadedBackupDb = null;

      // Firebase sync UI (opzionale)
      const chkFirebase = document.getElementById('firebase-mode-checkbox');
      const btnMigrate = document.getElementById('firebase-migrate-btn');
      const btnPull = document.getElementById('firebase-pull-btn');
      const btnSyncNow = document.getElementById('firebase-syncnow-btn');
      const lblUid = document.getElementById('firebase-uid-label');
      const lblStatus = document.getElementById('firebase-sync-status');

      const renderSync = (st) => {
        if (!lblStatus) return;
        const s = st || App.db.getSyncStatus();
        const msg = s.state === 'syncing' ? 'Sincronizzazione in corso…' :
                    s.state === 'error' ? ('Errore: ' + (s.lastError || '')) :
                    s.lastSyncedAt ? ('Ultima sync: ' + new Date(s.lastSyncedAt).toLocaleString()) :
                    'Inattivo';
        lblStatus.textContent = msg;
      };

      if (chkFirebase) {
        chkFirebase.checked = App.db.getMode() === 'firebase';
        chkFirebase.addEventListener('change', async () => {
          const enable = chkFirebase.checked;
          if (enable) {
            if (!confirm('Attivare Firebase (Firestore) come archivio dati?\n\nConsiglio: premi prima “Migra dati locali su Firebase”.')) {
              chkFirebase.checked = false;
              return;
            }
            App.db.setMode('firebase');
          } else {
            if (!confirm('Tornare a Local (browser)?\nI dati su Firebase non verranno cancellati.')) {
              chkFirebase.checked = true;
              return;
            }
            App.db.setMode('local');
          }
          location.reload();
        });
      }

      // Mostra UID/DeviceId (se presente)
      if (lblUid) {
        try {
          const mode = App.db.getMode();
          if (mode === 'firebase') {
            App.firebase.init().then(() => {
              const root = App.firebase.uid ? `uid:${App.firebase.uid}` : 'Auth non attivo';
              lblUid.textContent = root;
            });
          } else {
            lblUid.textContent = 'Local';
          }
        } catch {
          lblUid.textContent = '';
        }
      }

      btnMigrate?.addEventListener('click', async () => {
        try {
          await App.db.migrateLocalToFirebase();
          App.ui.showToast('Migrazione completata. Ricarico...', 'success');
          setTimeout(()=>location.reload(), 700);
        } catch (e) {
          App.ui.showToast('Migrazione fallita: ' + (e?.message || e), 'danger');
        }
      });

      btnPull?.addEventListener('click', async () => {
        try {
          const remote = await App.db.pullFirebaseToLocal();
          if (remote) {
            App.ui.showToast('Dati scaricati da Firebase (salvati anche in locale).', 'success');
          } else {
            App.ui.showToast('Nessun dato trovato su Firebase.', 'warning');
          }
          renderSync();
        } catch (e) {
          App.ui.showToast('Download fallito: ' + (e?.message || e), 'danger');
        }
      });

      btnSyncNow?.addEventListener('click', async () => {
        try {
          await App.db.syncNow();
          renderSync();
          App.ui.showToast('Sync avviata.', 'info');
        } catch (e) {
          App.ui.showToast('Sync fallita: ' + (e?.message || e), 'danger');
        }
      });

      App.events.on('sync:status', (s) => renderSync(s));
      renderSync();

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

            // Import "raw" (schema corrente) oppure backup legacy (mappato)
      inputImport?.addEventListener('change', async () => {
        const file = inputImport.files?.[0]; if (!file) return;
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          const normalized = isLegacyBackup(imported) ? mapBackupToDb(imported) : imported;
          App.db.save(normalizeDb(normalized));
          App.ui.showToast('Dati importati. Ricarico...', 'success');
          setTimeout(()=>location.reload(), 600);
        } catch { App.ui.showToast('File non valido.', 'danger'); }
      });

      // === Test import backup (preview + import locale + import Firebase) ===
      const setPreview = (dbObj, label = '') => {
        if (!preBackup) return;
        if (!dbObj) {
          preBackup.textContent = '(nessun file caricato)';
          return;
        }
        const s = summarizeDb(dbObj);
        preBackup.textContent = [
          label ? ('Fonte: ' + label) : 'Fonte: (file)',
          'Azienda: ' + (s.company || '—'),
          'Prodotti: ' + s.products,
          'Clienti: ' + s.customers,
          'Fornitori: ' + s.suppliers,
          'Ordini clienti: ' + s.customerOrders,
          'DDT clienti: ' + s.customerDDTs,
          'Fatture: ' + s.invoices,
          'Ordini fornitori: ' + s.supplierOrders,
          'DDT fornitori: ' + s.supplierDDTs,
          'Utenti (gestionale): ' + s.users
        ].join('\n');
      };

      const enableBackupActions = (enabled) => {
        if (btnImportLocal) btnImportLocal.disabled = !enabled;
        if (btnImportFirebase) btnImportFirebase.disabled = !enabled;
      };

      async function loadBackupFromText(text, label) {
        const obj = JSON.parse(text);
        const normalized = isLegacyBackup(obj) ? mapBackupToDb(obj) : obj;
        _loadedBackupDb = normalizeDb(normalized);
        setPreview(_loadedBackupDb, label);
        enableBackupActions(true);
      }

      btnLoadSample?.addEventListener('click', async () => {
        try {
          enableBackupActions(false);
          if (preBackup) preBackup.textContent = 'Carico esempio...';
          const res = await fetch('./data/admin_gestionale_backup_2025-11-14.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('Impossibile caricare il file esempio (HTTP ' + res.status + ')');
          const text = await res.text();
          await loadBackupFromText(text, 'data/admin_gestionale_backup_2025-11-14.json');
          App.ui.showToast('Esempio caricato.', 'success');
        } catch (e) {
          App.ui.showToast('Errore caricamento esempio: ' + (e?.message || e), 'danger');
          setPreview(null);
          enableBackupActions(false);
        }
      });

      inputBackup?.addEventListener('change', async () => {
        const file = inputBackup.files?.[0]; if (!file) return;
        try {
          enableBackupActions(false);
          if (preBackup) preBackup.textContent = 'Leggo file...';
          const text = await file.text();
          await loadBackupFromText(text, file.name);
          App.ui.showToast('Backup caricato (preview aggiornata).', 'info');
        } catch (e) {
          App.ui.showToast('File non valido: ' + (e?.message || e), 'danger');
          setPreview(null);
          enableBackupActions(false);
        }
      });

      btnImportLocal?.addEventListener('click', async () => {
        if (!_loadedBackupDb) return;
        if (!confirm('Importare questo backup nel gestionale (locale)?\nSovrascriverà i dati attuali.')) return;
        App.db.save(_loadedBackupDb);
        App.ui.showToast('Import completato. Ricarico...', 'success');
        setTimeout(()=>location.reload(), 600);
      });

      btnImportFirebase?.addEventListener('click', async () => {
        if (!_loadedBackupDb) return;

        if (!confirm('Importare questo backup su Firebase (Firestore) nel tuo spazio utente?\n\nConsiglio: abilita prima Authentication (Anonymous) e regole Firestore per utente.')) return;

        try {
          await App.firebase.init();
          if (!App.firebase.uid) {
            throw new Error('Firebase Auth non disponibile (Anonymous non abilitato o dominio non autorizzato).');
          }

          const repo = (await import('../../core/firestoreRepo.js')).firestoreRepo(App.firebase.fs, App.firebase.getRootPath());
          const wipe = chkWipe ? chkWipe.checked : true;

          if (wipe) {
            App.ui.showToast('Pulizia dati su Firebase…', 'info');
            await repo.wipeAll();
          }

          App.ui.showToast('Upload backup su Firebase…', 'info');
          await repo.writeAll(_loadedBackupDb);

          // imposta Firebase come modalità e ricarica
          App.db.setMode('firebase');
          App.ui.showToast('Import su Firebase completato. Ricarico…', 'success');
          setTimeout(()=>location.reload(), 800);
        } catch (e) {
          App.ui.showToast('Import Firebase fallito: ' + (e?.message || e), 'danger');
        }
      });

      // inizializza preview
      enableBackupActions(false);
      setPreview(null);

      btnDelete?.addEventListener('click', () => {
        if (confirm('Questa operazione cancellerà tutti i dati. Procedere?')) {
          localStorage.removeItem(App.config.DB_KEY);
          App.db.resetCache();
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


export function initImpostazioniFeature() {
  Impostazioni.init();
  App.Impostazioni = Impostazioni;
}
