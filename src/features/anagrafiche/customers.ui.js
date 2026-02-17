import { App } from '../../core/app.js';
import { masterdata } from '../../domain/masterdata.service.js';

export function initCustomersUI() {
  const tbody = document.getElementById('customers-table-body');
  const btnNew = document.getElementById('newCustomerBtn');
  const btnSave = document.getElementById('saveCustomerBtn');
  const search = document.getElementById('customer-search-input');
  if (!tbody) return;

  const render = (filter = '') => {
    const db = App.db.ensure();
    const term = (filter || '').toLowerCase();
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

    masterdata.upsertCustomer({ id, name, piva, address });
    render(search?.value || '');
    App.ui.showToast('Cliente salvato', 'success');
    try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).hide(); } catch {}
  });

  tbody.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]'); if (!b) return;
    const id = b.getAttribute('data-id');
    const act = b.getAttribute('data-action');
    const db = App.db.ensure();

    if (act === 'edit') {
      const c = (db.customers || []).find(x => x.id === id); if (!c) return;
      document.getElementById('customer-id').value = c.id;
      document.getElementById('customer-name').value = c.name || '';
      document.getElementById('customer-piva').value = c.piva || '';
      document.getElementById('customer-address').value = c.address || '';
      try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).show(); } catch {}
    } else if (act === 'del') {
      if (confirm('Eliminare il cliente?')) {
        masterdata.deleteCustomer(id);
        render(search?.value || '');
      }
    }
  });

  search?.addEventListener('input', () => render(search.value));

  // refresh quando cambia il DB (es. import JSON)
  App.events.on('db:changed', () => render(search?.value || ''));

  render();
}
