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
  nextCustomerOrderNumber(db) {
    const c = this._ensureCounters(db);
    c.orderCustomer = (c.orderCustomer || 0) + 1;
    return 'OC-' + String(c.orderCustomer).padStart(4, '0');
  },
  nextSupplierOrderNumber(db) {
    const c = this._ensureCounters(db);
    c.orderSupplier = (c.orderSupplier || 0) + 1;
    return 'OF-' + String(c.orderSupplier).padStart(4, '0');
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
