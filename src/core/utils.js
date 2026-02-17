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

  // === Numeratori ===
  nextCustomerOrderNumber(db) {
    db.counters.orderCustomer = (db.counters.orderCustomer || 0) + 1;
    return 'OC-' + String(db.counters.orderCustomer).padStart(4, '0');
  },
  nextSupplierOrderNumber(db) {
    db.counters.orderSupplier = (db.counters.orderSupplier || 0) + 1;
    return 'OF-' + String(db.counters.orderSupplier).padStart(4, '0');
  },
  nextCustomerDDTNumber(db) {
    db.counters.ddtCustomer = (db.counters.ddtCustomer || 0) + 1;
    const y = new Date().getFullYear();
    return `DDT-${y}-${String(db.counters.ddtCustomer).padStart(4,'0')}`;
  },
  nextSupplierDDTNumber(db) {
    db.counters.ddtSupplier = (db.counters.ddtSupplier || 0) + 1;
    const y = new Date().getFullYear();
    return `R-DDT-${y}-${String(db.counters.ddtSupplier).padStart(4,'0')}`;
  },
  nextInvoiceNumber(db) {
    db.counters.invoice = (db.counters.invoice || 0) + 1;
    const y = new Date().getFullYear();
    return `F-${y}-${String(db.counters.invoice).padStart(4,'0')}`;
  }
};
