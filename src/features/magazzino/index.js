import { App } from '../../core/app.js';
import { adjustStock } from '../../domain/inventory.service.js';
import { renderMaceratedProductsTable } from './macerated.ui.js';

export function initMagazzinoFeature() {
  const loadForm = document.getElementById('manual-load-form');
  const unloadForm = document.getElementById('manual-unload-form');
  const loadSel = document.getElementById('load-product-select');
  const unloadSel = document.getElementById('unload-product-select');
  const stockSel = document.getElementById('stock-query-product-select');
  const inventoryBody = document.getElementById('inventory-table-body');
  const inventoryPhysicalBody = document.getElementById('inventory-physical-body');
  const maceratedProductsBody = document.getElementById('macerated-products-table-body');
  const btnResetPhysical = document.getElementById('reset-physical-counts-btn');
  const btnApplyPhysical = document.getElementById('apply-physical-counts-btn');

  const h = value => App.utils.escapeHtml(value);

  const fillSelects = () => {
    const db = App.db.ensure();
    const opts = (db.products || []).map(p => `<option value="${h(p.id)}">${h(p.code)} - ${h(p.description)}</option>`).join('');
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
          <td>${h(p.code)}</td>
          <td>${h(p.description)}</td>
          <td>${h([p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-'))}</td>
          <td class="text-end">${p.stockQty || 0}</td>
          <td class="text-end">${p.quarantineQty || 0}</td>
        </tr>`).join('');
    }
  };

  const renderProdottiMacerati = () => {
    const db = App.db.ensure();
    renderMaceratedProductsTable({ db, tbody: maceratedProductsBody, h });
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
        <tr data-pid="${h(p.id)}">
          <td>${h(p.code)}</td>
          <td>${h(p.description)}</td>
          <td>${h([p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-'))}</td>
          <td class="text-end">${sysQty}</td>
          <td class="text-end" style="max-width:180px">
            <input class="form-control form-control-sm text-end inv-phys-input" type="number" step="1" placeholder="—" value="${h(physVal)}">
          </td>
          <td class="text-end ${diffCls} inv-diff-cell">${diffTxt}</td>
        </tr>`;
    }).join('');
  };

    

  // Inventario fisico: salva conteggi e aggiorna differenza live
  const updateRowDiff = (tr, physStr) => {
    const dbx = App.db.ensure();
    const pid = tr.getAttribute('data-pid');
    const p = (dbx.products || []).find(x => String(x.id) === String(pid));
    const sysQty = Number(p?.stockQty || 0);
    const phys = (physStr === '' || physStr === null) ? null : Number(physStr);
    const cell = tr.querySelector('.inv-diff-cell');
    if (!cell) return;
    if (phys === null || Number.isNaN(phys)) {
      cell.textContent = '';
      cell.classList.remove('text-success','text-danger','text-muted');
      return;
    }
    const diff = phys - sysQty;
    cell.textContent = diff > 0 ? `+${diff}` : String(diff);
    cell.classList.remove('text-success','text-danger','text-muted');
    cell.classList.add(diff === 0 ? 'text-muted' : (diff > 0 ? 'text-success' : 'text-danger'));
  };

  if (inventoryPhysicalBody && inventoryPhysicalBody.dataset.bound !== '1') {
    inventoryPhysicalBody.dataset.bound = '1';

    inventoryPhysicalBody.addEventListener('input', (e) => {
      const inp = e.target.closest('.inv-phys-input');
      if (!inp) return;
      const tr = inp.closest('tr');
      if (!tr) return;
      updateRowDiff(tr, inp.value);
    });

    inventoryPhysicalBody.addEventListener('change', (e) => {
      const inp = e.target.closest('.inv-phys-input');
      if (!inp) return;
      const tr = inp.closest('tr');
      if (!tr) return;
      const pid = tr.getAttribute('data-pid');
      App.db.mutate('inventory:set-physical-count', currentDb => {
        currentDb.settings = currentDb.settings || {};
        currentDb.settings.physicalCounts = currentDb.settings.physicalCounts || {};
        const v = String(inp.value || '').trim();
        if (v === '') delete currentDb.settings.physicalCounts[pid];
        else currentDb.settings.physicalCounts[pid] = Number(v);
        return { productId: pid };
      });
    });
  }

  // Applica riallineamento giacenze dai conteggi fisici
  if (btnApplyPhysical && btnApplyPhysical.dataset.bound !== '1') {
    btnApplyPhysical.dataset.bound = '1';
    btnApplyPhysical.addEventListener('click', () => {
      const dbx = App.db.ensure();
      const counts = (dbx.settings && dbx.settings.physicalCounts) ? dbx.settings.physicalCounts : {};
      const entries = Object.entries(counts || {}).filter(([pid, val]) => {
        const p = (dbx.products || []).find(x => String(x.id) === String(pid));
        if (!p) return false;
        const phys = Number(val);
        return Number.isFinite(phys) && phys !== Number(p.stockQty || 0);
      });

      if (!entries.length) {
        App.ui.showToast('Nessuna differenza inventariale da allineare.', 'info');
        return;
      }

      const preview = entries.slice(0, 8).map(([pid, val]) => {
        const p = (dbx.products || []).find(x => String(x.id) === String(pid));
        return `- ${p?.code || pid}: ${Number(p?.stockQty || 0)} → ${Number(val)}`;
      }).join('\n');
      const more = entries.length > 8 ? `\n... e altri ${entries.length - 8} prodotti` : '';

      const ok = window.confirm(
        `Stai per riallineare le giacenze disponibili in base ai conteggi fisici inseriti.\n\n` +
        `Prodotti interessati: ${entries.length}\n\n${preview}${more}\n\n` +
        `L'operazione aggiorna direttamente le giacenze disponibili senza usare movimenti manuali. Continuare?`
      );
      if (!ok) return;

      const phrase = window.prompt('Per confermare digita ALLINEA INVENTARIO');
      if (phrase !== 'ALLINEA INVENTARIO') {
        App.ui.showToast('Allineamento inventario annullato.', 'warning');
        return;
      }

      App.db.mutate('inventory:apply-physical-alignment', currentDb => {
        for (const [pid, val] of entries) {
          const p = (currentDb.products || []).find(x => String(x.id) === String(pid));
          if (!p) continue;
          p.stockQty = Number(val);
        }
        currentDb.settings = currentDb.settings || {};
        currentDb.settings.lastInventoryAlignment = {
          at: Date.now(),
          count: entries.length
        };
        return { count: entries.length };
      });
      App.events.emit('inventory:changed', { reason: 'ALLINEAMENTO_INVENTARIO', count: entries.length });
      renderElencoGiacenze();
      renderInventarioFisico();
      App.ui.showToast(`Giacenze allineate per ${entries.length} prodotto/i.`, 'success');
    });
  }

  // Azzera conteggi fisici
  if (btnResetPhysical && btnResetPhysical.dataset.bound !== '1') {
    btnResetPhysical.dataset.bound = '1';
    btnResetPhysical.addEventListener('click', () => {
      if (!confirm('Azzera tutti i conteggi fisici inseriti?')) return;
      App.db.mutate('inventory:reset-physical-counts', currentDb => {
        currentDb.settings = currentDb.settings || {};
        currentDb.settings.physicalCounts = {};
        return { reset: true };
      });
      renderInventarioFisico();
      App.ui.showToast('Conteggi fisici azzerati.', 'success');
    });
  }

fillSelects();
  renderElencoGiacenze();
  renderInventarioFisico();
  renderProdottiMacerati();

  if (loadForm && loadForm.dataset.bound !== '1') {
    loadForm.dataset.bound = '1';
    loadForm.addEventListener('submit', (e) => {
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
      const qtyInput = document.getElementById('load-product-qty');
      if (qtyInput) qtyInput.value = '1';
      if (loadSel) loadSel.value = '';
    });
  }

  if (unloadForm && unloadForm.dataset.bound !== '1') {
    unloadForm.dataset.bound = '1';
    unloadForm.addEventListener('submit', (e) => {
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
      const qtyInput = document.getElementById('unload-product-qty');
      if (qtyInput) qtyInput.value = '1';
      if (unloadSel) unloadSel.value = '';
    });
  }

  if (stockSel && stockSel.dataset.bound !== '1') {
    stockSel.dataset.bound = '1';
    stockSel.addEventListener('change', () => {
    const id = stockSel.value;
    const db = App.db.ensure();
    const p = (db.products || []).find(x => x.id === id);
    if (!p) return;
    document.getElementById('stock-query-result')?.classList.remove('d-none');
    document.getElementById('stock-query-product-name').textContent = `${p.code} - ${p.description}`;
    document.getElementById('stock-query-qty').textContent = p.stockQty || 0;
    document.getElementById('stock-query-location').textContent = [p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-');
    });
  }

  const refreshAll = () => { fillSelects(); renderElencoGiacenze();
  renderInventarioFisico();
  renderProdottiMacerati(); };

  
  // Reset forms quando si entra nelle sezioni (evita che restino i dati precedenti)
  const resetSection = (sid) => {
    if (sid === 'carico-manuale') {
      loadForm?.reset();
      if (loadSel) loadSel.value = '';
      const qtyInput = document.getElementById('load-product-qty');
      if (qtyInput) qtyInput.value = '1';
    }
    if (sid === 'scarico-manuale') {
      unloadForm?.reset();
      if (unloadSel) unloadSel.value = '';
      const qtyInput = document.getElementById('unload-product-qty');
      if (qtyInput) qtyInput.value = '1';
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
    }
    if (sid === 'inventario-fisico') {
      renderInventarioFisico();
    }
    if (sid === 'prodotti-macerati') {
      renderProdottiMacerati();
    }
  };
  App.events.on('section:changed', (sid) => { resetSection(sid); });

  // default più sicuro per gli input quantità
  const loadQtyInput = document.getElementById('load-product-qty');
  const unloadQtyInput = document.getElementById('unload-product-qty');
  if (loadQtyInput && !loadQtyInput.value) loadQtyInput.value = '1';
  if (unloadQtyInput && !unloadQtyInput.value) unloadQtyInput.value = '1';


  App.events.on('logged-in', refreshAll);
  App.events.on('products:changed', refreshAll);
  App.events.on('db:changed', refreshAll);
}
