import { App } from '../../core/app.js';
import { masterdata } from '../../domain/masterdata.service.js';

export function initCustomersUI() {
  const tbody = document.getElementById('customers-table-body');
  const btnNew = document.getElementById('newCustomerBtn');
  const btnSave = document.getElementById('saveCustomerBtn');
  const search = document.getElementById('customer-search-input');
  const modalEl = document.getElementById('customerModal');
  const titleEl = document.getElementById('customerModalTitle');
  if (!tbody) return;
  if (tbody.dataset.bound === '1') return;
  tbody.dataset.bound = '1';

  const fields = {
    id: document.getElementById('customer-id'),
    name: document.getElementById('customer-name'),
    piva: document.getElementById('customer-piva'),
    address: document.getElementById('customer-address')
  };

  const resetForm = () => {
    if (fields.id) fields.id.value = '';
    if (fields.name) fields.name.value = '';
    if (fields.piva) fields.piva.value = '';
    if (fields.address) fields.address.value = '';
    if (titleEl) titleEl.textContent = 'Nuovo Cliente';
  };

  const openModal = () => {
    try { bootstrap.Modal.getOrCreateInstance(modalEl).show(); } catch {}
  };

  const closeModal = () => {
    try { bootstrap.Modal.getOrCreateInstance(modalEl).hide(); } catch {}
  };

  const render = (filter = '') => {
    const db = App.db.ensure();
    const term = String(filter || '').toLowerCase();
    const items = (db.customers || []).filter(c => {
      const s = `${c.id || ''} ${c.name || ''} ${c.piva || ''} ${c.address || ''}`.toLowerCase();
      return s.includes(term);
    });
    tbody.innerHTML = items.map(c => `
      <tr>
        <td>${c.id || ''}</td>
        <td>${c.name || ''}</td>
        <td>${c.piva || ''}</td>
        <td>${c.address || ''}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${String(c.id || '')}">Modifica</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="del" data-id="${String(c.id || '')}">Elimina</button>
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

      masterdata.upsertCustomer({ id, name, piva, address });
      render(search?.value || '');
      App.ui.showToast('Cliente salvato', 'success');
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
      const c = (db.customers || []).find(x => String(x.id) === id);
      if (!c) return;
      if (fields.id) fields.id.value = c.id || '';
      if (fields.name) fields.name.value = c.name || '';
      if (fields.piva) fields.piva.value = c.piva || '';
      if (fields.address) fields.address.value = c.address || '';
      if (titleEl) titleEl.textContent = 'Modifica Cliente';
      openModal();
      return;
    }

    if (act === 'del' && confirm('Eliminare il cliente?')) {
      masterdata.deleteCustomer(id);
      render(search?.value || '');
    }
  });

  if (search && search.dataset.bound !== '1') {
    search.dataset.bound = '1';
    search.addEventListener('input', () => render(search.value));
  }

  modalEl?.addEventListener('hidden.bs.modal', resetForm);

  App.events.on('db:changed', () => render(search?.value || ''));
  App.events.on('customers:changed', () => render(search?.value || ''));
  App.events.on('section:changed', (sid) => {
    if (sid === 'anagrafica-clienti') render(search?.value || '');
  });

  resetForm();
  render();
}
