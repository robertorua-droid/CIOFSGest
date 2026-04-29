import { App } from '../core/app.js';
import {
  deleteCustomerRecord,
  deleteProductRecord,
  deleteSupplierRecord,
  upsertCustomerRecord,
  upsertProductRecord,
  upsertSupplierRecord
} from './masterdata.rules.js';

function uuid() {
  return App.utils.uuid();
}

export const masterdata = {
  // ===== Customers =====
  upsertCustomer(customer) {
    const payload = App.db.mutate('masterdata:upsert-customer', db => upsertCustomerRecord(db, customer, uuid));
    App.events.emit('customers:changed', App.db.ensure().customers || []);
    return payload;
  },

  deleteCustomer(id) {
    const deleted = App.db.mutate('masterdata:delete-customer', db => deleteCustomerRecord(db, id));
    if (deleted) App.events.emit('customers:changed', App.db.ensure().customers || []);
    return deleted;
  },

  // ===== Suppliers =====
  upsertSupplier(supplier) {
    const payload = App.db.mutate('masterdata:upsert-supplier', db => upsertSupplierRecord(db, supplier, uuid));
    App.events.emit('suppliers:changed', App.db.ensure().suppliers || []);
    return payload;
  },

  deleteSupplier(id) {
    const deleted = App.db.mutate('masterdata:delete-supplier', db => deleteSupplierRecord(db, id));
    if (deleted) App.events.emit('suppliers:changed', App.db.ensure().suppliers || []);
    return deleted;
  },

  // ===== Products =====
  upsertProduct(product) {
    const payload = App.db.mutate('masterdata:upsert-product', db => upsertProductRecord(db, product, uuid));
    App.events.emit('products:changed', App.db.ensure().products || []);
    return payload;
  },

  deleteProduct(id) {
    const deleted = App.db.mutate('masterdata:delete-product', db => deleteProductRecord(db, id));
    if (deleted) App.events.emit('products:changed', App.db.ensure().products || []);
    return deleted;
  }
};
