import { App } from '../core/app.js';

export const masterdata = {
  // ===== Customers =====
  upsertCustomer(customer) {
    const db = App.db.ensure();
    db.customers = db.customers || [];
    const id = customer.id || App.utils.uuid();
    const payload = { id, name: customer.name, piva: customer.piva || '', address: customer.address || '' };
    const idx = db.customers.findIndex(c => c.id === id);
    if (idx >= 0) db.customers[idx] = payload;
    else db.customers.push(payload);
    App.db.save(db);
    App.events.emit('customers:changed', db.customers);
    return payload;
  },
  deleteCustomer(id) {
    const db = App.db.ensure();
    const idx = (db.customers || []).findIndex(c => c.id === id);
    if (idx >= 0) {
      db.customers.splice(idx, 1);
      App.db.save(db);
      App.events.emit('customers:changed', db.customers);
      return true;
    }
    return false;
  },

  // ===== Suppliers =====
  upsertSupplier(supplier) {
    const db = App.db.ensure();
    db.suppliers = db.suppliers || [];
    const id = supplier.id || App.utils.uuid();
    const payload = { id, name: supplier.name, piva: supplier.piva || '', address: supplier.address || '' };
    const idx = db.suppliers.findIndex(s => s.id === id);
    if (idx >= 0) db.suppliers[idx] = payload;
    else db.suppliers.push(payload);
    App.db.save(db);
    App.events.emit('suppliers:changed', db.suppliers);
    return payload;
  },
  deleteSupplier(id) {
    const db = App.db.ensure();
    const idx = (db.suppliers || []).findIndex(s => s.id === id);
    if (idx >= 0) {
      db.suppliers.splice(idx, 1);
      App.db.save(db);
      App.events.emit('suppliers:changed', db.suppliers);
      return true;
    }
    return false;
  },

  // ===== Products =====
  upsertProduct(product) {
    const db = App.db.ensure();
    db.products = db.products || [];
    const id = product.id || App.utils.uuid();

    // preserva giacenza se il prodotto esiste già
    const prev = db.products.find(p => p.id === id);
    const stockQty = typeof product.stockQty === 'number'
      ? product.stockQty
      : (prev?.stockQty || 0);

    const payload = {
      id,
      description: product.description,
      code: product.code,
      purchasePrice: Number(product.purchasePrice || 0),
      salePrice: Number(product.salePrice || 0),
      iva: Number.parseInt(product.iva || 22, 10),
      locCorsia: product.locCorsia || '',
      locScaffale: product.locScaffale || '',
      locPiano: product.locPiano || '',
      stockQty
    };

    const idx = db.products.findIndex(p => p.id === id);
    if (idx >= 0) db.products[idx] = payload;
    else db.products.push(payload);

    App.db.save(db);
    App.events.emit('products:changed', db.products);
    return payload;
  },

  deleteProduct(id) {
    const db = App.db.ensure();
    const idx = (db.products || []).findIndex(p => p.id === id);
    if (idx >= 0) {
      db.products.splice(idx, 1);
      App.db.save(db);
      App.events.emit('products:changed', db.products);
      return true;
    }
    return false;
  }
};
