/* macerated.service.js - registro consultivo dei prodotti macerati/distrutti da quarantena */

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const norm = value => String(value || '').trim().toLowerCase();

export function isMaceratedQuarantineRecord(record) {
  if (!record) return false;
  const type = norm(record.resolutionType);
  const status = norm(record.status);
  return type === 'destroy' || status === 'da distruggere' || status === 'distrutta' || status === 'distrutto' || status === 'macerata' || status === 'macerato';
}

export function getMaceratedProductRows(db = {}) {
  const products = Array.isArray(db.products) ? db.products : [];
  const suppliers = Array.isArray(db.suppliers) ? db.suppliers : [];
  const productById = new Map(products.map(p => [String(p.id), p]));
  const supplierById = new Map(suppliers.map(s => [String(s.id), s]));

  return (db.supplierQuarantine || [])
    .filter(isMaceratedQuarantineRecord)
    .map((record) => {
      const product = productById.get(String(record.productId || '')) || null;
      const supplier = supplierById.get(String(record.supplierId || '')) || null;
      return {
        id: record.id,
        date: record.resolvedAt || record.date || '',
        productId: record.productId || '',
        productCode: record.productCode || product?.code || '',
        description: record.description || product?.description || '',
        supplierId: record.supplierId || '',
        supplierName: record.supplierName || supplier?.name || '',
        qty: toNumber(record.qty),
        sourceOrderNumber: record.sourceOrderNumber || record.orderNumber || '',
        sourceDdtNumber: record.sourceDdtNumber || record.ddtNumber || '',
        note: record.note || record.reason || ''
      };
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || '')));
}

export function getMaceratedProductsSummary(db = {}) {
  return getMaceratedProductRows(db).reduce((summary, row) => {
    summary.totalRows += 1;
    summary.totalQty += toNumber(row.qty);
    if (row.productId) summary.productIds.add(String(row.productId));
    return summary;
  }, { totalRows: 0, totalQty: 0, productIds: new Set() });
}
