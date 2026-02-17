/**
 * DB schema iniziale (localStorage).
 * Mantieni qui la "fonte di verità" della struttura dati.
 */
export function createInitialDb() {
  return {
    company: { name: 'Gestionale OL' },
    users: [],
    customers: [],
    suppliers: [],
    products: [],
    customerOrders: [],
    supplierOrders: [],
    customerDDTs: [],
    supplierDDTs: [],
    invoices: [],
    notes: {}, // { userId: "...": "testo" }
    counters: {
      orderCustomer: 0,
      orderSupplier: 0,
      ddtCustomer: 0,
      ddtSupplier: 0,
      invoice: 0
    }
  };
}

/**
 * Normalizza un DB caricato (da localStorage / Firestore / import) assicurando
 * che tutte le chiavi e i tipi attesi esistano.
 *
 * Obiettivo: evitare crash quando il DB proviene da versioni precedenti
 * (es. mancano counters, notes, ecc.).
 */
export function normalizeDb(input) {
  const base = createInitialDb();
  const db = (input && typeof input === 'object') ? input : {};

  // Oggetti
  if (!db.company || typeof db.company !== 'object' || Array.isArray(db.company)) db.company = {};
  for (const [k, v] of Object.entries(base.company)) {
    if (db.company[k] === undefined) db.company[k] = v;
  }

  if (!db.notes || typeof db.notes !== 'object' || Array.isArray(db.notes)) db.notes = {};

  if (!db.counters || typeof db.counters !== 'object' || Array.isArray(db.counters)) db.counters = {};
  for (const [k, v] of Object.entries(base.counters)) {
    if (db.counters[k] === undefined) db.counters[k] = v;
  }

  // Array collections
  const arrKeys = [
    'users',
    'customers',
    'suppliers',
    'products',
    'customerOrders',
    'supplierOrders',
    'customerDDTs',
    'supplierDDTs',
    'invoices'
  ];
  for (const k of arrKeys) {
    if (!Array.isArray(db[k])) db[k] = [];
  }

  // Remove null-ish accidental values (best effort)
  for (const k of Object.keys(base)) {
    if (db[k] == null) db[k] = base[k];
  }

  // ===== Backwards compatibility / denormalization =====
  // I backup legacy non includono spesso campi "denormalizzati" come customerName/supplierName
  // e possono usare productName al posto di description (o viceversa).
  // Qui arricchiamo i documenti in memoria per evitare "undefined" in UI/PDF.
  try {
    const custById = new Map((db.customers || []).map(c => [String(c.id), c]));
    const supById = new Map((db.suppliers || []).map(s => [String(s.id), s]));

    const fixLines = (lines) => {
      if (!Array.isArray(lines)) return;
      for (const l of lines) {
        if (l && l.description == null && l.productName != null) l.description = l.productName;
        if (l && l.productName == null && l.description != null) l.productName = l.description;
      }
    };

    for (const o of (db.customerOrders || [])) {
      if (o && (o.customerName == null || o.customerName === '')) {
        const c = custById.get(String(o.customerId));
        if (c?.name) o.customerName = c.name;
      }
      fixLines(o?.lines);
    }
    for (const o of (db.supplierOrders || [])) {
      if (o && (o.supplierName == null || o.supplierName === '')) {
        const s = supById.get(String(o.supplierId));
        if (s?.name) o.supplierName = s.name;
      }
      fixLines(o?.lines);
    }

    for (const d of (db.customerDDTs || [])) {
      if (d && (d.customerName == null || d.customerName === '')) {
        const c = custById.get(String(d.customerId));
        if (c?.name) d.customerName = c.name;
      }
      fixLines(d?.lines);
    }
    for (const d of (db.supplierDDTs || [])) {
      if (d && (d.supplierName == null || d.supplierName === '')) {
        const s = supById.get(String(d.supplierId));
        if (s?.name) d.supplierName = s.name;
      }
      fixLines(d?.lines);
    }

    for (const inv of (db.invoices || [])) {
      if (inv && (inv.customerName == null || inv.customerName === '')) {
        const c = custById.get(String(inv.customerId));
        if (c?.name) inv.customerName = c.name;
      }
      fixLines(inv?.lines);
    }
  } catch {
    // best effort: non blocchiamo la UI
  }

  return db;
}
