import { App } from '../../core/app.js';
export function initCompanySettings() {
      const form = document.getElementById('company-info-form');
      if (!form) return;
      const syncCompanyForm = () => {
        const curDb = App.db.ensure();
        document.getElementById('company-name').value = curDb.company?.name || '';
        document.getElementById('company-address').value = curDb.company?.address || '';
        document.getElementById('company-city').value = curDb.company?.city || '';
        document.getElementById('company-zip').value = curDb.company?.zip || '';
        document.getElementById('company-province').value = curDb.company?.province || '';
      };
      if (form.dataset.bound === '1') {
        syncCompanyForm();
        return;
      }
      form.dataset.bound = '1';
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      syncCompanyForm();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        App.db.mutate('settings:update-company', currentDb => {
          const c = currentDb.company || (currentDb.company = {});
          c.name = document.getElementById('company-name').value.trim();
          c.address = document.getElementById('company-address').value.trim();
          c.city = document.getElementById('company-city').value.trim();
          c.zip = document.getElementById('company-zip').value.trim();
          c.province = document.getElementById('company-province').value.trim();
          return { companyName: c.name };
        });
        db = App.db.ensure();
        App.ui.setCompanySidebarName(db);
        App.ui.showToast('Dati azienda salvati', 'success');
      });
}

    
