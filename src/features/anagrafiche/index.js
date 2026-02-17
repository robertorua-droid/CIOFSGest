import { App } from '../../core/app.js';
import { initCustomersUI } from './customers.ui.js';
import { initSuppliersUI } from './suppliers.ui.js';
import { initProductsUI } from './products.ui.js';

export function initAnagraficheFeature() {
  App.events.on('logged-in', () => {
    initCustomersUI();
    initSuppliersUI();
    initProductsUI();
  });
}
