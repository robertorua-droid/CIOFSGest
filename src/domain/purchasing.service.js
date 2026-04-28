/* purchasing.service.js - logica di dominio per acquisti, DDT fornitore, quarantena e resi */

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function getSupplierOrderStatus(lines = []) {
  const normalized = Array.isArray(lines) ? lines : [];
  const anyQuarantine = normalized.some(l => toNumber(l.quarantineQty) > 0);
  const allReceived = normalized.length > 0 && normalized.every(l => toNumber(l.receivedQty) >= toNumber(l.qty));
  const anyReceived = normalized.some(l => toNumber(l.receivedQty) > 0);
  return anyQuarantine ? 'Aperto con riserva' : (allReceived ? 'Completato' : (anyReceived ? 'Parzialmente Ricevuto' : 'Inviato'));
}

export function recomputeSupplierOrderStatus(order) {
  if (!order) return 'Inviato';
  const status = getSupplierOrderStatus(order.lines || []);
  order.status = status;
  return status;
}

export function buildSupplierOrder({ id, number, date, supplier, lines = [] }) {
  const normalizedLines = lines.map(r => ({ ...r }));
  return {
    id,
    number,
    date,
    supplierId: supplier.id,
    supplierName: supplier.name,
    lines: normalizedLines,
    total: normalizedLines.reduce((a, r) => a + toNumber(r.qty) * toNumber(r.price), 0),
    status: 'Inviato'
  };
}

export function getSupplierOrderResidual(line) {
  return Math.max(0, toNumber(line?.qty) - toNumber(line?.receivedQty) - toNumber(line?.quarantineQty));
}

export function lineAcceptedQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return toNumber(line?.acceptedQty);
  return ddt?.refused ? 0 : (ddt?.withReserve ? 0 : toNumber(line?.qty));
}

export function lineReserveQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return toNumber(line?.reserveQty);
  return ddt?.withReserve ? toNumber(line?.qty) : 0;
}

export function lineRefusedQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return toNumber(line?.refusedQty);
  return ddt?.refused ? toNumber(line?.qty) : 0;
}

export const receivedLikeQty = (line, ddt = null) => lineAcceptedQty(line, ddt) + lineReserveQty(line, ddt);

export function computeSupplierDDTStatus(ddt) {
  const lines = ddt?.lines || [];
  const accepted = lines.reduce((a, l) => a + lineAcceptedQty(l, ddt), 0);
  const reserved = lines.reduce((a, l) => a + lineReserveQty(l, ddt), 0);
  const refused = lines.reduce((a, l) => a + lineRefusedQty(l, ddt), 0);
  if (refused > 0 && accepted + reserved === 0) return 'Respinto totale';
  if (refused > 0 && reserved > 0) return 'Parzialmente respinto con riserva';
  if (refused > 0) return 'Parzialmente respinto';
  if (reserved > 0) return 'Ricevuto con riserva';
  return 'Ricevuto';
}

export function lineOutcomeLabel(line, ddt = null) {
  const accepted = lineAcceptedQty(line, ddt);
  const reserved = lineReserveQty(line, ddt);
  const refused = lineRefusedQty(line, ddt);
  if (refused > 0 && accepted + reserved === 0) return 'Respinta';
  if (refused > 0 && reserved > 0) return 'Mista (riserva + respinta)';
  if (refused > 0) return 'Mista';
  if (reserved > 0) return 'Con riserva';
  return 'Accettata';
}

export function getSupplierReceiptInventoryChanges(order, handledLines = []) {
  const stockChanges = handledLines
    .map(s => ({ productId: order?.lines?.[s.i]?.productId, delta: toNumber(s.acceptedQty) }))
    .filter(x => x.productId && x.delta > 0);
  const quarantineChanges = handledLines
    .map(s => ({ productId: order?.lines?.[s.i]?.productId, delta: toNumber(s.reserveQty) }))
    .filter(x => x.productId && x.delta > 0);
  return { stockChanges, quarantineChanges };
}

export function applySupplierReceiptToOrder(order, handledLines = []) {
  handledLines.forEach(s => {
    const line = order?.lines?.[s.i];
    if (!line) return;
    line.receivedQty = toNumber(line.receivedQty) + toNumber(s.acceptedQty);
    line.quarantineQty = toNumber(line.quarantineQty) + toNumber(s.reserveQty);
  });
  return recomputeSupplierOrderStatus(order);
}

