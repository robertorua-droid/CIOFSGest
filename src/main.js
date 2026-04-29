import { App } from './core/app.js';
import { initThemeToggle } from './core/theme.js';
import { initDataSourceBadge } from './core/dataSourceBadge.js';
import { initSidebar } from './core/sidebar.js';
import { initLogin } from './features/login/index.js';
import { initAnagraficheFeature } from './features/anagrafiche/index.js';
import { initMagazzinoFeature } from './features/magazzino/index.js';
import { initVenditeFeature } from './features/vendite/index.js';
import { initAcquistiFeature } from './features/acquisti/index.js';
import { initImpostazioniFeature } from './features/impostazioni/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Theme toggle (works even before login UI is shown)
  try { initThemeToggle(); } catch {}

  // bootstrap Firebase-only: inizializza Firebase e carica Firestore solo se esiste già una sessione
  try {
    await App.boot();
  } catch (e) {
    console.error(e);
    const box = document.getElementById('error-message');
    if (box) {
      box.textContent = 'Errore caricamento Firebase: ' + String(e?.message || e);
      box.classList.remove('d-none');
    }
  }

  // Badge sorgente dati Firebase
  try { initDataSourceBadge(App); } catch {}

  // Sidebar mobile/collassabile
  try { App.sidebar = initSidebar(); } catch {}

  // inizializzazioni
  initLogin();
  initAnagraficheFeature();
  initMagazzinoFeature();
  initVenditeFeature();
  initAcquistiFeature();
  initImpostazioniFeature();

  // compat: mostra nome azienda anche prima del login se presente
  try { App.ui.setCompanySidebarName(App.db.ensure()); } catch {}
});
