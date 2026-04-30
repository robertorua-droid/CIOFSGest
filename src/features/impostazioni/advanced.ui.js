import { App } from '../../core/app.js';
import {
  createBackupPreviewText,
  importBackupToFirebase,
  loadFirebaseSnapshotForBackup,
  prepareBackupFromText,
  wipeFirebaseDataset
} from '../../domain/backup.service.js';
import { firestoreRepo } from '../../core/firestoreRepo.js';
import {
  assertClassResetConfirmation,
  isClassResetSupervisor,
  removeClassUsersExceptSupervisors,
  wipeClassDatasets
} from '../../domain/classReset.service.js';
export function initAdvancedSettings() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const btnSend = document.getElementById('send-data-btn');
      const btnExportCurrent = document.getElementById('backup-export-current-btn');
      const btnDeleteFirebaseData = document.getElementById('delete-firebase-data-btn');
      const classAdminCard = document.getElementById('class-admin-actions-card');
      const btnWipeClassData = document.getElementById('class-wipe-data-btn');
      const btnRemoveClassUsers = document.getElementById('class-remove-users-btn');
      const classAdminNote = document.getElementById('class-admin-actions-note');
      const fsUsageCard = document.getElementById('fs-usage-card');
      const elFsJson = document.getElementById('fs-json-size');
      const elFsEst = document.getElementById('fs-est-size');
      const elFsDocs = document.getElementById('fs-doc-count');
      const elFsPct = document.getElementById('fs-used-pct');
      const elFsBar = document.getElementById('fs-usage-bar');
      const btnFsClass = document.getElementById('fs-class-calc-btn');
      const lblFsUsers = document.getElementById('fs-class-users');
      const noteFsClass = document.getElementById('fs-class-calc-note');
      const chkAllowNeg = document.getElementById('allow-negative-stock-checkbox');

      // Permessi: alcune azioni sono riservate ai Supervisor
      const role = App.currentUser?.role || 'User';
      const isSupervisor = (role === 'Supervisor' || role === 'Admin');
      const isClassAdmin = isClassResetSupervisor(App.currentUser, App.config?.SUPERVISOR_EMAILS);
      // Nasconde la card 'Dati Firebase' per gli User
      if (!isSupervisor) {
        const card = btnDeleteFirebaseData?.closest('.card');
        if (card) card.classList.add('d-none');
      }
      if (classAdminCard) classAdminCard.classList.toggle('d-none', !isClassAdmin);
      if (classAdminNote && isClassAdmin) {
        classAdminNote.textContent = `Supervisor autorizzato: ${App.currentUser?.email || ''}`;
      }


      // Backup test/import (JSON precedente -> schema corrente)
      const btnLoadSample = document.getElementById('backup-load-sample-btn');
      const inputBackup = document.getElementById('backup-file-input');
      const preBackup = document.getElementById('backup-preview');
      const btnImportFirebase = document.getElementById('backup-import-firebase-btn');
      const chkWipe = document.getElementById('backup-wipe-checkbox');
      let _loadedBackupDb = null;
      if (document.getElementById('avanzate')?.dataset.bound === '1') {
        if (chkAllowNeg) chkAllowNeg.checked = (db.settings?.allowNegativeStock !== false);
        return;
      }
      const advancedSection = document.getElementById('avanzate');
      if (advancedSection) advancedSection.dataset.bound = '1';

      // Didattica: consenti giacenza negativa (default ON)
      const syncAllowNegToggle = () => {
        if (!chkAllowNeg) return;
        const val = (db.settings?.allowNegativeStock !== false);
        if (chkAllowNeg.checked !== val) chkAllowNeg.checked = val;
      };

      if (chkAllowNeg) {
        // inizializza default true se mancante (e persiste)
        db.settings = db.settings || {};
        if (db.settings.allowNegativeStock === undefined) {
          App.db.mutate('settings:init-negative-stock', currentDb => {
            currentDb.settings = currentDb.settings || {};
            currentDb.settings.allowNegativeStock = true;
            return { allowNegativeStock: true };
          });
          db = App.db.ensure();
        }
        syncAllowNegToggle();

        chkAllowNeg.addEventListener('change', () => {
          App.db.mutate('settings:update-negative-stock', currentDb => {
            currentDb.settings = currentDb.settings || {};
            currentDb.settings.allowNegativeStock = !!chkAllowNeg.checked;
            return { allowNegativeStock: currentDb.settings.allowNegativeStock };
          });
          db = App.db.ensure();
          App.ui.showToast('Impostazione salvata.', 'success');
        });

        // mantiene il toggle sincronizzato se il DB cambia (sync/pull/import)
        App.events.on('db:changed', (d) => {
          db = d;
          syncAllowNegToggle();
        });
      }
