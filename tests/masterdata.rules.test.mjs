import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteCustomerRecord,
  deleteProductRecord,
  deleteSupplierRecord,
  upsertCustomerRecord,
  upsertProductRecord,
  upsertSupplierRecord
} from '../src/domain/masterdata.rules.js';

const ids = () => 'new-id';

test('crea e aggiorna cliente', () => {
  const db = { customers: [] };
  const created = upsertCustomerRecord(db, { name: 'Cliente A' }, ids);
  assert.equal(created.id, 'new-id');
  const updated = upsertCustomerRecord(db, { id: 'new-id', name: 'Cliente B', piva: '123' }, ids);
  assert.equal(db.customers.length, 1);
  assert.equal(updated.name, 'Cliente B');
  assert.equal(deleteCustomerRecord(db, 'new-id'), true);
  assert.equal(deleteCustomerRecord(db, 'missing'), false);
});

test('crea e aggiorna fornitore', () => {
  const db = { suppliers: [] };
  upsertSupplierRecord(db, { name: 'Fornitore A' }, ids);
  upsertSupplierRecord(db, { id: 'new-id', name: 'Fornitore B' }, ids);
  assert.equal(db.suppliers.length, 1);
  assert.equal(db.suppliers[0].name, 'Fornitore B');
  assert.equal(deleteSupplierRecord(db, 'new-id'), true);
});

test('preserva stock e quarantena prodotto se non forniti', () => {
  const db = { products: [{ id: 'p1', code: 'A', description: 'Old', stockQty: 9, quarantineQty: 3 }] };
  const payload = upsertProductRecord(db, { id: 'p1', code: 'A2', description: 'New', purchasePrice: '1.5', salePrice: '3', iva: '22' }, ids);
  assert.equal(payload.stockQty, 9);
  assert.equal(payload.quarantineQty, 3);
  assert.equal(payload.purchasePrice, 1.5);
  assert.equal(deleteProductRecord(db, 'p1'), true);
});
