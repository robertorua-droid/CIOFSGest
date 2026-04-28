import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDb } from '../src/core/dbSchema.js';
import {
  buildCustomerDDT,
  buildCustomerOrder,
  buildInvoiceLines,
  calculateInvoiceTotals,
  getDDTRestoreStockChanges,
  getShipmentStockWarnings
} from '../src/domain/sales.service.js';
import {
  applyQuarantineResolutionToOrder,
  buildQuarantineHistoryRecords,
  buildSupplierDDT,
  buildSupplierOrder,
  computeSupplierDDTStatus,
  getSupplierOrderResidual,
  lineOutcomeLabel,
  receivedLikeQty
} from '../src/domain/purchasing.service.js';
import {
  BACKUP_ALIGNMENT_FIELDS,
  assertBackupSnapshotAligned,
  createBackupPreviewText,
  prepareBackupFromText
} from '../src/domain/backup.service.js';

test('normalizeDb preserva schema completo e arricchisce campi denormalizzati legacy', () => {
  const db = normalizeDb({
    company: {},
    customers: [{ id: 'c1', name: 'Cliente Legacy' }],
    suppliers: [{ id: 's1', name: 'Fornitore Legacy' }],
    products: [{ id: 'p1', code: 'P001', description: 'Prodotto legacy' }],
    customerOrders: [{ id: 'oc1', customerId: 'c1', lines: [{ productName: 'P001 - Prodotto legacy' }] }],
    supplierOrders: [{ id: 'of1', supplierId: 's1', lines: [{ description: 'P001 - Prodotto legacy' }] }],
    invoices: [{ id: 'f1', customerId: 'c1', ddts: ['DDT-1'], lines: [{ productName: 'P001 - Prodotto legacy' }] }]
  });

  assert.equal(db.company.name, 'Gestionale OL');
  assert.equal(db.customerOrders[0].customerName, 'Cliente Legacy');
  assert.equal(db.supplierOrders[0].supplierName, 'Fornitore Legacy');
  assert.equal(db.supplierOrders[0].lines[0].productName, 'P001 - Prodotto legacy');
  assert.equal(db.products[0].quarantineQty, 0);
  assert.deepEqual(db.invoices[0].ddtNumbers, ['DDT-1']);
  assert.ok(Array.isArray(db.supplierReturnDDTs));
});

test('vendite: warning stock raggruppati e fallback fattura da anagrafica prodotto', () => {
  const db = {
    products: [{ id: 'p1', code: 'A001', description: 'Articolo A', stockQty: 3, salePrice: 12, iva: 10 }]
  };
  const customer = { id: 'c1', name: 'Cliente Uno' };
  const order = buildCustomerOrder({
    id: 'o1', number: 'OC-1', date: '2026-04-24', customer,
    lines: [
      { productId: 'p1', productName: 'A001 - Articolo A', qty: 3, price: 12, shippedQty: 0 },
      { productId: 'p1', productName: 'A001 - Articolo A', qty: 2, price: 12, shippedQty: 0 }
    ]
  });

  assert.deepEqual(getShipmentStockWarnings(db, order, [{ i: 0, qty: 2 }, { i: 1, qty: 2 }]), [
    { code: 'A001', available: 3, qty: 4 }
  ]);

  const ddt = buildCustomerDDT({ id: 'd1', number: 'DDT-1', date: '2026-04-24', order, shipLines: [{ i: 0, qty: 2 }] });
  delete ddt.lines[0].price;
  delete ddt.lines[0].iva;
  const lines = buildInvoiceLines(db, [ddt]);
  assert.deepEqual(lines[0], { productId: 'p1', description: 'A001 - Articolo A', qty: 2, price: 12, iva: 10 });
  const totals = calculateInvoiceTotals(lines);
  assert.equal(totals.subtotal, 24);
  assert.equal(Number(totals.ivaTotal.toFixed(2)), 2.4);
  assert.equal(Number(totals.total.toFixed(2)), 26.4);
  assert.deepEqual(getDDTRestoreStockChanges(db, { lines: [{ description: 'A001 - Articolo A', qty: 2 }] }), [{ productId: 'p1', delta: 2 }]);
});

