export function renderSupplierQuarantineTables({ db, tbody, histBody, canManage, h }) {
  if (!tbody) return;
  const rows = (db.supplierQuarantine || []).filter(q => q.status === 'In quarantena');
  tbody.innerHTML = rows.length ? rows.map(q => `
        <tr>
          <td>${h(q.date || '')}</td>
          <td>${h(q.supplierName || '')}</td>
          <td>${h(q.orderNumber || '')}</td>
          <td>${h(q.ddtNumber || '')}</td>
          <td>${h(q.description || '')}</td>
          <td class="text-end">${h(q.qty || 0)}</td>
          <td>${h(q.note || '—')}</td>
          <td class="text-end">
            ${canManage ? `<button class="btn btn-sm btn-outline-primary" data-action="manage-q" data-id="${h(q.id)}">Gestisci quantità quarantena</button>` : '<span class="text-muted">Solo Supervisor</span>'}
          </td>
        </tr>`).join('') : `<tr><td colspan="8" class="text-muted">Nessuna merce in quarantena.</td></tr>`;
  if (histBody) {
    const historyRows = (db.supplierQuarantine || []).filter(q => q.status !== 'In quarantena');
    histBody.innerHTML = historyRows.length ? historyRows.map(q => `
          <tr>
            <td>${h(q.resolvedAt || '')}</td>
            <td>${h(q.supplierName || '')}</td>
            <td>${h(q.orderNumber || '')}</td>
            <td>${h(q.description || '')}</td>
            <td class="text-end">${h(q.qty || 0)}</td>
            <td>${h(q.status || '')}</td>
            <td>${h(q.returnDdtNumber || '—')}</td>
            <td>${h(q.note || '—')}</td>
          </tr>`).join('') : `<tr><td colspan="8" class="text-muted">Nessuna quarantena chiusa.</td></tr>`;
  }
}
