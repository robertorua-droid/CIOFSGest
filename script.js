/* Gestionale Magazzino Didattico – Versione OL
 * JS principale
 * - Persistenza: LocalStorage (chiave: 'gestionale_ol_db')
 * - Librerie: jQuery, Bootstrap 5, Chart.js, jsPDF
 */

(function() {
  'use strict';

  const DB_KEY = 'gestionale_ol_db';
  const VERSION = 'OL 0.15.12';
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xwpagyqy';

  // Stato runtime
  let db = null;
  let currentUser = null;
  let isSetupMode = false; // attivo solo se login con admin/gestionale ed è l'unico utente

  // --- Utility ---
  function loadDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try { db = JSON.parse(raw); }
      catch(e) { console.error('DB corrotto, ripristino struttura vuota', e); db = freshDB(); saveDB(); }
    } else {
      db = freshDB();
      saveDB();
    }
    // Se non ci sono utenti, crea admin/gestionale
    if (!db.users || db.users.length === 0) {
      db.users = [{ id: 1, surname: 'admin', name: 'Amministratore', password: 'gestionale', role: 'Admin' }];
      saveDB();
    }
  }

  function freshDB() {
    return {
      companyInfo: { name: '', address: '', city: '', zip: '', province: '' },
      products: [],
      customers: [],
      suppliers: [],
      customerOrders: [],
      customerDdts: [],
      supplierOrders: [],
      supplierDdts: [],
      invoices: [],
      users: [],
      notes: []
    };
  }

  function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  function fmtCurrency(n) { return '€ ' + (Number(n || 0)).toFixed(2); }

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function nextSequential(prefix, list, field) {
    let max = 0;
    (list || []).forEach(x => {
      const num = String(x[field] || '').replace(prefix+'-','').replace(prefix,'');
      const v = parseInt(num,10);
      if(!isNaN(v)) max = Math.max(max, v);
    });
    return `${prefix}-${max+1}`;
  }

  function showToast(message, type='info', delay=3000) {
    const container = document.querySelector('.toast-container');
    const id = 't'+Date.now();
    // Bootstrap 5 toast markup
    const bg = ({
      success: 'text-bg-success',
      danger: 'text-bg-danger',
      warning: 'text-bg-warning',
      info: 'text-bg-info'
    })[type] || 'text-bg-secondary';

    const html = `
      <div id="${id}" class="toast align-items-center ${bg} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`;
    container.insertAdjacentHTML('beforeend', html);
    const toastEl = document.getElementById(id);
    const toast = new bootstrap.Toast(toastEl, { delay });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  }

  function findCustomerName(id) {
    const c = db.customers.find(x => String(x.id) === String(id));
    return c ? c.name : '';
  }
  function findSupplierName(id) {
    const s = db.suppliers.find(x => String(x.id) === String(id));
    return s ? s.name : '';
  }
  function findProduct(id) {
    return db.products.find(x => String(x.id) === String(id));
  }

  // --- Login ---
  function setupLoginPrefillIfNeeded() {
    // Se l'unico utente è admin/gestionale => precompila i campi
    if (db.users.length === 1 && db.users[0].surname === 'admin' && db.users[0].password === 'gestionale') {
      $('#username').val('admin');
      $('#password').val('gestionale');
    }
  }

  function handleLoginSubmit(ev) {
    ev.preventDefault();
    const u = $('#username').val().trim();
    const p = $('#password').val().trim();
    const user = db.users.find(x => x.surname === u && x.password === p);
    if (!user) {
      $('#error-message').removeClass('d-none');
      return;
    }
    currentUser = user;
    // setup mode: se esiste solo admin/gestionale
    isSetupMode = (db.users.length === 1 && user.surname === 'admin' && user.password === 'gestionale');
    $('#login-container').addClass('d-none');
    $('#main-app').removeClass('d-none');
    $('#user-name-sidebar').text(`${user.name} ${user.surname} • ${user.role}`);
    $('#version-sidebar').text(VERSION);
    $('#company-name-sidebar').text(db.companyInfo.name || 'Gestionale OL');
    buildMenuVisibility();
    renderAll();
    startClock();
    buildCalendar(new Date());
    loadUserNotes();
    showSection('home');
    showToast(isSetupMode ? 'Modalità di prima configurazione attiva' : 'Accesso eseguito', 'success');
  }

  function buildMenuVisibility() {
    // Nascondi tutto tranne le voci consentite in setup mode
    const allowedInSetup = new Set(['menu-anagrafica-azienda','menu-anagrafica-utenti','menu-avanzate']);
    if (isSetupMode) {
      document.querySelectorAll('.sidebar .menu-item').forEach(el => {
        if (allowedInSetup.has(el.id)) el.classList.remove('d-none');
        else el.classList.add('d-none');
      });
    } else {
      // mostra tutto di default
      document.querySelectorAll('.sidebar .menu-item').forEach(el => el.classList.remove('d-none'));
      // Applica restrizioni di ruolo basilari (User meno privilegi)
      if (currentUser.role === 'User') {
        // User: nasconde creazione documenti, anagrafica utenti/azienda
        const hideIds = [
          'menu-nuovo-ordine-cliente','menu-nuovo-ddt-cliente','menu-fatturazione',
          'menu-nuovo-ordine-fornitore','menu-nuovo-ddt-fornitore',
          'menu-anagrafica-utenti','menu-anagrafica-azienda'
        ];
        hideIds.forEach(id => document.getElementById(id)?.classList.add('d-none'));
      }
    }
  }

  function logout() {
    currentUser = null;
    isSetupMode = false;
    $('#main-app').addClass('d-none');
    $('#login-container').removeClass('d-none');
    $('#login-form')[0].reset();
    setupLoginPrefillIfNeeded();
  }

  // --- Clock & Calendar ---
  let clockTimer = null;
  function startClock() {
    function tick() {
      $('#current-datetime').text(new Date().toLocaleString('it-IT'));
    }
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  function buildCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month+1, 0);
    const table = [];
    table.push('<table class="table table-sm"><thead><tr><th colspan="7">'+date.toLocaleString('it-IT',{month:'long',year:'numeric'})+'</th></tr>');
    table.push('<tr><th>Lu</th><th>Ma</th><th>Me</th><th>Gi</th><th>Ve</th><th>Sa</th><th>Do</th></tr></thead><tbody>');
    let day = 1;
    const start = (firstDay.getDay()+6)%7; // Monday=0
    for (let r=0;r<6;r++) {
      table.push('<tr>');
      for (let c=0;c<7;c++) {
        const idx = r*7+c;
        if (idx<start || day>lastDay.getDate()) { table.push('<td></td>'); }
        else {
          const cls = (day===new Date().getDate() && month===new Date().getMonth() && year===new Date().getFullYear())?'today':'';
          table.push('<td class="'+cls+'">'+day+'</td>'); day++;
        }
      }
      table.push('</tr>');
    }
    table.push('</tbody></table>');
    $('#calendar-widget').html(table.join(''));
  }

  // --- Notes ---
  function loadUserNotes() {
    const rec = db.notes.find(n => n.userId === currentUser.id);
    $('#notes-textarea').val(rec ? rec.text : '');
  }
  function saveUserNotes() {
    const text = $('#notes-textarea').val();
    let rec = db.notes.find(n => n.userId === currentUser.id);
    if (!rec) { rec = { userId: currentUser.id, text }; db.notes.push(rec); }
    else rec.text = text;
    saveDB();
    showToast('Note salvate', 'success');
  }

  // --- Navigation ---
  function showSection(id) {
    $('.content-section').addClass('d-none');
    $('#'+id).removeClass('d-none');
    $('.sidebar .nav-link').removeClass('active');
    $('.sidebar .nav-link[data-target="'+id+'"]').addClass('active');
  }

  // --- Render helpers ---
  function renderAll() {
    renderCompanyInfoForm();
    renderUsersTable();
    renderCustomersTable();
    renderSuppliersTable();
    renderProductsTable();
    renderInventoryTable();
    fillCommonSelects();
    renderCustomerOrdersList();
    renderSupplierOrdersList();
    renderCustomerDdtsList();
    renderSupplierDdtsList();
    renderInvoicesList();
    renderCharts();
  }

  // Company
  function renderCompanyInfoForm() {
    $('#company-name').val(db.companyInfo.name || '');
    $('#company-address').val(db.companyInfo.address || '');
    $('#company-city').val(db.companyInfo.city || '');
    $('#company-zip').val(db.companyInfo.zip || '');
    $('#company-province').val(db.companyInfo.province || '');
    $('#company-name-sidebar').text(db.companyInfo.name || 'Gestionale OL');
  }

  // Users
  function renderUsersTable() {
    const tbody = $('#users-table-body').empty();
    db.users.forEach(u => {
      // Nasconde l'utente admin/gestionale se siamo oltre il setup mode per semplicità
      const hide = (!isSetupMode && u.surname==='admin' && u.password==='gestionale');
      if (hide) return;
      const tr = $(`<tr>
        <td>${u.id}</td>
        <td>${u.surname}</td>
        <td>${u.name}</td>
        <td>${u.role}</td>
        <td>
          <button class="btn btn-sm btn-primary me-2 edit-user" data-id="${u.id}"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm btn-danger delete-user" data-id="${u.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`);
      tbody.append(tr);
    });
  }

  // Customers
  function renderCustomersTable() {
    const tbody = $('#customers-table-body').empty();
    (db.customers || []).forEach(c => {
      const tr = $(`<tr>
        <td>${c.id}</td><td>${c.name}</td><td>${c.piva || ''}</td><td>${c.address || ''}</td>
        <td>
          <button class="btn btn-sm btn-primary me-2 edit-customer" data-id="${c.id}"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm btn-danger delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`);
      tbody.append(tr);
    });
    // Filtro ricerca
    $('#customer-search-input').off('keyup').on('keyup', function() {
      const q = $(this).val().toLowerCase();
      $('#customers-table-body tr').each(function() {
        const txt = $(this).text().toLowerCase();
        $(this).toggle(txt.indexOf(q) >= 0);
      });
    });
  }

  // Suppliers
  function renderSuppliersTable() {
    const tbody = $('#suppliers-table-body').empty();
    (db.suppliers || []).forEach(s => {
      const tr = $(`<tr>
        <td>${s.id}</td><td>${s.name}</td><td>${s.piva || ''}</td><td>${s.address || ''}</td>
        <td>
          <button class="btn btn-sm btn-primary me-2 edit-supplier" data-id="${s.id}"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm btn-danger delete-supplier" data-id="${s.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`);
      tbody.append(tr);
    });
    $('#supplier-search-input').off('keyup').on('keyup', function() {
      const q = $(this).val().toLowerCase();
      $('#suppliers-table-body tr').each(function() {
        const txt = $(this).text().toLowerCase();
        $(this).toggle(txt.indexOf(q) >= 0);
      });
    });
  }

  // Products
  function renderProductsTable() {
    const tbody = $('#products-table-body').empty();
    (db.products || []).forEach(p => {
      const loc = [p.corsia, p.scaffale, p.piano].filter(Boolean).join('-');
      const tr = $(`<tr>
        <td>${p.code || ''}</td>
        <td>${p.description || ''}</td>
        <td>${fmtCurrency(p.purchasePrice || 0)}</td>
        <td>${fmtCurrency(p.salePrice || 0)}</td>
        <td>${loc || ''}</td>
        <td class="text-end">${p.giacenza || 0}</td>
        <td>
          <button class="btn btn-sm btn-primary me-2 edit-product" data-id="${p.id}"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm btn-danger delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`);
      tbody.append(tr);
    });
    $('#product-search-input').off('keyup').on('keyup', function() {
      const q = $(this).val().toLowerCase();
      $('#products-table-body tr').each(function() {
        const txt = $(this).text().toLowerCase();
        $(this).toggle(txt.indexOf(q) >= 0);
      });
    });
  }

  // Inventory
  function renderInventoryTable() {
    const tbody = $('#inventory-table-body').empty();
    (db.products || []).forEach(p => {
      const loc = [p.corsia, p.scaffale, p.piano].filter(Boolean).join('-');
      const tr = $(`<tr>
        <td>${p.code || ''}</td>
        <td>${p.description || ''}</td>
        <td>${loc || ''}</td>
        <td class="text-end">${p.giacenza || 0}</td>
      </tr>`);
      tbody.append(tr);
    });
  }

  // Selects comuni
  function fillCommonSelects() {
    function fillSelect($sel, items, getVal, getText, placeholder) {
      const currentVal = $sel.val();
      $sel.empty();
      if (placeholder) $sel.append(`<option value="" disabled selected>${placeholder}</option>`);
      items.forEach(it => $sel.append(`<option value="${getVal(it)}">${getText(it)}</option>`));
      if (currentVal) $sel.val(currentVal); // tenta di preservare
    }
    // Clienti
    const customersSorted = [...db.customers].sort((a,b)=>a.name.localeCompare(b.name));
    fillSelect($('#order-customer-select'), customersSorted, c=>c.id, c=>c.name, 'Seleziona un cliente...');
    fillSelect($('#invoice-customer-select'), customersSorted, c=>c.id, c=>c.name, 'Seleziona un cliente...');

    // Fornitori
    const suppliersSorted = [...db.suppliers].sort((a,b)=>a.name.localeCompare(b.name));
    fillSelect($('#order-supplier-select'), suppliersSorted, s=>s.id, s=>s.name, 'Seleziona un fornitore...');

    // Prodotti (per ordini e movimenti)
    const prodsSorted = [...db.products].sort((a,b)=> (a.code||'').localeCompare(b.code||''));
    fillSelect($('#order-product-select'), prodsSorted, p=>p.id, p=>`${p.code} - ${p.description}`, 'Seleziona un prodotto...');
    fillSelect($('#order-supplier-product-select'), prodsSorted, p=>p.id, p=>`${p.code} - ${p.description}`, 'Seleziona un prodotto...');
    fillSelect($('#load-product-select'), prodsSorted, p=>p.id, p=>`${p.code} - ${p.description}`);
    fillSelect($('#unload-product-select'), prodsSorted, p=>p.id, p=>`${p.code} - ${p.description}`);
    fillSelect($('#stock-query-product-select'), prodsSorted, p=>p.id, p=>`${p.code} - ${p.description}`);

    // Ordini cliente evadibili
    const openCustOrders = db.customerOrders.filter(o => o.status !== 'Evaso');
    const withLabel = openCustOrders.map(o => ({ id:o.id, label:`${o.number} – ${findCustomerName(o.customerId)} (${o.date})`}));
    fillSelect($('#ddt-order-select'), withLabel, x=>x.id, x=>x.label, 'Seleziona un ordine...');

    // Ordini fornitore ricevíbili
    const openSuppOrders = db.supplierOrders.filter(o => o.status !== 'Completato');
    const withLabel2 = openSuppOrders.map(o => ({ id:o.id, label:`${o.number} – ${findSupplierName(o.supplierId)} (${o.date})`}));
    fillSelect($('#ddt-supplier-order-select'), withLabel2, x=>x.id, x=>x.label, 'Seleziona un ordine...');
  }

  // --- CRUD minimal ---
  function nextId(arr) { return (arr.length? Math.max(...arr.map(x=>Number(x.id)||0)) : 0) + 1; }

  // Salvataggio anagrafica azienda
  $('#company-info-form').on('submit', function(e){
    e.preventDefault();
    db.companyInfo.name = $('#company-name').val().trim();
    db.companyInfo.address = $('#company-address').val().trim();
    db.companyInfo.city = $('#company-city').val().trim();
    db.companyInfo.zip = $('#company-zip').val().trim();
    db.companyInfo.province = $('#company-province').val().trim();
    saveDB();
    $('#company-name-sidebar').text(db.companyInfo.name || 'Gestionale OL');
    showToast('Dati azienda salvati', 'success');
  });

  // Users add/edit/delete
  $('#togglePassword').on('click', () => {
    const inp = document.getElementById('user-password');
    inp.type = (inp.type === 'password' ? 'text' : 'password');
  });
  $('#saveUserBtn').on('click', function(){
    const id = $('#user-id').val();
    const surname = $('#user-surname').val().trim();
    const name = $('#user-name').val().trim();
    const password = $('#user-password').val().trim();
    const role = $('#user-role').val();
    if (!surname || !name || !password) { showToast('Compila tutti i campi utente', 'warning'); return; }
    if (id) {
      const u = db.users.find(x => String(x.id)===String(id));
      if (u) { u.surname=surname; u.name=name; u.password=password; u.role=role; }
      showToast('Utente aggiornato', 'success');
    } else {
      const u = { id: nextId(db.users), surname, name, password, role };
      db.users.push(u);
      showToast('Utente creato', 'success');
    }
    saveDB();
    renderUsersTable();
    $('#userModal').modal('hide');
    // Se viene creato un altro Admin oltre admin/gestionale, la prossima volta admin/gestionale non sarà più "speciale"
  });
  $(document).on('click','.edit-user', function(){
    const id = $(this).data('id');
    const u = db.users.find(x => String(x.id)===String(id));
    if (!u) return;
    $('#userModalTitle').text('Modifica Utente');
    $('#user-id').val(u.id);
    $('#user-surname').val(u.surname);
    $('#user-name').val(u.name);
    $('#user-password').val(u.password);
    $('#user-role').val(u.role);
    $('#userModal').modal('show');
  });
  $(document).on('click','.delete-user', function(){
    const id = $(this).data('id');
    if (!confirm('Eliminare l\'utente?')) return;
    db.users = db.users.filter(x => String(x.id)!==String(id));
    saveDB();
    renderUsersTable();
  });
  $('#newUserBtn').on('click', () => {
    $('#userModalTitle').text('Nuovo Utente');
    $('#userForm')[0].reset();
    $('#user-id').val('');
  });

  // Customers add/edit/delete
  $('#saveCustomerBtn').on('click', function(){
    const id = $('#customer-id').val();
    const name = $('#customer-name').val().trim();
    const piva = $('#customer-piva').val().trim();
    const address = $('#customer-address').val().trim();
    if (!name) { showToast('La ragione sociale è obbligatoria','warning'); return; }
    if (id) {
      const c = db.customers.find(x => String(x.id)===String(id));
      if (c) { c.name=name; c.piva=piva; c.address=address; }
      showToast('Cliente aggiornato','success');
    } else {
      db.customers.push({ id: nextId(db.customers), name, piva, address });
      showToast('Cliente creato','success');
    }
    saveDB(); renderCustomersTable(); fillCommonSelects(); $('#customerModal').modal('hide');
  });
  $(document).on('click','.edit-customer', function(){
    const id = $(this).data('id');
    const c = db.customers.find(x => String(x.id)===String(id));
    if (!c) return;
    $('#customerModalTitle').text('Modifica Cliente');
    $('#customer-id').val(c.id);
    $('#customer-name').val(c.name);
    $('#customer-piva').val(c.piva || '');
    $('#customer-address').val(c.address || '');
    $('#customerModal').modal('show');
  });
  $(document).on('click','.delete-customer', function(){
    const id = $(this).data('id');
    if (!confirm('Eliminare il cliente?')) return;
    db.customers = db.customers.filter(x => String(x.id)!==String(id));
    saveDB(); renderCustomersTable(); fillCommonSelects();
  });

  // Suppliers add/edit/delete
  $('#saveSupplierBtn').on('click', function(){
    const id = $('#supplier-id').val();
    const name = $('#supplier-name').val().trim();
    const piva = $('#supplier-piva').val().trim();
    const address = $('#supplier-address').val().trim();
    if (!name) { showToast('La ragione sociale è obbligatoria','warning'); return; }
    if (id) {
      const s = db.suppliers.find(x => String(x.id)===String(id));
      if (s) { s.name=name; s.piva=piva; s.address=address; }
      showToast('Fornitore aggiornato','success');
    } else {
      db.suppliers.push({ id: nextId(db.suppliers), name, piva, address });
      showToast('Fornitore creato','success');
    }
    saveDB(); renderSuppliersTable(); fillCommonSelects(); $('#supplierModal').modal('hide');
  });
  $(document).on('click','.edit-supplier', function(){
    const id = $(this).data('id');
    const s = db.suppliers.find(x => String(x.id)===String(id));
    if (!s) return;
    $('#supplierModalTitle').text('Modifica Fornitore');
    $('#supplier-id').val(s.id);
    $('#supplier-name').val(s.name);
    $('#supplier-piva').val(s.piva || '');
    $('#supplier-address').val(s.address || '');
    $('#supplierModal').modal('show');
  });
  $(document).on('click','.delete-supplier', function(){
    const id = $(this).data('id');
    if (!confirm('Eliminare il fornitore?')) return;
    db.suppliers = db.suppliers.filter(x => String(x.id)!==String(id));
    saveDB(); renderSuppliersTable(); fillCommonSelects();
  });

  // Products add/edit/delete
  $('#saveProductBtn').on('click', function(){
    const id = $('#product-id').val();
    const description = $('#product-description').val().trim();
    const code = $('#product-code').val().trim();
    const purchasePrice = Number($('#product-purchase-price').val() || 0);
    const salePrice = Number($('#product-sale-price').val() || 0);
    const iva = Number($('#product-iva').val() || 22);
    const corsia = $('#product-loc-corsia').val().trim();
    const scaffale = $('#product-loc-scaffale').val().trim();
    const piano = $('#product-loc-piano').val().trim();
    if (!description || !code) { showToast('Descrizione e codice sono obbligatori','warning'); return; }
    if (id) {
      const p = db.products.find(x => String(x.id)===String(id));
      if (p) {
        Object.assign(p, { description, code, purchasePrice, salePrice, iva, corsia, scaffale, piano });
      }
      showToast('Prodotto aggiornato','success');
    } else {
      const newP = {
        id: 'PRD'+Date.now(),
        description, code, purchasePrice, salePrice, iva, corsia, scaffale, piano,
        giacenza: 0
      };
      db.products.push(newP);
      showToast('Prodotto creato','success');
    }
    saveDB(); renderProductsTable(); renderInventoryTable(); fillCommonSelects(); $('#productModal').modal('hide');
  });
  $(document).on('click','.edit-product', function(){
    const id = $(this).data('id');
    const p = db.products.find(x => String(x.id)===String(id));
    if (!p) return;
    $('#productModalTitle').text('Modifica Prodotto');
    $('#product-id').val(p.id);
    $('#product-description').val(p.description || '');
    $('#product-code').val(p.code || '');
    $('#product-purchase-price').val(p.purchasePrice || '');
    $('#product-sale-price').val(p.salePrice || '');
    $('#product-iva').val(p.iva || 22);
    $('#product-loc-corsia').val(p.corsia || '');
    $('#product-loc-scaffale').val(p.scaffale || '');
    $('#product-loc-piano').val(p.piano || '');
    $('#productModal').modal('show');
  });
  $(document).on('click','.delete-product', function(){
    const id = $(this).data('id');
    if (!confirm('Eliminare il prodotto?')) return;
    db.products = db.products.filter(x => String(x.id)!==String(id));
    saveDB(); renderProductsTable(); renderInventoryTable(); fillCommonSelects();
  });
  $('#newProductBtn').on('click', () => {
    $('#productModalTitle').text('Nuovo Prodotto');
    $('#productForm')[0].reset();
    $('#product-id').val('');
  });

  // Movimenti manuali
  $('#manual-load-form').on('submit', function(e){
    e.preventDefault();
    const pid = $('#load-product-select').val();
    const qty = Number($('#load-product-qty').val());
    if (!pid || qty<=0) { showToast('Seleziona prodotto e quantità valida','warning'); return; }
    const p = findProduct(pid); if (!p) return;
    p.giacenza = Number(p.giacenza || 0) + qty;
    saveDB(); renderProductsTable(); renderInventoryTable(); fillCommonSelects();
    showToast('Carico registrato','success');
    this.reset();
  });
  $('#manual-unload-form').on('submit', function(e){
    e.preventDefault();
    const pid = $('#unload-product-select').val();
    const qty = Number($('#unload-product-qty').val());
    if (!pid || qty<=0) { showToast('Seleziona prodotto e quantità valida','warning'); return; }
    const p = findProduct(pid); if (!p) return;
    if (Number(p.giacenza||0) < qty) { showToast('Giacenza insufficiente','danger'); return; }
    p.giacenza = Number(p.giacenza || 0) - qty;
    saveDB(); renderProductsTable(); renderInventoryTable(); fillCommonSelects();
    showToast('Scarico registrato','success');
    this.reset();
  });
  $('#stock-query-product-select').on('change', function(){
    const p = findProduct($(this).val());
    if (!p) return;
    $('#stock-query-product-name').text(`${p.code} – ${p.description}`);
    $('#stock-query-qty').text(p.giacenza || 0);
    $('#stock-query-location').text([p.corsia,p.scaffale,p.piano].filter(Boolean).join('-') || '—');
    $('#stock-query-result').removeClass('d-none');
  });

  // Ordine Cliente
  let tempCustOrderLines = [];
  function resetCustomerOrderForm() {
    tempCustOrderLines = [];
    $('#order-lines-tbody').empty();
    $('#order-total').text('€ 0.00');
    $('#order-customer-number').val(nextSequential('ORD-C', db.customerOrders, 'number'));
    $('#order-customer-date').val(todayStr());
  }
  $('#add-product-to-order-btn').on('click', function(){
    const pid = $('#order-product-select').val();
    const qty = Number($('#order-product-qty').val());
    if (!pid || qty<=0) { showToast('Seleziona prodotto e quantità valida','warning'); return; }
    const p = findProduct(pid); if (!p) return;
    const price = Number($('#order-product-price').val() || p.salePrice || 0);
    const line = { productId: p.id, productName: `${p.code} - ${p.description}`, qty, shippedQty: 0, price, subtotal: price*qty };
    tempCustOrderLines.push(line);
    renderTempLines('#order-lines-tbody', tempCustOrderLines);
    updateTempTotal('#order-total', tempCustOrderLines);
  });
  function renderTempLines(tbodySelector, lines) {
    const tbody = $(tbodySelector).empty();
    lines.forEach((l,idx)=>{
      const tr = $(`<tr>
        <td>${l.productName}</td><td>${l.qty}</td><td>${fmtCurrency(l.price)}</td><td>${fmtCurrency(l.subtotal)}</td>
        <td><button class="btn btn-sm btn-outline-danger remove-line" data-idx="${idx}"><i class="fas fa-times"></i></button></td>
      </tr>`);
      tbody.append(tr);
    });
  }
  $(document).on('click','.remove-line', function(){
    const idx = Number($(this).data('idx'));
    tempCustOrderLines.splice(idx,1);
    renderTempLines('#order-lines-tbody', tempCustOrderLines);
    updateTempTotal('#order-total', tempCustOrderLines);
  });
  function updateTempTotal(selector, lines) {
    const tot = lines.reduce((a,b)=>a+(b.subtotal||0),0);
    $(selector).text(fmtCurrency(tot));
  }
  $('#new-customer-order-form').on('submit', function(e){
    e.preventDefault();
    const customerId = $('#order-customer-select').val();
    if (!customerId) { showToast('Seleziona il cliente','warning'); return; }
    if (tempCustOrderLines.length===0) { showToast('Aggiungi almeno una riga','warning'); return; }
    const rec = {
      id: nextId(db.customerOrders),
      number: $('#order-customer-number').val(),
      date: $('#order-customer-date').val() || todayStr(),
      customerId: String(customerId),
      lines: tempCustOrderLines.map(l=>({...l})),
      status: 'In lavorazione',
      total: tempCustOrderLines.reduce((a,b)=>a+(b.subtotal||0),0)
    };
    db.customerOrders.push(rec);
    saveDB();
    showToast('Ordine cliente salvato','success');
    this.reset(); resetCustomerOrderForm(); renderCustomerOrdersList(); fillCommonSelects();
  });

  function renderCustomerOrdersList() {
    const tbody = $('#customer-orders-table-body').empty();
    db.customerOrders.forEach(o => {
      const tr = $(`<tr>
        <td>${o.number}</td><td>${o.date}</td><td>${findCustomerName(o.customerId)}</td><td>${fmtCurrency(o.total)}</td><td>${o.status}</td>
        <td><button class="btn btn-sm btn-outline-primary view-cust-order" data-id="${o.id}"><i class="fas fa-eye"></i> Visualizza</button></td>
      </tr>`);
      tbody.append(tr);
    });
  }
  $(document).on('click','.view-cust-order', function(){
    const id = $(this).data('id');
    const o = db.customerOrders.find(x=>String(x.id)===String(id));
    if (!o) return;
    const rows = o.lines.map(l=>`<tr><td>${l.productName}</td><td>${l.qty}</td><td>${l.shippedQty||0}</td><td>${fmtCurrency(l.price)}</td><td>${fmtCurrency(l.subtotal)}</td></tr>`).join('');
    $('#customerOrderDetailModalBody').html(`
      <div class="mb-2"><strong>Cliente:</strong> ${findCustomerName(o.customerId)}</div>
      <div class="mb-2"><strong>Numero / Data:</strong> ${o.number} – ${o.date}</div>
      <table class="table"><thead><tr><th>Prodotto</th><th>Qtà Ord.</th><th>Qtà Evasa</th><th>Prezzo</th><th>Subtotale</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="text-end"><strong>Totale Ordine: ${fmtCurrency(o.total)}</strong></div>
    `);
    $('#customerOrderDetailModal').modal('show');
  });

  // DDT Cliente (evasione)
  $('#ddt-order-select').on('change', function(){
    const id = $(this).val();
    const o = db.customerOrders.find(x=>String(x.id)===String(id));
    if (!o) return;
    $('#ddt-details-section').removeClass('d-none');
    $('#ddt-customer-name').val(findCustomerName(o.customerId));
    $('#ddt-number').val(nextSequential('DDT', db.customerDdts, 'number'));
    $('#ddt-date').val(todayStr());
    const tbody = $('#ddt-products-tbody').empty();
    o.lines.forEach((l, idx)=>{
      const residuo = Number(l.qty) - Number(l.shippedQty||0);
      const tr = $(`<tr>
        <td>${l.productName}</td>
        <td>${l.qty}</td>
        <td>${residuo}</td>
        <td><input type="number" class="form-control ship-qty" data-idx="${idx}" min="0" max="${residuo}" value="${residuo}"></td>
      </tr>`);
      tbody.append(tr);
    });
  });

  $('#new-customer-ddt-form').on('submit', function(e){
    e.preventDefault();
    const id = $('#ddt-order-select').val();
    const o = db.customerOrders.find(x=>String(x.id)===String(id));
    if (!o) { showToast('Ordine non trovato', 'danger'); return; }
    // calcola quantità da spedire
    const qtys = [];
    $('#ddt-products-tbody .ship-qty').each(function(){ qtys.push(Number($(this).val()||0)); });
    if (qtys.every(q=>q<=0)) { showToast('Inserisci almeno una quantità da spedire','warning'); return; }
    const number = $('#ddt-number').val();
    const date = $('#ddt-date').val() || todayStr();

    const lines = [];
    o.lines.forEach((l, idx)=>{
      const q = Math.min(qtys[idx], (Number(l.qty)-Number(l.shippedQty||0)));
      if (q>0) {
        lines.push({ productId: l.productId, productName: l.productName, qty: q, price: l.price, subtotal: q*l.price });
        l.shippedQty = Number(l.shippedQty||0)+q;
        // scalare giacenza
        const p = findProduct(l.productId); if (p) p.giacenza = Number(p.giacenza||0) - q;
      }
    });

    if (lines.length===0) { showToast('Nessuna riga valida','warning'); return; }
    // crea DDT
    db.customerDdts.push({
      id: nextId(db.customerDdts),
      number, date, customerId: String(o.customerId), orderNumber: o.number, lines, status: 'Da Fatturare'
    });
    // aggiorna stato ordine
    const fully = o.lines.every(l => Number(l.shippedQty||0) >= Number(l.qty));
    o.status = fully ? 'Evaso' : 'Parzialmente Evaso';
    saveDB();
    renderCustomerOrdersList();
    renderCustomerDdtsList();
    renderProductsTable();
    renderInventoryTable();
    showToast('DDT cliente generato','success');
    this.reset();
    $('#ddt-details-section').addClass('d-none');
    fillCommonSelects();
  });

  function renderCustomerDdtsList() {
    const tbody = $('#customer-ddts-table-body').empty();
    db.customerDdts.forEach(d => {
      const tr = $(`<tr>
        <td>${d.number}</td><td>${d.date}</td><td>${findCustomerName(d.customerId)}</td><td>${d.orderNumber}</td><td>${d.status||'Da Fatturare'}</td>
        <td><button class="btn btn-sm btn-outline-primary view-cddt" data-id="${d.id}"><i class="fas fa-eye"></i> Visualizza</button></td>
      </tr>`);
      tbody.append(tr);
    });
  }
  $(document).on('click','.view-cddt', function(){
    const id = $(this).data('id');
    const d = db.customerDdts.find(x=>String(x.id)===String(id));
    if (!d) return;
    const rows = d.lines.map(l=>`<tr><td>${l.productName}</td><td>${l.qty}</td><td>${fmtCurrency(l.price)}</td><td>${fmtCurrency(l.subtotal)}</td></tr>`).join('');
    $('#ddtDetailModalBody').html(`
      <div class="mb-2"><strong>Cliente:</strong> ${findCustomerName(d.customerId)}</div>
      <div class="mb-2"><strong>Numero / Data:</strong> ${d.number} – ${d.date}</div>
      <div class="mb-2"><strong>Rif. Ordine:</strong> ${d.orderNumber}</div>
      <table class="table"><thead><tr><th>Prodotto</th><th>Qtà</th><th>Prezzo</th><th>Subtotale</th></tr></thead><tbody>${rows}</tbody></table>
    `);
    $('#ddtDetailModal').modal('show');
  });

  // Fatturazione
  $('#invoice-customer-select').on('change', function(){
    const cid = $(this).val();
    const open = db.customerDdts.filter(d => String(d.customerId)===String(cid) && d.status!=='Fatturato');
    const list = open.map(d => `<div class="form-check">
      <input class="form-check-input ddt-to-invoice" type="checkbox" value="${d.id}" id="ddtchk${d.id}">
      <label class="form-check-label" for="ddtchk${d.id}">${d.number} (${d.date}) – ${d.orderNumber}</label>
    </div>`).join('') || '<div class="text-muted">Nessun DDT da fatturare</div>';
    $('#invoice-ddt-list').html(list);
    $('#invoice-ddt-section').toggleClass('d-none', open.length===0 ? true : false);
  });

  $('#generate-invoice-preview-btn').on('click', function(){
    const ids = [];
    $('.ddt-to-invoice:checked').each(function(){ ids.push($(this).val()); });
    if (ids.length===0) { showToast('Seleziona almeno un DDT','warning'); return; }
    const ddts = db.customerDdts.filter(d => ids.includes(String(d.id)));
    const cid = $('#invoice-customer-select').val();
    $('#invoice-preview-customer').val(findCustomerName(cid));
    $('#invoice-preview-number').val(nextSequential('FATT', db.invoices, 'number'));
    $('#invoice-preview-date').val(todayStr());

    // raggruppa linee
    const lines = [];
    ddts.forEach(d => d.lines.forEach(l => lines.push({ description: l.productName, qty: l.qty, price: l.price, iva: 22, imponibile: l.qty*l.price })));
    const tbody = $('#invoice-preview-lines-tbody').empty();
    lines.forEach(L => tbody.append(`<tr><td>${L.description}</td><td>${L.qty}</td><td>${fmtCurrency(L.price)}</td><td>${fmtCurrency(L.imponibile)}</td><td>${L.iva}%</td></tr>`));
    const tot = lines.reduce((a,b)=>a+(b.imponibile||0),0);
    $('#invoice-summary').html(`<div class="card card-body"><div class="d-flex justify-content-between"><div><strong>Imponibile (22%)</strong></div><div>${fmtCurrency(tot)}</div></div><div class="d-flex justify-content-between"><div><strong>IVA (22%)</strong></div><div>${fmtCurrency(tot*0.22)}</div></div><hr><div class="d-flex justify-content-between"><div><strong>TOTALE</strong></div><div>${fmtCurrency(tot*1.22)}</div></div></div>`);
    $('#invoice-preview-section').removeClass('d-none');
    // salva anteprima in memoria
    $('#confirm-invoice-btn').data('ddt-ids', ids).data('lines', lines);
  });

  $('#confirm-invoice-btn').on('click', function(){
    const ids = $(this).data('ddt-ids') || [];
    const lines = $(this).data('lines') || [];
    const cid = $('#invoice-customer-select').val();
    const inv = {
      id: nextId(db.invoices),
      number: $('#invoice-preview-number').val(),
      date: $('#invoice-preview-date').val() || todayStr(),
      customerId: String(cid),
      ddts: ids.map(String),
      lines: lines.map(l=>({ description:l.description, qty:l.qty, price:l.price, iva:l.iva, imponibile:l.imponibile })),
      summary: { '22': { imponibile: lines.reduce((a,b)=>a+(b.imponibile||0),0), imposta: lines.reduce((a,b)=>a+(b.imponibile||0),0)*0.22 } },
      total: lines.reduce((a,b)=>a+(b.imponibile||0),0)*1.22
    };
    db.invoices.push(inv);
    // marca DDT come fatturati
    db.customerDdts.forEach(d => { if (ids.includes(String(d.id))) d.status='Fatturato'; });
    saveDB();
    renderInvoicesList();
    renderCustomerDdtsList();
    showToast('Fattura generata','success');
    $('#invoice-preview-section').addClass('d-none');
    $('#invoice-ddt-section').addClass('d-none');
    $('#invoice-preview-lines-tbody').empty();
  });

  function renderInvoicesList() {
    const tbody = $('#invoices-table-body').empty();
    db.invoices.forEach(f => {
      const tr = $(`<tr>
        <td>${f.number}</td><td>${f.date}</td><td>${findCustomerName(f.customerId)}</td><td>${fmtCurrency(f.total)}</td>
        <td><button class="btn btn-sm btn-outline-primary view-invoice" data-id="${f.id}"><i class="fas fa-eye"></i> Visualizza</button></td>
      </tr>`);
      tbody.append(tr);
    });
  }
  $(document).on('click','.view-invoice', function(){
    const id = $(this).data('id');
    const f = db.invoices.find(x=>String(x.id)===String(id));
    if (!f) return;
    const rows = f.lines.map(l=>`<tr><td>${l.description}</td><td>${l.qty}</td><td>${fmtCurrency(l.price)}</td><td>${fmtCurrency(l.imponibile)}</td><td>${l.iva}%</td></tr>`).join('');
    const sum = f.summary['22'];
    $('#invoiceDetailModalBody').html(`
      <div class="mb-2"><strong>Cliente:</strong> ${findCustomerName(f.customerId)}</div>
      <div class="mb-2"><strong>Numero / Data:</strong> ${f.number} – ${f.date}</div>
      <div class="mb-2"><strong>DDT inclusi:</strong> ${f.ddts.join(', ')}</div>
      <table class="table"><thead><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>Imponibile</th><th>IVA</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="text-end"><strong>Imponibile:</strong> ${fmtCurrency(sum.imponibile)} • <strong>IVA:</strong> ${fmtCurrency(sum.imposta)} • <strong>Totale:</strong> ${fmtCurrency(f.total)}</div>
    `);
    $('#invoiceDetailModal').modal('show');
  });

  // Ordine Fornitore
  let tempSuppOrderLines = [];
  function resetSupplierOrderForm() {
    tempSuppOrderLines = [];
    $('#supplier-order-lines-tbody').empty();
    $('#supplier-order-total').text('€ 0.00');
    $('#order-supplier-number').val(nextSequential('ORD-F', db.supplierOrders, 'number'));
    $('#order-supplier-date').val(todayStr());
  }
  $('#add-product-to-supplier-order-btn').on('click', function(){
    const pid = $('#order-supplier-product-select').val();
    const qty = Number($('#order-supplier-product-qty').val());
    if (!pid || qty<=0) { showToast('Seleziona prodotto e quantità valida','warning'); return; }
    const p = findProduct(pid); if (!p) return;
    const price = Number($('#order-supplier-product-price').val() || p.purchasePrice || 0);
    const line = { productId: p.id, productName: `${p.code} - ${p.description}`, qty, receivedQty: 0, price, subtotal: price*qty };
    tempSuppOrderLines.push(line);
    renderTempLines('#supplier-order-lines-tbody', tempSuppOrderLines);
    updateTempTotal('#supplier-order-total', tempSuppOrderLines);
  });
  $('#new-supplier-order-form').on('submit', function(e){
    e.preventDefault();
    const supplierId = $('#order-supplier-select').val();
    if (!supplierId) { showToast('Seleziona il fornitore','warning'); return; }
    if (tempSuppOrderLines.length===0) { showToast('Aggiungi almeno una riga','warning'); return; }
    const rec = {
      id: nextId(db.supplierOrders),
      number: $('#order-supplier-number').val(),
      date: $('#order-supplier-date').val() || todayStr(),
      supplierId: String(supplierId),
      lines: tempSuppOrderLines.map(l=>({...l})),
      status: 'Inviato',
      total: tempSuppOrderLines.reduce((a,b)=>a+(b.subtotal||0),0)
    };
    db.supplierOrders.push(rec);
    saveDB();
    showToast('Ordine fornitore salvato','success');
    this.reset(); resetSupplierOrderForm(); renderSupplierOrdersList(); fillCommonSelects();
  });

  function renderSupplierOrdersList() {
    const tbody = $('#supplier-orders-table-body').empty();
    db.supplierOrders.forEach(o => {
      const tr = $(`<tr>
        <td>${o.number}</td><td>${o.date}</td><td>${findSupplierName(o.supplierId)}</td><td>${fmtCurrency(o.total)}</td><td>${o.status}</td>
        <td><button class="btn btn-sm btn-outline-primary view-supp-order" data-id="${o.id}"><i class="fas fa-eye"></i> Visualizza</button></td>
      </tr>`);
      tbody.append(tr);
    });
  }
  $(document).on('click','.view-supp-order', function(){
    const id = $(this).data('id');
    const o = db.supplierOrders.find(x=>String(x.id)===String(id));
    if (!o) return;
    const rows = o.lines.map(l=>`<tr><td>${l.productName}</td><td>${l.qty}</td><td>${l.receivedQty||0}</td><td>${fmtCurrency(l.price)}</td><td>${fmtCurrency(l.subtotal)}</td></tr>`).join('');
    $('#supplierOrderDetailModalBody').html(`
      <div class="mb-2"><strong>Fornitore:</strong> ${findSupplierName(o.supplierId)}</div>
      <div class="mb-2"><strong>Numero / Data:</strong> ${o.number} – ${o.date}</div>
      <table class="table"><thead><tr><th>Prodotto</th><th>Qtà Ord.</th><th>Qtà Ricev.</th><th>Prezzo</th><th>Subtotale</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="text-end"><strong>Totale Ordine: ${fmtCurrency(o.total)}</strong></div>
    `);
    $('#supplierOrderDetailModal').modal('show');
  });

  // DDT Fornitore (MERCE IN ENTRATA) – FIX
  $('#ddt-supplier-order-select').on('change', function(){
    const id = $(this).val();
    const o = db.supplierOrders.find(x=>String(x.id)===String(id));
    if (!o) { $('#ddt-supplier-details-section').addClass('d-none'); return; }
    $('#ddt-supplier-details-section').removeClass('d-none');
    $('#ddt-supplier-name').val(findSupplierName(o.supplierId));
    $('#ddt-supplier-date').val(todayStr());
    // Popola righe
    const tbody = $('#ddt-supplier-products-tbody').empty();
    o.lines.forEach((l, idx)=>{
      const residuo = Number(l.qty) - Number(l.receivedQty || 0);
      const tr = $(`<tr>
        <td>${l.productName}</td>
        <td>${l.qty}</td>
        <td>${residuo}</td>
        <td><input type="number" class="form-control recv-qty" data-idx="${idx}" min="0" max="${residuo}" value="${residuo}"></td>
      </tr>`);
      tbody.append(tr);
    });
  });

  $('#new-supplier-ddt-form').on('submit', function(e){
    e.preventDefault();
    const orderId = $('#ddt-supplier-order-select').val();
    const o = db.supplierOrders.find(x=>String(x.id)===String(orderId));
    if (!o) { showToast('Ordine non trovato', 'danger'); return; }
    const supplierName = findSupplierName(o.supplierId);
    const number = $('#ddt-supplier-number').val().trim();
    const date = $('#ddt-supplier-date').val() || todayStr();
    if (!number) { showToast('Inserisci il numero del DDT fornitore','warning'); return; }

    const qtys = [];
    $('#ddt-supplier-products-tbody .recv-qty').each(function(){ qtys.push(Number($(this).val()||0)); });
    if (qtys.every(q=>q<=0)) { showToast('Inserisci almeno una quantità ricevuta','warning'); return; }

    const lines = [];
    o.lines.forEach((l, idx)=>{
      const residuo = Number(l.qty) - Number(l.receivedQty || 0);
      const q = Math.min(qtys[idx] || 0, residuo);
      if (q>0) {
        lines.push({ productId: l.productId, productName: l.productName, qty: q, price: l.price, subtotal: q*l.price });
        // aggiorna ricevuto
        l.receivedQty = Number(l.receivedQty || 0) + q;
        // incrementa giacenza
        const p = findProduct(l.productId); if (p) p.giacenza = Number(p.giacenza || 0) + q;
      }
    });

    if (lines.length===0) { showToast('Nessuna riga valida','warning'); return; }

    // crea DDT fornitore
    db.supplierDdts.push({
      id: nextId(db.supplierDdts),
      number, date, supplierId: String(o.supplierId),
      ourOrderNumber: o.number,
      lines,
      dest: db.companyInfo.name || 'Magazzino'
    });

    // aggiorna stato ordine
    const fully = o.lines.every(l => Number(l.receivedQty||0) >= Number(l.qty));
    o.status = fully ? 'Completato' : 'Parzialmente Ricevuto';

    saveDB();
    renderSupplierOrdersList();
    renderSupplierDdtsList();
    renderProductsTable();
    renderInventoryTable();
    showToast('Merce registrata in entrata','success');
    this.reset();
    $('#ddt-supplier-details-section').addClass('d-none');
    fillCommonSelects();
  });

  function renderSupplierDdtsList() {
    const tbody = $('#supplier-ddts-table-body').empty();
    db.supplierDdts.forEach(d => {
      const tr = $(`<tr>
        <td>${d.number}</td><td>${d.date}</td><td>${findSupplierName(d.supplierId)}</td><td>${d.dest || (db.companyInfo.name||'Magazzino')}</td><td>${d.ourOrderNumber || ''}</td>
        <td><button class="btn btn-sm btn-outline-primary view-sddt" data-id="${d.id}"><i class="fas fa-eye"></i> Visualizza</button></td>
      </tr>`);
      tbody.append(tr);
    });
  }
  $(document).on('click','.view-sddt', function(){
    const id = $(this).data('id');
    const d = db.supplierDdts.find(x=>String(x.id)===String(id));
    if (!d) return;
    const rows = d.lines.map(l=>`<tr><td>${l.productName}</td><td>${l.qty}</td><td>${fmtCurrency(l.price)}</td><td>${fmtCurrency(l.subtotal)}</td></tr>`).join('');
    $('#supplierDdtDetailModalBody').html(`
      <div class="mb-2"><strong>Fornitore:</strong> ${findSupplierName(d.supplierId)}</div>
      <div class="mb-2"><strong>Numero / Data:</strong> ${d.number} – ${d.date}</div>
      <div class="mb-2"><strong>Rif. nostro ordine:</strong> ${d.ourOrderNumber || '—'}</div>
      <table class="table"><thead><tr><th>Prodotto</th><th>Qtà</th><th>Prezzo</th><th>Subtotale</th></tr></thead><tbody>${rows}</tbody></table>
    `);
    $('#supplierDdtDetailModal').modal('show');
  });

  // Invoices already handled above

  // Statistiche (semplici)
  let chart1=null, chart2=null;
  function renderCharts() {
    if (chart1) { chart1.destroy(); chart1=null; }
    if (chart2) { chart2.destroy(); chart2=null; }
    if (currentUser.role === 'User') {
      // Top 5 per giacenza
      const sorted = [...db.products].sort((a,b)=>Number(b.giacenza||0)-Number(a.giacenza||0)).slice(0,5);
      $('#chart1Title').text('Top 5 Prodotti per Giacenza');
      chart1 = new Chart(document.getElementById('statChart1'), {
        type: 'bar',
        data: { labels: sorted.map(p=>p.code), datasets: [{ label: 'Giacenza', data: sorted.map(p=>p.giacenza||0) }] },
        options: { responsive:true, plugins:{legend:{display:false}} }
      });
      // In esaurimento
      const low = [...db.products].filter(p=>Number(p.giacenza||0)<=2).sort((a,b)=>a.giacenza-b.giacenza).slice(0,5);
      $('#chart2Title').text('Top 5 Prodotti in Esaurimento');
      chart2 = new Chart(document.getElementById('statChart2'), {
        type: 'pie',
        data: { labels: low.map(p=>p.code), datasets: [{ data: low.map(p=>p.giacenza||0) }] },
        options: { responsive:true }
      });
    } else {
      // Valore ordini per mese (clienti)
      const byMonth = {};
      db.customerOrders.forEach(o=>{
        const m = (o.date||'').slice(0,7);
        byMonth[m] = (byMonth[m]||0) + (o.total||0);
      });
      const months = Object.keys(byMonth).sort();
      $('#chart1Title').text('Fatturato Ordini per Mese');
      chart1 = new Chart(document.getElementById('statChart1'), {
        type: 'line',
        data: { labels: months, datasets: [{ label:'Valore ordini', data: months.map(m=>byMonth[m]) }] },
        options: { responsive:true }
      });
      // Valore ordini per cliente
      const byCust = {};
      db.customerOrders.forEach(o=>{
        const name = findCustomerName(o.customerId) || '—';
        byCust[name] = (byCust[name]||0) + (o.total||0);
      });
      const custs = Object.keys(byCust).sort((a,b)=>byCust[b]-byCust[a]).slice(0,8);
      $('#chart2Title').text('Valore Ordini per Cliente');
      chart2 = new Chart(document.getElementById('statChart2'), {
        type: 'doughnut',
        data: { labels: custs, datasets: [{ data: custs.map(k=>byCust[k]) }] },
        options: { responsive:true }
      });
    }
  }

  // Avanzate: Export/Import/Delete/Send
  $('#export-data-btn').on('click', function(){
    const surname = (currentUser && currentUser.surname) ? currentUser.surname : 'backup';
    const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${surname}_gestionale_OL_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  $('#import-file-input').on('change', function(e){
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function() {
      try {
        const data = JSON.parse(reader.result);
        db = data;
        saveDB();
        renderAll();
        fillCommonSelects();
        showToast('Dati importati correttamente','success');
      } catch(err) {
        console.error(err);
        showToast('File non valido','danger');
      }
    };
    reader.readAsText(file);
  });

  $('#delete-all-data-btn').on('click', function(){
    if (!confirm('Confermi la cancellazione di TUTTI i dati?')) return;
    localStorage.removeItem(DB_KEY);
    loadDB(); // ricrea struttura e admin/gestionale
    setupLoginPrefillIfNeeded();
    showToast('Dati cancellati. Esegui nuovamente l\'accesso.','warning');
    logout();
  });

  $('#send-data-btn').on('click', async function(){
    try {
      const payload = {
        subject: `Gestionale OL – invio dati da ${currentUser ? (currentUser.surname + ' ' + currentUser.name) : 'utente'}`,
        timestamp: new Date().toISOString(),
        user: currentUser ? { surname: currentUser.surname, name: currentUser.name, role: currentUser.role } : null,
        db
      };
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) showToast('Dati inviati al docente','success');
      else showToast('Invio fallito. Verifica la connessione.', 'danger');
    } catch(err) {
      console.error(err);
      showToast('Errore durante l\'invio','danger');
    }
  });

  // Help: nuova scheda
  $('#help-btn').on('click', function(){
    window.open('Manuale%20Utente.txt','_blank');
  });
  // F1 apre help
  document.addEventListener('keydown', function(e){
    if (e.key === 'F1') { e.preventDefault(); window.open('Manuale%20Utente.txt','_blank'); }
  });

  // Sidebar navigation
  $(document).on('click', '.sidebar .nav-link[data-target]', function(e){
    e.preventDefault();
    const id = $(this).data('target');
    showSection(id);
    // Reset form dinamici
    if (id==='nuovo-ordine-cliente') resetCustomerOrderForm();
    if (id==='nuovo-ordine-fornitore') resetSupplierOrderForm();
  });

  // Azioni extra
  $('#logout-btn').on('click', function(e){ e.preventDefault(); logout(); });
  $('#save-notes-btn').on('click', function(){ saveUserNotes(); });

  // Login
  $('#login-form').on('submit', handleLoginSubmit);

  // Init
  $(function(){
    loadDB();
    setupLoginPrefillIfNeeded();
    $('#version-sidebar').text(VERSION);
  });

})();
