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

  return db;
}
