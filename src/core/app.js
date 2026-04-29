import { config } from './config.js';
import { createEventBus } from './events.js';
import { createDb } from './db.js';
import { utils } from './utils.js';
import { ui } from './ui.js';
import { createHome } from './home.js';
import { createStats } from './stats.js';
import { firebase } from './firebase.js';
import { userDirectory } from './userDirectory.js';

const events = createEventBus();
const db = createDb(events);
const home = createHome({ db, ui, events });
const stats = createStats({ db, utils });

export const App = {
  config,
  events,
  db,
  firebase,
  userDirectory,
  currentUser: null,
  utils,
  ui,
  home,
  stats,
  sidebar: null,

  /**
   * Bootstrap asincrono Firebase-only.
   * Inizializza Firebase; se esiste già una sessione autenticata carica Firestore,
   * altrimenti il caricamento dati avviene dopo il login.
   */
  async boot() {
    await db.init();
  }
};

// Espone App per debug da console browser
window.App = App;
