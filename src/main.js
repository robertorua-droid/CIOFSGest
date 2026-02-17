import { App } from './core/app.js';
import { initLogin } from './features/login/index.js';
import { initAnagraficheFeature } from './features/anagrafiche/index.js';
import { initMagazzinoFeature } from './features/magazzino/index.js';
import { initVenditeFeature } from './features/vendite/index.js';
import { initAcquistiFeature } from './features/acquisti/index.js';
import { initImpostazioniFeature } from './features/impostazioni/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  // bootstrap (DB locale o Firestore)
  await App.boot();

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
