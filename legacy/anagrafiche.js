/* anagrafiche.js - customers, suppliers, products CRUD */
(function (global) {
  'use strict';
  const { App } = global;

  const Anagrafiche = {
    initCustomers() {
      const db = App.db.ensure();
      const tbody = document.getElementById('customers-table-body');
      const btnNew = document.getElementById('newCustomerBtn');
      const btnSave = document.getElementById('saveCustomerBtn');
      const search = document.getElementById('customer-search-input');

      const render = (filter='') => {
        const term = (filter||'').toLowerCase();
        const items = (db.customers || []).filter(c => {
          const s = `${c.id||''} ${c.name||''} ${c.piva||''} ${c.address||''}`.toLowerCase();
          return s.includes(term);
        });
        tbody.innerHTML = items.map(c => `
          <tr>
            <td>${c.id || ''}</td>
            <td>${c.name || ''}</td>
            <td>${c.piva || ''}</td>
            <td>${c.address || ''}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${c.id}">Modifica</button>
              <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${c.id}">Elimina</button>
            </td>
          </tr>`).join('');
      };

      btnNew?.addEventListener('click', () => {
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-piva').value = '';
        document.getElementById('customer-address').value = '';
      });
      btnSave?.addEventListener('click', () => {
        const id = document.getElementById('customer-id').value || App.utils.uuid();
        const name = document.getElementById('customer-name').value.trim();
        const piva = document.getElementById('customer-piva').value.trim();
        const address = document.getElementById('customer-address').value.trim();
        if (!name) return App.ui.showToast('La ragione sociale è obbligatoria.', 'warning');
        const idx = (db.customers || []).findIndex(c => c.id === id);
        const payload = { id, name, piva, address };
        if (idx >= 0) db.customers[idx] = payload; else db.customers.push(payload);
        App.db.save(db); render(search?.value||''); App.ui.showToast('Cliente salvato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).hide(); } catch {}
      });
      tbody?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-action]'); if (!b) return;
        const id = b.getAttribute('data-id'); const act = b.getAttribute('data-action');
        if (act === 'edit') {
          const c = db.customers.find(x => x.id === id); if (!c) return;
          document.getElementById('customer-id').value = c.id;
          document.getElementById('customer-name').value = c.name || '';
          document.getElementById('customer-piva').value = c.piva || '';
          document.getElementById('customer-address').value = c.address || '';
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).show(); } catch {}
        } else if (act === 'del') {
          const i = db.customers.findIndex(x => x.id === id);
          if (i >= 0 && confirm('Eliminare il cliente?')) { db.customers.splice(i,1); App.db.save(db); render(search?.value||''); }
        }
      });
      search?.addEventListener('input', () => render(search.value));
      render();
    },

    initSuppliers() {
      const db = App.db.ensure();
      const tbody = document.getElementById('suppliers-table-body');
      const btnNew = document.getElementById('newSupplierBtn');
      const btnSave = document.getElementById('saveSupplierBtn');
      const search = document.getElementById('supplier-search-input');

      const render = (filter='') => {
        const term = (filter||'').toLowerCase();
        const items = (db.suppliers || []).filter(s => {
          const s1 = `${s.id||''} ${s.name||''} ${s.piva||''} ${s.address||''}`.toLowerCase();
          return s1.includes(term);
        });
        tbody.innerHTML = items.map(s => `
          <tr>
            <td>${s.id || ''}</td>
            <td>${s.name || ''}</td>
            <td>${s.piva || ''}</td>
            <td>${s.address || ''}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${s.id}">Modifica</button>
              <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${s.id}">Elimina</button>
            </td>
          </tr>`).join('');
      };

      btnNew?.addEventListener('click', () => {
        document.getElementById('supplier-id').value = '';
        document.getElementById('supplier-name').value = '';
        document.getElementById('supplier-piva').value = '';
        document.getElementById('supplier-address').value = '';
      });
      btnSave?.addEventListener('click', () => {
        const id = document.getElementById('supplier-id').value || App.utils.uuid();
        const name = document.getElementById('supplier-name').value.trim();
        const piva = document.getElementById('supplier-piva').value.trim();
        const address = document.getElementById('supplier-address').value.trim();
        if (!name) return App.ui.showToast('La ragione sociale è obbligatoria.', 'warning');
        const idx = (db.suppliers || []).findIndex(s => s.id === id);
        const payload = { id, name, piva, address };
        if (idx >= 0) db.suppliers[idx] = payload; else db.suppliers.push(payload);
        App.db.save(db); render(search?.value||''); App.ui.showToast('Fornitore salvato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierModal')).hide(); } catch {}
      });
      tbody?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-action]'); if (!b) return;
        const id = b.getAttribute('data-id'); const act = b.getAttribute('data-action');
        if (act === 'edit') {
          const s = db.suppliers.find(x => x.id === id); if (!s) return;
          document.getElementById('supplier-id').value = s.id;
          document.getElementById('supplier-name').value = s.name || '';
          document.getElementById('supplier-piva').value = s.piva || '';
          document.getElementById('supplier-address').value = s.address || '';
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierModal')).show(); } catch {}
        } else if (act === 'del') {
          const i = db.suppliers.findIndex(x => x.id === id);
          if (i >= 0 && confirm('Eliminare il fornitore?')) { db.suppliers.splice(i,1); App.db.save(db); render(search?.value||''); }
        }
      });
      search?.addEventListener('input', () => render(search.value));
      render();
    },

    initProducts() {
      const db = App.db.ensure();
      const tbody = document.getElementById('products-table-body');
      const btnNew = document.getElementById('newProductBtn');
      const btnSave = document.getElementById('saveProductBtn');
      const search = document.getElementById('product-search-input');

      const render = (filter='') => {
        const t = (filter||'').toLowerCase();
        const items = (db.products || []).filter(p => {
          const s = `${p.code||''} ${p.description||''}`.toLowerCase();
          return s.includes(t);
        });
        tbody.innerHTML = items.map(p => `
          <tr>
            <td>${p.code || ''}</td>
            <td>${p.description || ''}</td>
            <td class="text-end">${App.utils.fmtMoney(p.purchasePrice || 0)}</td>
            <td class="text-end">${App.utils.fmtMoney(p.salePrice || 0)}</td>
            <td>${[p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-')}</td>
            <td class="text-end">${p.stockQty || 0}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${p.id}">Modifica</button>
              <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${p.id}">Elimina</button>
            </td>
          </tr>`).join('');
      };

      btnNew?.addEventListener('click', () => {
        document.getElementById('product-id').value = '';
        document.getElementById('product-description').value = '';
        document.getElementById('product-code').value = '';
        document.getElementById('product-purchase-price').value = '';
        document.getElementById('product-sale-price').value = '';
        document.getElementById('product-iva').value = '22';
        document.getElementById('product-loc-corsia').value = '';
        document.getElementById('product-loc-scaffale').value = '';
        document.getElementById('product-loc-piano').value = '';
      });
      btnSave?.addEventListener('click', () => {
        const id = document.getElementById('product-id').value || App.utils.uuid();
        const description = document.getElementById('product-description').value.trim();
        const code = document.getElementById('product-code').value.trim();
        if (!description || !code) return App.ui.showToast('Descrizione e Codice sono obbligatori.', 'warning');
        const payload = {
          id, description, code,
          purchasePrice: parseFloat(document.getElementById('product-purchase-price').value || '0'),
          salePrice: parseFloat(document.getElementById('product-sale-price').value || '0'),
          iva: parseInt(document.getElementById('product-iva').value || '22', 10),
          locCorsia: document.getElementById('product-loc-corsia').value.trim(),
          locScaffale: document.getElementById('product-loc-scaffale').value.trim(),
          locPiano: document.getElementById('product-loc-piano').value.trim(),
          stockQty: (db.products.find(p => p.id === id)?.stockQty) || 0
        };
        const idx = (db.products || []).findIndex(p => p.id === id);
        if (idx >= 0) db.products[idx] = payload; else db.products.push(payload);
        App.db.save(db); render(search?.value||''); App.ui.showToast('Prodotto salvato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide(); } catch {}
      });
      tbody?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-action]'); if (!b) return;
        const id = b.getAttribute('data-id'); const act = b.getAttribute('data-action');
        const p = db.products.find(x => x.id === id);
        if (act === 'edit' && p) {
          document.getElementById('product-id').value = p.id || '';
          document.getElementById('product-description').value = p.description || '';
          document.getElementById('product-code').value = p.code || '';
          document.getElementById('product-purchase-price').value = p.purchasePrice || '';
          document.getElementById('product-sale-price').value = p.salePrice || '';
          document.getElementById('product-iva').value = String(p.iva || 22);
          document.getElementById('product-loc-corsia').value = p.locCorsia || '';
          document.getElementById('product-loc-scaffale').value = p.locScaffale || '';
          document.getElementById('product-loc-piano').value = p.locPiano || '';
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).show(); } catch {}
        } else if (act === 'del') {
          const i = db.products.findIndex(x => x.id === id);
          if (i >= 0 && confirm('Eliminare il prodotto?')) {
            db.products.splice(i,1); App.db.save(db); render(search?.value||'');
          }
        }
      });
      search?.addEventListener('input', () => render(search.value));
      render();
    },

    init() {
      App.events.on('logged-in', () => {
        this.initCustomers();
        this.initSuppliers();
        this.initProducts();
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => Anagrafiche.init());
  App.Anagrafiche = Anagrafiche;

})(window);
