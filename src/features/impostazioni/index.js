/* impostazioni/index.js - entrypoint impostazioni */
import { App } from '../../core/app.js';
import { initCompanySettings } from './company.ui.js';
import { initUsersSettings } from './users.ui.js';
import { initAdvancedSettings } from './advanced.ui.js';
import { initReleaseChangelogSettings } from './release.ui.js';

const Impostazioni = {
  initCompany: initCompanySettings,
  initUsers: initUsersSettings,
  initAdvanced: initAdvancedSettings,
  initReleaseChangelog: initReleaseChangelogSettings,

    init() {
      if (this._initDone) return;
      this._initDone = true;

      const refreshSection = (sid) => {
        if (!sid) return;
        if (sid === 'anagrafica-azienda') this.initCompany();
        if (sid === 'anagrafica-utenti') this.initUsers();
        if (sid === 'avanzate') this.initAdvanced();
        if (sid === 'release-changelog') this.initReleaseChangelog();
      };

      App.events.on('logged-in', () => {
        this.initCompany();
        this.initUsers();
        this.initAdvanced();
        this.initReleaseChangelog();
      });

      App.events.on('db:changed', () => {
        const current = document.querySelector('.content-section:not(.d-none)')?.id;
        refreshSection(current);
      });
      App.events.on('section:changed', refreshSection);
    }
  };


export function initImpostazioniFeature() {
  Impostazioni.init();
  App.Impostazioni = Impostazioni;
}
