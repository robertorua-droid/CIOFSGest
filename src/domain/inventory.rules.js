function findProduct(db, productId) {
  return (db.products || []).find(p => p.id === productId);
}

export function normalizeInventoryChanges(changes = []) {
  const grouped = new Map();
  for (const c of changes || []) {
    if (!c?.productId) continue;
    const delta = Number(c.delta || 0);
    if (!Number.isFinite(delta) || delta === 0) continue;
    grouped.set(c.productId, (grouped.get(c.productId) || 0) + delta);
  }
  return Array.from(grouped.entries()).map(([productId, delta]) => ({ productId, delta }));
}

export function findStockNegatives(db, changes = []) {
  const grouped = normalizeInventoryChanges(changes);
  const negatives = [];
  for (const { productId, delta } of grouped) {
    const product = findProduct(db, productId);
    if (!product) throw new Error(`Prodotto non trovato (${productId})`);
    const current = Number(product.stockQty || 0);
    const newQty = current + delta;
    if (newQty < 0) negatives.push({ product, current, delta, newQty });
  }
  return negatives;
}

export function validateStockBatch(db, changes = [], { allowNegativeStock } = {}) {
  const negatives = findStockNegatives(db, changes);
  const allowNeg = allowNegativeStock ?? (db.settings?.allowNegativeStock !== false);
  if (negatives.length && !allowNeg) {
    const first = negatives[0];
    throw new Error(`Giacenza insufficiente per ${first.product.code} (disponibile: ${first.current})`);
  }
  return { changes: normalizeInventoryChanges(changes), negatives, allowNegativeStock: allowNeg };
}

export function buildNegativeStockMessage(negatives = []) {
  const lines = negatives.map(n => {
    const code = n.product.code || n.product.id;
    return `- ${code}: ${n.current} → ${n.newQty} (var: ${n.delta})`;
  }).join('\n');
  return `Attenzione: l'operazione porta la giacenza in negativo per uno o più prodotti.\n\n${lines}\n\nVuoi continuare?`;
}

export function applyStockBatch(db, changes = []) {
  const grouped = normalizeInventoryChanges(changes);
  for (const { productId, delta } of grouped) {
    const product = findProduct(db, productId);
    if (!product) throw new Error(`Prodotto non trovato (${productId})`);
    product.stockQty = Number(product.stockQty || 0) + delta;
  }
  return grouped;
}

export function validateQuarantineBatch(db, changes = []) {
  const grouped = normalizeInventoryChanges(changes);
  for (const { productId, delta } of grouped) {
    const product = findProduct(db, productId);
    if (!product) throw new Error(`Prodotto non trovato (${productId})`);
    const current = Number(product.quarantineQty || 0);
    const newQty = current + delta;
    if (newQty < 0) throw new Error(`Quantità in quarantena insufficiente per ${product.code}`);
  }
  return grouped;
}

export function applyQuarantineBatch(db, changes = []) {
  const grouped = validateQuarantineBatch(db, changes);
  for (const { productId, delta } of grouped) {
    const product = findProduct(db, productId);
    product.quarantineQty = Number(product.quarantineQty || 0) + delta;
  }
  return grouped;
}
