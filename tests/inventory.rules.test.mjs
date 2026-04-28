import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyQuarantineBatch,
  applyStockBatch,
  buildNegativeStockMessage,
  normalizeInventoryChanges,
  validateQuarantineBatch,
  validateStockBatch
} from '../src/domain/inventory.rules.js';

function db() {
  return { settings: { allowNegativeStock: false }, products: [
    { id: 'p1', code: 'A1', stockQty: 10, quarantineQty: 2 },
    { id: 'p2', code: 'B2', stockQty: 0, quarantineQty: 0 }
  ] };
}

test('normalizza e raggruppa le variazioni inventario', () => {
  assert.deepEqual(normalizeInventoryChanges([
    { productId: 'p1', delta: 2 },
    { productId: 'p1', delta: -1 },
    { productId: 'p2', delta: 0 },
    { productId: '', delta: 4 }
  ]), [{ productId: 'p1', delta: 1 }]);
});

test('blocca stock negativo quando non consentito', () => {
  assert.throws(() => validateStockBatch(db(), [{ productId: 'p1', delta: -11 }]), /Giacenza insufficiente/);
});

test('applica batch stock valido', () => {
  const state = db();
  const applied = applyStockBatch(state, [{ productId: 'p1', delta: -3 }, { productId: 'p2', delta: 5 }]);
  assert.deepEqual(applied, [{ productId: 'p1', delta: -3 }, { productId: 'p2', delta: 5 }]);
  assert.equal(state.products[0].stockQty, 7);
  assert.equal(state.products[1].stockQty, 5);
});

test('valida e applica quarantena', () => {
  const state = db();
  assert.throws(() => validateQuarantineBatch(state, [{ productId: 'p1', delta: -3 }]), /quarantena insufficiente/);
  applyQuarantineBatch(state, [{ productId: 'p1', delta: -1 }]);
  assert.equal(state.products[0].quarantineQty, 1);
});

test('messaggio stock negativo contiene codici e quantità', () => {
  const state = db();
  const validation = validateStockBatch(state, [{ productId: 'p1', delta: -15 }], { allowNegativeStock: true });
  const message = buildNegativeStockMessage(validation.negatives);
  assert.match(message, /A1/);
  assert.match(message, /10/);
  assert.match(message, /-5/);
});
