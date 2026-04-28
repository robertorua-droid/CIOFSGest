import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyShipmentToOrder,
  buildCustomerDDT,
  buildCustomerOrder,
  buildInvoice,
  buildInvoiceLines,
  calculateInvoiceTotals,
  findLinkedInvoiceForDDT,
  getCustomerOrderStatus,
  getDDTRestoreStockChanges,
  getOpenCustomerOrders,
  getShipmentStockWarnings,
  markDDTsInvoiced,
  rollbackCustomerDDT,
  rollbackInvoiceDDTState
} from '../src/domain/sales.service.js';

const sampleDb = () => ({
  products: [
    { id: 'p1', code: 'A001', description: 'Articolo A', stockQty: 5, salePrice: 10, iva: 22 },
    { id: 'p2', code: 'B002', description: 'Articolo B', stockQty: 1, salePrice: 20, iva: 10 }
  ],
  customers: [{ id: 'c1', name: 'Cliente Uno' }],
  customerOrders: [],
  customerDDTs: [],
  invoices: []
});

test('calcola lo stato ordine cliente in base alle quantità evase', () => {
  assert.equal(getCustomerOrderStatus([{ qty: 2, shippedQty: 0 }]), 'In lavorazione');
  assert.equal(getCustomerOrderStatus([{ qty: 2, shippedQty: 1 }]), 'Parzialmente Evaso');
  assert.equal(getCustomerOrderStatus([{ qty: 2, shippedQty: 2 }]), 'Evaso');
});

test('costruisce ordine cliente e individua ordini ancora aperti', () => {
  const db = sampleDb();
  const order = buildCustomerOrder({
    id: 'o1',
    number: 'OC-1',
    date: '2026-04-24',
    customer: db.customers[0],
    lines: [{ productId: 'p1', productName: 'A001 - Articolo A', qty: 3, price: 10, shippedQty: 0 }]
  });
  db.customerOrders.push(order);
  assert.equal(order.total, 30);
  assert.equal(getOpenCustomerOrders(db).length, 1);
});

test('applica spedizione a ordine, crea DDT e segnala stock insufficiente', () => {
  const db = sampleDb();
  const order = buildCustomerOrder({
    id: 'o1', number: 'OC-1', date: '2026-04-24', customer: db.customers[0],
    lines: [{ productId: 'p2', productName: 'B002 - Articolo B', qty: 3, price: 20, shippedQty: 0 }]
  });
  const shipLines = [{ i: 0, qty: 2 }];
  assert.deepEqual(getShipmentStockWarnings(db, order, shipLines), [{ code: 'B002', available: 1, qty: 2 }]);
  applyShipmentToOrder(order, shipLines);
  assert.equal(order.status, 'Parzialmente Evaso');
  const ddt = buildCustomerDDT({ id: 'd1', number: 'DDT-1', date: '2026-04-24', order, shipLines, transportReason: 'Vendita' });
  assert.equal(ddt.lines[0].qty, 2);
});

test('rollback DDT ripristina quantità evasa e prepara variazioni stock', () => {
  const db = sampleDb();
  const order = buildCustomerOrder({
    id: 'o1', number: 'OC-1', date: '2026-04-24', customer: db.customers[0],
    lines: [{ productId: 'p1', productName: 'A001 - Articolo A', qty: 2, price: 10, shippedQty: 2 }]
  });
  order.status = 'Evaso';
  db.customerOrders.push(order);
  const ddt = { number: 'DDT-1', orderNumber: 'OC-1', lines: [{ productId: 'p1', description: 'A001 - Articolo A', qty: 2 }] };
  rollbackCustomerDDT(db, ddt);
  assert.equal(order.lines[0].shippedQty, 0);
  assert.equal(order.status, 'In lavorazione');
  assert.deepEqual(getDDTRestoreStockChanges(db, ddt), [{ productId: 'p1', delta: 2 }]);
});

test('costruisce fattura da DDT e consente rollback stato DDT', () => {
  const db = sampleDb();
  const ddts = [{ number: 'DDT-1', lines: [{ productId: 'p1', description: 'A001 - Articolo A', qty: 2, price: 10, iva: 22 }] }];
  db.customerDDTs = ddts;
  const lines = buildInvoiceLines(db, ddts);
  assert.deepEqual(calculateInvoiceTotals(lines), { subtotal: 20, ivaTotal: 4.4, total: 24.4 });
  const invoice = buildInvoice({ id: 'f1', number: 'FT-1', date: '2026-04-24', customer: db.customers[0], ddts, lines });
  db.invoices.push(invoice);
  markDDTsInvoiced(ddts, invoice.number);
  assert.equal(findLinkedInvoiceForDDT(db, 'DDT-1').number, 'FT-1');
  rollbackInvoiceDDTState(db, invoice);
  assert.equal(ddts[0].status, 'Da Fatturare');
  assert.equal('invoiceNumber' in ddts[0], false);
});