export function buildSupplierDDT({ id, number, date, order, handledLines = [], notes = '' }) {
  const totalReserved = handledLines.reduce((a, s) => a + toNumber(s.reserveQty), 0);
  const totalRefused = handledLines.reduce((a, s) => a + toNumber(s.refusedQty), 0);
  const ddt = {
    id,
    number,
    date,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    orderNumber: order.number,
    withReserve: totalReserved > 0,
    refused: totalRefused > 0 && handledLines.every(s => toNumber(s.acceptedQty) + toNumber(s.reserveQty) === 0),
    notes: String(notes || '').trim(),
    lines: handledLines.map(s => {
      const line = order.lines[s.i];
      return {
        productId: line.productId,
        description: line.productName,
        qty: toNumber(s.qty),
        acceptedQty: toNumber(s.acceptedQty),
        reserveQty: toNumber(s.reserveQty),
        refusedQty: toNumber(s.refusedQty),
        lineNotes: s.lineNotes || '',
        price: line.price
      };
    })
  };
  ddt.status = computeSupplierDDTStatus(ddt);
  return ddt;
}

export function buildSupplierQuarantineRecords({ uuid, date, order, ddt, handledLines = [], notes = '' }) {
  return handledLines
    .filter(s => toNumber(s.reserveQty) > 0)
    .map(s => {
      const line = order.lines[s.i];
      return {
        id: uuid(),
        date,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        orderId: order.id,
        orderNumber: order.number,
        ddtId: ddt.id,
        ddtNumber: ddt.number,
        productId: line.productId,
        description: line.productName || line.description,
        qty: toNumber(s.reserveQty),
        note: s.lineNotes || notes || '',
        status: 'In quarantena'
      };
    });
}

export function rollbackSupplierDDT(order, ddt) {
  if (!order || !ddt) return null;
  (ddt.lines || []).forEach(dl => {
    const line = (order.lines || []).find(l => String(l.productId || '') === String(dl.productId || ''))
      || (order.lines || []).find(l => String(l.productName || l.description || '') === String(dl.description || ''));
    if (!line) return;
    line.receivedQty = Math.max(0, toNumber(line.receivedQty) - toNumber(dl.acceptedQty));
    line.quarantineQty = Math.max(0, toNumber(line.quarantineQty) - toNumber(dl.reserveQty));
  });
  recomputeSupplierOrderStatus(order);
  return order;
}

export function getSupplierDDTRestoreChanges(db, ddt) {
  const findProductId = (line) => line.productId
    || (db?.products || []).find(pp => String(pp.description || '') === String(line.description || ''))?.id;
  const stockChanges = (ddt?.lines || []).map(line => {
    const pid = findProductId(line);
    const delta = -toNumber(line.acceptedQty);
    return pid && delta ? { productId: pid, delta } : null;
  }).filter(Boolean);
  const quarantineChanges = (ddt?.lines || []).map(line => {
    const pid = findProductId(line);
    const delta = -toNumber(line.reserveQty);
    return pid && delta ? { productId: pid, delta } : null;
  }).filter(Boolean);
  return { stockChanges, quarantineChanges };
}

export function applyQuarantineResolutionToOrder(order, rec, { total, releaseQty }) {
  const line = (order?.lines || []).find(l => String(l.productId || '') === String(rec?.productId || ''))
    || (order?.lines || []).find(l => String(l.productName || l.description || '') === String(rec?.description || ''));
  if (line) {
    line.quarantineQty = Math.max(0, toNumber(line.quarantineQty) - toNumber(total));
    if (toNumber(releaseQty) > 0) line.receivedQty = toNumber(line.receivedQty) + toNumber(releaseQty);
  }
  if (order) recomputeSupplierOrderStatus(order);
  return line || null;
}

export function buildSupplierReturnFromQuarantine({ id, number, date, rec, qty, note }) {
  return {
    id,
    number,
    date,
    supplierId: rec.supplierId,
    supplierName: rec.supplierName,
    sourceOrderId: rec.orderId,
    sourceOrderNumber: rec.orderNumber,
    sourceDdtId: rec.ddtId,
    sourceDdtNumber: rec.ddtNumber,
    status: 'Preparato',
    returnReason: 'Reso da quarantena',
    packageCount: 1,
    carrier: '',
    transportNotes: note,
    notes: note,
    lines: [{
      productId: rec.productId,
      productName: rec.description,
      description: rec.description,
      qty: toNumber(qty),
      reason: note
    }]
  };
}

export function buildQuarantineHistoryRecords({ uuid, today, rec, note, releaseQty = 0, returnQty = 0, destroyQty = 0, returnDdtNumber = null }) {
  const records = [];
  const push = (status, qty, extra = {}) => {
    if (!(toNumber(qty) > 0)) return;
    records.push({
      ...rec,
      ...extra,
      id: uuid(),
      qty: toNumber(qty),
      status,
      note: extra.note ?? (note || rec.note || ''),
      resolvedAt: today,
      sourceQuarantineId: rec.id
    });
  };
  push('Resa al fornitore', returnQty, { returnDdtNumber, resolutionType: 'return' });
  push('Svincolata', releaseQty, { resolutionType: 'release', note: note || rec.note || '' });
  push('Da distruggere', destroyQty, { resolutionType: 'destroy' });
  return records;
}
