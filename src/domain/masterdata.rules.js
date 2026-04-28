import { assertNoCustomerUsage, assertNoProductUsage, assertNoSupplierUsage } from "./referentialIntegrity.service.js";

export function buildCustomerPayload(customer = {}, idFactory) {
  const id = customer.id || idFactory();
  return { id, name: customer.name, piva: customer.piva || '', address: customer.address || '' };
}

export function upsertCustomerRecord(db, customer = {}, idFactory) {
  db.customers = db.customers || [];
  const payload = buildCustomerPayload(customer, idFactory);
  const idx = db.customers.findIndex(c => c.id === payload.id);
  if (idx >= 0) db.customers[idx] = payload;
  else db.customers.push(payload);
  return payload;
}

export function deleteCustomerRecord(db, id) {
  assertNoCustomerUsage(db, id);
  const idx = (db.customers || []).findIndex(c => c.id === id);
  if (idx < 0) return false;
  db.customers.splice(idx, 1);
  return true;
}

export function buildSupplierPayload(supplier = {}, idFactory) {
  const id = supplier.id || idFactory();
  return { id, name: supplier.name, piva: supplier.piva || '', address: supplier.address || '' };
}

export function upsertSupplierRecord(db, supplier = {}, idFactory) {
  db.suppliers = db.suppliers || [];
  const payload = buildSupplierPayload(supplier, idFactory);
  const idx = db.suppliers.findIndex(s => s.id === payload.id);
  if (idx >= 0) db.suppliers[idx] = payload;
  else db.suppliers.push(payload);
  return payload;
}

export function deleteSupplierRecord(db, id) {
  assertNoSupplierUsage(db, id);
  const idx = (db.suppliers || []).findIndex(s => s.id === id);
  if (idx < 0) return false;
  db.suppliers.splice(idx, 1);
  return true;
}

export function buildProductPayload(db, product = {}, idFactory) {
  const id = product.id || idFactory();
  const prev = (db.products || []).find(p => p.id === id);
  return {
    id,
    description: product.description,
    code: product.code,
    purchasePrice: Number(product.purchasePrice || 0),
    salePrice: Number(product.salePrice || 0),
    iva: Number.parseInt(product.iva || 22, 10),
    locCorsia: product.locCorsia || '',
    locScaffale: product.locScaffale || '',
    locPiano: product.locPiano || '',
    stockQty: typeof product.stockQty === 'number' ? product.stockQty : (prev?.stockQty || 0),
    quarantineQty: typeof product.quarantineQty === 'number' ? product.quarantineQty : (prev?.quarantineQty || 0)
  };
}

export function upsertProductRecord(db, product = {}, idFactory) {
  db.products = db.products || [];
  const payload = buildProductPayload(db, product, idFactory);
  const idx = db.products.findIndex(p => p.id === payload.id);
  if (idx >= 0) db.products[idx] = payload;
  else db.products.push(payload);
  return payload;
}

export function deleteProductRecord(db, id) {
  assertNoProductUsage(db, id);
  const idx = (db.products || []).findIndex(p => p.id === id);
  if (idx < 0) return false;
  db.products.splice(idx, 1);
  return true;
}
