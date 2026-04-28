import test from 'node:test';
import assert from 'node:assert/strict';
import { getMaceratedProductRows, isMaceratedQuarantineRecord } from '../src/domain/macerated.service.js';

test('riconosce solo le chiusure quarantena da distruggere/macerare', () => {
  assert.equal(isMaceratedQuarantineRecord({ resolutionType: 'destroy', status: 'Da distruggere' }), true);
  assert.equal(isMaceratedQuarantineRecord({ status: 'Da distruggere' }), true);
  assert.equal(isMaceratedQuarantineRecord({ status: 'Resa al fornitore', resolutionType: 'return' }), false);
  assert.equal(isMaceratedQuarantineRecord({ status: 'Svincolata', resolutionType: 'release' }), false);
});

test('costruisce il registro prodotti macerati da supplierQuarantine senza nuova persistenza', () => {
  const rows = getMaceratedProductRows({
    products: [{ id: 'p1', code: 'ART-1', description: 'Articolo 1' }],
    suppliers: [{ id: 's1', name: 'Fornitore 1' }],
    supplierQuarantine: [
      {
        id: 'q1-h1',
        productId: 'p1',
        supplierId: 's1',
        qty: 3,
        status: 'Da distruggere',
        resolutionType: 'destroy',
        resolvedAt: '2026-04-28',
        ddtNumber: 'DDT-F-1',
        orderNumber: 'OF-1',
        note: 'Merce danneggiata'
      },
      { id: 'q1-h2', productId: 'p1', supplierId: 's1', qty: 2, status: 'Svincolata', resolutionType: 'release' }
    ]
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: 'q1-h1',
    date: '2026-04-28',
    productId: 'p1',
    productCode: 'ART-1',
    description: 'Articolo 1',
    supplierId: 's1',
    supplierName: 'Fornitore 1',
    qty: 3,
    sourceOrderNumber: 'OF-1',
    sourceDdtNumber: 'DDT-F-1',
    note: 'Merce danneggiata'
  });
});
