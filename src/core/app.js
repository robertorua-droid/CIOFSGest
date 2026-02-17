import { config } from './config.js';
import { createEventBus } from './events.js';
import { createDb } from './db.js';
import { utils } from './utils.js';
import { ui } from './ui.js';
import { createHome } from './home.js';
import { createStats } from './stats.js';
import { firebase } from './firebase.js';

const events = createEventBus();
const db = createDb(events);
const home = createHome({ db, ui, events });
const stats = createStats({ db, utils });

export const App = {
  config,
  events,
  db,
  firebase,
  utils,
  ui,
  home,
  stats,

  /**
   * Bootstrap asincrono (caricamento DB locale o Firestore, ecc.).
   * Da chiamare prima di inizializzare le feature.
   */
  async boot() {
    await db.init();
  }
};

// Expose for debugging / compatibility with legacy
window.App = App;
