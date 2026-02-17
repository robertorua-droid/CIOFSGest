import { App } from '../../core/app.js';
import { masterdata } from '../../domain/masterdata.service.js';

export function initProductsUI() {
  const tbody = document.getElementById('products-table-body');
  const btnNew = document.getElementById('newProductBtn');
  const btnSave = document.getElementById('saveProductBtn');
  const search = document.getElementById('product-search-input');
  if (!tbody) return;

  const render = (filter = '') => {
    const db = App.db.ensure();
    const t = (filter || '').toLowerCase();
    const items = (db.products || []).filter(p => {
      const s = `${p.code || ''} ${p.description || ''}`.toLowerCase();
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

    masterdata.upsertProduct({
      id,
      description,
      code,
      purchasePrice: parseFloat(document.getElementById('product-purchase-price').value || '0'),
      salePrice: parseFloat(document.getElementById('product-sale-price').value || '0'),
      iva: parseInt(document.getElementById('product-iva').value || '22', 10),
      locCorsia: document.getElementById('product-loc-corsia').value.trim(),
      locScaffale: document.getElementById('product-loc-scaffale').value.trim(),
      locPiano: document.getElementById('product-loc-piano').value.trim()
    });

    render(search?.value || '');
    App.ui.showToast('Prodotto salvato', 'success');
    try { bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide(); } catch {}
  });

  tbody.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]'); if (!b) return;
    const id = b.getAttribute('data-id');
    const act = b.getAttribute('data-action');
    const db = App.db.ensure();
    const p = (db.products || []).find(x => x.id === id);

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
      if (confirm('Eliminare il prodotto?')) {
        masterdata.deleteProduct(id);
        render(search?.value || '');
      }
    }
  });

  search?.addEventListener('input', () => render(search.value));
  App.events.on('db:changed', () => render(search?.value || ''));
  render();
}
