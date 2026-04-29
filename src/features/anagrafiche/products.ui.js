import { App } from '../../core/app.js';
import { masterdata } from '../../domain/masterdata.service.js';

export function initProductsUI() {
  const tbody = document.getElementById('products-table-body');
  const btnNew = document.getElementById('newProductBtn');
  const btnSave = document.getElementById('saveProductBtn');
  const search = document.getElementById('product-search-input');
  const modalEl = document.getElementById('productModal');
  const titleEl = document.getElementById('productModalTitle');
  if (!tbody) return;
  if (tbody.dataset.bound === '1') return;
  tbody.dataset.bound = '1';

  const fields = {
    id: document.getElementById('product-id'),
    description: document.getElementById('product-description'),
    code: document.getElementById('product-code'),
    purchasePrice: document.getElementById('product-purchase-price'),
    salePrice: document.getElementById('product-sale-price'),
    iva: document.getElementById('product-iva'),
    locCorsia: document.getElementById('product-loc-corsia'),
    locScaffale: document.getElementById('product-loc-scaffale'),
    locPiano: document.getElementById('product-loc-piano')
  };

  const resetForm = () => {
    if (fields.id) fields.id.value = '';
    if (fields.description) fields.description.value = '';
    if (fields.code) fields.code.value = '';
    if (fields.purchasePrice) fields.purchasePrice.value = '';
    if (fields.salePrice) fields.salePrice.value = '';
    if (fields.iva) fields.iva.value = '22';
    if (fields.locCorsia) fields.locCorsia.value = '';
    if (fields.locScaffale) fields.locScaffale.value = '';
    if (fields.locPiano) fields.locPiano.value = '';
    if (titleEl) titleEl.textContent = 'Nuovo Prodotto';
  };

  const openModal = () => {
    try { bootstrap.Modal.getOrCreateInstance(modalEl).show(); } catch {}
  };

  const closeModal = () => {
    try { bootstrap.Modal.getOrCreateInstance(modalEl).hide(); } catch {}
  };

  const h = value => App.utils.escapeHtml(value);

  const render = (filter = '') => {
    const db = App.db.ensure();
    const t = String(filter || '').toLowerCase();
    const items = (db.products || []).filter(p => {
      const s = `${p.code || ''} ${p.description || ''}`.toLowerCase();
      return s.includes(t);
    });
    tbody.innerHTML = items.map(p => `
      <tr>
        <td>${h(p.code || '')}</td>
        <td>${h(p.description || '')}</td>
        <td class="text-end">${App.utils.fmtMoney(p.purchasePrice || 0)}</td>
        <td class="text-end">${App.utils.fmtMoney(p.salePrice || 0)}</td>
        <td>${h([p.locCorsia,p.locScaffale,p.locPiano].filter(Boolean).join('-'))}</td>
        <td class="text-end">${p.stockQty || 0}</td>
        <td class="text-end">${p.quarantineQty || 0}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${h(p.id || '')}">Modifica</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="del" data-id="${h(p.id || '')}">Elimina</button>
        </td>
      </tr>`).join('');
  };

  if (btnNew && btnNew.dataset.bound !== '1') {
    btnNew.dataset.bound = '1';
    btnNew.addEventListener('click', () => resetForm());
  }

  if (btnSave && btnSave.dataset.bound !== '1') {
    btnSave.dataset.bound = '1';
    btnSave.addEventListener('click', () => {
      const id = fields.id?.value || App.utils.uuid();
      const description = fields.description?.value?.trim() || '';
      const code = fields.code?.value?.trim() || '';
      if (!description || !code) return App.ui.showToast('Descrizione e Codice sono obbligatori.', 'warning');

      masterdata.upsertProduct({
        id,
        description,
        code,
        purchasePrice: parseFloat(fields.purchasePrice?.value || '0'),
        salePrice: parseFloat(fields.salePrice?.value || '0'),
        iva: parseInt(fields.iva?.value || '22', 10),
        locCorsia: fields.locCorsia?.value?.trim() || '',
        locScaffale: fields.locScaffale?.value?.trim() || '',
        locPiano: fields.locPiano?.value?.trim() || ''
      });

      render(search?.value || '');
      App.ui.showToast('Prodotto salvato', 'success');
      closeModal();
      resetForm();
    });
  }

  tbody.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (!b || !tbody.contains(b)) return;
    const id = String(b.getAttribute('data-id') || '');
    const act = b.getAttribute('data-action');
    const db = App.db.ensure();
    const p = (db.products || []).find(x => String(x.id) === id);

    if (act === 'edit' && p) {
      if (fields.id) fields.id.value = p.id || '';
      if (fields.description) fields.description.value = p.description || '';
      if (fields.code) fields.code.value = p.code || '';
      if (fields.purchasePrice) fields.purchasePrice.value = p.purchasePrice ?? '';
      if (fields.salePrice) fields.salePrice.value = p.salePrice ?? '';
      if (fields.iva) fields.iva.value = String(p.iva || 22);
      if (fields.locCorsia) fields.locCorsia.value = p.locCorsia || '';
      if (fields.locScaffale) fields.locScaffale.value = p.locScaffale || '';
      if (fields.locPiano) fields.locPiano.value = p.locPiano || '';
      if (titleEl) titleEl.textContent = 'Modifica Prodotto';
      openModal();
      return;
    }

    if (act === 'del' && confirm('Eliminare il prodotto?')) {
      masterdata.deleteProduct(id);
      render(search?.value || '');
    }
  });

  if (search && search.dataset.bound !== '1') {
    search.dataset.bound = '1';
    search.addEventListener('input', () => render(search.value));
  }

  modalEl?.addEventListener('hidden.bs.modal', resetForm);

  App.events.on('db:changed', () => render(search?.value || ''));
  App.events.on('products:changed', () => render(search?.value || ''));
  App.events.on('section:changed', (sid) => {
    if (sid === 'anagrafica-prodotti') render(search?.value || '');
  });

  resetForm();
  render();
}
