import { App } from '../../core/app.js';
import { masterdata } from '../../domain/masterdata.service.js';

export function initSuppliersUI() {
  const tbody = document.getElementById('suppliers-table-body');
  const btnNew = document.getElementById('newSupplierBtn');
  const btnSave = document.getElementById('saveSupplierBtn');
  const search = document.getElementById('supplier-search-input');
  if (!tbody) return;

  const render = (filter = '') => {
    const db = App.db.ensure();
    const term = (filter || '').toLowerCase();
    const items = (db.suppliers || []).filter(s => {
      const s1 = `${s.id || ''} ${s.name || ''} ${s.piva || ''} ${s.address || ''}`.toLowerCase();
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

    masterdata.upsertSupplier({ id, name, piva, address });
    render(search?.value || '');
    App.ui.showToast('Fornitore salvato', 'success');
    try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierModal')).hide(); } catch {}
  });

  tbody.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]'); if (!b) return;
    const id = b.getAttribute('data-id');
    const act = b.getAttribute('data-action');
    const db = App.db.ensure();

    if (act === 'edit') {
      const s = (db.suppliers || []).find(x => x.id === id); if (!s) return;
      document.getElementById('supplier-id').value = s.id;
      document.getElementById('supplier-name').value = s.name || '';
      document.getElementById('supplier-piva').value = s.piva || '';
      document.getElementById('supplier-address').value = s.address || '';
      try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierModal')).show(); } catch {}
    } else if (act === 'del') {
      if (confirm('Eliminare il fornitore?')) {
        masterdata.deleteSupplier(id);
        render(search?.value || '');
      }
    }
  });

  search?.addEventListener('input', () => render(search.value));
  App.events.on('db:changed', () => render(search?.value || ''));
  render();
}
