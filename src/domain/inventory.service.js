import { App } from '../core/app.js';
import {
  applyQuarantineBatch,
  applyStockBatch,
  buildNegativeStockMessage,
  normalizeInventoryChanges,
  validateQuarantineBatch,
  validateStockBatch
} from './inventory.rules.js';

function emitInventoryChanged(changes, meta = {}) {
  App.events.emit('inventory:changed', { changes, meta });
}

/**
 * Applica una lista di variazioni stock usando regole pure testabili e una
 * sola mutazione applicativa su cache/Firestore.
 */
export function adjustStockBatch(changes, meta = {}) {
  const db = App.db.ensure();
  const validation = validateStockBatch(db, changes);

  if (validation.negatives.length && validation.allowNegativeStock) {
    const ok = window.confirm(buildNegativeStockMessage(validation.negatives));
    if (!ok) throw new Error('Operazione annullata.');
  }

  const applied = App.db.mutate('inventory:adjust-stock', currentDb => applyStockBatch(currentDb, changes));
  emitInventoryChanged(applied, meta);
  return applied;
}

export function adjustStock(productId, delta, meta = {}) {
  return adjustStockBatch([{ productId, delta }], meta);
}

export function adjustQuarantineBatch(changes, meta = {}) {
  const db = App.db.ensure();
  validateQuarantineBatch(db, changes);
  const applied = App.db.mutate('inventory:adjust-quarantine', currentDb => applyQuarantineBatch(currentDb, changes));
  emitInventoryChanged(applied, { ...meta, bucket: 'quarantine' });
  return applied;
}

export function adjustQuarantine(productId, delta, meta = {}) {
  return adjustQuarantineBatch([{ productId, delta }], meta);
}

export { normalizeInventoryChanges };
