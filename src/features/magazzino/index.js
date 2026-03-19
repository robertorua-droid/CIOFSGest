import { App } from '../../core/app.js';
import { adjustStock } from '../../domain/inventory.service.js';

export function initMagazzinoFeature() {
  const loadForm = document.getElementById('manual-load-form');
  const unloadForm = document.getElementById('manual-unload-form');
  const loadSel = document.getElementById('load-product-select');
  const unloadSel = document.getElementById('unload-product-select');
  const stockSel = document.getElementById('stock-query-product-select');
  const inventoryBody = document.getElementById('inventory-table-body');
  const inventoryPhysicalBody = document.getElementById('inventory-physical-body');

  const fillSelects = () => {
    const db = App.db.ensure();
    const opts = (db.products || []).map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`).join('');
    const prevLoad = loadSel?.value;
    const prevUnload = unloadSel?.value;
    const prevStock = stockSel?.value;

    if (loadSel) loadSel.innerHTML = `<option disabled selected value="">Seleziona...</option>` + opts;
    if (unloadSel) unloadSel.innerHTML = `<option disabled selected value="">Seleziona...</option>` + opts;
    if (stockSel) stockSel.innerHTML = `<option disabled selected value="">Seleziona un prodotto...</option>` + opts;

    if (prevLoad) loadSel.value = prevLoad;
    if (prevUnload) unloadSel.value = prevUnload;
    if (prevStock) stockSel.value = prevStock;
  };

  const renderElencoGiacenze = () => {
    const db = App.db.ensure();
    if (inventoryBody) {
      inventoryBody.innerHTML = (db.products || []).map(p => `
        <tr>
          <td>${p.code}</td>
          <td>${p.description}</td>
          <td>${[p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-')}</td>
          <td class="text-end">${p.stockQty || 0}</td>
        </tr>`).join('');
    }
  };

  const renderInventarioFisico = () => {
    const db = App.db.ensure();
    if (!inventoryPhysicalBody) return;

    const counts = (db.settings && db.settings.physicalCounts) ? db.settings.physicalCounts : {};
    inventoryPhysicalBody.innerHTML = (db.products || []).map(p => {
      const sysQty = Number(p.stockQty || 0);
      const physVal = (counts && counts[p.id] !== undefined) ? counts[p.id] : '';
      const physNum = (physVal === '' || physVal === null) ? null : Number(physVal);
      const diff = (physNum === null || Number.isNaN(physNum)) ? '' : (physNum - sysQty);
      const diffCls = diff === '' ? '' : (diff === 0 ? 'text-muted' : (diff > 0 ? 'text-success' : 'text-danger'));
      const diffTxt = diff === '' ? '' : (diff > 0 ? `+${diff}` : `${diff}`);

      return `
        <tr data-pid="${p.id}">
          <td>${p.code}</td>
          <td>${p.description}</td>
          <td>${[p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-')}</td>
          <td class="text-end">${sysQty}</td>
          <td class="text-end" style="max-width:180px">
            <input class="form-control form-control-sm text-end inv-phys-input" type="number" step="1" placeholder="—" value="${physVal}">
          </td>
          <td class="text-end ${diffCls} inv-diff-cell">${diffTxt}</td>
        </tr>`;
    }).join('');
  };

    fillSelects();
  renderElencoGiacenze();
  renderInventarioFisico();

loadForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = loadSel?.value;
    const qty = parseFloat(document.getElementById('load-product-qty').value || '0');
    if (!id || qty <= 0) return App.ui.showToast('Seleziona un prodotto e una quantità > 0', 'warning');

    try {
      adjustStock(id, qty, { reason: 'CARICO_MANUALE' });
      renderElencoGiacenze();
  renderInventarioFisico();
      App.ui.showToast('Carico registrato', 'success');
    } catch (err) {
      App.ui.showToast(err.message || 'Errore durante il carico', 'danger');
    }
  });

  unloadForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = unloadSel?.value;
    const qty = parseFloat(document.getElementById('unload-product-qty').value || '0');
    if (!id || qty <= 0) return App.ui.showToast('Seleziona un prodotto e una quantità > 0', 'warning');

    try {
      adjustStock(id, -qty, { reason: 'SCARICO_MANUALE' });
      renderElencoGiacenze();
  renderInventarioFisico();
      App.ui.showToast('Scarico registrato', 'success');
    } catch (err) {
      App.ui.showToast(err.message || 'Errore durante lo scarico', 'danger');
    }
  });

  stockSel?.addEventListener('change', () => {
    const id = stockSel.value;
    const db = App.db.ensure();
    const p = (db.products || []).find(x => x.id === id);
    if (!p) return;
    document.getElementById('stock-query-result')?.classList.remove('d-none');
    document.getElementById('stock-query-product-name').textContent = `${p.code} - ${p.description}`;
    document.getElementById('stock-query-qty').textContent = p.stockQty || 0;
    document.getElementById('stock-query-location').textContent = [p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-');
  });

  const refreshAll = () => { fillSelects(); renderElencoGiacenze();
  renderInventarioFisico(); };

  
  // Reset forms quando si entra nelle sezioni (evita che restino i dati precedenti)
  const resetSection = (sid) => {
    if (sid === 'carico-manuale') {
      loadForm?.reset();
      if (loadSel) loadSel.value = '';
    }
    if (sid === 'scarico-manuale') {
      unloadForm?.reset();
      if (unloadSel) unloadSel.value = '';
    }
    if (sid === 'consultazione-giacenze') {
      if (stockSel) stockSel.value = '';
      const q = document.getElementById('stock-query-qty');
      const loc = document.getElementById('stock-query-location');
      if (q) q.textContent = '-';
      if (loc) loc.textContent = '-';
    }
    if (sid === 'elenco-giacenze') {
      renderElencoGiacenze();
  renderInventarioFisico();
    }
  };
  App.events.on('section:changed', (sid) => { resetSection(sid); });


  App.events.on('logged-in', refreshAll);
  App.events.on('products:changed', refreshAll);
  App.events.on('db:changed', refreshAll);
}
