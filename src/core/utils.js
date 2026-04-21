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
  _maxMatchingNumber(values, patterns = []) {
    let max = 0;
    const arr = Array.isArray(values) ? values : [];
    for (const raw of arr) {
      const value = String(raw || '').trim();
      for (const re of patterns) {
        const m = value.match(re);
        if (!m) continue;
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
        break;
      }
    }
    return max;
  },
  _customerOrderIndex(db) {
    const c = this._ensureCounters(db);
    const existingMax = this._maxMatchingNumber(
      (db?.customerOrders || []).map(o => o?.number),
      [/^OC-(\d+)$/i, /^ORD-C-(\d+)$/i]
    );
    return Math.max(Number(c.orderCustomer || 0), existingMax);
  },
  _supplierOrderIndex(db) {
    const c = this._ensureCounters(db);
    const existingMax = this._maxMatchingNumber(
      (db?.supplierOrders || []).map(o => o?.number),
      [/^OF-(\d+)$/i, /^ORD-F-(\d+)$/i]
    );
    return Math.max(Number(c.orderSupplier || 0), existingMax);
  },
  previewCustomerOrderNumber(db) {
    const next = this._customerOrderIndex(db) + 1;
    return 'OC-' + String(next).padStart(4, '0');
  },
  previewSupplierOrderNumber(db) {
    const next = this._supplierOrderIndex(db) + 1;
    return 'OF-' + String(next).padStart(4, '0');
  },
  finalizeCustomerOrderNumber(db, preferredNumber) {
    const c = this._ensureCounters(db);
    const used = new Set((db?.customerOrders || []).map(o => String(o?.number || '').trim()));
    const preferred = String(preferredNumber || '').trim();
    const prefMatch = preferred.match(/^OC-(\d+)$/i) || preferred.match(/^ORD-C-(\d+)$/i);
    let n = this._customerOrderIndex(db);
    if (prefMatch) {
      const parsed = parseInt(prefMatch[1], 10);
      if (Number.isFinite(parsed) && parsed > n) n = parsed - 1;
    }
    let candidate;
    do {
      n += 1;
      candidate = 'OC-' + String(n).padStart(4, '0');
    } while (used.has(candidate));
    c.orderCustomer = n;
    return candidate;
  },
  finalizeSupplierOrderNumber(db, preferredNumber) {
    const c = this._ensureCounters(db);
    const used = new Set((db?.supplierOrders || []).map(o => String(o?.number || '').trim()));
    const preferred = String(preferredNumber || '').trim();
    const prefMatch = preferred.match(/^OF-(\d+)$/i) || preferred.match(/^ORD-F-(\d+)$/i);
    let n = this._supplierOrderIndex(db);
    if (prefMatch) {
      const parsed = parseInt(prefMatch[1], 10);
      if (Number.isFinite(parsed) && parsed > n) n = parsed - 1;
    }
    let candidate;
    do {
      n += 1;
      candidate = 'OF-' + String(n).padStart(4, '0');
    } while (used.has(candidate));
    c.orderSupplier = n;
    return candidate;
  },
  nextCustomerOrderNumber(db) {
    return this.finalizeCustomerOrderNumber(db);
  },
  nextSupplierOrderNumber(db) {
    return this.finalizeSupplierOrderNumber(db);
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