// ===== Utilizzo Firestore (stima) – visibile solo Supervisor =====
      
      // ===== Utilizzo Firestore (classe) – solo Supervisor =====
      if (fsUsageCard && !isSupervisor) fsUsageCard.classList.add('d-none');

      const formatBytes = (bytes) => {
        const b = Number(bytes || 0);
        if (!Number.isFinite(b) || b < 0) return '—';
        const units = ['B','KB','MB','GB'];
        let v = b; let u = 0;
        while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
        return `${v.toFixed(u === 0 ? 0 : 2)} ${units[u]}`;
      };

      const FREE = 1024 * 1024 * 1024; // 1 GiB (Spark)
      const estimateDocCount = (d) => {
        const dbx = d || {};
        let n = 5; // meta docs
        n += (dbx.products || []).length;
        n += (dbx.customers || []).length;
        n += (dbx.suppliers || []).length;
        n += (dbx.customerOrders || []).length;
        n += (dbx.supplierOrders || []).length;
        n += (dbx.customerDDTs || []).length;
        n += (dbx.supplierDDTs || []).length;
        n += (dbx.supplierQuarantine || []).length;
        n += (dbx.supplierReturnDDTs || []).length;
        n += (dbx.invoices || []).length;
        return n;
      };

      btnFsClass?.addEventListener('click', async () => {
        if (!isSupervisor) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        try {
          if (noteFsClass) noteFsClass.textContent = 'Calcolo in corso…';
          // elenco utenti (appUsers)
          const users = await App.userDirectory.listAll();
          const uids = (users || []).map(u => String(u.uid || u.id || '')).filter(Boolean);
          if (lblFsUsers) lblFsUsers.textContent = String(uids.length);

          // somma dimensione JSON dei dataset di tutti gli utenti
          const enc = new TextEncoder();
          let totalBytes = 0;
          let totalDocs = 0;

          // ATTENZIONE: richiede rules che permettano al Supervisor di leggere /users/{uid}/...
          // Se non abilitate, qui riceverai permission-denied.
          await App.firebase.init();
          for (const uid of uids) {
            const root = `users/${uid}`;
            const repo = firestoreRepo(App.firebase.fs, root);
            const data = await repo.loadAll();
            totalBytes += enc.encode(JSON.stringify(data || {})).length;
            totalDocs += estimateDocCount(data);
          }

          // overhead/indici: stima x2
          const est = Math.round(totalBytes * 2);
          const pct = (est / FREE) * 100;

          if (elFsJson) elFsJson.textContent = formatBytes(totalBytes);
          if (elFsEst) elFsEst.textContent = formatBytes(est);
          if (elFsDocs) elFsDocs.textContent = String(totalDocs);
          if (elFsPct) elFsPct.textContent = `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
          if (elFsBar) elFsBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;

          if (noteFsClass) noteFsClass.textContent = 'Calcolo completato.';
        } catch (e) {
          if (noteFsClass) noteFsClass.textContent = '';
          App.ui.showToast('Errore calcolo utilizzo classe: ' + (e?.message || e), 'danger');
          // hint
          if (String(e?.message || e).includes('permission') || String(e?.code || '').includes('permission')) {
            App.ui.showToast('Nota: per calcolare il totale classe, il Supervisor deve poter leggere i dati degli altri utenti (/users/{uid}). Aggiorna le Firestore Rules.', 'warning');
          }
        }
      });


      // Firebase sync UI (opzionale)
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
      // Mostra UID Firebase (se presente)
      if (lblUid) {
        try {
          App.firebase.init().then(() => {
            const root = App.firebase.uid ? 'uid:' + App.firebase.uid : 'Auth non attivo';
            lblUid.textContent = root;
          });
        } catch {
          lblUid.textContent = '';
        }
      }
      btnSyncNow?.addEventListener('click', async () => {
        try {
          await App.db.syncNow();
          renderSync();
          App.ui.showToast('Sincronizzazione completata.', 'success');
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

      const ensureFirebaseBackupReady = async () => {
        await App.firebase.init();
        if (!App.firebase.uid) throw new Error('Firebase Auth non disponibile: effettua il login prima di usare backup/import/export.');
        return firestoreRepo(App.firebase.fs, App.firebase.getRootPath());
      };

      const loadFirebaseSnapshotForExport = async () => {
        App.ui.showToast("Sincronizzazione Firebase in corso prima dell'export…", "info");
        const repo = await ensureFirebaseBackupReady();
        return loadFirebaseSnapshotForBackup({
          syncNow: () => App.db.syncNow(),
          loadAll: () => repo.loadAll(),
          currentDb: () => App.db.ensure()
        });
      };

      btnSend?.addEventListener('click', async () => {
        try {
          const snapshot = await loadFirebaseSnapshotForExport();
          downloadJson(snapshot, `backup_firebase_revisione_${new Date().toISOString().slice(0,10)}.json`);
          const mailto = 'mailto:docente@example.com?subject=' + encodeURIComponent('Revisione dati gestionale') +
            '&body=' + encodeURIComponent('Ho scaricato il backup Firebase del gestionale e lo allego a questa email per la revisione.');
          window.location.href = mailto;
        } catch (e) {
          App.ui.showToast('Preparazione revisione fallita: ' + (e?.message || e), 'danger');
        }
      });

      // Backup export Firebase - forza la sync prima di scaricare
      btnExportCurrent?.addEventListener('click', async () => {
        try {
          const snapshot = await loadFirebaseSnapshotForExport();
          const filename = `backup_firebase_${new Date().toISOString().slice(0,10)}.json`;
          downloadJson(snapshot, filename);
          App.ui.showToast('Backup esportato da Firebase dopo sincronizzazione completata.', 'success');
        } catch (e) {
          App.ui.showToast('Export Firebase fallito: ' + (e?.message || e), 'danger');
        }
      });

      // === Test import backup (preview + import Firebase) ===
      const setPreview = (dbObj, label = '') => {
        if (!preBackup) return;
        preBackup.textContent = createBackupPreviewText(dbObj, label);
      };

      const enableBackupActions = (enabled) => {
        if (btnImportFirebase) btnImportFirebase.disabled = !enabled;
      };

      async function loadBackupFromText(text, label) {
        _loadedBackupDb = prepareBackupFromText(text);
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
      btnImportFirebase?.addEventListener('click', async () => {
        if (!_loadedBackupDb) return;

        if (!confirm('Importare questo backup su Firebase (Firestore) nel tuo spazio utente?\n\nDevi essere autenticato con un account Firebase e avere regole Firestore abilitate per il tuo utente.')) return;

        try {
          const repo = await ensureFirebaseBackupReady();
          const wipe = chkWipe ? chkWipe.checked : true;

          if (wipe) App.ui.showToast('Pulizia dati su Firebase…', 'info');
          App.ui.showToast('Upload backup su Firebase…', 'info');
          await importBackupToFirebase({
            repo,
            backupDb: _loadedBackupDb,
            wipe,
            reload: () => App.db.loadFromFirebase()
          });
          App.ui.showToast('Import su Firebase completato. Dati ricaricati da Firestore.', 'success');
          setPreview(null);
          enableBackupActions(false);
          if (inputBackup) inputBackup.value = '';
        } catch (e) {
          App.ui.showToast('Import Firebase fallito: ' + (e?.message || e), 'danger');
        }
      });

      // inizializza preview
      enableBackupActions(false);
      setPreview(null);


      const listClassUsersForReset = async () => {
        const users = await App.userDirectory.listAll();
        return (users || []).map(u => ({ ...u, uid: u.uid || u.id }));
      };

      btnWipeClassData?.addEventListener('click', async () => {
        if (!isClassAdmin) return App.ui.showToast('Azione riservata al supervisor autorizzato.', 'warning');
        try {
          const users = await listClassUsersForReset();
          const txt = prompt(
            'Operazione irreversibile: verranno cancellati i dati Firestore di tutti gli utenti della classe.\n\n' +
            'Prima di procedere esporta un backup se necessario.\n\n' +
            'Per confermare scrivi: SVUOTA CLASSE'
          );
          assertClassResetConfirmation(txt, 'SVUOTA CLASSE');
          App.ui.showToast('Pulizia dati classe in corso…', 'warning');
          await App.firebase.init();
          await wipeClassDatasets({
            users,
            createRepoForUid: (uid) => firestoreRepo(App.firebase.fs, `users/${uid}`),
            resetCurrentCache: () => App.db.resetCache()
          });
          App.ui.showToast(`Dati classe cancellati per ${users.length} utente/i. Ricarico…`, 'success');
          setTimeout(() => location.reload(), 900);
        } catch (e) {
          if (String(e?.message || e).includes('Conferma non valida')) return;
          App.ui.showToast('Pulizia dati classe fallita: ' + (e?.message || e), 'danger');
        }
      });

      btnRemoveClassUsers?.addEventListener('click', async () => {
        if (!isClassAdmin) return App.ui.showToast('Azione riservata al supervisor autorizzato.', 'warning');
        try {
          const users = await listClassUsersForReset();
          const txt = prompt(
            'Operazione irreversibile: verranno rimossi dalla directory applicativa tutti gli utenti classe tranne il supervisor autorizzato.\n\n' +
            'Gli account Firebase Authentication vanno poi eliminati manualmente dalla Firebase Console.\n\n' +
            'Per confermare scrivi: RIMUOVI UTENTI'
          );
          assertClassResetConfirmation(txt, 'RIMUOVI UTENTI');
          App.ui.showToast('Rimozione utenti classe in corso…', 'warning');
          const result = await removeClassUsersExceptSupervisors({
            users,
            supervisorEmails: App.config?.SUPERVISOR_EMAILS,
            deleteUsersByUid: (uids) => App.userDirectory.deleteMany(uids)
          });
          App.ui.showToast(`Utenti rimossi dalla directory applicativa: ${result.removed}. Supervisor mantenuti: ${result.kept}.`, 'success');
          if (classAdminNote) classAdminNote.textContent = 'Utenti applicativi rimossi. Ora elimina manualmente gli account da Firebase Authentication se necessario.';
          App.events.emit('db:changed', App.db.ensure());
        } catch (e) {
          if (String(e?.message || e).includes('Conferma non valida')) return;
          App.ui.showToast('Rimozione utenti classe fallita: ' + (e?.message || e), 'danger');
        }
      });

      // Cancella dati su Firebase (utente)
      btnDeleteFirebaseData?.addEventListener('click', async () => {
        const txt = prompt('Operazione irreversibile.\n\nScrivi CANCELLA per confermare la cancellazione dei dati su Firebase (utente).');
        if (txt !== 'CANCELLA') return;
        try {
          const repo = await ensureFirebaseBackupReady();
          App.ui.showToast('Cancellazione dati su Firebase…', 'warning');
          await wipeFirebaseDataset({ repo, resetCache: () => App.db.resetCache() });
          App.ui.showToast('Dati Firebase cancellati. Ricarico…', 'success');
          setTimeout(()=>location.reload(), 900);
        } catch (e) {
          App.ui.showToast('Cancellazione Firebase fallita: ' + (e?.message || e), 'danger');
        }
      });
}
