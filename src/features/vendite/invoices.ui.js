export function renderInvoicesTable({ db, tbody, canDelete, h, fmtMoney }) {
  if (!tbody) return;
  tbody.innerHTML = (db.invoices || []).map(f => `
        <tr>
          <td>${h(f.number)}</td>
          <td>${h(f.date)}</td>
          <td>${h(f.customerName)}</td>
          <td class="text-end">${fmtMoney(f.total || 0)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-invoice" data-num="${h(f.number)}">Dettaglio</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-invoice" data-num="${h(f.number)}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
}
