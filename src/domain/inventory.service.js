import { App } from '../core/app.js';

function findProduct(db, productId) {
  return (db.products || []).find(p => p.id === productId);
}

/**
 * Applica una lista di variazioni (delta) di stock.
 * - Valida prima tutte le righe
 * - Applica poi tutte le variazioni (atomico per quanto possibile sul DB locale)
 *
 * @param {{productId:string, delta:number}[]} changes
 * @param {{reason?:string, ref?:string}} meta
 */
export function adjustStockBatch(changes, meta = {}) {
  const db = App.db.ensure();
  const grouped = new Map();

  for (const c of changes) {
    if (!c?.productId) continue;
    const d = Number(c.delta || 0);
    if (!Number.isFinite(d) || d === 0) continue;
    grouped.set(c.productId, (grouped.get(c.productId) || 0) + d);
  }

  // validate
  for (const [productId, delta] of grouped.entries()) {
    const p = findProduct(db, productId);
    if (!p) throw new Error(`Prodotto non trovato (${productId})`);
    const newQty = (p.stockQty || 0) + delta;
    if (newQty < 0) {
      throw new Error(`Giacenza insufficiente per ${p.code} (disponibile: ${p.stockQty || 0})`);
    }
  }

  // apply
  for (const [productId, delta] of grouped.entries()) {
    const p = findProduct(db, productId);
    p.stockQty = (p.stockQty || 0) + delta;
  }

  App.db.save(db);
  App.events.emit('inventory:changed', { changes: Array.from(grouped.entries()).map(([productId, delta]) => ({ productId, delta })), meta });
}

export function adjustStock(productId, delta, meta = {}) {
  return adjustStockBatch([{ productId, delta }], meta);
}
