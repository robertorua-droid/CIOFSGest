import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMovementStats,
  buildSalesStats,
  buildSupplierQualityStats,
  lineAcceptedQty,
  lineRefusedQty,
  lineReserveQty,
  monthKey,
  percentText
} from '../src/domain/stats.service.js';

test('calcola quantità riga DDT fornitore per formati nuovi e legacy', () => {
  assert.equal(lineAcceptedQty({ acceptedQty: 2, reserveQty: 1, refusedQty: 0 }), 2);
  assert.equal(lineReserveQty({ acceptedQty: 2, reserveQty: 1, refusedQty: 0 }), 1);
  assert.equal(lineRefusedQty({ acceptedQty: 0, reserveQty: 0, refusedQty: 3 }), 3);
  assert.equal(lineAcceptedQty({ qty: 4 }, { refused: false, withReserve: false }), 4);
  assert.equal(lineReserveQty({ qty: 4 }, { withReserve: true }), 4);
  assert.equal(lineRefusedQty({ qty: 4 }, { refused: true }), 4);
});

test('buildMovementStats aggrega top entrate e uscite', () => {
  const stats = buildMovementStats({
    supplierDDTs: [
      { lines: [{ productId: 'p1', acceptedQty: 3, reserveQty: 1, refusedQty: 0 }, { productId: 'p2', qty: 2 }] }
    ],
    customerDDTs: [
      { lines: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 5 }] }
    ]
  });
  assert.deepEqual(stats.inboundTop, [['p1', 4], ['p2', 2]]);
  assert.deepEqual(stats.outboundTop, [['p2', 5], ['p1', 2]]);
});

test('buildSalesStats raggruppa per mese e cliente', () => {
  assert.equal(monthKey('2026-04-24'), '2026-04');
  const stats = buildSalesStats({ customerOrders: [
    { date: '2026-04-01', customerName: 'A', total: 10 },
    { date: '2026-04-20', customerName: 'B', total: 20 },
    { date: '2026-05-01', customerName: 'A', total: 5 }
  ] });
  assert.deepEqual(stats.months, ['2026-04', '2026-05']);
  assert.deepEqual(stats.monthlyValues, [30, 5]);
  assert.deepEqual(stats.customers, ['A', 'B']);
  assert.deepEqual(stats.customerValues, [15, 20]);
});

test('buildSupplierQualityStats calcola percentuali e righe qualità', () => {
  assert.equal(percentText(1, 4), '25.0%');
  assert.equal(percentText(1, 0), '0%');
  const stats = buildSupplierQualityStats({
    supplierOrders: [{ id: 'o1' }, { id: 'o2' }],
    supplierDDTs: [
      { orderNumber: 'OF-1', number: 'DF-1', supplierName: 'Zeta', date: '2026-04-24', lines: [{ description: 'A', refusedQty: 2, lineNotes: 'rotto' }] },
      { orderNumber: 'OF-2', number: 'DF-2', supplierName: 'Alfa', date: '2026-04-24', lines: [{ description: 'B', reserveQty: 1 }] }
    ]
  });
  assert.equal(stats.rejectedPercent, '50.0%');
  assert.equal(stats.reservePercent, '50.0%');
  assert.equal(stats.rejectedRows[0].qty, 2);
  assert.equal(stats.reserveRows[0].supplierName, 'Alfa');
});
