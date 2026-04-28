import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNoCustomerUsage,
  assertNoProductUsage,
  assertNoSupplierUsage,
  customerUsage,
  productUsage,
  supplierUsage
} from '../src/domain/referentialIntegrity.service.js';

test('rileva uso prodotto in documenti clienti, fornitori e quarantena', () => {
  const db = {
    customerOrders: [{ lines: [{ productId: 'p1' }] }],
    customerDDTs: [{ lines: [{ productId: 'p1' }] }],
    invoices: [{ lines: [{ productId: 'p1' }] }],
    supplierOrders: [{ lines: [{ productId: 'p1' }] }],
    supplierDDTs: [{ lines: [{ productId: 'p1' }] }],
    supplierQuarantine: [{ productId: 'p1' }],
    supplierReturnDDTs: [{ lines: [{ productId: 'p1' }] }]
  };
  assert.deepEqual(productUsage(db, 'p1'), [
    'ordini cliente', 'DDT cliente', 'fatture', 'ordini fornitore', 'DDT fornitore', 'quarantena fornitore', 'resi fornitore'
  ]);
  assert.throws(() => assertNoProductUsage(db, 'p1'), /Prodotto collegato/);
});

test('rileva uso cliente e fornitore', () => {
  const db = {
    customerOrders: [{ customerId: 'c1' }],
    customerDDTs: [{ customerId: 'c1' }],
    invoices: [{ customerId: 'c1' }],
    supplierOrders: [{ supplierId: 's1' }],
    supplierDDTs: [{ supplierId: 's1' }],
    supplierQuarantine: [{ supplierId: 's1' }],
    supplierReturnDDTs: [{ supplierId: 's1' }]
  };
  assert.deepEqual(customerUsage(db, 'c1'), ['ordini cliente', 'DDT cliente', 'fatture']);
  assert.deepEqual(supplierUsage(db, 's1'), ['ordini fornitore', 'DDT fornitore', 'quarantena fornitore', 'resi fornitore']);
  assert.throws(() => assertNoCustomerUsage(db, 'c1'), /Cliente collegato/);
  assert.throws(() => assertNoSupplierUsage(db, 's1'), /Fornitore collegato/);
});
