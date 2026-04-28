import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQuarantineResolutionToOrder,
  applySupplierReceiptToOrder,
  buildQuarantineHistoryRecords,
  buildSupplierDDT,
  buildSupplierOrder,
  buildSupplierQuarantineRecords,
  buildSupplierReturnFromQuarantine,
  getSupplierDDTRestoreChanges,
  getSupplierOrderResidual,
  getSupplierOrderStatus,
  getSupplierReceiptInventoryChanges,
  lineOutcomeLabel,
  rollbackSupplierDDT
} from '../src/domain/purchasing.service.js';

const supplier = { id: 's1', name: 'Fornitore Uno' };
const line = { productId: 'p1', productName: 'P001 - Prodotto', qty: 10, price: 5, receivedQty: 0, quarantineQty: 0 };

test('buildSupplierOrder calcola totale e stato iniziale', () => {
  const order = buildSupplierOrder({ id: 'o1', number: 'OF-1', date: '2026-04-24', supplier, lines: [line] });
  assert.equal(order.total, 50);
  assert.equal(order.status, 'Inviato');
  assert.equal(getSupplierOrderResidual(order.lines[0]), 10);
});

test('ricezione fornitore aggiorna stato, DDT e quarantena', () => {
  const order = buildSupplierOrder({ id: 'o1', number: 'OF-1', date: '2026-04-24', supplier, lines: [line] });
  const handledLines = [{ i: 0, acceptedQty: 4, reserveQty: 3, refusedQty: 1, qty: 8, lineNotes: 'controllo qualità' }];
  const changes = getSupplierReceiptInventoryChanges(order, handledLines);
  assert.deepEqual(changes.stockChanges, [{ productId: 'p1', delta: 4 }]);
  assert.deepEqual(changes.quarantineChanges, [{ productId: 'p1', delta: 3 }]);

  applySupplierReceiptToOrder(order, handledLines);
  assert.equal(order.lines[0].receivedQty, 4);
  assert.equal(order.lines[0].quarantineQty, 3);
  assert.equal(order.status, 'Aperto con riserva');

  const ddt = buildSupplierDDT({ id: 'd1', number: 'DF-1', date: '2026-04-24', order, handledLines, notes: 'nota' });
  assert.equal(ddt.status, 'Parzialmente respinto con riserva');
  assert.equal(lineOutcomeLabel(ddt.lines[0], ddt), 'Mista (riserva + respinta)');

  const quarantine = buildSupplierQuarantineRecords({ uuid: () => 'q1', date: '2026-04-24', order, ddt, handledLines, notes: 'nota' });
  assert.equal(quarantine.length, 1);
  assert.equal(quarantine[0].qty, 3);
});

test('rollback DDT fornitore ripristina ordine e produce delta negativi', () => {
  const order = buildSupplierOrder({ id: 'o1', number: 'OF-1', date: '2026-04-24', supplier, lines: [line] });
  const handledLines = [{ i: 0, acceptedQty: 4, reserveQty: 3, refusedQty: 0, qty: 7, lineNotes: 'riserva' }];
  applySupplierReceiptToOrder(order, handledLines);
  const ddt = buildSupplierDDT({ id: 'd1', number: 'DF-1', date: '2026-04-24', order, handledLines });

  rollbackSupplierDDT(order, ddt);
  assert.equal(order.lines[0].receivedQty, 0);
  assert.equal(order.lines[0].quarantineQty, 0);
  assert.equal(order.status, 'Inviato');

  const changes = getSupplierDDTRestoreChanges({ products: [] }, ddt);
  assert.deepEqual(changes.stockChanges, [{ productId: 'p1', delta: -4 }]);
  assert.deepEqual(changes.quarantineChanges, [{ productId: 'p1', delta: -3 }]);
});

test('gestione quarantena genera reso e storico senza dipendere dalla UI', () => {
  const order = buildSupplierOrder({ id: 'o1', number: 'OF-1', date: '2026-04-24', supplier, lines: [{ ...line, receivedQty: 4, quarantineQty: 3 }] });
  const rec = { id: 'q1', productId: 'p1', description: 'P001 - Prodotto', qty: 3, supplierId: 's1', supplierName: 'Fornitore Uno', orderId: 'o1', orderNumber: 'OF-1', ddtId: 'd1', ddtNumber: 'DF-1', note: 'difetto', status: 'In quarantena' };
  applyQuarantineResolutionToOrder(order, rec, { total: 3, releaseQty: 1 });
  assert.equal(order.lines[0].receivedQty, 5);
  assert.equal(order.lines[0].quarantineQty, 0);
  assert.equal(order.status, 'Parzialmente Ricevuto');

  const ret = buildSupplierReturnFromQuarantine({ id: 'r1', number: 'RF-1', date: '2026-04-24', rec, qty: 2, note: 'difetto grave' });
  assert.equal(ret.lines[0].qty, 2);
  assert.equal(ret.sourceDdtNumber, 'DF-1');

  const history = buildQuarantineHistoryRecords({ uuid: (() => { let n = 0; return () => `h${++n}`; })(), today: '2026-04-24', rec, note: 'difetto grave', releaseQty: 1, returnQty: 2, destroyQty: 0, returnDdtNumber: 'RF-1' });
  assert.equal(history.length, 2);
  assert.equal(history[0].status, 'Resa al fornitore');
  assert.equal(history[1].status, 'Svincolata');
});

test('stato ordine fornitore distingue inviato, parziale e completato', () => {
  assert.equal(getSupplierOrderStatus([{ qty: 2, receivedQty: 0 }]), 'Inviato');
  assert.equal(getSupplierOrderStatus([{ qty: 2, receivedQty: 1 }]), 'Parzialmente Ricevuto');
  assert.equal(getSupplierOrderStatus([{ qty: 2, receivedQty: 2 }]), 'Completato');
  assert.equal(getSupplierOrderStatus([{ qty: 2, receivedQty: 1, quarantineQty: 1 }]), 'Aperto con riserva');
});
