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
    notes: {},   // { userId: "..." : "text" }
    counters: { orderCustomer: 0, orderSupplier: 0, ddtCustomer: 0, ddtSupplier: 0, invoice: 0 }
  };
}
