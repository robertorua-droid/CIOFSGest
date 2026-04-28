import test from 'node:test';
import assert from 'node:assert/strict';
import { createMutationRunner } from '../src/core/dbMutation.js';

function makeHarness(initial = { products: [{ id: 'p1', stock: 1 }], meta: { revision: 1 } }) {
  let state = JSON.parse(JSON.stringify(initial));
  const events = [];
  const runner = createMutationRunner({
    ensure: () => state,
    save: draft => { state = JSON.parse(JSON.stringify(draft)); return state; },
    emit: (name, payload) => events.push({ name, payload })
  });
  return { runner, get state() { return state; }, events };
}

test('mutate salva solo il draft completato con successo', () => {
  const h = makeHarness();
  const result = h.runner('inventory:test', db => {
    db.products[0].stock += 4;
    return { stock: db.products[0].stock };
  });

  assert.deepEqual(result, { stock: 5 });
  assert.equal(h.state.products[0].stock, 5);
  assert.equal(h.events.at(-1).name, 'db:mutation');
});

test('mutate non sporca lo stato condiviso se l updater fallisce', () => {
  const h = makeHarness();
  assert.throws(() => {
    h.runner('inventory:fail', db => {
      db.products[0].stock = -99;
      throw new Error('errore simulato');
    });
  }, /errore simulato/);

  assert.equal(h.state.products[0].stock, 1);
  assert.equal(h.events.at(-1).name, 'db:mutation:error');
});

test('mutate blocca mutazioni annidate', () => {
  const h = makeHarness();
  assert.throws(() => {
    h.runner('outer', db => {
      db.products[0].stock += 1;
      h.runner('inner', nested => {
        nested.products[0].stock += 1;
      });
    });
  }, /annidata non consentita/);

  assert.equal(h.state.products[0].stock, 1);
});

test('mutate rifiuta updater asincroni', () => {
  const h = makeHarness();
  assert.throws(() => {
    h.runner('async', async () => true);
  }, /asincrona non supportata/);
});
