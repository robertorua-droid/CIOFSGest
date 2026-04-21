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
  const allowNeg = (db.settings?.allowNegativeStock !== false);
  const negatives = [];

  for (const [productId, delta] of grouped.entries()) {
    const p = findProduct(db, productId);
    if (!p) throw new Error(`Prodotto non trovato (${productId})`);
    const current = (p.stockQty || 0);
    const newQty = current + delta;
    if (newQty < 0) {
      negatives.push({ p, current, delta, newQty });
    }
  }

  if (negatives.length) {
    if (!allowNeg) {
      const first = negatives[0];
      throw new Error(`Giacenza insufficiente per ${first.p.code} (disponibile: ${first.current})`);
    }

    const lines = negatives.map(n => {
      const code = n.p.code || n.p.id;
      return `- ${code}: ${n.current} → ${n.newQty} (var: ${n.delta})`;
    }).join('\n');

    const ok = window.confirm(
      `Attenzione: l'operazione porta la giacenza in negativo per uno o più prodotti.\n\n${lines}\n\nVuoi continuare?`
    );
    if (!ok) throw new Error('Operazione annullata.');
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


export function adjustQuarantineBatch(changes, meta = {}) {
  const db = App.db.ensure();
  const grouped = new Map();
  for (const c of changes) {
    if (!c?.productId) continue;
    const d = Number(c.delta || 0);
    if (!Number.isFinite(d) || d === 0) continue;
    grouped.set(c.productId, (grouped.get(c.productId) || 0) + d);
  }
  for (const [productId, delta] of grouped.entries()) {
    const p = findProduct(db, productId);
    if (!p) throw new Error(`Prodotto non trovato (${productId})`);
    const current = Number(p.quarantineQty || 0);
    const newQty = current + delta;
    if (newQty < 0) throw new Error(`Quantità in quarantena insufficiente per ${p.code}`);
  }
  for (const [productId, delta] of grouped.entries()) {
    const p = findProduct(db, productId);
    p.quarantineQty = Number(p.quarantineQty || 0) + delta;
  }
  App.db.save(db);
  App.events.emit('inventory:changed', { changes: Array.from(grouped.entries()).map(([productId, delta]) => ({ productId, delta })), meta: { ...meta, bucket: 'quarantine' } });
}

export function adjustQuarantine(productId, delta, meta = {}) {
  return adjustQuarantineBatch([{ productId, delta }], meta);
}
