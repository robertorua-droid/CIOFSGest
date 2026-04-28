import { getMaceratedProductRows } from '../../domain/macerated.service.js';

export function renderMaceratedProductsTable({ db, tbody, h }) {
  if (!tbody) return;
  const rows = getMaceratedProductRows(db);
  tbody.innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${h(row.date || '')}</td>
      <td>${h(row.productCode || '—')}</td>
      <td>${h(row.description || '')}</td>
      <td>${h(row.supplierName || '')}</td>
      <td class="text-end">${h(row.qty || 0)}</td>
      <td>${h(row.sourceDdtNumber || '—')}</td>
      <td>${h(row.sourceOrderNumber || '—')}</td>
      <td>${h(row.note || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="8" class="text-muted">Nessun prodotto macerato registrato.</td></tr>`;
}
