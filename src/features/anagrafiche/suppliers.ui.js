import { App } from '../../core/app.js';
import { masterdata } from '../../domain/masterdata.service.js';

export function initSuppliersUI() {
  const tbody = document.getElementById('suppliers-table-body');
  const btnNew = document.getElementById('newSupplierBtn');
  const btnSave = document.getElementById('saveSupplierBtn');
  const search = document.getElementById('supplier-search-input');
  const modalEl = document.getElementById('supplierModal');
  const titleEl = document.getElementById('supplierModalTitle');
  if (!tbody) return;
  if (tbody.dataset.bound === '1') return;
  tbody.dataset.bound = '1';

  const fields = {
    id: document.getElementById('supplier-id'),
    name: document.getElementById('supplier-name'),
    piva: document.getElementById('supplier-piva'),
    address: document.getElementById('supplier-address')
  };

  const resetForm = () => {
    if (fields.id) fields.id.value = '';
    if (fields.name) fields.name.value = '';
    if (fields.piva) fields.piva.value = '';
    if (fields.address) fields.address.value = '';
    if (titleEl) titleEl.textContent = 'Nuovo Fornitore';
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
    const term = String(filter || '').toLowerCase();
    const items = (db.suppliers || []).filter(s => {
      const s1 = `${s.id || ''} ${s.name || ''} ${s.piva || ''} ${s.address || ''}`.toLowerCase();
      return s1.includes(term);
    });
    tbody.innerHTML = items.map(s => `
      <tr>
        <td>${h(s.id || '')}</td>
        <td>${h(s.name || '')}</td>
        <td>${h(s.piva || '')}</td>
        <td>${h(s.address || '')}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${h(s.id || '')}">Modifica</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="del" data-id="${h(s.id || '')}">Elimina</button>
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
      const name = fields.name?.value?.trim() || '';
      const piva = fields.piva?.value?.trim() || '';
      const address = fields.address?.value?.trim() || '';
      if (!name) return App.ui.showToast('La ragione sociale è obbligatoria.', 'warning');

      masterdata.upsertSupplier({ id, name, piva, address });
      render(search?.value || '');
      App.ui.showToast('Fornitore salvato', 'success');
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

    if (act === 'edit') {
      const s = (db.suppliers || []).find(x => String(x.id) === id);
      if (!s) return;
      if (fields.id) fields.id.value = s.id || '';
      if (fields.name) fields.name.value = s.name || '';
      if (fields.piva) fields.piva.value = s.piva || '';
      if (fields.address) fields.address.value = s.address || '';
      if (titleEl) titleEl.textContent = 'Modifica Fornitore';
      openModal();
      return;
    }

    if (act === 'del' && confirm('Eliminare il fornitore?')) {
      masterdata.deleteSupplier(id);
      render(search?.value || '');
    }
  });

  if (search && search.dataset.bound !== '1') {
    search.dataset.bound = '1';
    search.addEventListener('input', () => render(search.value));
  }

  modalEl?.addEventListener('hidden.bs.modal', resetForm);

  App.events.on('db:changed', () => render(search?.value || ''));
  App.events.on('suppliers:changed', () => render(search?.value || ''));
  App.events.on('section:changed', (sid) => {
    if (sid === 'anagrafica-fornitori') render(search?.value || '');
  });

  resetForm();
  render();
}
