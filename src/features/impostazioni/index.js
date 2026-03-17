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

      const section = document.getElementById('anagrafica-utenti');
      const tbody = document.getElementById('users-table-body');
      const saveBtn = document.getElementById('saveUserBtn');
      const newBtn = document.getElementById('newUserBtn');
      const infoP = section?.querySelector('p');
      const theadRow = section?.querySelector('table thead tr');

      const modal = document.getElementById('userModal');
      const form = document.getElementById('userForm');
      const localFields = document.getElementById('localUserFields');
      const fbFields = document.getElementById('firebaseUserFields');

      if (!tbody || !saveBtn || !form) return;

      const isFirebaseMode = (App.db.getMode?.() === 'firebase');
      const currentRole = App.currentUser?.role || 'User';
      const canManageFirebaseUsers = (currentRole === 'Supervisor' || currentRole === 'Admin');

      const setModalMode = (mode) => {
        form.dataset.mode = mode;
        if (mode === 'firebase') {
          localFields?.classList.add('d-none');
          fbFields?.classList.remove('d-none');
          document.getElementById('userModalTitle').textContent = 'Modifica Utente (Firebase)';
        } else {
          fbFields?.classList.add('d-none');
          localFields?.classList.remove('d-none');
          document.getElementById('userModalTitle').textContent = 'Utente (Locale)';
        }
      };

      // Avoid duplicate handlers if initUsers is re-called
      if (saveBtn.dataset.bound === '1') {
        // still refresh view
      } else {
        saveBtn.dataset.bound = '1';

        saveBtn.addEventListener('click', async () => {
          const mode = form.dataset.mode || 'local';

          if (mode === 'firebase') {
            if (!canManageFirebaseUsers) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
            const uid = document.getElementById('user-fb-uid').value;
            const email = document.getElementById('user-email').value;
            const name = document.getElementById('user-fb-name').value.trim();
            const surname = document.getElementById('user-fb-surname').value.trim();
            const role = document.getElementById('user-role').value || 'User';
            if (!uid || !email) return App.ui.showToast('Utente non valido.', 'warning');

            try {
              await App.userDirectory.update(uid, { role, name, surname });
              App.ui.showToast('Utente aggiornato su Firebase', 'success');
              try { bootstrap.Modal.getOrCreateInstance(modal).hide(); } catch {}
              await renderFirebaseUsers();
            } catch (e) {
              App.ui.showToast('Salvataggio fallito: ' + (e?.message || e), 'danger');
            }
            return;
          }

          // LOCAL mode (legacy / emergenza)
          const id = document.getElementById('user-id').value || App.utils.uuid();
          const surname = document.getElementById('user-surname').value.trim();
          const name = document.getElementById('user-name').value.trim();
          const password = document.getElementById('user-password').value;
          const role = document.getElementById('user-role').value;

          if (!surname || !name || !password) return App.ui.showToast('Compila i campi obbligatori.', 'warning');

          const idx = (db.users || []).findIndex(u => u.id === id);
          const payload = { id, surname, name, password, role };
          if (idx >= 0) db.users[idx] = payload; else (db.users = db.users || []).push(payload);
          App.db.save(db);
          renderLocalUsers();
          App.ui.showToast('Utente salvato', 'success');
          try { bootstrap.Modal.getOrCreateInstance(modal).hide(); } catch {}
        });

        // Toggle password visibility (local modal)
        document.getElementById('togglePassword')?.addEventListener('click', () => {
          const inp = document.getElementById('user-password');
          if (!inp) return;
          inp.type = (inp.type === 'password') ? 'text' : 'password';
          const ic = document.querySelector('#togglePassword i');
          if (ic) ic.className = (inp.type === 'password') ? 'fas fa-eye' : 'fas fa-eye-slash';
        });

        tbody.addEventListener('click', async (e) => {
          const btn = e.target.closest('button[data-action]'); if (!btn) return;
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');

          if (isFirebaseMode) {
            if (!canManageFirebaseUsers) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
            if (action === 'demote') {
              const uid = id;
              const u = firebaseUsersCache.find(x => (x.uid === uid || x.id === uid));
              if (!u) return;
              // Evita di declassare l'utente bootstrap (docente) o te stesso (per non bloccarti fuori)
              const meUid = App.firebase?.uid;
              const emailLc = String(u.email || '').toLowerCase();
              const bootstrap = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
              if (bootstrap.includes(emailLc)) return App.ui.showToast('Questo Supervisor è protetto (docente).', 'info');
              if (meUid && uid === meUid) return App.ui.showToast('Non puoi declassare te stesso da qui.', 'warning');
              // Evita di lasciare il sistema senza Supervisor
              const nSup = firebaseUsersCache.filter(x => String(x.role||'') === 'Supervisor').length;
              if (nSup <= 1) return App.ui.showToast('Deve rimanere almeno un Supervisor.', 'warning');
              if (!confirm(`Declassare ${u.email || uid} a User?`)) return;
              try {
                await App.userDirectory.update(uid, { role: 'User' });
                App.ui.showToast('Ruolo aggiornato: User', 'success');
                await renderFirebaseUsers();
              } catch (e) {
                App.ui.showToast('Declassamento fallito: ' + (e?.message || e), 'danger');
              }
            } else if (action === 'promote') {
              const uid = id;
              const u = firebaseUsersCache.find(x => (x.uid === uid || x.id === uid));
              if (!u) return;
              if ((u.role || '') === 'Supervisor') return App.ui.showToast('Utente già Supervisor.', 'info');
              if (!confirm(`Promuovere ${u.email || uid} a Supervisor?`)) return;
              try {
                await App.userDirectory.update(uid, { role: 'Supervisor' });
                App.ui.showToast('Ruolo aggiornato: Supervisor', 'success');
                await renderFirebaseUsers();
              } catch (e) {
                App.ui.showToast('Promozione fallita: ' + (e?.message || e), 'danger');
              }
            } else if (action === 'edit') {
              const u = firebaseUsersCache.find(x => x.uid === id || x.id === id);
              if (!u) return;
              setModalMode('firebase');
              document.getElementById('user-fb-uid').value = u.uid || u.id || '';
              document.getElementById('user-email').value = u.email || '';
              document.getElementById('user-fb-name').value = u.name || '';
              document.getElementById('user-fb-surname').value = u.surname || '';
              document.getElementById('user-role').value = u.role || 'User';
              try { bootstrap.Modal.getOrCreateInstance(modal).show(); } catch {}
            } else if (action === 'del') {
              App.ui.showToast('Per sicurezza: la cancellazione utenti Firebase non è abilitata dall’app.', 'warning');
            }
            return;
          }

          // LOCAL
          if (action === 'edit') {
            const u = (db.users || []).find(x => x.id === id); if (!u) return;
            setModalMode('local');
            document.getElementById('user-id').value = u.id;
            document.getElementById('user-surname').value = u.surname || '';
            document.getElementById('user-name').value = u.name || '';
            document.getElementById('user-password').value = u.password || '';
            document.getElementById('user-role').value = u.role || 'User';
            try { bootstrap.Modal.getOrCreateInstance(modal).show(); } catch {}
          } else if (action === 'del') {
            const i = (db.users || []).findIndex(x => x.id === id);
            if (i >= 0 && confirm('Eliminare l’utente?')) {
              db.users.splice(i,1); App.db.save(db); renderLocalUsers();
            }
          }
        });
      }

      // --- Render helpers
      const renderLocalUsers = () => {
        if (theadRow) theadRow.innerHTML = '<th>ID</th><th>Cognome (Login)</th><th>Nome</th><th>Ruolo</th><th class="text-end">Azioni</th>';
        if (infoP) infoP.innerHTML = 'Il <strong>Cognome</strong> e la <strong>Password</strong> sono usati per il Login locale (emergenza).';
        if (newBtn) {
          newBtn.classList.remove('d-none');
          newBtn.disabled = false;
          newBtn.innerHTML = '<i class="fas fa-plus"></i> Nuovo Utente';
          newBtn.onclick = () => { setModalMode('local'); form.reset(); document.getElementById('user-id').value = ''; try { bootstrap.Modal.getOrCreateInstance(modal).show(); } catch {} };
        }
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

      let firebaseUsersCache = [];
      let selectedFirebaseUids = new Set();

      const renderFirebaseUsers = async () => {
        if (theadRow) theadRow.innerHTML = '<th class="text-center" style="width:36px"><input class="form-check-input" type="checkbox" id="users-select-all"></th><th>UID</th><th>Email</th><th>Nome</th><th>Cognome</th><th>Ruolo</th><th class="text-end">Azioni</th>';
        if (infoP) infoP.innerHTML = 'Gli account vengono creati dalla schermata <strong>Registrati</strong>. In elenco compaiono gli utenti che hanno effettuato almeno un accesso (profilo <code>appUsers</code>). Qui puoi gestire i <strong>ruoli</strong> (solo Supervisor).';
        // Bulk actions toolbar (multi-select)
        let bulkBar = document.getElementById('users-bulk-actions');
        if (!bulkBar && section) {
          bulkBar = document.createElement('div');
          bulkBar.id = 'users-bulk-actions';
          bulkBar.className = 'd-flex flex-wrap gap-2 align-items-center mb-2';
          infoP?.after(bulkBar);
        }
        if (bulkBar) {
          bulkBar.innerHTML = `
            <button class="btn btn-sm btn-outline-success" id="bulk-promote-btn"><i class="fas fa-user-shield"></i> Promuovi selezionati</button>
            <button class="btn btn-sm btn-outline-warning" id="bulk-demote-btn"><i class="fas fa-user"></i> Riporta selezionati a User</button>
            <span class="ms-2 text-muted" id="bulk-selected-count">0 selezionati</span>
          `;
        }

        if (newBtn) {
          newBtn.classList.remove('d-none');
          newBtn.disabled = !canManageFirebaseUsers;
          newBtn.innerHTML = '<i class="fas fa-rotate-right"></i> Aggiorna elenco';
          newBtn.onclick = async () => { await renderFirebaseUsers(); };
        }

        if (!canManageFirebaseUsers) {
          tbody.innerHTML = `<tr><td colspan="7"><em>Accesso limitato: serve ruolo Supervisor per vedere/modificare gli utenti.</em></td></tr>`;
          return;
        }

        try {
          firebaseUsersCache = await App.userDirectory.listAll();
          // prune selection (uids no longer present)
          const present = new Set(firebaseUsersCache.map(x => String(x.uid || x.id || '')));
          selectedFirebaseUids = new Set([...selectedFirebaseUids].filter(uid => present.has(uid)));

        } catch (e) {
          tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Impossibile leggere la directory utenti su Firebase: ${(e?.message || e)}</td></tr>`;
          return;
        }

        tbody.innerHTML = firebaseUsersCache.map(u => `
          <tr>
            <td class="text-center"><input class="form-check-input user-select" type="checkbox" data-id="${u.uid || u.id}" ${selectedFirebaseUids.has(String(u.uid || u.id)) ? 'checked' : ''}></td>
            <td title="${u.uid || u.id || ''}">${String(u.uid || u.id || '').slice(0,8)}</td>
            <td>${u.email || ''}</td>
            <td>${u.name || ''}</td>
            <td>${u.surname || ''}</td>
            <td>${u.role || ''}</td>
            <td class="text-end">
              <div class="btn-group btn-group-sm" role="group">
                ${(() => {
                  const role = String(u.role || '');
                  const emailLc = String(u.email || '').toLowerCase();
                  const bootstrap = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
                  const meUid = App.firebase?.uid;
                  if (role !== 'Supervisor') {
                    return `<button class=\"btn btn-outline-success\" data-action=\"promote\" data-id=\"${u.uid || u.id}\">Promuovi a Supervisor</button>`;
                  }
                  if (bootstrap.includes(emailLc)) {
                    return `<button class=\"btn btn-outline-secondary\" disabled>Supervisor (docente)</button>`;
                  }
                  if (meUid && (u.uid || u.id) === meUid) {
                    return `<button class=\"btn btn-outline-secondary\" disabled>Supervisor (tu)</button>`;
                  }
                  return `<button class=\"btn btn-outline-warning\" data-action=\"demote\" data-id=\"${u.uid || u.id}\">Riporta a User</button>`;
                })()}
                <button class="btn btn-outline-primary" data-action="edit" data-id="${u.uid || u.id}">Modifica</button>
              </div>
            </td>
          </tr>`).join('');

        // --- Multi-select wiring
        const updateBulkCount = () => {
          const el = document.getElementById('bulk-selected-count');
          if (el) el.textContent = `${selectedFirebaseUids.size} selezionati`;
        };

        const syncSelectAll = () => {
          const all = document.getElementById('users-select-all');
          if (!all) return;
          const boxes = [...tbody.querySelectorAll('input.user-select')];
          const checked = boxes.filter(b => b.checked).length;
          all.checked = (boxes.length > 0 && checked === boxes.length);
          all.indeterminate = (checked > 0 && checked < boxes.length);
          updateBulkCount();
        };

        // bind once
        if (tbody.dataset.selectBound !== '1') {
          tbody.dataset.selectBound = '1';

          tbody.addEventListener('change', (e) => {
            const box = e.target.closest('input.user-select');
            if (!box) return;
            const uid = String(box.getAttribute('data-id') || '');
            if (!uid) return;
            if (box.checked) selectedFirebaseUids.add(uid);
            else selectedFirebaseUids.delete(uid);
            syncSelectAll();
          });
        }

        const selectAll = document.getElementById('users-select-all');
        if (selectAll && selectAll.dataset.bound !== '1') {
          selectAll.dataset.bound = '1';
          selectAll.addEventListener('change', () => {
            const boxes = [...tbody.querySelectorAll('input.user-select')];
            boxes.forEach(b => {
              b.checked = selectAll.checked;
              const uid = String(b.getAttribute('data-id') || '');
              if (!uid) return;
              if (b.checked) selectedFirebaseUids.add(uid);
              else selectedFirebaseUids.delete(uid);
            });
            syncSelectAll();
          });
        }

        // Bulk promote / demote
        const bulkPromote = document.getElementById('bulk-promote-btn');
        if (bulkPromote && bulkPromote.dataset.bound !== '1') {
          bulkPromote.dataset.bound = '1';
          bulkPromote.addEventListener('click', async () => {
            const ids = [...selectedFirebaseUids];
            if (!ids.length) return App.ui.showToast('Seleziona almeno un utente.', 'info');

            const toPromote = ids.filter(uid => {
              const u = firebaseUsersCache.find(x => String(x.uid || x.id) === uid);
              return u && String(u.role || '') !== 'Supervisor';
            });

            if (!toPromote.length) return App.ui.showToast('Nessun utente selezionato è promuovibile.', 'info');
            if (!confirm(`Promuovere ${toPromote.length} utenti a Supervisor?`)) return;

            try {
              if (App.userDirectory.updateManyRole) {
                await App.userDirectory.updateManyRole(toPromote, 'Supervisor');
              } else {
                for (const uid of toPromote) await App.userDirectory.update(uid, { role: 'Supervisor' });
              }
              App.ui.showToast('Promozione completata.', 'success');
              selectedFirebaseUids.clear();
              await renderFirebaseUsers();
            } catch (e) {
              App.ui.showToast('Promozione fallita: ' + (e?.message || e), 'danger');
            }
          });
        }

        const bulkDemote = document.getElementById('bulk-demote-btn');
        if (bulkDemote && bulkDemote.dataset.bound !== '1') {
          bulkDemote.dataset.bound = '1';
          bulkDemote.addEventListener('click', async () => {
            const ids = [...selectedFirebaseUids];
            if (!ids.length) return App.ui.showToast('Seleziona almeno un utente.', 'info');

            const meUid = App.firebase?.uid;
            const bootstrap = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());

            const supervisors = firebaseUsersCache.filter(x => String(x.role || '') === 'Supervisor');
            const nSup = supervisors.length;

            const toDemote = ids.filter(uid => {
              const u = firebaseUsersCache.find(x => String(x.uid || x.id) === uid);
              if (!u) return false;
              if (String(u.role || '') !== 'Supervisor') return false;
              if (meUid && uid === meUid) return false;
              const emailLc = String(u.email || '').toLowerCase();
              if (bootstrap.includes(emailLc)) return false;
              return true;
            });

            if (!toDemote.length) return App.ui.showToast('Nessun Supervisor selezionato è declassabile.', 'info');
            if (nSup - toDemote.length < 1) return App.ui.showToast('Deve rimanere almeno un Supervisor.', 'warning');
            if (!confirm(`Riportare ${toDemote.length} utenti a User?`)) return;

            try {
              if (App.userDirectory.updateManyRole) {
                await App.userDirectory.updateManyRole(toDemote, 'User');
              } else {
                for (const uid of toDemote) await App.userDirectory.update(uid, { role: 'User' });
              }
              App.ui.showToast('Declassamento completato.', 'success');
              selectedFirebaseUids.clear();
              await renderFirebaseUsers();
            } catch (e) {
              App.ui.showToast('Declassamento fallito: ' + (e?.message || e), 'danger');
            }
          });
        }

        // initial sync
        syncSelectAll();

      };

      // Initial render depending on mode
      if (isFirebaseMode) {
        setModalMode('firebase');
        renderFirebaseUsers();
      } else {
        setModalMode('local');
        renderLocalUsers();
      }
    },


    initAdvanced() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const btnSend = document.getElementById('send-data-btn');
      const btnExportCurrent = document.getElementById('backup-export-current-btn');
      const btnExportFirebase = document.getElementById('backup-export-firebase-btn');
      const btnClearLocalCache = document.getElementById('clear-local-cache-btn');
      const btnDeleteFirebaseData = document.getElementById('delete-firebase-data-btn');

      // Permessi: alcune azioni sono riservate ai Supervisor
      const role = App.currentUser?.role || 'User';
      const isSupervisor = (role === 'Supervisor' || role === 'Admin');
      // Nasconde la card 'Dati Firebase' per gli User
      if (!isSupervisor) {
        const card = btnDeleteFirebaseData?.closest('.card');
        if (card) card.classList.add('d-none');
      }


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

      const downloadJson = (obj, filename) => {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      };

      btnSend?.addEventListener('click', () => {
        downloadJson(db, 'dati_gestionale.json');
        const mailto = 'mailto:docente@example.com?subject=' + encodeURIComponent('Revisione dati gestionale') +
                       '&body=' + encodeURIComponent('In allegato i dati esportati del gestionale.');
        window.location.href = mailto;
      });

      // Backup export (dati correnti)
      btnExportCurrent?.addEventListener('click', () => {
        const side = document.getElementById('user-name-sidebar')?.textContent || '';
        const m = side.match(/Utente:\s*([^\s]+)/);
        const tag = m ? m[1] : 'export';
        const filename = `backup_${tag}_${new Date().toISOString().slice(0,10)}.json`;
        downloadJson(db, filename);
      });

      // Backup export (da Firebase) - NON modifica i dati locali
      btnExportFirebase?.addEventListener('click', async () => {
        try {
          await App.firebase.init();
          if (!App.firebase.uid) throw new Error('Firebase Auth non disponibile.');
          const repo = (await import('../../core/firestoreRepo.js')).firestoreRepo(App.firebase.fs, App.firebase.getRootPath());
          const remote = await repo.loadAll();
          const norm = normalizeDb(remote);
          const filename = `backup_firebase_${new Date().toISOString().slice(0,10)}.json`;
          downloadJson(norm, filename);
          App.ui.showToast('Backup esportato da Firebase.', 'success');
        } catch (e) {
          App.ui.showToast('Export Firebase fallito: ' + (e?.message || e), 'danger');
        }
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
        const mode = App.db.getMode();
        if (mode === 'firebase') {
          if (!confirm('Applico questo backup alla cache locale del browser.\n\nPer vederlo subito passerò in modalità Local (senza Firebase). Continuare?')) return;
          App.db.setMode('local');
        } else {
          if (!confirm('Applicare questo backup alla cache locale del browser?\nSovrascriverà i dati locali attuali.')) return;
        }
        App.db.save(_loadedBackupDb);
        App.ui.showToast('Import completato. Ricarico...', 'success');
        setTimeout(()=>location.reload(), 600);
      });

      btnImportFirebase?.addEventListener('click', async () => {
        if (!_loadedBackupDb) return;

        if (!confirm('Importare questo backup su Firebase (Firestore) nel tuo spazio utente?\n\nConsiglio: abilita Authentication (Email/Password) e regole Firestore per utente. Devi essere autenticato per usare Firestore.')) return;

        try {
          await App.firebase.init();
          if (!App.firebase.uid) {
            throw new Error('Firebase Auth non disponibile: fai login con Email/Password (o abilita Anonymous) e verifica gli Authorized domains.');
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

      // Svuota SOLO la cache locale (non tocca Firebase)
      btnClearLocalCache?.addEventListener('click', () => {
        if (!confirm('Svuotare la cache locale del browser?\n\nI dati su Firebase NON verranno toccati.')) return;
        localStorage.removeItem(App.config.DB_KEY);
        App.db.resetCache();
        App.ui.showToast('Cache locale svuotata. Ricarico…', 'info');
        setTimeout(()=>location.reload(), 600);
      });

      // Cancella dati su Firebase (utente)
      btnDeleteFirebaseData?.addEventListener('click', async () => {
        const txt = prompt('Operazione irreversibile.\n\nScrivi CANCELLA per confermare la cancellazione dei dati su Firebase (utente).');
        if (txt !== 'CANCELLA') return;
        try {
          await App.firebase.init();
          if (!App.firebase.uid) throw new Error('Firebase Auth non disponibile.');
          const repo = (await import('../../core/firestoreRepo.js')).firestoreRepo(App.firebase.fs, App.firebase.getRootPath());
          App.ui.showToast('Cancellazione dati su Firebase…', 'warning');
          await repo.wipeAll();
          // pulisci cache locale per evitare UI con dati vecchi
          localStorage.removeItem(App.config.DB_KEY);
          App.db.resetCache();
          App.ui.showToast('Dati Firebase cancellati. Ricarico…', 'success');
          setTimeout(()=>location.reload(), 900);
        } catch (e) {
          App.ui.showToast('Cancellazione Firebase fallita: ' + (e?.message || e), 'danger');
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
