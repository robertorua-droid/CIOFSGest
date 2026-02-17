// src/domain/backupMapper.js
// Converte un file di backup "legacy" (companyInfo, giacenza, customerDdts, ecc.)
// nello schema DB corrente del gestionale (createInitialDb()).

import { createInitialDb } from '../core/dbSchema.js';

function toStr(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function isLegacyBackup(obj) {
  return !!(obj && (obj.companyInfo || obj.products || obj.customerOrders || obj.customerDdts || obj.customerDDTs));
}

/**
 * Normalizza il backup legacy nello schema DB corrente.
 * - converte id numerici in stringhe (per consistenza)
 * - mappa campi prodotti: corsia/scaffale/piano/giacenza -> loc*/stockQty
 * - mappa customerDdts/supplierDdts (legacy) -> customerDDTs/supplierDDTs
 * - note array -> notes object { userId: text }
 */
export function mapBackupToDb(backup) {
  const db = createInitialDb();

  // Company
  const c = backup.company || backup.companyInfo || {};
  db.company = {
    name: (c.name || db.company.name || '').trim(),
    address: (c.address || '').trim(),
    city: (c.city || '').trim(),
    zip: (c.zip || '').trim(),
    province: (c.province || '').trim()
  };

  // Users (gestionale interno, NON Firebase Auth)
  db.users = (backup.users || []).map(u => ({
    id: toStr(u.id || u.surname || u.name || ''),
    surname: (u.surname || '').trim(),
    name: (u.name || '').trim(),
    password: toStr(u.password || ''),
    role: (u.role || 'User').trim()
  })).filter(u => u.id);

  // Customers / Suppliers
  db.customers = (backup.customers || []).map(cu => ({
    id: toStr(cu.id),
    name: (cu.name || '').trim(),
    piva: toStr(cu.piva || '').trim(),
    address: (cu.address || '').trim()
  })).filter(x => x.id);

  db.suppliers = (backup.suppliers || []).map(s => ({
    id: toStr(s.id),
    name: (s.name || '').trim(),
    piva: toStr(s.piva || '').trim(),
    address: (s.address || '').trim()
  })).filter(x => x.id);

  // Products
  db.products = (backup.products || []).map(p => ({
    id: toStr(p.id || p.code),
    code: (p.code || '').trim(),
    description: (p.description || '').trim(),
    purchasePrice: Number(p.purchasePrice || 0),
    salePrice: Number(p.salePrice || 0),
    iva: Number(p.iva || 22),
    locCorsia: (p.locCorsia || p.corsia || '').trim(),
    locScaffale: (p.locScaffale || p.scaffale || '').trim(),
    locPiano: (p.locPiano || p.piano || '').trim(),
    stockQty: Number(p.stockQty ?? p.giacenza ?? 0)
  })).filter(x => x.id);

  // Documents
  const normalizeLines = (lines, kind) => (lines || []).map(l => {
    const out = { ...l };
    // garantisci stringhe coerenti
    if (out.productId) out.productId = toStr(out.productId);
    if (out.customerId) out.customerId = toStr(out.customerId);
    if (out.supplierId) out.supplierId = toStr(out.supplierId);
    // elimina campi NaN
    if (out.qty !== undefined) out.qty = Number(out.qty || 0);
    if (out.price !== undefined) out.price = Number(out.price || 0);
    if (out.subtotal !== undefined) out.subtotal = Number(out.subtotal || 0);
    if (out.receivedQty !== undefined) out.receivedQty = Number(out.receivedQty || 0);
    if (out.shippedQty !== undefined) out.shippedQty = Number(out.shippedQty || 0);
    return out;
  });

  db.customerOrders = (backup.customerOrders || []).map(o => ({
    ...o,
    id: toStr(o.id || o.number),
    customerId: toStr(o.customerId),
    lines: normalizeLines(o.lines),
    total: Number(o.total || 0)
  })).filter(x => x.id);

  db.supplierOrders = (backup.supplierOrders || []).map(o => ({
    ...o,
    id: toStr(o.id || o.number),
    supplierId: toStr(o.supplierId),
    lines: normalizeLines(o.lines),
    total: Number(o.total || 0)
  })).filter(x => x.id);

  const legacyCustomerDdts = backup.customerDDTs || backup.customerDdts || [];
  db.customerDDTs = legacyCustomerDdts.map(d => ({
    ...d,
    id: toStr(d.id || d.number),
    customerId: toStr(d.customerId),
    lines: normalizeLines(d.lines)
  })).filter(x => x.id);

  const legacySupplierDdts = backup.supplierDDTs || backup.supplierDdts || [];
  db.supplierDDTs = legacySupplierDdts.map(d => ({
    ...d,
    id: toStr(d.id || d.number),
    supplierId: toStr(d.supplierId),
    lines: normalizeLines(d.lines)
  })).filter(x => x.id);

  db.invoices = (backup.invoices || []).map(f => ({
    ...f,
    id: toStr(f.id || f.number),
    customerId: toStr(f.customerId),
    ddts: (f.ddts || []).map(toStr),
    lines: (f.lines || []).map(l => ({
      ...l,
      qty: Number(l.qty || 0),
      price: Number(l.price || 0),
      iva: Number(l.iva || 22),
      imponibile: Number(l.imponibile || 0)
    })),
    total: Number(f.total || 0)
  })).filter(x => x.id);

  // Notes
  if (Array.isArray(backup.notes)) {
    const notesObj = {};
    for (const n of backup.notes) {
      const uid = toStr(n.userId);
      if (!uid) continue;
      notesObj[uid] = toStr(n.text || '');
    }
    db.notes = notesObj;
  } else if (backup.notes && typeof backup.notes === 'object') {
    db.notes = backup.notes;
  } else {
    db.notes = {};
  }

  // Counters: se non presenti, stima dai documenti
  if (backup.counters && typeof backup.counters === 'object') {
    db.counters = backup.counters;
  } else {
    db.counters = {
      orderCustomer: db.customerOrders.length,
      orderSupplier: db.supplierOrders.length,
      ddtCustomer: db.customerDDTs.length,
      ddtSupplier: db.supplierDDTs.length,
      invoice: db.invoices.length
    };
  }

  return db;
}

export function summarizeDb(db) {
  return {
    company: db.company?.name || '',
    users: (db.users || []).length,
    customers: (db.customers || []).length,
    suppliers: (db.suppliers || []).length,
    products: (db.products || []).length,
    customerOrders: (db.customerOrders || []).length,
    supplierOrders: (db.supplierOrders || []).length,
    customerDDTs: (db.customerDDTs || []).length,
    supplierDDTs: (db.supplierDDTs || []).length,
    invoices: (db.invoices || []).length
  };
}
