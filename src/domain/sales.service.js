/* sales.service.js - logica di dominio per vendite, DDT cliente e fatture */

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function getCustomerOrderStatus(lines = []) {
  const normalized = Array.isArray(lines) ? lines : [];
  const allShipped = normalized.length > 0 && normalized.every(l => toNumber(l.shippedQty) >= toNumber(l.qty));
  const anyShipped = normalized.some(l => toNumber(l.shippedQty) > 0);
  return allShipped ? 'Evaso' : (anyShipped ? 'Parzialmente Evaso' : 'In lavorazione');
}

export function recomputeCustomerOrderStatus(order) {
  if (!order) return 'In lavorazione';
  const status = getCustomerOrderStatus(order.lines || []);
  order.status = status;
  return status;
}

export function findLinkedInvoiceForDDT(db, ddtNumber) {
  return (db?.invoices || []).find(inv => {
    const linked = inv?.ddtNumbers || inv?.ddts || [];
    return Array.isArray(linked) && linked.includes(ddtNumber);
  }) || null;
}

export function getOpenCustomerOrders(db) {
  return (db?.customerOrders || []).filter(o =>
    (o.lines || []).some(l => toNumber(l.shippedQty) < toNumber(l.qty))
  );
}

export function buildCustomerOrder({ id, number, date, customer, lines = [] }) {
  const normalizedLines = lines.map(r => ({ ...r }));
  return {
    id,
    number,
    date,
    customerId: customer.id,
    customerName: customer.name,
    lines: normalizedLines,
    total: normalizedLines.reduce((a, r) => a + toNumber(r.qty) * toNumber(r.price), 0),
    status: 'In lavorazione'
  };
}

export function getShipmentStockWarnings(db, order, shipLines = []) {
  const grouped = new Map();
  shipLines.forEach(s => {
    const l = order?.lines?.[s.i];
    if (!l?.productId) return;
    grouped.set(l.productId, (grouped.get(l.productId) || 0) + toNumber(s.qty));
  });

  const warnings = [];
  grouped.forEach((qty, pid) => {
    const p = (db?.products || []).find(pp => String(pp.id) === String(pid));
    const available = toNumber(p?.stockQty);
    if (qty > available) warnings.push({ code: p?.code || pid, available, qty });
  });
  return warnings;
}

export function applyShipmentToOrder(order, shipLines = []) {
  shipLines.forEach(s => {
    const line = order?.lines?.[s.i];
    if (!line) return;
    line.shippedQty = toNumber(line.shippedQty) + toNumber(s.qty);
  });
  return recomputeCustomerOrderStatus(order);
}

export function buildCustomerDDT({ id, number, date, order, shipLines = [], parcels, carrier, transportReason, externalAspect, notes }) {
  return {
    id,
    number,
    date,
    customerId: order.customerId,
    customerName: order.customerName,
    orderNumber: order.number,
    parcels: Number(parcels || 0) || null,
    carrier: (carrier || '').trim(),
    transportReason: (transportReason || '').trim(),
    externalAspect: (externalAspect || '').trim(),
    notes: (notes || '').trim(),
    lines: shipLines.map(s => {
      const l = order.lines[s.i];
      return { productId: l.productId, description: l.productName, qty: toNumber(s.qty), price: l.price, iva: 22 };
    }),
    status: 'Da Fatturare'
  };
}

export function getDDTRestoreStockChanges(db, ddt) {
  return (ddt?.lines || []).map(dl => {
    const pid = dl.productId
      || (db?.products || []).find(pp => pp.code === ((dl.description || '').split(' - ')[0]))?.id;
    const q = toNumber(dl.qty);
    return pid && q ? { productId: pid, delta: q } : null;
  }).filter(Boolean);
}

export function rollbackCustomerDDT(db, ddt) {
  const order = (db?.customerOrders || []).find(o => o.number === ddt?.orderNumber);
  if (!order) return null;

  (ddt.lines || []).forEach(dl => {
    const line = (order.lines || []).find(l => (l.productName || '') === dl.description);
    if (line) line.shippedQty = Math.max(0, toNumber(line.shippedQty) - toNumber(dl.qty));
  });
  recomputeCustomerOrderStatus(order);
  return order;
}

function findProductForInvoiceLine(db, line) {
  const pid = line?.productId;
  const byId = pid ? (db?.products || []).find(pp => String(pp.id) === String(pid)) : null;
  if (byId) return byId;
  const code = String(line?.description || '').split(' - ')[0].trim();
  return (db?.products || []).find(pp => String(pp.code || '').trim() === code) || null;
}

export function buildInvoiceLines(db, ddts = []) {
  const invLines = [];
  ddts.forEach(d => (d.lines || []).forEach(l => {
    const prod = findProductForInvoiceLine(db, l);
    const qty = toNumber(l.qty);
    const price = (l.price != null && l.price !== '') ? toNumber(l.price) : toNumber(prod?.salePrice);
    const iva = (l.iva != null && l.iva !== '') ? toNumber(l.iva) : toNumber(prod?.iva, 22);
    const desc = l.description || (prod ? `${prod.code} - ${prod.description}` : '');
    invLines.push({
      productId: l.productId || prod?.id || null,
      description: desc,
      qty,
      price,
      iva
    });
  }));
  return invLines;
}

export function calculateInvoiceTotals(lines = []) {
  const subtotal = lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.price), 0);
  const ivaTotal = lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.price) * (toNumber(l.iva) / 100), 0);
  return { subtotal, ivaTotal, total: subtotal + ivaTotal };
}

export function buildInvoice({ id, number, date, customer, ddts = [], lines = [] }) {
  const totals = calculateInvoiceTotals(lines);
  return {
    id,
    number,
    date,
    customerId: customer.id,
    customerName: customer.name,
    ddtNumbers: ddts.map(d => d.number),
    ddts: ddts.map(d => d.number),
    lines,
    ...totals
  };
}

export function markDDTsInvoiced(ddts = [], invoiceNumber) {
  ddts.forEach(d => {
    d.status = 'Fatturato';
    d.invoiceNumber = invoiceNumber;
  });
}

export function rollbackInvoiceDDTState(db, invoice) {
  const linked = invoice?.ddtNumbers || invoice?.ddts || [];
  (db?.customerDDTs || []).forEach(d => {
    if (linked.includes(d.number)) {
      d.status = 'Da Fatturare';
      delete d.invoiceNumber;
    }
  });
}
