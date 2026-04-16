export const utils = {
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  fmtMoney(n) {
    const v = (typeof n === 'number') ? n : parseFloat(n || 0);
    const num = Number.isFinite(v) ? v : 0;
    return '€ ' + num.toFixed(2).replace('.', ',');
  },
  _ensureCounters(db) {
    if (!db || typeof db !== 'object') throw new Error('DB non valido');
    if (!db.counters || typeof db.counters !== 'object' || Array.isArray(db.counters)) db.counters = {};
    return db.counters;
  },


  // === Numeratori ===
  _maxByPatterns(items, preferredPatterns = [], fallbackPatterns = []) {
    const read = (patterns) => {
      let max = 0;
      for (const it of (items || [])) {
        const value = String(it?.number || '').trim();
        for (const rx of patterns) {
          const m = value.match(rx);
          if (m) {
            max = Math.max(max, Number(m[1] || 0));
            break;
          }
        }
      }
      return max;
    };
    const preferred = read(preferredPatterns);
    if (preferred > 0) return preferred;
    return read(fallbackPatterns);
  },

  _nextDocNumber(db, counterKey, items, preferredPatterns, fallbackPatterns, prefix) {
    const c = this._ensureCounters(db);
    const currentCounter = Number(c[counterKey] || 0);
    const maxExisting = this._maxByPatterns(items, preferredPatterns, fallbackPatterns);
    const next = Math.max(currentCounter, maxExisting) + 1;
    c[counterKey] = next;
    return prefix + String(next).padStart(4, '0');
  },

  _peekDocNumber(db, counterKey, items, preferredPatterns, fallbackPatterns, prefix) {
    const c = this._ensureCounters(db);
    const currentCounter = Number(c[counterKey] || 0);
    const maxExisting = this._maxByPatterns(items, preferredPatterns, fallbackPatterns);
    const next = Math.max(currentCounter, maxExisting) + 1;
    return prefix + String(next).padStart(4, '0');
  },

  peekCustomerOrderNumber(db) {
    return this._peekDocNumber(
      db,
      'orderCustomer',
      db?.customerOrders || [],
      [/^OC-(\d+)$/i],
      [/^ORD-C-(\d+)$/i],
      'OC-'
    );
  },
  nextCustomerOrderNumber(db) {
    return this._nextDocNumber(
      db,
      'orderCustomer',
      db?.customerOrders || [],
      [/^OC-(\d+)$/i],
      [/^ORD-C-(\d+)$/i],
      'OC-'
    );
  },
  peekSupplierOrderNumber(db) {
    return this._peekDocNumber(
      db,
      'orderSupplier',
      db?.supplierOrders || [],
      [/^OF-(\d+)$/i],
      [/^ORD-F-(\d+)$/i],
      'OF-'
    );
  },
  nextSupplierOrderNumber(db) {
    return this._nextDocNumber(
      db,
      'orderSupplier',
      db?.supplierOrders || [],
      [/^OF-(\d+)$/i],
      [/^ORD-F-(\d+)$/i],
      'OF-'
    );
  },
  nextCustomerDDTNumber(db) {
    const c = this._ensureCounters(db);
    c.ddtCustomer = (c.ddtCustomer || 0) + 1;
    const y = new Date().getFullYear();
    return `DDT-${y}-${String(c.ddtCustomer).padStart(4,'0')}`;
  },
  nextSupplierDDTNumber(db) {
    const c = this._ensureCounters(db);
    c.ddtSupplier = (c.ddtSupplier || 0) + 1;
    const y = new Date().getFullYear();
    return `R-DDT-${y}-${String(c.ddtSupplier).padStart(4,'0')}`;
  },
  nextInvoiceNumber(db) {
    const c = this._ensureCounters(db);
    c.invoice = (c.invoice || 0) + 1;
    const y = new Date().getFullYear();
    return `F-${y}-${String(c.invoice).padStart(4,'0')}`;
  }
};
