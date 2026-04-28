import { App } from '../../core/app.js';
import { firestoreRepo } from '../../core/firestoreRepo.js';
export function initUsersSettings() {
      const h = value => App.utils.escapeHtml(value);
      const section = document.getElementById('anagrafica-utenti');
      const tbody = document.getElementById('users-table-body');
      const saveBtn = document.getElementById('saveUserBtn');
      const newBtn = document.getElementById('newUserBtn');
      const infoP = section?.querySelector('p');
      const theadRow = section?.querySelector('table thead tr');

      const modal = document.getElementById('userModal');
      const form = document.getElementById('userForm');
      const fbFields = document.getElementById('firebaseUserFields');

      if (!tbody || !saveBtn || !form) return;

      const currentRole = App.currentUser?.role || 'User';
      const canManageFirebaseUsers = (currentRole === 'Supervisor' || currentRole === 'Admin');
      let firebaseUsersCache = [];
      let selectedFirebaseUids = new Set();

      const setModalMode = () => {
        form.dataset.mode = 'firebase';
        fbFields?.classList.remove('d-none');
        const title = document.getElementById('userModalTitle');
        if (title) title.textContent = 'Modifica Utente (Firebase)';
      };

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

      const renderFirebaseUsers = async () => {
        setModalMode();
        if (theadRow) theadRow.innerHTML = '<th class="text-center" style="width:36px"><input class="form-check-input" type="checkbox" id="users-select-all"></th><th>UID</th><th>Email</th><th>Nome</th><th>Cognome</th><th>Ruolo</th><th class="text-end">Azioni</th>';
        if (infoP) infoP.innerHTML = 'Gli account vengono creati dalla schermata <strong>Registrati</strong>. In elenco compaiono gli utenti che hanno effettuato almeno un accesso (profilo <code>appUsers</code>). Qui puoi gestire i <strong>ruoli</strong> su Firebase (solo Supervisor).';

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
          const present = new Set(firebaseUsersCache.map(x => String(x.uid || x.id || '')));
          selectedFirebaseUids = new Set([...selectedFirebaseUids].filter(uid => present.has(uid)));
        } catch (e) {
          tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Impossibile leggere la directory utenti su Firebase: ${h(e?.message || e)}</td></tr>`;
          return;
        }

        tbody.innerHTML = firebaseUsersCache.map(u => `
          <tr>
            <td class="text-center"><input class="form-check-input user-select" type="checkbox" data-id="${h(u.uid || u.id)}" ${selectedFirebaseUids.has(String(u.uid || u.id)) ? 'checked' : ''}></td>
            <td title="${h(u.uid || u.id || '')}">${h(String(u.uid || u.id || '').slice(0,8))}</td>
            <td>${h(u.email || '')}</td>
            <td>${h(u.name || '')}</td>
            <td>${h(u.surname || '')}</td>
            <td>${h(u.role || '')}</td>
            <td class="text-end">
              <div class="btn-group btn-group-sm" role="group">
                ${(() => {
                  const role = String(u.role || '');
                  const emailLc = String(u.email || '').toLowerCase();
                  const bootstrap = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
                  const meUid = App.firebase?.uid;
                  if (role !== 'Supervisor') return `<button class=\"btn btn-outline-success\" data-action=\"promote\" data-id=\"${u.uid || u.id}\">Promuovi a Supervisor</button>`;
                  if (bootstrap.includes(emailLc)) return `<button class=\"btn btn-outline-secondary\" disabled>Supervisor (docente)</button>`;
                  if (meUid && (u.uid || u.id) === meUid) return `<button class=\"btn btn-outline-secondary\" disabled>Supervisor (tu)</button>`;
                  return `<button class=\"btn btn-outline-warning\" data-action=\"demote\" data-id=\"${u.uid || u.id}\">Riporta a User</button>`;
                })()}
                <button class="btn btn-outline-primary" data-action="edit" data-id="${h(u.uid || u.id)}">Modifica</button>
              </div>
            </td>
          </tr>`).join('');

        const selectAll = document.getElementById('users-select-all');
        if (selectAll) {
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

        const bulkPromote = document.getElementById('bulk-promote-btn');
        bulkPromote?.addEventListener('click', async () => {
          const ids = [...selectedFirebaseUids];
          if (!ids.length) return App.ui.showToast('Seleziona almeno un utente.', 'info');
          const toPromote = ids.filter(uid => {
            const u = firebaseUsersCache.find(x => String(x.uid || x.id) === uid);
            return u && String(u.role || '') !== 'Supervisor';
          });
          if (!toPromote.length) return App.ui.showToast('Nessun utente selezionato è promuovibile.', 'info');
          if (!confirm(`Promuovere ${toPromote.length} utenti a Supervisor?`)) return;
          try {
            if (App.userDirectory.updateManyRole) await App.userDirectory.updateManyRole(toPromote, 'Supervisor');
            else for (const uid of toPromote) await App.userDirectory.update(uid, { role: 'Supervisor' });
            App.ui.showToast('Promozione completata.', 'success');
            selectedFirebaseUids.clear();
            await renderFirebaseUsers();
          } catch (e) {
            App.ui.showToast('Promozione fallita: ' + (e?.message || e), 'danger');
          }
        });

        const bulkDemote = document.getElementById('bulk-demote-btn');
        bulkDemote?.addEventListener('click', async () => {
          const ids = [...selectedFirebaseUids];
          if (!ids.length) return App.ui.showToast('Seleziona almeno un utente.', 'info');
          const meUid = App.firebase?.uid;
          const bootstrap = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
          const supervisors = firebaseUsersCache.filter(x => String(x.role || '') === 'Supervisor');
          const toDemote = ids.filter(uid => {
            const u = firebaseUsersCache.find(x => String(x.uid || x.id) === uid);
            if (!u) return false;
            if (String(u.role || '') !== 'Supervisor') return false;
            if (meUid && uid === meUid) return false;
            if (bootstrap.includes(String(u.email || '').toLowerCase())) return false;
            return true;
          });
          if (!toDemote.length) return App.ui.showToast('Nessun Supervisor selezionato è declassabile.', 'info');
          if (supervisors.length - toDemote.length < 1) return App.ui.showToast('Deve rimanere almeno un Supervisor.', 'warning');
          if (!confirm(`Riportare ${toDemote.length} utenti a User?`)) return;
          try {
            if (App.userDirectory.updateManyRole) await App.userDirectory.updateManyRole(toDemote, 'User');
            else for (const uid of toDemote) await App.userDirectory.update(uid, { role: 'User' });
            App.ui.showToast('Declassamento completato.', 'success');
            selectedFirebaseUids.clear();
            await renderFirebaseUsers();
          } catch (e) {
            App.ui.showToast('Declassamento fallito: ' + (e?.message || e), 'danger');
          }
        });

        syncSelectAll();
      };

      if (section?.dataset.bound === '1') {
        void renderFirebaseUsers();
        return;
      }
      if (section) section.dataset.bound = '1';

      saveBtn.addEventListener('click', async () => {
        if (!canManageFirebaseUsers) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        const uid = document.getElementById('user-fb-uid').value;
        const email = document.getElementById('user-email').value;
        const name = document.getElementById('user-fb-name').value.trim();
        const surname = document.getElementById('user-fb-surname').value.trim();
        const role = document.getElementById('user-role').value || 'User';
        if (!uid || !email) return App.ui.showToast('Utente Firebase non valido.', 'warning');

        try {
          await App.userDirectory.update(uid, { role, name, surname });
          App.ui.showToast('Utente aggiornato su Firebase', 'success');
          try { bootstrap.Modal.getOrCreateInstance(modal).hide(); } catch {}
          await renderFirebaseUsers();
        } catch (e) {
          App.ui.showToast('Salvataggio Firebase fallito: ' + (e?.message || e), 'danger');
        }
      });

      tbody.addEventListener('change', (e) => {
        const box = e.target.closest('input.user-select');
        if (!box) return;
        const uid = String(box.getAttribute('data-id') || '');
        if (!uid) return;
        if (box.checked) selectedFirebaseUids.add(uid);
        else selectedFirebaseUids.delete(uid);
        syncSelectAll();
      });

      tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        if (!canManageFirebaseUsers) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');

        if (action === 'demote') {
          const u = firebaseUsersCache.find(x => (x.uid === id || x.id === id));
          if (!u) return;
          const meUid = App.firebase?.uid;
          const emailLc = String(u.email || '').toLowerCase();
          const bootstrap = (App.config?.SUPERVISOR_EMAILS || []).map(e => String(e).toLowerCase());
          if (bootstrap.includes(emailLc)) return App.ui.showToast('Questo Supervisor è protetto (docente).', 'info');
          if (meUid && id === meUid) return App.ui.showToast('Non puoi declassare te stesso da qui.', 'warning');
          const nSup = firebaseUsersCache.filter(x => String(x.role||'') === 'Supervisor').length;
          if (nSup <= 1) return App.ui.showToast('Deve rimanere almeno un Supervisor.', 'warning');
          if (!confirm(`Declassare ${u.email || id} a User?`)) return;
          try {
            await App.userDirectory.update(id, { role: 'User' });
            App.ui.showToast('Ruolo aggiornato: User', 'success');
            await renderFirebaseUsers();
          } catch (e) {
            App.ui.showToast('Declassamento fallito: ' + (e?.message || e), 'danger');
          }
        } else if (action === 'promote') {
          const u = firebaseUsersCache.find(x => (x.uid === id || x.id === id));
          if (!u) return;
          if ((u.role || '') === 'Supervisor') return App.ui.showToast('Utente già Supervisor.', 'info');
          if (!confirm(`Promuovere ${u.email || id} a Supervisor?`)) return;
          try {
            await App.userDirectory.update(id, { role: 'Supervisor' });
            App.ui.showToast('Ruolo aggiornato: Supervisor', 'success');
            await renderFirebaseUsers();
          } catch (e) {
            App.ui.showToast('Promozione fallita: ' + (e?.message || e), 'danger');
          }
        } else if (action === 'edit') {
          const u = firebaseUsersCache.find(x => x.uid === id || x.id === id);
          if (!u) return;
          setModalMode();
          document.getElementById('user-fb-uid').value = u.uid || u.id || '';
          document.getElementById('user-email').value = u.email || '';
          document.getElementById('user-fb-name').value = u.name || '';
          document.getElementById('user-fb-surname').value = u.surname || '';
          document.getElementById('user-role').value = u.role || 'User';
          try { bootstrap.Modal.getOrCreateInstance(modal).show(); } catch {}
        }
      });

      void renderFirebaseUsers();
}

