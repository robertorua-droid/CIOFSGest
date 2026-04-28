function containsProduct(lines = [], productId) {
  return (lines || []).some(line => line?.productId === productId);
}

export function productUsage(db, productId) {
  const hits = [];
  if ((db.customerOrders || []).some(o => containsProduct(o.lines, productId))) hits.push('ordini cliente');
  if ((db.customerDDTs || []).some(d => containsProduct(d.lines, productId))) hits.push('DDT cliente');
  if ((db.invoices || []).some(f => containsProduct(f.lines, productId))) hits.push('fatture');
  if ((db.supplierOrders || []).some(o => containsProduct(o.lines, productId))) hits.push('ordini fornitore');
  if ((db.supplierDDTs || []).some(d => containsProduct(d.lines, productId))) hits.push('DDT fornitore');
  if ((db.supplierQuarantine || []).some(q => q.productId === productId)) hits.push('quarantena fornitore');
  if ((db.supplierReturnDDTs || []).some(r => containsProduct(r.lines, productId))) hits.push('resi fornitore');
  return [...new Set(hits)];
}

export function customerUsage(db, customerId) {
  const hits = [];
  if ((db.customerOrders || []).some(o => o.customerId === customerId)) hits.push('ordini cliente');
  if ((db.customerDDTs || []).some(d => d.customerId === customerId)) hits.push('DDT cliente');
  if ((db.invoices || []).some(f => f.customerId === customerId)) hits.push('fatture');
  return hits;
}

export function supplierUsage(db, supplierId) {
  const hits = [];
  if ((db.supplierOrders || []).some(o => o.supplierId === supplierId)) hits.push('ordini fornitore');
  if ((db.supplierDDTs || []).some(d => d.supplierId === supplierId)) hits.push('DDT fornitore');
  if ((db.supplierQuarantine || []).some(q => q.supplierId === supplierId)) hits.push('quarantena fornitore');
  if ((db.supplierReturnDDTs || []).some(r => r.supplierId === supplierId)) hits.push('resi fornitore');
  return hits;
}

export function assertNoProductUsage(db, productId) {
  const hits = productUsage(db, productId);
  if (hits.length) throw new Error(`Prodotto collegato a: ${hits.join(', ')}`);
}

export function assertNoCustomerUsage(db, customerId) {
  const hits = customerUsage(db, customerId);
  if (hits.length) throw new Error(`Cliente collegato a: ${hits.join(', ')}`);
}

export function assertNoSupplierUsage(db, supplierId) {
  const hits = supplierUsage(db, supplierId);
  if (hits.length) throw new Error(`Fornitore collegato a: ${hits.join(', ')}`);
}
