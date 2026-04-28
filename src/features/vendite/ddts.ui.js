export function renderCustomerDDTsTable({ db, tbody, canDelete, h, findLinkedInvoiceForDDT }) {
  if (!tbody) return;
  tbody.innerHTML = (db.customerDDTs || []).map(d => {
    const linkedInvoice = findLinkedInvoiceForDDT(db, d.number);
    const canDeleteThis = canDelete && !linkedInvoice && d.status !== 'Fatturato';
    return `
        <tr>
          <td>${h(d.number)}</td>
          <td>${h(d.date)}</td>
          <td>${h(d.customerName)}</td>
          <td>${h(d.orderNumber)}</td>
          <td>${h(d.status || 'Da Fatturare')}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-ddt" data-num="${h(d.number)}">Dettaglio</button>
            ${canDeleteThis ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-ddt" data-num="${h(d.number)}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `;
  }).join('');
}