test('acquisti: compatibilità DDT legacy con flag riserva/rifiuto', () => {
  const reserveLine = { qty: 5 };
  const refusedLine = { qty: 5 };
  assert.equal(receivedLikeQty(reserveLine, { withReserve: true }), 5);
  assert.equal(computeSupplierDDTStatus({ withReserve: true, lines: [reserveLine] }), 'Ricevuto con riserva');
  assert.equal(lineOutcomeLabel(reserveLine, { withReserve: true }), 'Con riserva');
  assert.equal(computeSupplierDDTStatus({ refused: true, lines: [refusedLine] }), 'Respinto totale');
  assert.equal(lineOutcomeLabel(refusedLine, { refused: true }), 'Respinta');
});

test('acquisti: risoluzione quarantena aggiorna residui ordine e genera storico distinto', () => {
  const supplier = { id: 's1', name: 'Fornitore Uno' };
  const order = buildSupplierOrder({
    id: 'of1', number: 'OF-1', date: '2026-04-24', supplier,
    lines: [{ productId: 'p1', productName: 'P001 - Prodotto', qty: 10, price: 5, receivedQty: 4, quarantineQty: 4 }]
  });
  const ddt = buildSupplierDDT({
    id: 'df1', number: 'DF-1', date: '2026-04-24', order,
    handledLines: [{ i: 0, qty: 4, acceptedQty: 0, reserveQty: 4, refusedQty: 0 }]
  });
  assert.equal(ddt.status, 'Ricevuto con riserva');

  const rec = { id: 'q1', productId: 'p1', description: 'P001 - Prodotto', qty: 4, supplierId: 's1', supplierName: 'Fornitore Uno', orderId: 'of1', orderNumber: 'OF-1', ddtId: 'df1', ddtNumber: 'DF-1', note: 'controllo qualità' };
  applyQuarantineResolutionToOrder(order, rec, { total: 4, releaseQty: 2 });
  assert.equal(order.lines[0].receivedQty, 6);
  assert.equal(order.lines[0].quarantineQty, 0);
  assert.equal(getSupplierOrderResidual(order.lines[0]), 4);

  const history = buildQuarantineHistoryRecords({
    uuid: (() => { let n = 0; return () => `h${++n}`; })(),
    today: '2026-04-24', rec, note: 'chiusura controllo', releaseQty: 2, returnQty: 1, destroyQty: 1, returnDdtNumber: 'RF-1'
  });
  assert.deepEqual(history.map(h => h.status), ['Resa al fornitore', 'Svincolata', 'Da distruggere']);
  assert.deepEqual(history.map(h => h.qty), [1, 2, 1]);
});

test('backup: tutti i campi critici sono tracciati nell’allineamento Firebase/cache', () => {
  assert.ok(BACKUP_ALIGNMENT_FIELDS.includes('supplierQuarantine'));
  assert.ok(BACKUP_ALIGNMENT_FIELDS.includes('supplierReturnDDTs'));

  const db = prepareBackupFromText(JSON.stringify({
    company: { name: 'Azienda Test' },
    products: [], customers: [], suppliers: [], customerOrders: [], customerDDTs: [], invoices: [],
    supplierOrders: [], supplierDDTs: [], supplierQuarantine: [{ id: 'q1' }], supplierReturnDDTs: [{ id: 'r1' }], users: []
  }));
  const preview = createBackupPreviewText(db, 'firebase');
  assert.match(preview, /Quarantena fornitori: 1/);
  assert.match(preview, /Resi fornitori: 1/);

  const missingReturn = { ...db, supplierReturnDDTs: [] };
  assert.throws(() => assertBackupSnapshotAligned(missingReturn, db), /supplierReturnDDTs/);
});
