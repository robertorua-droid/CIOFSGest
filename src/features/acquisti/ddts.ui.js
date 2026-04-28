export function renderSupplierDDTsTable({ db, tbody, canDelete, h }) {
  if (!tbody) return;
  tbody.innerHTML = (db.supplierDDTs || []).map(d => `
        <tr>
          <td>${h(d.number)}</td>
          <td>${h(d.date)}</td>
          <td>${h(d.supplierName)}</td>
          <td>${h(d.customerName || (db.company?.name || 'Nostra Sede'))}</td>
          <td>${h(d.orderNumber)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-supplier-ddt" data-num="${h(d.number)}">Dettaglio</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-supplier-ddt" data-num="${h(d.number)}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
}

export function renderSupplierReturnDDTsTable({ db, tbody, h }) {
  if (!tbody) return;
  tbody.innerHTML = (db.supplierReturnDDTs || []).length ? (db.supplierReturnDDTs || []).map(r => `
        <tr>
          <td>${h(r.number || '')}</td>
          <td>${h(r.date || '')}</td>
          <td>${h(r.supplierName || '')}</td>
          <td>${h(r.sourceOrderNumber || '')}</td>
          <td>${h(r.sourceDdtNumber || '')}</td>
          <td>${h(r.status || 'Preparato')}</td>
          <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="view-supplier-return" data-num="${h(r.number)}">Dettaglio</button></td>
        </tr>
      `).join('') : `<tr><td colspan="7" class="text-muted">Nessun reso fornitore registrato.</td></tr>`;
}
