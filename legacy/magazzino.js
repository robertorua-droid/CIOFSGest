/* magazzino.js - manual load/unload, stock query, inventory */
(function (global) {
  'use strict';
  const { App } = global;

  const Magazzino = {
    init() {
      const db = App.db.ensure();

      const loadForm = document.getElementById('manual-load-form');
      const unloadForm = document.getElementById('manual-unload-form');
      const loadSel = document.getElementById('load-product-select');
      const unloadSel = document.getElementById('unload-product-select');
      const stockSel = document.getElementById('stock-query-product-select');
      const inventoryBody = document.getElementById('inventory-table-body');

      const fillSelects = () => {
        const opts = (db.products || []).map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`).join('');
        if (loadSel) loadSel.innerHTML = `<option disabled selected value="">Seleziona...</option>` + opts;
        if (unloadSel) unloadSel.innerHTML = `<option disabled selected value="">Seleziona...</option>` + opts;
        if (stockSel) stockSel.innerHTML = `<option disabled selected value="">Seleziona un prodotto...</option>` + opts;
      };

      const renderInventory = () => {
        if (!inventoryBody) return;
        inventoryBody.innerHTML = (db.products || []).map(p => `
          <tr>
            <td>${p.code}</td>
            <td>${p.description}</td>
            <td>${[p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-')}</td>
            <td class="text-end">${p.stockQty || 0}</td>
          </tr>`).join('');
      };

      loadForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = loadSel.value;
        const qty = parseFloat(document.getElementById('load-product-qty').value || '0');
        if (!id || qty <= 0) return App.ui.showToast('Seleziona un prodotto e una quantità > 0', 'warning');
        const p = db.products.find(x => x.id === id); if (!p) return;
        p.stockQty = (p.stockQty || 0) + qty;
        App.db.save(db); renderInventory(); App.ui.showToast('Carico registrato', 'success');
      });

      unloadForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = unloadSel.value;
        const qty = parseFloat(document.getElementById('unload-product-qty').value || '0');
        if (!id || qty <= 0) return App.ui.showToast('Seleziona un prodotto e una quantità > 0', 'warning');
        const p = db.products.find(x => x.id === id); if (!p) return;
        const newQty = (p.stockQty || 0) - qty;
        if (newQty < 0) return App.ui.showToast('Giacenza insufficiente', 'danger');
        p.stockQty = newQty;
        App.db.save(db); renderInventory(); App.ui.showToast('Scarico registrato', 'success');
      });

      stockSel?.addEventListener('change', () => {
        const id = stockSel.value;
        const p = db.products.find(x => x.id === id);
        if (!p) return;
        document.getElementById('stock-query-result')?.classList.remove('d-none');
        document.getElementById('stock-query-product-name').textContent = `${p.code} - ${p.description}`;
        document.getElementById('stock-query-qty').textContent = p.stockQty || 0;
        document.getElementById('stock-query-location').textContent = [p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-');
      });

      App.events.on('logged-in', () => {
        fillSelects();
        renderInventory();
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => Magazzino.init());
  App.Magazzino = Magazzino;

})(window);
