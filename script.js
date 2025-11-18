$(document).ready(function() {

    // VARIABILE GLOBALE PER L'UTENTE LOGGATO
    let currentUser = null; 
    let dateTimeInterval = null; // Per l'orologio
    let isSetupMode = false; // Modalità setup iniziale (admin/gestionale unico utente)

    // --- DATABASE LOCALE (LOCAL STORAGE) ---
    const DB_KEYS = ['companyInfo', 'products', 'customers', 'suppliers', 'customerOrders', 'customerDdts', 'supplierOrders', 'supplierDdts', 'users', 'invoices', 'notes'];

    // Funzione per controllare e creare i dati di esempio all'avvio, PRIMA del login
    function checkAndSeedData() {
        if (!localStorage.getItem('companyInfo')) { // Usa companyInfo come indicatore di prima installazione
            console.log("Creazione dati di esempio nel Local Storage...");
            const sampleData = {
                companyInfo: { name: "NAXSO BBT S.R.L.", address: "Via L. Einaudi, 6", city: "Rivalta di Torino", zip: "10040", province: "TO" },
                products: [
                    { id: 'PRD1', code: 'Inchiostro', description: 'Inchiostro per biro', purchasePrice: 2.50, salePrice: 5.00, iva: 22, corsia: 'A', scaffale: '12', piano: '3', giacenza: 150 },
                    { id: 'PRD2', code: 'Fusto', description: 'Fusto per biro', purchasePrice: 0.80, salePrice: 1.50, iva: 22, corsia: 'A', scaffale: '12', piano: '3', giacenza: 500 },
                    { id: 'PRD3', code: 'Tappino', description: 'Tappino posteriore per biro', purchasePrice: 0.10, salePrice: 0.30, iva: 10, corsia: 'B', scaffale: '02', piano: '1', giacenza: 1200 },
                    { id: 'PRD4', code: 'PRD002', description: 'Prodotto 002', purchasePrice: 12.00, salePrice: 17.00, iva: 22, corsia: '', scaffale: '', piano: '', giacenza: 45 }
                ],
                customers: [ { id: 1, name: 'Lavorazioni Meccaniche SAS', piva: '01122334455', address: 'Via Cagliari 32, 10100 Torino (TO)'}, { id: 2, name: 'Rossi S.p.A.', piva: '09988776655', address: 'Via Roma 1, 10123 Torino (TO)'}, ],
                suppliers: [ { id: 1, name: 'Euroliquidi 2000', piva: '06382641006', address: 'Via Garibaldi, 76, 06024 Gubbio (PG)' }, { id: 2, name: 'Multitech SNC', piva: '00488410010', address: 'Via Po, 2, 10099 San Maruto Torinese (TO)' } ],
                users: [ { id: 1, surname: 'admin', name: 'Amministratore', password: 'gestionale', role: 'Admin' } ]
            };
            DB_KEYS.forEach(key => localStorage.setItem(key, JSON.stringify(sampleData[key] || [])));
        }
    }

    checkAndSeedData(); // Esegui il controllo all'avvio dell'applicazione

    // Prefill login al primo accesso con le credenziali di emergenza admin/gestionale
    (function prefillLoginIfFirstAccess() {
        const usersRaw = localStorage.getItem('users');
        let users = [];
        if (usersRaw) {
            try {
                users = JSON.parse(usersRaw) || [];
            } catch (e) {
                users = [];
            }
        }
        // Se non ci sono utenti, crea l'admin di emergenza
        if (!users || users.length === 0) {
            const adminUser = { id: 1, surname: 'admin', name: 'Amministratore', password: 'gestionale', role: 'Admin' };
            users = [adminUser];
            localStorage.setItem('users', JSON.stringify(users));
            console.log("Creato utente admin/gestionale di emergenza (nessun utente presente).");
        }
        // Se esiste solo l'utente admin/gestionale, precompila i campi di login
        if (users.length === 1 && users[0].surname && users[0].surname.toLowerCase() === 'admin' && users[0].password === 'gestionale') {
            $('#username').val('admin');
            $('#password').val('gestionale');
        }
    })();

    function initializeApp() {
        // Mostra la nuova home page di default
        $('.content-section').addClass('d-none');
        $('#home').removeClass('d-none');
        $('.sidebar .nav-link').removeClass('active');
        $('.sidebar .nav-link[data-target="home"]').addClass('active');
        
        renderAll();
    }

    function getData(key) { return JSON.parse(localStorage.getItem(key)) || []; }
    function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    function getNextId(items) { return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1; }

    // --- RENDERIZZAZIONE ---
    function renderAll() {
        renderCompanyInfoForm(); 
        updateCompanyUI(); 
        renderProductsTable(); 
        renderCustomersTable(); 
        renderSuppliersTable();
        renderInventoryTable(); 
        renderCustomerOrdersTable(); 
        renderCustomerDdtsTable(); 
        renderSupplierOrdersTable(); 
        renderSupplierDdtsTable();
        renderUsersTable(); 
        renderInvoicesTable();
        populateDropdowns(); 
        renderStatisticsPage();
        renderHomePage();
        updateMenuVisibility();
        applySetupModeMenu();
    }

    function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        if(company.name) $('#company-name-sidebar').text(company.name);
        
        if(currentUser) {
            $('#user-name-sidebar').text('Utente: ' + currentUser.surname);
        } else {
            $('#user-name-sidebar').text('');
        }
        $('#version-sidebar').text('(Release 1.0.14.11.25)');
    }

    function renderCompanyInfoForm() { const company = getData('companyInfo'); $('#company-name').val(company.name); $('#company-address').val(company.address); $('#company-city').val(company.city); $('#company-zip').val(company.zip); $('#company-province').val(company.province); }
    function renderProductsTable() { 
        const products = getData('products'); 
        const tableBody = $('#products-table-body').empty(); 
        products.forEach(p => { 
            const purchasePrice = p.purchasePrice ? `€ ${p.purchasePrice.toFixed(2)}` : '-';
            const salePrice = p.salePrice ? `€ ${p.salePrice.toFixed(2)}` : '-';
            const location = `${p.corsia || '-'} / ${p.scaffale || '-'} / ${p.piano || '-'}`; 
            tableBody.append(`<tr>
                <td>${p.code}</td>
                <td>${p.description}</td>
                <td>${purchasePrice}</td>
                <td>${salePrice}</td>
                <td>${location}</td>
                <td><strong>${p.giacenza || 0}</strong></td>
                <td><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td>
            </tr>`); 
        }); 
    }
    function renderInventoryTable() { const products = getData('products'); const tableBody = $('#inventory-table-body').empty(); products.forEach(p => { const location = `${p.corsia || '-'} / ${p.scaffale || '-'} / ${p.piano || '-'}`; tableBody.append(`<tr><td>${p.code}</td><td>${p.description}</td><td>${location}</td><td><strong>${p.giacenza || 0}</strong></td></tr>`); }); }
    function renderCustomersTable() { const customers = getData('customers'); const tableBody = $('#customers-table-body').empty(); customers.forEach(c => tableBody.append(`<tr><td>${c.id}</td><td>${c.name}</td><td>${c.piva}</td><td>${c.address}</td><td><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`)); }
    function renderSuppliersTable() { const suppliers = getData('suppliers'); const tableBody = $('#suppliers-table-body').empty(); suppliers.forEach(s => tableBody.append(`<tr><td>${s.id}</td><td>${s.name}</td><td>${s.piva}</td><td>${s.address}</td><td><button class="btn btn-sm btn-primary btn-edit-supplier" data-id="${s.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-supplier" data-id="${s.id}"><i class="fas fa-trash"></i></button></td></tr>`)); }
    function renderCustomerOrdersTable() { const orders = getData('customerOrders'); const customers = getData('customers'); const tableBody = $('#customer-orders-table-body').empty(); orders.forEach(o => { const customer = customers.find(c => c.id == o.customerId) || { name: 'Sconosciuto' }; let statusBadge; if (o.status === 'In lavorazione') statusBadge = `<span class="badge bg-warning text-dark">${o.status}</span>`; else if (o.status === 'Parzialmente Evaso') statusBadge = `<span class="badge bg-info">${o.status}</span>`; else if (o.status === 'Evaso') statusBadge = `<span class="badge bg-success">${o.status}</span>`; tableBody.append(`<tr><td>${o.number}</td><td>${o.date}</td><td>${customer.name}</td><td>€ ${o.total.toFixed(2)}</td><td>${statusBadge}</td><td><button class="btn btn-sm btn-info btn-view-customer-order" data-id="${o.id}" data-bs-toggle="modal" data-bs-target="#customerOrderDetailModal">Visualizza</button></td></tr>`); }); }
    function renderCustomerDdtsTable() { 
        const ddts = getData('customerDdts'); 
        const customers = getData('customers'); 
        const tableBody = $('#customer-ddts-table-body').empty(); 
        ddts.forEach(d => { 
            const customer = customers.find(c => c.id == d.customerId) || { name: 'Sconosciuto' }; 
            const status = d.status === 'Fatturato' ? `<span class="badge bg-success">${d.status}</span>` : `<span class="badge bg-secondary">${d.status}</span>`; 
            let actions = `<button class="btn btn-sm btn-secondary btn-view-ddt" data-id="${d.id}" data-bs-toggle="modal" data-bs-target="#ddtDetailModal">Visualizza</button>`;
            if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Supervisor')) {
                actions += ` <button class="btn btn-sm btn-danger btn-delete-ddt" data-id="${d.id}"><i class="fas fa-trash"></i></button>`;
            }
            tableBody.append(`<tr><td>${d.number}</td><td>${d.date}</td><td>${customer.name}</td><td>${d.orderNumber}</td><td>${status}</td><td>${actions}</td></tr>`); 
        }); 
    }
    function renderSupplierOrdersTable() { const orders = getData('supplierOrders'); const suppliers = getData('suppliers'); const tableBody = $('#supplier-orders-table-body').empty(); orders.forEach(o => { const supplier = suppliers.find(s => s.id == o.supplierId) || { name: 'Sconosciuto' }; let statusBadge; if (o.status === 'Inviato') statusBadge = `<span class="badge bg-primary">${o.status}</span>`; else if (o.status === 'Parzialmente Ricevuto') statusBadge = `<span class="badge bg-info">${o.status}</span>`; else if (o.status === 'Ricevuto') statusBadge = `<span class="badge bg-success">${o.status}</span>`; tableBody.append(`<tr><td>${o.number}</td><td>${o.date}</td><td>${supplier.name}</td><td>€ ${o.total.toFixed(2)}</td><td>${statusBadge}</td><td><button class="btn btn-sm btn-info btn-view-supplier-order" data-id="${o.id}" data-bs-toggle="modal" data-bs-target="#supplierOrderDetailModal">Visualizza</button></td></tr>`); }); }
    function renderSupplierDdtsTable() { const ddts = getData('supplierDdts'); const suppliers = getData('suppliers'); const company = getData('companyInfo'); const tableBody = $('#supplier-ddts-table-body').empty(); ddts.forEach(d => { const supplier = suppliers.find(s => s.id == d.supplierId) || { name: 'Sconosciuto' }; const destination = `${company.name}<br><small>${company.address}, ${company.zip} ${company.city} (${company.province})</small>`; tableBody.append(`<tr><td>${d.number}</td><td>${d.date}</td><td>${supplier.name}</td><td>${destination}</td><td>${d.orderNumber}</td><td><button class="btn btn-sm btn-secondary btn-view-supplier-ddt" data-id="${d.id}" data-bs-toggle="modal" data-bs-target="#supplierDdtDetailModal">Visualizza</button></td></tr>`); }); }
    function renderUsersTable() { const users = getData('users'); const tableBody = $('#users-table-body').empty(); users.forEach(u => tableBody.append(`<tr><td>${u.id}</td><td>${u.surname}</td><td>${u.name}</td><td>${u.role}</td><td><button class="btn btn-sm btn-primary btn-edit-user" data-id="${u.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-user" data-id="${u.id}"><i class="fas fa-trash"></i></button></td></tr>`)); }
    
    function renderInvoicesTable() { 
        const invoices = getData('invoices'); 
        const customers = getData('customers'); 
        const tableBody = $('#invoices-table-body').empty(); 
        invoices.forEach(inv => { 
            const customer = customers.find(c => c.id == inv.customerId) || { name: 'Sconosciuto' }; 
            let actions = `<button class="btn btn-sm btn-info btn-view-invoice" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal">Dettagli</button>`;
            if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Supervisor')) {
                actions += ` <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}"><i class="fas fa-trash"></i></button>`;
            }
            tableBody.append(`<tr><td>${inv.number}</td><td>${inv.date}</td><td>${customer.name}</td><td>€ ${inv.total.toFixed(2)}</td><td>${actions}</td></tr>`); 
        }); 
    }

    // --- LOGIN E NAVIGAZIONE ---
    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        const username = $('#username').val();
        const password = $('#password').val();
        
        let users = getData('users');
        if (users.length === 0) { 
            const adminUser = { id: 1, surname: 'admin', name: 'Amministratore', password: 'gestionale', role: 'Admin' };
            users = [adminUser];
            saveData('users', users);
            console.log("Anagrafica utenti vuota. Creato utente admin di default.");
        }
        
        const user = users.find(u => u.surname.toLowerCase() === username.toLowerCase() && u.password === password);

        if (user) {
            currentUser = user; 

            // Modalità di primo avvio: se esiste solo l'utente admin/gestionale creato di default
            const isDefaultAdmin = user.surname && user.surname.toLowerCase() === 'admin' && user.password === 'gestionale';
            const onlyOneUser = users.length === 1;
            isSetupMode = isDefaultAdmin && onlyOneUser;

            $('#login-container').addClass('d-none');
            $('#main-app').removeClass('d-none');
            initializeApp();
        } else {
            $('#error-message').removeClass('d-none');
        }
    });
    $('#logout-btn').on('click', function(e) { 
        e.preventDefault(); 
        currentUser = null; 
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        location.reload(); 
    });
    $('.sidebar .nav-link').on('click', function(e) {
        if ($(this).attr('id') === 'logout-btn') return;
        e.preventDefault();
        $('.sidebar .nav-link').removeClass('active');
        $(this).addClass('active');
        $('.content-section').addClass('d-none');
        $('#' + $(this).data('target')).removeClass('d-none');
    });

    function updateMenuVisibility() {
        if (currentUser && currentUser.role === 'User') {
            $('#menu-nuovo-ordine-cliente, #menu-nuovo-ordine-fornitore').hide();
            $('#menu-anagrafica-clienti, #menu-anagrafica-fornitori, #menu-anagrafica-azienda').hide();
            $('#menu-fatturazione, #menu-elenco-fatture').hide();
        } else {
            $('#menu-nuovo-ordine-cliente, #menu-nuovo-ordine-fornitore').show();
            $('#menu-anagrafica-clienti, #menu-anagrafica-fornitori, #menu-anagrafica-azienda').show();
            $('#menu-fatturazione, #menu-elenco-fatture').show();
        }
    }

    // --- MENU DI PRIMO AVVIO (SETUP) ---
    function applySetupModeMenu() {
        if (!isSetupMode) {
            return;
        }

        // Nascondi tutte le voci del menu
        $('.sidebar .nav-item').hide();

        // Mostra Home
        $('.sidebar .nav-link[data-target="home"]').closest('.nav-item').show();

        // Mostra sezione "Impostazioni"
        $('.sidebar .nav-section-title').filter(function() {
            return $(this).text().trim().toLowerCase() === 'impostazioni';
        }).closest('.nav-item').show();

        // Mostra le tre voci: Anagrafica Azienda, Anagrafica Utenti, Avanzate
        $('#menu-anagrafica-azienda').show();
        $('.sidebar .nav-link[data-target="anagrafica-utenti"]').closest('.nav-item').show();
        $('.sidebar .nav-link[data-target="avanzate"]').closest('.nav-item').show();

        // Mostra Logout
        $('#logout-btn').closest('.nav-item').show();
    }

    // --- FILTRI DI RICERCA ANAGRAFICHE ---
    function applySearchFilter(inputSelector, tableBodySelector) {
        $(inputSelector).on('keyup', function() {
            const term = $(this).val().toLowerCase();
            $(`${tableBodySelector} tr`).each(function() {
                const rowText = $(this).text().toLowerCase();
                $(this).toggle(rowText.indexOf(term) !== -1);
            });
        });
    }

    applySearchFilter('#customer-search-input', '#customers-table-body');
    applySearchFilter('#supplier-search-input', '#suppliers-table-body');
    applySearchFilter('#product-search-input', '#products-table-body');

    // --- CRUD ANAGRAFICHE ---
    function prepareNewItemModal(type) {
        const form = $(`#${type}Form`);
        if (form.length) form[0].reset();
        $(`#${type}-id`).val('');
        $(`#${type}ModalTitle`).text(`Nuovo ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (type === 'user') {
            $('#togglePassword i').removeClass('fa-eye-slash').addClass('fa-eye');
            $('#user-password').attr('type', 'password');
        }
    }

    function editItem(type, id) {
        const items = getData(`${type}s`);
        const item = items.find(i => i.id == id);
        if (!item) return;

        prepareNewItemModal(type);
        $(`#${type}ModalTitle`).text(`Modifica ${type.charAt(0).toUpperCase() + type.slice(1)}`);

        for (const key in item) {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                const field = $(`#${type}-${key}`);
                if (field.length) {
                    field.val(item[key]);
                }
            }
        }

        if (type === 'product') {
            $('#product-purchase-price').val(item.purchasePrice);
            $('#product-sale-price').val(item.salePrice);
            $('#product-loc-corsia').val(item.corsia);
            $('#product-loc-scaffale').val(item.scaffale);
            $('#product-loc-piano').val(item.piano);
        }

        $(`#${type}-id`).val(item.id);
        $(`#${type}Modal`).modal('show');
    }

    function deleteItem(type, id) {
        const typePlural = `${type}s`;
        const items = getData(typePlural);
        const item = items.find(i => i.id == id);
        if (!item) return;

        const itemName = item.name || item.description || item.surname;
        if (confirm(`Sei sicuro di voler eliminare "${itemName}"?`)) {
            const updatedItems = items.filter(i => i.id != id);
            saveData(typePlural, updatedItems);
            
            switch(type) {
                case 'product': renderProductsTable(); renderInventoryTable(); populateDropdowns(); break;
                case 'customer': renderCustomersTable(); populateDropdowns(); break;
                case 'supplier': renderSuppliersTable(); populateDropdowns(); break;
                case 'user': renderUsersTable(); break;
            }
        }
    }

    ['product', 'customer', 'supplier', 'user'].forEach(type => {
        $(`#new${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).on('click', function() {
            prepareNewItemModal(type);
        });

        $(`#save${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).on('click', function() {
            const typePlural = `${type}s`;
            let items = getData(typePlural);
            const id = $(`#${type}-id`).val();
            
            let itemData = {};
            if (type === 'product') {
                itemData = {
                    code: $('#product-code').val(),
                    description: $('#product-description').val(),
                    purchasePrice: parseFloat($('#product-purchase-price').val()) || 0,
                    salePrice: parseFloat($('#product-sale-price').val()) || 0,
                    iva: parseInt($('#product-iva').val()) || 22,
                    corsia: $('#product-loc-corsia').val(),
                    scaffale: $('#product-loc-scaffale').val(),
                    piano: $('#product-loc-piano').val(),
                };
            } else if (type === 'customer') {
                itemData = { name: $('#customer-name').val(), piva: $('#customer-piva').val(), address: $('#customer-address').val() };
            } else if (type === 'supplier') {
                itemData = { name: $('#supplier-name').val(), piva: $('#supplier-piva').val(), address: $('#supplier-address').val() };
            } else if (type === 'user') {
                itemData = { surname: $('#user-surname').val(), name: $('#user-name').val(), password: $('#user-password').val(), role: $('#user-role').val() };
            }

            if (id) {
                const index = items.findIndex(i => i.id == id);
                if (index > -1) {
                    items[index] = { ...items[index], ...itemData };
                }
            } else {
                if (type === 'product') {
                    let maxIdNum = 0;
                    items.forEach(p => {
                        const numId = parseInt(String(p.id).replace('PRD', ''));
                        if (!isNaN(numId) && numId > maxIdNum) maxIdNum = numId;
                    });
                    itemData.id = 'PRD' + (maxIdNum + 1);
                    itemData.giacenza = 0;
                } else {
                    itemData.id = getNextId(items);
                }
                items.push(itemData);
            }

            saveData(typePlural, items);

            switch(type) {
                case 'product': renderProductsTable(); renderInventoryTable(); populateDropdowns(); break;
                case 'customer': renderCustomersTable(); populateDropdowns(); break;
                case 'supplier': renderSuppliersTable(); populateDropdowns(); break;
                case 'user': renderUsersTable(); break;
            }
            $(`#${type}Modal`).modal('hide');
        });

        const tableBodyId = `#${type}s-table-body`;
        $(tableBodyId).on('click', `.btn-edit-${type}`, function() { editItem(type, $(this).data('id')); });
        $(tableBodyId).on('click', `.btn-delete-${type}`, function() { deleteItem(type, $(this).data('id')); });
    });

    $('#togglePassword').on('click', function() {
        const passwordField = $('#user-password');
        const type = passwordField.attr('type') === 'password' ? 'text' : 'password';
        passwordField.attr('type', type);
        $(this).find('i').toggleClass('fa-eye fa-eye-slash');
    });

    // --- HOME PAGE ---
    function renderHomePage() {
        if(currentUser) {
            $('#welcome-message').text(`Benvenuto, ${currentUser.name} ${currentUser.surname}`);
        }
        
        function updateDateTime() {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
            $('#current-datetime').text(now.toLocaleDateString('it-IT', options));
        }
        
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);

        renderCalendar();
        loadUserNotes();
    }

    function renderCalendar() {
        const calendarWidget = $('#calendar-widget');
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const today = now.getDate();
    
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
    
        const monthName = firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        
        let html = `<h5 class="text-center">${monthName}</h5>`;
        html += '<table class="table table-bordered">';
        html += '<thead><tr><th>Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead>';
        html += '<tbody><tr>';
    
        let dayOfWeek = firstDay.getDay();
        for (let i = 0; i < dayOfWeek; i++) {
            html += '<td></td>';
        }
    
        for (let day = 1; day <= lastDay.getDate(); day++) {
            if (dayOfWeek === 7) {
                dayOfWeek = 0;
                html += '</tr><tr>';
            }
            const isToday = (day === today) ? ' class="today"' : '';
            html += `<td${isToday}>${day}</td>`;
            dayOfWeek++;
        }
    
        for (let i = dayOfWeek; i < 7; i++) {
            html += '<td></td>';
        }
    
        html += '</tr></tbody></table>';
        calendarWidget.html(html);
    }
    
    function loadUserNotes() {
        if (!currentUser) return;
        const notes = getData('notes');
        const userNote = notes.find(note => note.userId === currentUser.id);
        if (userNote) {
            $('#notes-textarea').val(userNote.text);
        } else {
            $('#notes-textarea').val('');
        }
    }

    $('#save-notes-btn').on('click', function() {
        if (!currentUser) return;
        let notes = getData('notes');
        const noteText = $('#notes-textarea').val();
        const userNoteIndex = notes.findIndex(note => note.userId === currentUser.id);

        if (userNoteIndex > -1) {
            notes[userNoteIndex].text = noteText;
        } else {
            notes.push({ userId: currentUser.id, text: noteText });
        }
        saveData('notes', notes);
        alert("Appunti salvati!");
    });


    // --- MOVIMENTI MAGAZZINO ---
    $('#manual-load-form').on('submit', function(e) {
        e.preventDefault();
        const productId = $('#load-product-select').val();
        const qty = parseInt($('#load-product-qty').val());
        
        if(!productId || !qty || qty <= 0) {
            alert("Seleziona un prodotto e inserisci una quantità valida.");
            return;
        }

        let products = getData('products');
        const productIndex = products.findIndex(p => p.id === productId);
        if(productIndex > -1) {
            products[productIndex].giacenza = (products[productIndex].giacenza || 0) + qty;
            saveData('products', products);
            alert(`Caricati ${qty} pz di "${products[productIndex].description}". Nuova giacenza: ${products[productIndex].giacenza}`);
            renderInventoryTable();
            renderProductsTable();
            $(this)[0].reset();
        }
    });

    $('#manual-unload-form').on('submit', function(e) {
        e.preventDefault();
        const productId = $('#unload-product-select').val();
        const qty = parseInt($('#unload-product-qty').val());

        if(!productId || !qty || qty <= 0) {
            alert("Seleziona un prodotto e inserisci una quantità valida.");
            return;
        }

        let products = getData('products');
        const productIndex = products.findIndex(p => p.id === productId);
        if(productIndex > -1) {
            if((products[productIndex].giacenza || 0) < qty) {
                alert("Errore: Giacenza insufficiente per effettuare lo scarico.");
                return;
            }
            products[productIndex].giacenza -= qty;
            saveData('products', products);
            alert(`Scaricati ${qty} pz di "${products[productIndex].description}". Nuova giacenza: ${products[productIndex].giacenza}`);
            renderInventoryTable();
            renderProductsTable();
            $(this)[0].reset();
        }
    });

    $('#stock-query-product-select').on('change', function() {
        const productId = $(this).val();
        const resultCard = $('#stock-query-result');

        if (!productId) {
            resultCard.addClass('d-none');
            return;
        }

        const products = getData('products');
        const product = products.find(p => p.id === productId);

        if (product) {
            $('#stock-query-product-name').text(`${product.code} - ${product.description}`);
            $('#stock-query-qty').text(product.giacenza || 0);
            const location = `${product.corsia || '-'} / ${product.scaffale || '-'} / ${product.piano || '-'}`;
            $('#stock-query-location').text(location);
            resultCard.removeClass('d-none');
        } else {
            resultCard.addClass('d-none');
        }
    });
    
    // --- CICLO ATTIVO (CLIENTI) ---
    let currentOrderLines = [];

    function updateOrderTotal() {
        const total = currentOrderLines.reduce((sum, line) => sum + line.subtotal, 0);
        $('#order-total').text(`€ ${total.toFixed(2)}`);
    }

    function renderOrderLines() {
        const tbody = $('#order-lines-tbody').empty();
        currentOrderLines.forEach((line, index) => {
            tbody.append(`<tr>
                <td>${line.productName}</td>
                <td>${line.qty}</td>
                <td>€ ${line.price.toFixed(2)}</td>
                <td>€ ${line.subtotal.toFixed(2)}</td>
                <td><button type="button" class="btn btn-sm btn-danger remove-order-line" data-index="${index}"><i class="fas fa-times"></i></button></td>
            </tr>`);
        });
        updateOrderTotal();
    }

    $('#order-product-select').on('change', function() {
        const productId = $(this).val();
        if (!productId) {
            $('#order-product-price').val('');
            return;
        }
        const products = getData('products');
        const product = products.find(p => p.id === productId);
        if (product) {
            $('#order-product-price').val(product.salePrice.toFixed(2));
        }
    });

    $('#add-product-to-order-btn').on('click', function() {
        const productId = $('#order-product-select').val();
        const qty = parseInt($('#order-product-qty').val());
        let price = parseFloat($('#order-product-price').val());
        const products = getData('products');
        const product = products.find(p => p.id === productId);

        if (!product || !qty || qty <= 0) {
            alert("Selezionare un prodotto e una quantità valida.");
            return;
        }
        if (isNaN(price)) price = product.salePrice;

        currentOrderLines.push({
            productId: product.id,
            productName: `${product.code} - ${product.description}`,
            qty,
            price,
            subtotal: qty * price
        });
        renderOrderLines();

        $('#order-product-qty').val(1);
        $('#order-product-price').val('');
        $('#order-product-select').val('');
    });
    
    $('#order-lines-tbody').on('click', '.remove-order-line', function() {
        const index = $(this).data('index');
        currentOrderLines.splice(index, 1);
        renderOrderLines();
    });

    $('#new-customer-order-form').on('submit', function(e) {
        e.preventDefault();
        const customerId = $('#order-customer-select').val();
        if (!customerId || currentOrderLines.length === 0) {
            alert("Selezionare un cliente e aggiungere almeno un prodotto all'ordine.");
            return;
        }

        let orders = getData('customerOrders');
        const total = currentOrderLines.reduce((sum, line) => sum + line.subtotal, 0);
        const newOrder = {
            id: getNextId(orders),
            number: $('#order-customer-number').val(),
            date: $('#order-customer-date').val(),
            customerId: customerId,
            lines: currentOrderLines,
            total: total,
            status: 'In lavorazione',
        };
        newOrder.lines.forEach(l => l.qtyEvasa = 0); 

        orders.push(newOrder);
        saveData('customerOrders', orders);

        alert(`Ordine ${newOrder.number} salvato con successo!`);
        currentOrderLines = [];
        renderOrderLines();
        $(this)[0].reset();
        populateDropdowns();
        renderCustomerOrdersTable();
    });

    $('#customer-orders-table-body').on('click', '.btn-view-customer-order', function() {
        const orderId = $(this).data('id');
        const orders = getData('customerOrders');
        const order = orders.find(o => o.id == orderId);
    
        if (!order) {
            alert("Ordine non trovato!");
            return;
        }

        // Mostra o nascondi il pulsante elimina in base al ruolo
        if (currentUser && currentUser.role === 'User') {
            $('#delete-customer-order-btn').hide();
        } else {
            $('#delete-customer-order-btn').show();
        }
    
        const customers = getData('customers');
        const customer = customers.find(c => c.id == order.customerId) || { name: 'Sconosciuto' };
    
        $('#customerOrderDetailModalTitle').text(`Dettaglio Ordine N° ${order.number}`);
    
        let modalBodyHtml = `
            <div class="row mb-3">
                <div class="col-md-6"><strong>Cliente:</strong> ${customer.name}</div>
                <div class="col-md-6"><strong>Data Ordine:</strong> ${order.date}</div>
            </div>
            <h5>Riepilogo Prodotti</h5>
            <table class="table table-sm">
                <thead><tr><th>Prodotto</th><th>Quantità</th><th>Prezzo Unitario</th><th>Subtotale</th></tr></thead>
                <tbody>`;
    
        order.lines.forEach(line => {
            modalBodyHtml += `
                <tr>
                    <td>${line.productName}</td>
                    <td>${line.qty}</td>
                    <td>€ ${line.price.toFixed(2)}</td>
                    <td>€ ${line.subtotal.toFixed(2)}</td>
                </tr>`;
        });
    
        modalBodyHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" class="text-end">Totale Ordine:</th>
                        <th>€ ${order.total.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
            <div class="mt-3"><strong>Stato Ordine:</strong> ${order.status}</div>`;
    
        $('#customerOrderDetailModalBody').html(modalBodyHtml);
        $('#delete-customer-order-btn').data('order-id', orderId); 
    });

    $('#delete-customer-order-btn').on('click', function() {
        const orderId = $(this).data('order-id');
        if (!orderId) return;

        if (confirm("Sei sicuro di voler eliminare questo ordine? L'operazione non è reversibile.")) {
            let orders = getData('customerOrders');
            const updatedOrders = orders.filter(o => o.id != orderId);
            saveData('customerOrders', updatedOrders);

            $('#customerOrderDetailModal').modal('hide');
            renderCustomerOrdersTable();
            populateDropdowns();
            alert("Ordine eliminato con successo.");
        }
    });

    $('#ddt-order-select').on('change', function() {
        const orderId = $(this).val();
        const ddtSection = $('#ddt-details-section');
        if (!orderId) {
            ddtSection.addClass('d-none');
            return;
        }
    
        const orders = getData('customerOrders');
        const order = orders.find(o => o.id == orderId);
        const customers = getData('customers');
        const customer = customers.find(c => c.id == order.customerId);
    
        $('#ddt-customer-name').val(customer.name);
        $('#ddt-number').val('DDT-' + (getData('customerDdts').length + 1));
        $('#ddt-date').val(new Date().toISOString().slice(0, 10));
    
        const tbody = $('#ddt-products-tbody').empty();
        order.lines.forEach(line => {
            const qtyResidua = line.qty - (line.qtyEvasa || 0);
            if (qtyResidua > 0) {
                tbody.append(`
                    <tr>
                        <td>${line.productName}</td>
                        <td>${line.qty}</td>
                        <td>${qtyResidua}</td>
                        <td><input type="number" class="form-control form-control-sm ddt-ship-qty" 
                                   min="0" max="${qtyResidua}" value="${qtyResidua}" 
                                   data-product-id="${line.productId}" data-line-index="${order.lines.indexOf(line)}"></td>
                    </tr>
                `);
            }
        });
    
        ddtSection.removeClass('d-none');
    });

    $('#new-customer-ddt-form').on('submit', function(e) {
        e.preventDefault();
        const orderId = $('#ddt-order-select').val();
        if (!orderId) return;
    
        let orders = getData('customerOrders');
        const orderIndex = orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
    
        const ddtLines = [];
        let isAnyProductShipped = false;
    
        $('.ddt-ship-qty').each(function() {
            const qtyToShip = parseInt($(this).val());
            if (qtyToShip > 0) {
                isAnyProductShipped = true;
                const lineIndex = $(this).data('line-index');
                const originalLine = orders[orderIndex].lines[lineIndex];
                
                ddtLines.push({
                    productId: originalLine.productId,
                    productName: originalLine.productName,
                    qty: qtyToShip,
                    price: originalLine.price,
                    subtotal: qtyToShip * originalLine.price
                });
                
                orders[orderIndex].lines[lineIndex].qtyEvasa = (orders[orderIndex].lines[lineIndex].qtyEvasa || 0) + qtyToShip;
            }
        });
    
        if (!isAnyProductShipped) {
            alert("Nessun prodotto selezionato per la spedizione. Inserire una quantità maggiore di zero.");
            return;
        }
    
        let totalQtyOrdered = orders[orderIndex].lines.reduce((sum, l) => sum + l.qty, 0);
        let totalQtyShipped = orders[orderIndex].lines.reduce((sum, l) => sum + (l.qtyEvasa || 0), 0);
    
        if (totalQtyShipped >= totalQtyOrdered) {
            orders[orderIndex].status = 'Evaso';
        } else {
            orders[orderIndex].status = 'Parzialmente Evaso';
        }
        saveData('customerOrders', orders);
    
        let ddts = getData('customerDdts');
        const newDdt = {
            id: getNextId(ddts),
            number: $('#ddt-number').val(),
            date: $('#ddt-date').val(),
            customerId: orders[orderIndex].customerId,
            orderNumber: orders[orderIndex].number,
            lines: ddtLines,
            status: 'Da Fatturare',
            aspettoBeni: $('#ddt-aspetto-beni').val(),
            numColli: $('#ddt-num-colli').val(),
            peso: $('#ddt-peso').val(),
            vettore: $('#ddt-vettore').val(),
            dataTrasporto: $('#ddt-data-trasporto').val(),
            dataRicezione: $('#ddt-data-ricezione').val()
        };
        ddts.push(newDdt);
        saveData('customerDdts', ddts);
    
        let products = getData('products');
        ddtLines.forEach(line => {
            const productIndex = products.findIndex(p => p.id === line.productId);
            if (productIndex !== -1) {
                products[productIndex].giacenza -= line.qty;
            }
        });
        saveData('products', products);
    
        alert(`DDT ${newDdt.number} generato con successo!`);
        $(this)[0].reset();
        $('#ddt-details-section').addClass('d-none');
        renderAll();
    });

    $('#customer-ddts-table-body').on('click', '.btn-view-ddt', function() {
        const ddtId = $(this).data('id');
        const ddts = getData('customerDdts');
        const ddt = ddts.find(d => d.id == ddtId);

        if (!ddt) {
            alert("DDT non trovato!");
            return;
        }

        const customers = getData('customers');
        const customer = customers.find(c => c.id == ddt.customerId) || { name: 'Sconosciuto' };

        $('#ddtDetailModalTitle').text(`Dettaglio DDT N° ${ddt.number}`);

        let modalBodyHtml = `
            <div class="row mb-3">
                <div class="col-md-6"><strong>Cliente:</strong> ${customer.name}</div>
                <div class="col-md-3"><strong>Data DDT:</strong> ${ddt.date}</div>
                <div class="col-md-3"><strong>Rif. Ordine:</strong> ${ddt.orderNumber}</div>
            </div>
            <div class="row mb-3">
                <div class="col-md-3"><strong>Aspetto Beni:</strong> ${ddt.aspettoBeni || '-'}</div>
                <div class="col-md-3"><strong>Num. Colli:</strong> ${ddt.numColli || '-'}</div>
                <div class="col-md-3"><strong>Peso:</strong> ${ddt.peso || '-'}</div>
                <div class="col-md-3"><strong>Vettore:</strong> ${ddt.vettore || '-'}</div>
            </div>
            <div class="row mb-3">
                <div class="col-md-6"><strong>Data Inizio Trasporto:</strong> ${ddt.dataTrasporto || '-'}</div>
                <div class="col-md-6"><strong>Data Ricezione:</strong> ${ddt.dataRicezione || '-'}</div>
            </div>
            <h5 class="mt-4">Prodotti Spediti</h5>
            <table class="table table-sm">
                <thead><tr><th>Prodotto</th><th>Quantità</th><th>Prezzo Unitario</th><th>Subtotale</th></tr></thead>
                <tbody>`;

        ddt.lines.forEach(line => {
            modalBodyHtml += `
                <tr>
                    <td>${line.productName}</td>
                    <td>${line.qty}</td>
                    <td>€ ${line.price.toFixed(2)}</td>
                    <td>€ ${line.subtotal.toFixed(2)}</td>
                </tr>`;
        });
        
        const total = ddt.lines.reduce((sum, line) => sum + line.subtotal, 0);

        modalBodyHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" class="text-end">Totale Imponibile:</th>
                        <th>€ ${total.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
            <div class="mt-3"><strong>Stato DDT:</strong> ${ddt.status}</div>`;

        $('#ddtDetailModalBody').html(modalBodyHtml);
    });
    
    $('#customer-ddts-table-body').on('click', '.btn-delete-ddt', function() {
        const ddtId = $(this).data('id');
        if (!ddtId) return;
    
        let ddts = getData('customerDdts');
        const ddtIndex = ddts.findIndex(d => d.id == ddtId);
        if (ddtIndex === -1) return;
    
        const ddtToDelete = ddts[ddtIndex];
    
        if (ddtToDelete.status === 'Fatturato') {
            alert("Impossibile eliminare un DDT che è già stato fatturato. Eliminare prima la fattura corrispondente.");
            return;
        }
    
        if (confirm(`Sei sicuro di voler eliminare il DDT N° ${ddtToDelete.number}? L'operazione ripristinerà le giacenze e lo stato dell'ordine collegato.`)) {
            // 1. Ripristina giacenze
            let products = getData('products');
            ddtToDelete.lines.forEach(line => {
                const productIndex = products.findIndex(p => p.id === line.productId);
                if (productIndex !== -1) {
                    products[productIndex].giacenza += line.qty;
                }
            });
            saveData('products', products);
    
            // 2. Aggiorna stato ordine
            let orders = getData('customerOrders');
            const orderIndex = orders.findIndex(o => o.number === ddtToDelete.orderNumber);
            if (orderIndex !== -1) {
                ddtToDelete.lines.forEach(ddtLine => {
                    const orderLine = orders[orderIndex].lines.find(ol => ol.productId === ddtLine.productId);
                    if (orderLine) {
                        orderLine.qtyEvasa = (orderLine.qtyEvasa || 0) - ddtLine.qty;
                    }
                });
    
                let totalQtyShipped = orders[orderIndex].lines.reduce((sum, l) => sum + (l.qtyEvasa || 0), 0);
                if (totalQtyShipped <= 0) {
                    orders[orderIndex].status = 'In lavorazione';
                } else {
                    orders[orderIndex].status = 'Parzialmente Evaso';
                }
                saveData('customerOrders', orders);
            }
    
            // 3. Elimina DDT
            ddts.splice(ddtIndex, 1);
            saveData('customerDdts', ddts);
    
            alert("DDT eliminato con successo.");
            renderAll();
        }
    });

    $('#print-ddt-btn').on('click', function() {
        window.print();
    });

    function populateDropdowns() {
        const customers = getData('customers');
        const suppliers = getData('suppliers');
        const products = getData('products');
        const productOptions = products.map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`).join('');
        
        $('#order-customer-select, #invoice-customer-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(customers.map(c => `<option value="${c.id}">${c.name}</option>`));
        $('#order-product-select, #load-product-select, #unload-product-select, #stock-query-product-select, #order-supplier-product-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(productOptions);
        
        $('#order-customer-number').val('ORD-C-' + (getData('customerOrders').length + 1));
        $('#order-customer-date').val(new Date().toISOString().slice(0, 10));
        
        const openOrders = getData('customerOrders').filter(o => o.status === 'In lavorazione' || o.status === 'Parzialmente Evaso');
        $('#ddt-order-select').empty().append('<option selected disabled value="">Seleziona un ordine...</option>').append(openOrders.map(o => { const c = customers.find(c => c.id == o.customerId); return `<option value="${o.id}">${o.number} - ${c.name}</option>`; }));
        
        $('#order-supplier-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(suppliers.map(s => `<option value="${s.id}">${s.name}</option>`));
        $('#order-supplier-number').val('ORD-F-' + (getData('supplierOrders').length + 1));
        $('#order-supplier-date').val(new Date().toISOString().slice(0, 10));
        
        const openSupplierOrders = getData('supplierOrders').filter(o => o.status === 'Inviato' || o.status === 'Parzialmente Ricevuto');
        $('#ddt-supplier-order-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(openSupplierOrders.map(o => { const s = suppliers.find(s => s.id == o.supplierId); return `<option value="${o.id}">${o.number} - ${s.name}</option>`; }));
    }
    
    // --- FATTURAZIONE ---
    $('#invoice-customer-select').on('change', function() {
        const customerId = $(this).val();
        const ddts = getData('customerDdts');
        const ddtsToInvoice = ddts.filter(d => d.customerId == customerId && d.status === 'Da Fatturare');
        
        const listContainer = $('#invoice-ddt-list').empty();
        $('#invoice-preview-section').addClass('d-none');
        $('#generate-invoice-preview-btn').show();

        if (ddtsToInvoice.length > 0) {
            ddtsToInvoice.forEach(d => {
                listContainer.append(`<div class="form-check"><input class="form-check-input ddt-to-invoice-check" type="checkbox" value="${d.id}" id="ddt-check-${d.id}"><label class="form-check-label" for="ddt-check-${d.id}">DDT N° ${d.number} del ${d.date}</label></div>`);
            });
        } else {
            listContainer.html('<div class="alert alert-warning">Non ci sono DDT da fatturare per il cliente selezionato.</div>');
            $('#generate-invoice-preview-btn').hide();
        }
        $('#invoice-ddt-section').removeClass('d-none');
    });
    
    $('#generate-invoice-preview-btn').on('click', function() {
        const selectedDdtIds = $('.ddt-to-invoice-check:checked').map(function() {
            return $(this).val();
        }).get();
    
        if (selectedDdtIds.length === 0) {
            alert("Selezionare almeno un DDT da fatturare.");
            return;
        }
    
        const allDdts = getData('customerDdts');
        const products = getData('products');
        const customers = getData('customers');
        const customerId = $('#invoice-customer-select').val();
        const customer = customers.find(c => c.id == customerId);
    
        const ddtsToInvoice = allDdts.filter(d => selectedDdtIds.includes(String(d.id)));
    
        const invoiceLines = {};
        ddtsToInvoice.forEach(ddt => {
            ddt.lines.forEach(line => {
                const product = products.find(p => p.id === line.productId);
                const iva = product ? product.iva : 22;
                const key = `${line.productId}_${line.price}_${iva}`;
    
                if (!invoiceLines[key]) {
                    invoiceLines[key] = {
                        description: line.productName,
                        qty: 0,
                        price: line.price,
                        iva: iva,
                        imponibile: 0
                    };
                }
                invoiceLines[key].qty += line.qty;
                invoiceLines[key].imponibile += line.subtotal;
            });
        });
        
        const previewTbody = $('#invoice-preview-lines-tbody').empty();
        Object.values(invoiceLines).forEach(line => {
            previewTbody.append(`
                <tr>
                    <td>${line.description}</td>
                    <td>${line.qty}</td>
                    <td>€ ${line.price.toFixed(2)}</td>
                    <td>€ ${line.imponibile.toFixed(2)}</td>
                    <td>${line.iva}%</td>
                </tr>
            `);
        });
    
        const summary = {};
        let totalImponibile = 0;
        Object.values(invoiceLines).forEach(line => {
            if (!summary[line.iva]) {
                summary[line.iva] = { imponibile: 0, imposta: 0 };
            }
            summary[line.iva].imponibile += line.imponibile;
            totalImponibile += line.imponibile;
        });
        
        let totalImposta = 0;
        let summaryHtml = '<table class="table table-sm">';
        for (const iva in summary) {
            summary[iva].imposta = summary[iva].imponibile * (iva / 100);
            totalImposta += summary[iva].imposta;
            summaryHtml += `
                <tr><td>Imponibile ${iva}%</td><td class="text-end">€ ${summary[iva].imponibile.toFixed(2)}</td></tr>
                <tr><td>IVA ${iva}%</td><td class="text-end">€ ${summary[iva].imposta.toFixed(2)}</td></tr>
            `;
        }
        summaryHtml += `
            <tr class="fw-bold fs-5">
                <td>Totale Fattura</td>
                <td class="text-end">€ ${(totalImponibile + totalImposta).toFixed(2)}</td>
            </tr>
        </table>`;
        $('#invoice-summary').html(summaryHtml);
    
        $('#invoice-preview-customer').val(customer.name);
        $('#invoice-preview-number').val('FATT-' + (getData('invoices').length + 1));
        $('#invoice-preview-date').val(new Date().toISOString().slice(0, 10));
    
        $('#confirm-invoice-btn').data('invoiceData', {
            ddtIds: selectedDdtIds,
            lines: Object.values(invoiceLines),
            summary: summary,
            total: totalImponibile + totalImposta,
            customerId: customerId
        });
    
        $('#invoice-preview-section').removeClass('d-none');
    });
    
    $('#confirm-invoice-btn').on('click', function() {
        const data = $(this).data('invoiceData');
        if (!data) {
            alert("Errore: dati fattura non trovati.");
            return;
        }
    
        let invoices = getData('invoices');
        const newInvoice = {
            id: getNextId(invoices),
            number: $('#invoice-preview-number').val(),
            date: $('#invoice-preview-date').val(),
            customerId: data.customerId,
            ddts: data.ddtIds,
            lines: data.lines,
            summary: data.summary,
            total: data.total
        };
        invoices.push(newInvoice);
        saveData('invoices', invoices);
    
        let allDdts = getData('customerDdts');
        allDdts.forEach(ddt => {
            if (data.ddtIds.includes(String(ddt.id))) {
                ddt.status = 'Fatturato';
            }
        });
        saveData('customerDdts', allDdts);
        
        alert(`Fattura ${newInvoice.number} creata con successo!`);
        $('#invoice-customer-select').val('');
        $('#invoice-ddt-section').addClass('d-none');
        $('#invoice-preview-section').addClass('d-none');
        renderInvoicesTable();
        renderCustomerDdtsTable();
    });

    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const invoiceId = $(this).data('id');
        const invoices = getData('invoices');
        const invoice = invoices.find(inv => inv.id == invoiceId);

        if (!invoice) {
            alert("Fattura non trovata!");
            return;
        }

        const customers = getData('customers');
        const customer = customers.find(c => c.id == invoice.customerId) || { name: 'Sconosciuto' };

        $('#invoiceDetailModalTitle').text(`Dettaglio Fattura N° ${invoice.number}`);

        const allDdts = getData('customerDdts');
        const ddtNumbers = invoice.ddts.map(ddtId => {
            const ddt = allDdts.find(d => d.id == ddtId);
            return ddt ? ddt.number : `ID:${ddtId}`;
        }).join(', ');

        let modalBodyHtml = `
            <div class="row mb-3">
                <div class="col-md-6"><strong>Cliente:</strong> ${customer.name}</div>
                <div class="col-md-3"><strong>Data Fattura:</strong> ${invoice.date}</div>
                <div class="col-md-3"><strong>Numero:</strong> ${invoice.number}</div>
            </div>
            <p><strong>DDT Inclusi:</strong> ${ddtNumbers}</p>
            <h5>Riepilogo Prodotti</h5>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Descrizione</th>
                        <th>Quantità</th>
                        <th>Prezzo Unitario</th>
                        <th>Imponibile</th>
                        <th>IVA</th>
                    </tr>
                </thead>
                <tbody>`;

        invoice.lines.forEach(line => {
            modalBodyHtml += `
                <tr>
                    <td>${line.description}</td>
                    <td>${line.qty}</td>
                    <td>€ ${line.price.toFixed(2)}</td>
                    <td>€ ${line.imponibile.toFixed(2)}</td>
                    <td>${line.iva}%</td>
                </tr>`;
        });

        modalBodyHtml += `</tbody></table>`;
        
        let summaryHtml = '<div class="row justify-content-end"><div class="col-md-6"><table class="table table-sm">';
        summaryHtml += '<thead><tr><th>Riepilogo IVA</th><th class="text-end">Importo</th></tr></thead><tbody>'

        let totalImponibileFattura = 0;
        for (const iva in invoice.summary) {
            totalImponibileFattura += invoice.summary[iva].imponibile;
        }
        summaryHtml += `<tr><td>Totale Imponibile</td><td class="text-end">€ ${totalImponibileFattura.toFixed(2)}</td></tr>`;
        
        for (const iva in invoice.summary) {
            const imposta = invoice.summary[iva].imposta;
            summaryHtml += `<tr><td>IVA ${iva}%</td><td class="text-end">€ ${imposta.toFixed(2)}</td></tr>`;
        }

        summaryHtml += `
            <tr class="fw-bold fs-5 border-top">
                <td>Totale Fattura</td>
                <td class="text-end">€ ${invoice.total.toFixed(2)}</td>
            </tr>
        </tbody></table></div></div>`;

        modalBodyHtml += summaryHtml;

        $('#invoiceDetailModalBody').html(modalBodyHtml);
    });

    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() {
        const invoiceId = $(this).data('id');
        if (!invoiceId) return;
    
        if (confirm("Sei sicuro di voler eliminare questa fattura? I DDT collegati torneranno allo stato 'Da Fatturare'.")) {
            let invoices = getData('invoices');
            const invoiceIndex = invoices.findIndex(inv => inv.id == invoiceId);
            if (invoiceIndex === -1) return;
    
            const invoiceToDelete = invoices[invoiceIndex];
            
            // Ripristina lo stato dei DDT
            let ddts = getData('customerDdts');
            ddts.forEach(ddt => {
                if (invoiceToDelete.ddts.includes(String(ddt.id))) {
                    ddt.status = 'Da Fatturare';
                }
            });
            saveData('customerDdts', ddts);
    
            // Elimina la fattura
            invoices.splice(invoiceIndex, 1);
            saveData('invoices', invoices);
    
            alert("Fattura eliminata con successo.");
            renderInvoicesTable();
            renderCustomerDdtsTable();
        }
    });

    $('#print-invoice-btn').on('click', function() {
        window.print();
    });

    // --- CICLO PASSIVO (FORNITORI) ---
    let currentSupplierOrderLines = [];

    function updateSupplierOrderTotal() {
        const total = currentSupplierOrderLines.reduce((sum, line) => sum + line.subtotal, 0);
        $('#supplier-order-total').text(`€ ${total.toFixed(2)}`);
    }

    function renderSupplierOrderLines() {
        const tbody = $('#supplier-order-lines-tbody').empty();
        currentSupplierOrderLines.forEach((line, index) => {
            tbody.append(`<tr>
                <td>${line.productName}</td>
                <td>${line.qty}</td>
                <td>€ ${line.price.toFixed(2)}</td>
                <td>€ ${line.subtotal.toFixed(2)}</td>
                <td><button type="button" class="btn btn-sm btn-danger remove-supplier-order-line" data-index="${index}"><i class="fas fa-times"></i></button></td>
            </tr>`);
        });
        updateSupplierOrderTotal();
    }

    $('#add-product-to-supplier-order-btn').on('click', function() {
        const productId = $('#order-supplier-product-select').val();
        const qty = parseInt($('#order-supplier-product-qty').val());
        let price = parseFloat($('#order-supplier-product-price').val());
        const products = getData('products');
        const product = products.find(p => p.id === productId);

        if (!product || !qty || qty <= 0) {
            alert("Selezionare un prodotto e una quantità valida.");
            return;
        }
        if (isNaN(price)) price = product.purchasePrice;

        currentSupplierOrderLines.push({
            productId: product.id,
            productName: `${product.code} - ${product.description}`,
            qty,
            price,
            subtotal: qty * price
        });
        renderSupplierOrderLines();

        $('#order-supplier-product-qty').val(1);
        $('#order-supplier-product-price').val('');
        $('#order-supplier-product-select').val('');
    });

    $('#supplier-order-lines-tbody').on('click', '.remove-supplier-order-line', function() {
        const index = $(this).data('index');
        currentSupplierOrderLines.splice(index, 1);
        renderSupplierOrderLines();
    });

    $('#new-supplier-order-form').on('submit', function(e) {
        e.preventDefault();
        const supplierId = $('#order-supplier-select').val();
        if (!supplierId || currentSupplierOrderLines.length === 0) {
            alert("Selezionare un fornitore e aggiungere almeno un prodotto all'ordine.");
            return;
        }

        let orders = getData('supplierOrders');
        const total = currentSupplierOrderLines.reduce((sum, line) => sum + line.subtotal, 0);
        const newOrder = {
            id: getNextId(orders),
            number: $('#order-supplier-number').val(),
            date: $('#order-supplier-date').val(),
            supplierId: supplierId,
            lines: currentSupplierOrderLines,
            total: total,
            status: 'Inviato', // Stati possibili: Inviato, Parzialmente Ricevuto, Ricevuto
            ricevuto: 0 
        };

        orders.push(newOrder);
        saveData('supplierOrders', orders);

        alert(`Ordine fornitore ${newOrder.number} salvato con successo!`);
        currentSupplierOrderLines = [];
        renderSupplierOrderLines();
        $(this)[0].reset();
        populateDropdowns();
        renderSupplierOrdersTable();
    });


    // --- STATISTICHE ---
    let statChart1Instance = null; 
    let statChart2Instance = null;

    function renderStatisticsPage() {
        if (!currentUser) return;
    
        if (statChart1Instance) statChart1Instance.destroy();
        if (statChart2Instance) statChart2Instance.destroy();
    
        if (currentUser.role === 'Admin' || currentUser.role === 'Supervisor') {
            $('#chart1Title').text('Fatturato Ordini per Mese');
            $('#chart2Title').text('Valore Ordini per Cliente');
    
            // Grafico 1: Fatturato Mensile
            const orders = getData('customerOrders');
            const monthlySales = {};
            orders.forEach(o => {
                const month = o.date.substring(0, 7);
                if (!monthlySales[month]) monthlySales[month] = 0;
                monthlySales[month] += o.total;
            });
            const salesLabels = Object.keys(monthlySales).sort();
            const salesData = salesLabels.map(label => monthlySales[label]);
            statChart1Instance = new Chart($('#statChart1'), { type: 'bar', data: { labels: salesLabels, datasets: [{ label: 'Fatturato Mensile (€)', data: salesData, backgroundColor: 'rgba(0, 123, 255, 0.5)' }] }, options: { scales: { y: { beginAtZero: true } } } });
    
            // Grafico 2: Valore per Cliente
            const customers = getData('customers');
            const salesByCustomer = {};
            orders.forEach(o => {
                const customer = customers.find(c => c.id == o.customerId);
                const customerName = customer ? customer.name : 'Sconosciuto';
                if (!salesByCustomer[customerName]) salesByCustomer[customerName] = 0;
                salesByCustomer[customerName] += o.total;
            });
            const customerLabels = Object.keys(salesByCustomer);
            const customerData = Object.values(salesByCustomer);
            statChart2Instance = new Chart($('#statChart2'), { type: 'pie', data: { labels: customerLabels, datasets: [{ data: customerData }] } });
    
        } else { // User
            $('#chart1Title').text('Top 5 Prodotti per Giacenza');
            $('#chart2Title').text('Top 5 Prodotti in Esaurimento (scorta < 50)');
    
            const products = getData('products');
    
            // Grafico 1: Top 5 Giacenze
            const sortedByStock = [...products].sort((a, b) => (b.giacenza || 0) - (a.giacenza || 0)).slice(0, 5);
            const stockLabels = sortedByStock.map(p => p.description);
            const stockData = sortedByStock.map(p => p.giacenza || 0);
            statChart1Instance = new Chart($('#statChart1'), { type: 'bar', data: { labels: stockLabels, datasets: [{ label: 'Quantità in Giacenza', data: stockData, backgroundColor: 'rgba(40, 167, 69, 0.5)' }] }, options: { scales: { y: { beginAtZero: true } } } });
    
            // Grafico 2: Prodotti in esaurimento
            const lowStockProducts = [...products].filter(p => (p.giacenza || 0) < 50 && (p.giacenza || 0) > 0).sort((a, b) => (a.giacenza || 0) - (b.giacenza || 0)).slice(0, 5);
            const lowStockLabels = lowStockProducts.map(p => p.description);
            const lowStockData = lowStockProducts.map(p => p.giacenza || 0);
            statChart2Instance = new Chart($('#statChart2'), { type: 'doughnut', data: { labels: lowStockLabels, datasets: [{ data: lowStockData, backgroundColor: ['rgba(255, 193, 7, 0.5)', 'rgba(220, 53, 69, 0.5)'] }] } });
        }
    }

    // --- IMPOSTAZIONI E AVANZATE ---
    $('#send-data-btn').on('click', function() {
        if (!currentUser) {
            alert("Per inviare i dati devi essere loggato.");
            return;
        }
        if (!confirm("Vuoi davvero inviare una copia dei dati al docente per la revisione?")) {
            return;
        }

        const payload = {};
        DB_KEYS.forEach(function(key) {
            try {
                payload[key] = JSON.parse(localStorage.getItem(key) || 'null');
            } catch (e) {
                payload[key] = null;
            }
        });

        const formData = new FormData();
        formData.append('subject', 'Invio dati gestionale magazzino didattico');
        formData.append('user', currentUser.surname + ' ' + (currentUser.name || ''));
        formData.append('role', currentUser.role);
        formData.append('json', JSON.stringify(payload, null, 2));

        fetch('https://formspree.io/f/xwpagyqy', {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: formData
        }).then(function(response) {
            if (response.ok) {
                alert("Dati inviati correttamente al docente.");
            } else {
                alert("Si è verificato un problema durante l'invio dei dati (codice " + response.status + ").");
            }
        }).catch(function(error) {
            console.error("Errore durante l'invio dei dati per revisione:", error);
            alert("Si è verificato un errore di rete durante l'invio dei dati.");
        });
    });

    $('#export-data-btn').on('click', function() {
        if (!currentUser) {
            alert("Utente non riconosciuto. Impossibile esportare.");
            return;
        }
    
        const allData = {};
        DB_KEYS.forEach(key => {
            allData[key] = getData(key);
        });
    
        const dataStr = JSON.stringify(allData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
    
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        a.download = `${currentUser.surname}_gestionale_backup_${today}.json`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("Dati esportati con successo.");
    });
    
    $('#import-file-input').on('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        if (!confirm("ATTENZIONE: L'importazione sovrascriverà tutti i dati attuali. Vuoi continuare?")) {
            $(this).val('');
            return;
        }
    
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                let isValid = true;
                DB_KEYS.forEach(key => {
                    if (typeof importedData[key] === 'undefined') {
                        isValid = false;
                    }
                });
    
                if (!isValid) {
                    alert("Errore: Il file di importazione non è valido o è corrotto. La struttura non corrisponde a quella attesa.");
                    return;
                }
    
                DB_KEYS.forEach(key => {
                    saveData(key, importedData[key]);
                });
    
                alert("Dati importati con successo! L'applicazione verrà ricaricata.");
                location.reload();
    
            } catch (error) {
                alert("Errore durante la lettura del file. Assicurati che sia un file JSON valido.");
                console.error("Errore importazione:", error);
            } finally {
                $('#import-file-input').val('');
            }
        };
        reader.readAsText(file);
    });
    
    $('#delete-all-data-btn').on('click', function() {
        if (confirm("SEI ASSOLUTAMENTE SICURO? Questa operazione cancellerà PERMANENTEMENTE tutti i dati (clienti, prodotti, ordini, ecc.). L'operazione non è reversibile.")) {
            if (confirm("ULTIMA CONFERMA: Sei sicuro di voler cancellare tutto?")) {
                localStorage.clear();
                alert("Tutti i dati sono stati cancellati. L'applicazione verrà ricaricata.");
                location.reload();
            }
        }
    });

    // --- HELP ---
    const helpManualContent = {
        user: `
            <h3>Capitolo 1: Guida per il Ruolo "User"</h3>
            <p>Il ruolo "User" è pensato per un operatore di magazzino con accesso limitato alle sole funzioni di consultazione e gestione della merce.</p>
            <h4>1.1 Home Page</h4>
            <p>Dopo il login, verrai accolto da una pagina di benvenuto con il tuo nome. In questa pagina troverai un calendario e un block-notes personale dove salvare i tuoi appunti.</p>
            <h4>1.2 Statistiche</h4>
            <p>Questa pagina mostra grafici relativi alla situazione del magazzino: i prodotti con maggiore giacenza e quelli in esaurimento.</p>
            <h4>1.3 Gestione Anagrafiche (Accesso Limitato)</h4>
            <p>Puoi visualizzare l'elenco dei prodotti e degli utenti, ma non puoi crearne di nuovi.</p>
            <h4>1.4 Gestione Magazzino</h4>
            <p>Questa è la tua sezione principale. Puoi effettuare un <strong>Carico Manuale</strong> per aumentare la giacenza di un prodotto, o uno <strong>Scarico Manuale</strong> per diminuirla. Puoi anche consultare le <strong>Giacenze</strong> di un singolo prodotto o visualizzare l'<strong>Inventario</strong> completo.</p>
            <h4>1.5 Ciclo Attivo e Passivo (Sola Visualizzazione)</h4>
            <p>Puoi consultare tutti i documenti emessi (Ordini, DDT, Fatture) ma non puoi crearli, modificarli o eliminarli. I pulsanti per eliminare documenti non sono visibili.</p>
        `,
        full: `
            <h3>Manuale Utente - Gestionale Magazzino Didattico (Release 1.0.14.11.25)</h3>
            <h4>Introduzione</h4>
            <p>Questo software è uno strumento educativo per simulare le principali operazioni di un'azienda. Funziona interamente nel browser e salva i dati localmente.</p>
            <hr>
            <h3>Capitolo 1: Guida per il Ruolo "User"</h3>
            <p>Il ruolo "User" è pensato per un operatore di magazzino con accesso limitato alle sole funzioni di consultazione e gestione della merce.</p>
            <h4>1.1 Home Page</h4>
            <p>Dopo il login, verrai accolto da una pagina di benvenuto con il tuo nome. In questa pagina troverai un calendario e un block-notes personale dove salvare i tuoi appunti.</p>
            <h4>1.2 Statistiche</h4>
            <p>Questa pagina mostra grafici relativi alla situazione del magazzino: i prodotti con maggiore giacenza e quelli in esaurimento.</p>
            <h4>1.3 Gestione Anagrafiche (Accesso Limitato)</h4>
            <p>Puoi visualizzare l'elenco dei prodotti e degli utenti, ma non puoi crearne di nuovi.</p>
            <h4>1.4 Gestione Magazzino</h4>
            <p>Questa è la tua sezione principale. Puoi effettuare un <strong>Carico Manuale</strong> per aumentare la giacenza di un prodotto, o uno <strong>Scarico Manuale</strong> per diminuirla. Puoi anche consultare le <strong>Giacenze</strong> di un singolo prodotto o visualizzare l'<strong>Inventario</strong> completo.</p>
            <h4>1.5 Ciclo Attivo e Passivo (Sola Visualizzazione)</h4>
            <p>Puoi consultare tutti i documenti emessi (Ordini, DDT, Fatture) ma non puoi crearli, modificarli o eliminarli. I pulsanti per eliminare documenti non sono visibili.</p>
            <hr>
            <h3>Capitolo 2: Guida per i Ruoli "Supervisor" e "Admin"</h3>
            <p>Questi ruoli hanno accesso completo a tutte le funzionalità operative.</p>
            <h4>2.1 Statistiche</h4>
            <p>La pagina delle statistiche è orientata alle vendite e mostra il fatturato mensile e il valore degli ordini per cliente.</p>
            <h4>2.2 Gestione Anagrafiche (Accesso Completo)</h4>
            <p>Puoi creare, modificare ed eliminare liberamente Clienti, Fornitori e Prodotti.</p>
            <h4>2.3 Flusso di Vendita (Ciclo Attivo)</h4>
            <ol>
                <li><strong>Nuovo Ordine Cliente:</strong> Crea un nuovo ordine selezionando cliente e prodotti. L'ordine viene salvato in stato "In lavorazione".</li>
                <li><strong>Nuovo DDT Cliente:</strong> Seleziona un ordine aperto per evaderlo. Questa operazione scala la giacenza a magazzino e aggiorna lo stato dell'ordine in "Parzialmente Evaso" o "Evaso". Il DDT viene creato come "Da Fatturare".</li>
                <li><strong>Fatturazione:</strong> Seleziona un cliente e i suoi DDT "Da Fatturare" per creare una fattura. Una volta generata, i DDT vengono contrassegnati come "Fatturati".</li>
            </ol>
            <h4>2.4 Gestione dei Documenti (Eliminazione e Ripristino)</h4>
            <ul>
                <li><strong>Eliminare un Ordine:</strong> Dal dettaglio ordine, il pulsante "Elimina Ordine" lo rimuove permanentemente.</li>
                <li><strong>Eliminare un DDT:</strong> Puoi eliminare solo DDT non fatturati. Questa azione ripristina la giacenza e lo stato dell'ordine collegato.</li>
                <li><strong>Eliminare una Fattura:</strong> Questa azione cancella la fattura e riporta i DDT collegati allo stato "Da Fatturare".</li>
            </ul>
            <hr>
            <h3>Capitolo 3: Funzionalità per l'Admin</h3>
            <p>L'Admin ha tutti i permessi degli altri ruoli, con in più la gestione del sistema.</p>
            <h4>3.1 Anagrafica Azienda</h4>
            <p>In Impostazioni, puoi definire i dati della tua azienda.</p>
            <h4>3.2 Anagrafica Utenti</h4>
            <p>In Impostazioni, puoi creare, modificare ed eliminare gli account utente e assegnare i loro ruoli.</p>
            <h4>3.3 Funzionalità Avanzate</h4>
            <p>Permette di esportare (backup) e importare (ripristino) l'intero database dell'applicazione, oppure di cancellare tutti i dati per ricominciare da capo.</p>
        `
    };

    function showHelp() {
        if (!currentUser) return;
        const helpContent = (currentUser.role === 'User') ? helpManualContent.user : helpManualContent.full;
        const helpWindow = window.open('', '_blank');
        if (!helpWindow) {
            alert("Il browser ha bloccato l'apertura della nuova scheda. Controlla le impostazioni dei popup.");
            return;
        }
        
        helpWindow.document.write(`
            <!DOCTYPE html>
            <html lang="it">
            <head>
                <meta charset="UTF-8">
                <title>Manuale Utente</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { padding: 2rem; }
                    h3 { color: #0d6efd; }
                    hr { margin: 2rem 0; }
                </style>
            </head>
            <body>
                <div class="container-fluid">
                    ${helpContent}
                </div>
            </body>
            </html>
        `);
        helpWindow.document.close();
    }

    $('#help-btn').on('click', showHelp);

    $(document).on('keydown', function(e) {
        if (e.key === "F1") {
            e.preventDefault();
            showHelp();
        }
    });

});
