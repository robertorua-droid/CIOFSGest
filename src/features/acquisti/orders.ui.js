export function renderSupplierOrdersTable({ db, tbody, canDelete, h, fmtMoney }) {
  if (!tbody) return;
  tbody.innerHTML = (db.supplierOrders || []).map(o => `
        <tr>
          <td>${h(o.number)}</td>
          <td>${h(o.date)}</td>
          <td>${h(o.supplierName)}</td>
          <td class="text-end">${fmtMoney(o.total || 0)}</td>
          <td>${h(o.status || 'Inviato')}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-num="${h(o.number)}">Visualizza</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-order" data-num="${h(o.number)}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
}
