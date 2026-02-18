import { App } from './core/app.js';
import { initThemeToggle } from './core/theme.js';
import { initDataSourceBadge } from './core/dataSourceBadge.js';
import { initLogin } from './features/login/index.js';
import { initAnagraficheFeature } from './features/anagrafiche/index.js';
import { initMagazzinoFeature } from './features/magazzino/index.js';
import { initVenditeFeature } from './features/vendite/index.js';
import { initAcquistiFeature } from './features/acquisti/index.js';
import { initImpostazioniFeature } from './features/impostazioni/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Theme toggle (works even before login UI is shown)
  try { initThemeToggle(); } catch {}

  // bootstrap (DB locale o Firestore)
  await App.boot();

  // Badge sorgente dati (Firebase/Local)
  try { initDataSourceBadge(App); } catch {}

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
