// Variabili Globali
let db, auth;
let globalData = {
    companyInfo: {},
    products: [],
    customers: [],
    invoices: [],
    notes: []
};
let currentUser = null;
let dateTimeInterval = null;
let CURRENT_EDITING_ID = null;         
let CURRENT_EDITING_INVOICE_ID = null; 
window.tempInvoiceLines = [];          

$(document).ready(function() {

    // =========================================================
    // TIMEOUT DI INATTIVITÀ (30 minuti)
    // =========================================================
    const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 5 minuti
    let inactivityTimer = null;
    let inactivityHandlersBound = false;

    function handleInactivityLogout() {
        if (!currentUser) return; // già disconnesso

        // Piccolo messaggio all'utente
        alert("Sessione scaduta per inattività. Verrai disconnesso.");

        // Sign-out Firebase + reload pulito
        auth.signOut().then(() => {
            // location.reload() per essere sicuri di resettare lo stato dell'app
            location.reload();
        }).catch(err => {
            console.error("Errore nel logout per inattività:", err);
            // In caso di errore, comunque forziamo il reload
            location.reload();
        });
    }

    function resetInactivityTimer() {
        if (!currentUser) return; // timer attivo solo se loggato
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
    }

    function startInactivityWatch() {
        if (inactivityHandlersBound) {
            // Già agganciati, basta resettare il timer
            resetInactivityTimer();
            return;
        }

        inactivityHandlersBound = true;

        // Qualsiasi interazione “normale” resetta il timer
        $(document).on('mousemove.inactivity keydown.inactivity click.inactivity scroll.inactivity', () => {
            resetInactivityTimer();
        });

        // Prima partenza
        resetInactivityTimer();
    }

    function stopInactivityWatch() {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        if (inactivityHandlersBound) {
            $(document).off('.inactivity');
            inactivityHandlersBound = false;
        }
    }

    // =========================================================
    // 0. INIZIALIZZAZIONE FIREBASE (AVVIO SICURO)
    // =========================================================
    
    if (typeof firebase === 'undefined') {
        alert("ERRORE CRITICO: Firebase non caricato. Controlla la connessione internet.");
        return;
    }

    try {
        const firebaseConfig = {
          apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
          authDomain: "fprf-6c080.firebaseapp.com",
          projectId: "fprf-6c080",
          storageBucket: "fprf-6c080.firebasestorage.app",
          messagingSenderId: "406236428222",
          appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase connesso.");

    } catch (error) {
        console.error("Firebase Error:", error);
        alert("Errore connessione Database: " + error.message);
    }

    // =========================================================
    // 1. FUNZIONI DI UTILITÀ
    // =========================================================

    function formatDateForDisplay(dateString) {
        if (!dateString) return '-';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString; 
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    function escapeXML(str) { 
        if (typeof str !== 'string') return ''; 
        return str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]); 
    }
    function normalizeCountryCode(raw) {
        if (!raw) return 'IT';
        const t = String(raw).trim().toUpperCase();

        // se è già un codice a 2 lettere lo uso così com'è
        if (t.length === 2) return t;

        // casi più probabili digitati a mano
        if (t === 'ITALIA' || t === 'ITALY') return 'IT';

        // fallback sicuro
        return 'IT';
    }


    function getNextId(items) { 
        if (!items || items.length === 0) return 1;
        const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
        return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
    }

    function getData(key) { return globalData[key] || []; }
    function safeFloat(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n; }

    // Restituisce il riferimento al document utente: /users/{uid}
    function getUserDocRef() {
        if (!currentUser || !currentUser.uid) {
            throw new Error("Nessun utente loggato, impossibile accedere ai dati utente.");
        }
        return db.collection('users').doc(currentUser.uid);
    }

    // =========================================================
    // 2. GESTIONE DATI CLOUD (MULTI-UTENTE)
    // =========================================================

    async function loadAllDataFromCloud() {
        if (!currentUser) {
            console.warn("loadAllDataFromCloud chiamato senza utente.");
            return;
        }

        try {
            const userRef = getUserDocRef();

            // 1) settings/companyInfo
            const companyDoc = await userRef.collection('settings').doc('companyInfo').get();
            if (companyDoc.exists) {
                globalData.companyInfo = companyDoc.data();
            } else {
                globalData.companyInfo = {};
            }

            // 2) Altre collezioni: products, customers, invoices, notes
            const collections = ['products', 'customers', 'invoices', 'notes'];
            for (const col of collections) {
                const snapshot = await userRef.collection(col).get();
                globalData[col] = snapshot.docs.map(doc => ({
                    id: String(doc.id),
                    ...doc.data()
                }));
            }

            console.log("Dati sincronizzati per utente:", currentUser.uid, globalData);
        } catch (e) {
            console.error("Errore Load Cloud:", e);
            throw e;
        }
    }

    async function saveDataToCloud(collection, dataObj, id = null) {
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }
        try {
            const userRef = getUserDocRef();

            if (collection === 'companyInfo') {
                await userRef.collection('settings').doc('companyInfo').set(dataObj, { merge: true });
                globalData.companyInfo = { ...(globalData.companyInfo || {}), ...dataObj };
            } else {
                if (!id) {
                    console.error("ID mancante per salvataggio in", collection);
                    return;
                }
                const strId = String(id);
                await userRef.collection(collection).doc(strId).set(dataObj, { merge: true });

                if (!globalData[collection]) globalData[collection] = [];
                const index = globalData[collection].findIndex(item => String(item.id) === strId);
                if (index > -1) {
                    globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                } else {
                    globalData[collection].push({ id: strId, ...dataObj });
                }
            }
        } catch (e) {
            console.error("Errore Cloud:", e);
            alert("Errore Cloud: " + e.message);
        }
    }

    async function deleteDataFromCloud(collection, id) {
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }

        if (!confirm("Sei sicuro di voler eliminare questo elemento?")) return;

        try {
            const userRef = getUserDocRef();
            const strId = String(id);
            await userRef.collection(collection).doc(strId).delete();

            if (globalData[collection]) {
                globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
            }
            renderAll();
        } catch (e) {
            console.error("Errore eliminazione:", e);
            alert("Errore eliminazione: " + e.message);
        }
    }

    // =========================================================
    // 3. FUNZIONI DI RENDER UI
    // =========================================================

    function renderAll() {
    renderCompanyInfoForm();
    updateCompanyUI();
    renderProductsTable();
    renderCustomersTable();
    refreshInvoiceYearFilter();   // <- POPOLA / AGGIORNA LA COMBO ANNO
    renderInvoicesTable();        // <- USA IL VALORE SELEZIONATO
    populateDropdowns();
    refreshStatsYearFilter();     // <- POPOLA / AGGIORNA LA COMBO ANNO STATISTICHE
    renderStatisticsPage();
    renderHomePage();
}
        
        // Popola la combo "Anno" in Elenco Documenti
    function renderAll() {
    renderCompanyInfoForm();
    updateCompanyUI();
    renderProductsTable();
    renderCustomersTable();
    refreshInvoiceYearFilter();   // <- POPOLA / AGGIORNA LA COMBO ANNO
    renderInvoicesTable();        // <- USA IL VALORE SELEZIONATO
    populateDropdowns();
    refreshStatsYearFilter();
    renderStatisticsPage();
    renderHomePage();
}

// Popola la combo "Anno" in Elenco Documenti
function refreshInvoiceYearFilter() {
    const $select = $('#invoice-year-filter');
    if (!$select.length) return; // se per qualche motivo non esiste, esco

    const previous = $select.val() || 'all';

    const invoices = getData('invoices');
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) {
                yearsSet.add(y);
            }
        }
    });

    const years = Array.from(yearsSet).sort().reverse(); // anni decrescenti

    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    years.forEach(y => {
        $select.append(`<option value="${y}">${y}</option>`);
    });

    if (years.includes(previous)) {
        $select.val(previous);
    } else {
        $select.val('all');
    }
}


function refreshStatsYearFilter() {
    const $select = $('#stats-year-filter');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices');
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));

    // Default: anno corrente (se presente), altrimenti primo anno disponibile, altrimenti "Tutti"
    if (years.includes(previous) && previous !== '') {
        $select.val(previous);
    } else if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (years.length > 0) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}



    function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        if(company.name) $('#company-name-sidebar').text(company.name);
        if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
    }

    function renderHomePage() { 
        if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const note = getData('notes').find(n => n.userId === currentUser.uid);
        if(note) $('#notes-textarea').val(note.text);
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        }));
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);
    }

    function renderCalendar() {
        const c = $('#calendar-widget');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayDate = now.getDate();
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const totalDays = lastDay.getDate();
        let startingDay = firstDay.getDay(); 
        
        let html = `<div class="card shadow-sm border-0">
<div class="card-header bg-primary text-white text-center fw-bold">
${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}
</div>
<div class="card-body p-0">
<table class="table table-bordered text-center mb-0" style="table-layout: fixed;">
<thead class="table-light">
<tr>
<th class="text-danger">Dom</th><th>Lun</th><th>Mar</th><th>Mer</th>
<th>Gio</th><th>Ven</th><th>Sab</th>
</tr>
</thead>
<tbody><tr>`;

        for(let i = 0; i < startingDay; i++) { 
            html += '<td class="bg-light"></td>'; 
        }

        for(let day = 1; day <= totalDays; day++) {
            if (startingDay > 6) { 
                startingDay = 0; 
                html += '</tr><tr>'; 
            }
            const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `<td class="align-middle p-2"><div class="${isToday}" style="width:32px; height:32px; line-height:32px; margin:0 auto;">${day}</div></td>`;
            startingDay++;
        }
        while(startingDay <= 6) { 
            html += '<td class="bg-light"></td>'; 
            startingDay++; 
        }
        html += '</tr></tbody></table></div></div>';
        c.html(html);
    }

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty();
        const selectedYear = ($('#stats-year-filter').length ? ($('#stats-year-filter').val() || 'all') : 'all');
        const inSelectedYear = (inv) => {
            if (selectedYear === 'all') return true;
            return (inv.date && typeof inv.date === 'string' && inv.date.substring(0,4) === String(selectedYear));
        };
        const facts = getData('invoices').filter(i => inSelectedYear(i) && (i.type === 'Fattura' || i.type === undefined || i.type === ''));
        const notes = getData('invoices').filter(i => inSelectedYear(i) && i.type === 'Nota di Credito');
        
        if(facts.length === 0) { 
            container.html('<div class="alert alert-info">Nessun dato.</div>'); 
            renderTaxSimulation(0,0); 
            return; 
        }

        const totF = facts.reduce((s,i)=>s+safeFloat(i.total),0);
        const totN = notes.reduce((s,i)=>s+safeFloat(i.total),0);
        const net = totF - totN;

        let cust = {};
        facts.forEach(i=>{
            const c=String(i.customerId); 
            if(!cust[c])cust[c]=0; 
            cust[c]+=safeFloat(i.total)
        });
        notes.forEach(i=>{
            const c=String(i.customerId); 
            if(cust[c])cust[c]-=safeFloat(i.total)
        });

        let h = `<h5>Dettaglio Clienti</h5><table class="table table-striped table-sm">
<thead><tr><th>Cliente</th><th>Fatturato Netto</th><th>% sul Totale</th></tr></thead><tbody>`;
        Object.keys(cust)
            .sort((a,b)=>cust[b]-cust[a])
            .forEach(cid=>{
                const c = getData('customers').find(x=>String(x.id)===String(cid))||{name:'?'};
                const tot = cust[cid];
                const perc = net > 0 ? (tot / net) * 100 : 0;
                h+=`<tr><td>${c.name}</td><td>€ ${tot.toFixed(2)}</td><td>${perc.toFixed(1)}%</td></tr>`;
            });
        h+=`<tr class="fw-bold"><td>TOTALE</td><td>€ ${net.toFixed(2)}</td><td>100%</td></tr></tbody></table>`;
        container.html(h);

        const impF = facts.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        const impN = notes.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        renderTaxSimulation(impF, impN);
    }

    function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
        const container = $('#tax-simulation-container').empty();
        const comp = getData('companyInfo');
        const coeff = safeFloat(comp.coefficienteRedditivita);
        const taxRate = safeFloat(comp.aliquotaSostitutiva);
        const inpsRate = safeFloat(comp.aliquotaContributi);

        if(!coeff || !taxRate || !inpsRate) {
            container.html('<div class="alert alert-warning">Dati mancanti.</div>');
            return;
        }

        const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
        const taxableIncome = grossRevenue * (coeff / 100);
        const socialSecurity = taxableIncome * (inpsRate / 100);
        const netTaxable = taxableIncome - socialSecurity;
        const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;
        const totalDue = socialSecurity + tax;

        const html = `
<div class="row">
  <div class="col-md-6">
    <h5>Simulazione Contributi INPS</h5>
    <table class="table table-sm">
      <tr><th>Reddito Lordo Imponibile</th><td>€ ${taxableIncome.toFixed(2)}</td></tr>
      <tr><th>Aliquota Contributi INPS</th><td>${inpsRate}%</td></tr>
      <tr><th>Contributi Totali Previsti</th><td>€ ${socialSecurity.toFixed(2)}</td></tr>
      <tr><th>Stima Primo Acconto (40%)</th><td>€ ${(socialSecurity*0.4).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (40%)</th><td>€ ${(socialSecurity*0.4).toFixed(2)}</td></tr>
    </table>
  </div>
  <div class="col-md-6">
    <h5>Simulazione Imposta Sostitutiva (IRPEF)</h5>
    <table class="table table-sm">
      <tr><th>Reddito Lordo Imponibile</th><td>€ ${taxableIncome.toFixed(2)}</td></tr>
      <tr><th>Contributi INPS Deducibili</th><td>- € ${socialSecurity.toFixed(2)}</td></tr>
      <tr><th>Reddito Netto Imponibile</th><td>€ ${netTaxable.toFixed(2)}</td></tr>
      <tr><th>Aliquota Imposta</th><td>${taxRate}%</td></tr>
      <tr><th>Imposta Totale Prevista</th><td>€ ${tax.toFixed(2)}</td></tr>
      <tr><th>Stima Primo Acconto (50%)</th><td>€ ${(tax*0.5).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (50%)</th><td>€ ${(tax*0.5).toFixed(2)}</td></tr>
      <tr class="table-primary fw-bold"><th>Totale Uscite Stimate (Contributi + Imposte)</th><td>€ ${totalDue.toFixed(2)}</td></tr>
    </table>
  </div>
</div>`;
        container.html(html);
    }

    function renderCompanyInfoForm() {
        const c = getData('companyInfo') || {};
        for (const k in c) {
            $(`#company-${k}`).val(c[k]);
        }
    }

    function renderProductsTable() {
        const table = $('#products-table-body').empty();
        getData('products').forEach(p => {
            const price = parseFloat(p.salePrice || 0).toFixed(2);
            table.append(`
<tr>
  <td>${p.code || ''}</td>
  <td>${p.description || ''}</td>
  <td class="text-end">€ ${price}</td>
  <td>${p.iva || '0'}%</td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
        });
    }

    function renderCustomersTable() {
        const table = $('#customers-table-body').empty();
        getData('customers').forEach(c => {
            table.append(`
<tr>
  <td>${c.name || ''}</td>
  <td>${c.piva || ''}</td>
  <td>${c.sdi || '-'}</td>
  <td>${c.address || ''}</td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
        });
    }

    // Filtro anno per elenco fatture
    function getInvoiceFilterYear() {
        return $('#invoice-year-filter').val() || 'all';
    }

    function renderInvoicesTable() {
    const table = $('#invoices-table-body').empty();

    // Tutte le fatture ordinate per numero (come prima)
    const allInvoices = getData('invoices').sort(
        (a, b) => (b.number || '').localeCompare(a.number || '')
    );

    // Legge il filtro anno (se esiste la select)
    const yearSelect = $('#invoice-year-filter');
    const selectedYear = yearSelect.length ? (yearSelect.val() || 'all') : 'all';

    // Se è selezionato un anno specifico, filtra; altrimenti mostra tutte
    const invoices = selectedYear === 'all'
        ? allInvoices
        : allInvoices.filter(inv =>
            inv.date && String(inv.date).substring(0, 4) === String(selectedYear)
        );

    invoices.forEach(inv => {
        const c = getData('customers').find(
            cust => String(cust.id) === String(inv.customerId)
        ) || { name: 'Sconosciuto' };

        const isCredit = inv.type === 'Nota di Credito';
        const isPaid = (!isCredit) && (inv.status === 'Pagata');
        const isSent = inv.sentToAgenzia === true;

        // Blocchi:
        // - Modifica/Elimina: bloccati se Pagata (solo fatture) oppure se marcata Inviata ad ADE
        // - Pagata: deve restare cliccabile anche se "Inviata", finché non è Pagata. (Per NdC è sempre disabilitato)
        const lockEditDelete = isSent || ((!isCredit) && isPaid);
        const lockPaidButton = isCredit || isPaid;
const badge = inv.type === 'Nota di Credito'
            ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>'
            : '<span class="badge bg-primary">Fatt.</span>';

        let statusBadge = '<span class="badge bg-warning text-dark">Da Incassare</span>';
        if (inv.type === 'Nota di Credito') {
            // Le note di credito restano 'Emessa' finché non vengono marcate come inviate ad ADE.
            statusBadge = '<span class="badge bg-info text-dark">Emessa</span>';
        } else {
            statusBadge = isPaid
                ? '<span class="badge bg-success">Pagata</span>'
                : '<span class="badge bg-warning text-dark">Da Incassare</span>';
        }

        // Se marcata come inviata ad ADE, aggiunge un badge informativo
        if (isSent) {
            statusBadge += ' <span class="badge bg-dark">Inviata</span>';
        }

        const payClass = lockPaidButton ? 'btn-secondary disabled' : 'btn-success';
        const editClass = lockEditDelete ? 'btn-secondary disabled' : 'btn-outline-secondary';
        const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice ${lockEditDelete ? 'disabled' : ''}" data-id="${inv.id}" title="Elimina" ${lockEditDelete ? 'disabled' : ''}><i class="fas fa-trash"></i></button>`;

        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Vedi">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${lockEditDelete ? 'disabled' : ''}>
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="XML">
                    <i class="fas fa-file-code"></i>
                </button>
                <button class=\"btn btn-sm ${isSent ? 'btn-dark' : 'btn-outline-dark'} btn-mark-sent\" data-id=\"${inv.id}\" title=\"${isSent ? 'Segnato come Inviato (clic per annullare)' : 'Segna come Inviato'}\">
                    <i class=\"fas fa-paper-plane\"></i>
                </button>
                <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Stato" ${lockPaidButton ? 'disabled' : ''}>
                    <i class="fas fa-check"></i>
                </button>
                ${btnDelete}
            </div>
        `;

        const total = (parseFloat(inv.total) || 0).toFixed(2);
        table.append(`
            <tr class="${lockEditDelete ? 'table-light text-muted' : ''}">
                <td>${badge}</td>
                <td class="fw-bold">${inv.number}</td>
                <td>${formatDateForDisplay(inv.date)}</td>
                <td>${c.name}</td>
                <td class="text-end">€ ${total}</td>
                <td class="text-end small">${formatDateForDisplay(inv.dataScadenza)}</td>
                <td>${statusBadge}</td>
                <td class="text-end">${btns}</td>
            </tr>
        `);
    });
}
// Popola la combo Anno in base alle fatture presenti
function refreshInvoiceYearFilter() {
    const select = $('#invoice-year-filter');
    if (!select.length) return;

    const invoices = getData('invoices') || [];
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            yearsSet.add(inv.date.substring(0, 4));
        }
    });

    const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a)); // discendente
    const currentValue = select.val() || 'all';

    select.empty();
    select.append('<option value="all">Tutti</option>');
    years.forEach(y => {
        select.append(`<option value="${y}">${y}</option>`);
    });

    // Mantieni la selezione corrente se ancora valida, altrimenti "Tutti"
    if (years.includes(currentValue)) {
        select.val(currentValue);
    } else {
        select.val('all');
    }

    // Assicura che il change rinfreschi la tabella
    select.off('change').on('change', function () {
        renderInvoicesTable();
    });
}
    function populateDropdowns() {
        // clienti
        $('#invoice-customer-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append(
                getData('customers').map(c => 
                    `<option value="${c.id}">${c.name}</option>`
                )
            );

        // prodotti/servizi
        $('#invoice-product-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append('<option value="manual">Manuale</option>')
            .append(
                getData('products').map(p =>
                    `<option value="${p.id}">${p.code || ''} - ${p.description || ''}</option>`
                )
            );
    }

    // =========================================================
    // 4. EVENT LISTENERS
    // =========================================================

    // AUTH
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;

            // Nascondo login, mostro loading
            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none');

            try {
                await loadAllDataFromCloud();
                $('#loading-screen').addClass('d-none');
                $('#main-app').removeClass('d-none');
                renderAll();

                // Avvio monitoraggio inattività
                startInactivityWatch();
            } catch (error) {
                alert("Errore DB: " + error.message);
                $('#loading-screen').addClass('d-none');
            }
        } else {
            currentUser = null;
            $('#main-app').addClass('d-none');
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');

            // Stop monitoraggio inattività
            stopInactivityWatch();
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        $('#login-error').addClass('d-none');
        $('#login-spinner').removeClass('d-none');
        $('#btn-login-submit').prop('disabled', true);

        const email = $('#email').val();
        const password = $('#password').val();

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                $('#login-spinner').addClass('d-none');
                $('#btn-login-submit').prop('disabled', false);
            })
            .catch(err => {
                console.error("Login Error:", err);
                $('#login-error').removeClass('d-none');
                $('#login-spinner').addClass('d-none');
                $('#btn-login-submit').prop('disabled', false);
            });
    });

    $('#logout-btn').on('click', function(e) {
        e.preventDefault();
        auth.signOut().then(() => {
            // signOut risolve -> lo stato auth.onAuthStateChanged farà il resto
            location.reload();
        });
    });
    
    // Cambio anno → rendo di nuovo l'elenco documenti filtrato
    $('#invoice-year-filter').on('change', function () {
        renderInvoicesTable();
    });

    // filtro anno STATISTICHE
    $('#stats-year-filter').on('change', function () {
        renderStatisticsPage();
    });

    // NAVIGAZIONE
    $('.sidebar .nav-link').on('click', function(e) { 
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return; 
        e.preventDefault(); 
        const target = $(this).data('target'); 
        if(target === 'nuova-fattura-accompagnatoria') { 
            if(this.id === 'menu-nuova-nota-credito') prepareDocumentForm('Nota di Credito'); 
            else if(this.id === 'menu-nuova-fattura') { 
                $('#newInvoiceChoiceModal').modal('show'); 
                return; 
            } else prepareDocumentForm('Fattura'); 
        } 
        if(target === 'statistiche') renderStatisticsPage();

        if (target === 'elenco-fatture') {
            renderInvoicesTable();
        }

        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none'); 
    });

    // MODALE FATTURA
    $('#newInvoiceChoiceModal').on('show.bs.modal', function () { 
        const invoices = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined); 
        invoices.sort((a, b) => new Date(b.date) - new Date(a.date)); 
        const options = invoices.map(inv => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`).join(''); 
        $('#copy-from-invoice-select').html('<option value="">Copia da esistente...</option>' + options); 
    });

    $('#btn-create-new-blank-invoice').click(function() { 
        $('#newInvoiceChoiceModal').modal('hide'); 
        $('.sidebar .nav-link').removeClass('active'); 
        $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
        prepareDocumentForm('Fattura'); 
    });

    $('#btn-copy-from-invoice').click(function() { 
        const id = $('#copy-from-invoice-select').val(); 
        if(!id) return; 
        $('#newInvoiceChoiceModal').modal('hide'); 
        $('.sidebar .nav-link').removeClass('active'); 
        $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
        loadInvoiceForEditing(id, true); 
    });

    // CRUD ANAGRAFICHE
    function editItem(type, id) { 
        if (type === 'customer' || type === 'product') CURRENT_EDITING_ID = String(id); 
        const item = getData(`${type}s`).find(i => String(i.id) === String(id)); 
        if (!item) return; 
        $(`#${type}Form`)[0].reset(); 
        $(`#${type}ModalTitle`).text(`Modifica`); 
        $(`#${type}-id`).val(String(item.id)); 
        for (const key in item) { 
            const field = $(`#${type}-${key}`); 
            if (field.length) { 
                if (field.is(':checkbox')) field.prop('checked', item[key]); 
                else field.val(item[key]); 
            } 
        } 
        if (type === 'product') { 
            $('#product-iva').trigger('change'); 
            if(item.iva == '0') $('#product-esenzioneIva').val(item.esenzioneIva); 
        } 
        $(`#${type}Modal`).modal('show'); 
    }

    $('#newCustomerBtn').click(() => { 
        CURRENT_EDITING_ID = null; 
        $('#customerForm')[0].reset(); 
        $('#customer-id').val('Nuovo'); 
        $('#customerModal').modal('show'); 
    });

    $('#saveCustomerBtn').click(async () => { 
        const data = { 
            name: $('#customer-name').val(), 
            piva: $('#customer-piva').val(), 
            codiceFiscale: $('#customer-codiceFiscale').val(), 
            sdi: $('#customer-sdi').val(), 
            address: $('#customer-address').val(), 
            comune: $('#customer-comune').val(), 
            provincia: ($('#customer-provincia').val() || '').toUpperCase(),
            cap: $('#customer-cap').val(), 
            nazione: $('#customer-nazione').val(), 
            rivalsaInps: $('#customer-rivalsaInps').is(':checked'),
            pec: $('#customer-pec').val() || ''
        }; 
        let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : String(getNextId(getData('customers'))); 
        await saveDataToCloud('customers', data, id); 
        $('#customerModal').modal('hide'); 
        renderAll(); 
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function(e) { 
        editItem('customer', $(e.currentTarget).attr('data-id')); 
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function(e) { 
        deleteDataFromCloud('customers', $(e.currentTarget).attr('data-id')); 
    });

    $('#newProductBtn').click(() => { 
        CURRENT_EDITING_ID = null; 
        $('#productForm')[0].reset(); 
        $('#product-id').val('Nuovo'); 
        $('#product-iva').val('0').change(); 
        $('#productModal').modal('show'); 
    });

    $('#saveProductBtn').click(async () => { 
        const data = { 
            description: $('#product-description').val(), 
            code: $('#product-code').val(), 
            salePrice: $('#product-salePrice').val(), 
            iva: $('#product-iva').val(), 
            esenzioneIva: $('#product-esenzioneIva').val() 
        }; 
        let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : 'PRD' + new Date().getTime(); 
        await saveDataToCloud('products', data, id); 
        $('#productModal').modal('hide'); 
        renderAll(); 
    });

    $('#products-table-body').on('click', '.btn-edit-product', function(e) { 
        editItem('product', $(e.currentTarget).attr('data-id')); 
    });

    $('#products-table-body').on('click', '.btn-delete-product', function(e) { 
        deleteDataFromCloud('products', $(e.currentTarget).attr('data-id')); 
    });

    $('#product-iva').change(function() { 
        toggleEsenzioneIvaField('product', $(this).val()); 
    });

    function toggleEsenzioneIvaField(prefix, ivaVal) {
        const esenzioneField = $(`#${prefix}-esenzioneIva`);
        if (ivaVal === '0') {
            esenzioneField.prop('disabled', false);
        } else {
            esenzioneField.prop('disabled', true).val('');
        }
    }

    // FATTURE CORE
    window.tempInvoiceLines = []; 
    
    // Calcolo automatico data di scadenza = Data Riferimento + Giorni Scadenza
    function recalcInvoiceDueDate() {
        const refDateStr = $('#invoice-dataRiferimento').val();
        const giorni = parseInt($('#invoice-giorniTermini').val(), 10);

        if (!refDateStr || isNaN(giorni)) return;

        const refDate = new Date(refDateStr);
        refDate.setDate(refDate.getDate() + giorni);

        const dueStr = refDate.toISOString().slice(0, 10);
        $('#invoice-dataScadenza').val(dueStr);
    }

    function prepareDocumentForm(type) {
        CURRENT_EDITING_INVOICE_ID = null; 

        // reset form e stato
        $('#new-invoice-form')[0].reset();
        $('#invoice-id').val('Nuovo');
        $('#document-type').val(type);

        // righe fattura
        $('#invoice-lines-tbody').empty();
        window.tempInvoiceLines = [];
        populateDropdowns();

        // data documento = oggi
        const today = new Date().toISOString().slice(0, 10);
        $('#invoice-date').val(today);

        // DEFAULT PAGAMENTO
        // Condizioni Pagamento
        $('#invoice-condizioniPagamento').val('Pagamento Completo');
        // Modalità Pagamento
        $('#invoice-modalitaPagamento').val('Bonifico Bancario');

        // DEFAULT DATE PAGAMENTO
        // Data riferimento = data documento
        $('#invoice-dataRiferimento').val(today);
        // Giorni scadenza (se vuoi altro valore cambia 30)
        $('#invoice-giorniTermini').val(30);
        // Calcolo automatica della scadenza
        recalcInvoiceDueDate();

        // Tipo documento / titolo
        if (type === 'Nota di Credito') {
            $('#document-title').text('Nuova Nota di Credito');
            $('#credit-note-fields').removeClass('d-none');
        } else {
            $('#document-title').text('Nuova Fattura');
            $('#credit-note-fields').addClass('d-none');
        }

        // Numero fattura e totali
        updateInvoiceNumber(type, today.substring(0, 4));
        updateTotalsDisplay();
    }

    function loadInvoiceForEditing(id, isCopy) { 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if (!inv) return; 
        const type = isCopy ? 'Fattura' : (inv.type || 'Fattura'); 
        prepareDocumentForm(type); 
        if (!isCopy) { 
            CURRENT_EDITING_INVOICE_ID = String(inv.id); 
            $('#invoice-id').val(inv.id); 
            $('#document-title').text(`Modifica ${type} ${inv.number}`); 
        } 
        $('#invoice-customer-select').val(inv.customerId); 
        $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0, 10) : inv.date); 
        if(!isCopy) $('#invoice-number').val(inv.number); 
        $('#invoice-condizioniPagamento').val(inv.condizioniPagamento); 
        $('#invoice-modalitaPagamento').val(inv.modalitaPagamento); 
        $('#invoice-dataScadenza').val(inv.dataScadenza); 
        if (type === 'Nota di Credito') { 
            $('#linked-invoice').val(inv.linkedInvoice); 
            $('#reason').val(inv.reason); 
        } 
        window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines || [])); 
        renderLocalInvoiceLines(); 
        updateTotalsDisplay(); 
    }

    function updateInvoiceNumber(type, year) { 
        if (CURRENT_EDITING_INVOICE_ID) return; 
        const invs = getData('invoices').filter(i => 
            (i.type === type || (type==='Fattura' && !i.type)) && 
            i.date && i.date.substring(0, 4) === String(year)
        ); 
        let next = 1; 
        if (invs.length > 0) { 
            next = Math.max(...invs.map(i => {
                const parts = String(i.number || '').split('-');
                const last = parts[parts.length-1];
                return parseInt(last) || 0;
            })) + 1; 
        }
        $('#invoice-number').val(`${type==='Fattura'?'FATT':'NC'}-${year}-${String(next).padStart(2, '0')}`);
    }

    $('#add-product-to-invoice-btn').click(() => {
        const d = $('#invoice-product-description').val(); 
        if(!d) return;
        window.tempInvoiceLines.push({
            productName: d,
            qty: parseFloat($('#invoice-product-qty').val())||1,
            price: parseFloat($('#invoice-product-price').val())||0,
            subtotal: (parseFloat($('#invoice-product-qty').val())||1)*(parseFloat($('#invoice-product-price').val())||0),
            iva: $('#invoice-product-iva').val(),
            esenzioneIva: $('#invoice-product-esenzioneIva').val()
        });
        renderLocalInvoiceLines(); 
        updateTotalsDisplay();
    });

    function renderLocalInvoiceLines() {
        const t = $('#invoice-lines-tbody').empty(); 
        window.tempInvoiceLines.forEach((l, i) => { 
            t.append(`
<tr>
  <td>${l.productName}</td>
  <td class="text-end">${l.qty}</td>
  <td class="text-end">€ ${l.price.toFixed(2)}</td>
  <td class="text-end">€ ${l.subtotal.toFixed(2)}</td>
  <td class="text-end">
    <button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button>
  </td>
</tr>`);
        });
    }

    $('#invoice-lines-tbody').on('click', '.del-line', function() {
        window.tempInvoiceLines.splice($(this).data('i'), 1); 
        renderLocalInvoiceLines(); 
        updateTotalsDisplay(); 
    });

    function updateTotalsDisplay() {
        const cid = $('#invoice-customer-select').val();
        const cust = getData('customers').find(c => String(c.id) === String(cid));
        const comp = getData('companyInfo');

        if (!cust || !comp) {
            $('#invoice-total').text('€ 0,00');
            $('#invoice-tax-details').text('');
            return { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, totDoc: 0 };
        }

        // 1) Individuare riga "Rivalsa Bollo", se presente
        const rows = window.tempInvoiceLines.filter(l => 
            l.productName.toLowerCase() !== 'rivalsa bollo'
        );
        const bollo = window.tempInvoiceLines.find(l => 
            l.productName.toLowerCase() === 'rivalsa bollo'
        );
        const impBollo = bollo ? (parseFloat(bollo.subtotal) || 0) : 0;

        // 2) Totale prestazioni (senza bollo)
        const totPrest = rows.reduce((s, l) => s + (parseFloat(l.subtotal) || 0), 0);

        // 3) Rivalsa INPS (se il cliente ha la spunta)
        let riv = 0;
        const aliquotaInps = parseFloat(comp.aliquotaInps || comp.aliquotaContributi || 0);
        if (cust.rivalsaInps && aliquotaInps > 0) {
            riv = totPrest * (aliquotaInps / 100);
        }

        // 4) Totale Imponibile (Prestazioni + eventuale rivalsa INPS)
        const totImp = totPrest + riv;

        // 5) Totale Documento (Imponibile + marca da bollo, se presente)
        const totDoc = totImp + impBollo;

        // 6) Aggiornamento UI
        $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
        $('#invoice-tax-details').text(
            `(Imp: € ${totImp.toFixed(2)} - Bollo: € ${impBollo.toFixed(2)})`
        );

        return { totPrest, riv, impBollo, totImp, totDoc };
    }

    $('#invoice-customer-select').change(updateTotalsDisplay);
    
     // Ricalcolo automatico Date di pagamento
    $('#invoice-date').on('change', function() {
        const d = $(this).val();
        if (!d) return;
        // allineo anche la data di riferimento alla nuova data documento
        $('#invoice-dataRiferimento').val(d);
        recalcInvoiceDueDate();
    });

    $('#invoice-dataRiferimento, #invoice-giorniTermini').on('change keyup', function() {
        recalcInvoiceDueDate();
    });

    // Quando seleziono un servizio dalla tendina, compilo automaticamente la riga
    $('#invoice-product-select').on('change', function() {
        const selectedId = $(this).val();
        const descInput = $('#invoice-product-description');
        const priceInput = $('#invoice-product-price');
        const qtyInput = $('#invoice-product-qty');
        const ivaSelect = $('#invoice-product-iva');
        const esenzioneSelect = $('#invoice-product-esenzioneIva');

        if (!selectedId) {
            // Nessuna scelta: reset campi
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', true);
            ivaSelect.prop('disabled', true);
            esenzioneSelect.prop('disabled', true);
            toggleEsenzioneIvaField('invoice', ivaSelect.val());
            return;
        }

        if (selectedId === 'manual') {
            // Modalità manuale: sblocco descrizione/prezzo, IVA libera
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', false);
            ivaSelect.prop('disabled', false);
            esenzioneSelect.prop('disabled', false);
            toggleEsenzioneIvaField('invoice', ivaSelect.val());
            return;
        }

        // Altrimenti è un prodotto standard
        const product = getData('products').find(p => String(p.id) === String(selectedId));
        if (!product) return;

        descInput.val(product.description || '');
        priceInput.val(product.salePrice || 0);
        qtyInput.val(1);

        ivaSelect.val(product.iva || '0');
        esenzioneSelect.val(product.esenzioneIva || 'N2.1');

        // In questo caso descrizione e prezzo sono modificabili?
        // Se vuoi, puoi bloccarli:
        // descInput.prop('readonly', true);
        // priceInput.prop('readonly', true);

        // IVA/Esenzione Iva: gestite come da logica esistente
        ivaSelect.prop('disabled', false);
        esenzioneSelect.prop('disabled', false);
        toggleEsenzioneIvaField('invoice', ivaSelect.val());
    });

    $('#new-invoice-form').submit(async function(e) { 
        e.preventDefault(); 
        const cid = $('#invoice-customer-select').val(); 
        if (!cid || window.tempInvoiceLines.length === 0) { 
            alert("Dati incompleti."); 
            return; 
        } 
        const type = $('#document-type').val(); 
        const calcs = updateTotalsDisplay(); 
        const data = { 
            number: $('#invoice-number').val(), 
            date: $('#invoice-date').val(), 
            customerId: cid, 
            type: type, 
            lines: window.tempInvoiceLines, 
            totalePrestazioni: calcs.totPrest, 
            importoBollo: calcs.impBollo, 
            rivalsa: { importo: calcs.riv }, 
            totaleImponibile: calcs.totImp, 
            total: calcs.totDoc, 
            status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'), 
            dataScadenza: $('#invoice-dataScadenza').val(), 
            condizioniPagamento: $('#invoice-condizioniPagamento').val(), 
            modalitaPagamento: $('#invoice-modalitaPagamento').val(), 
            linkedInvoice: $('#linked-invoice').val(), 
            reason: $('#reason').val() 
        }; 

        if (CURRENT_EDITING_INVOICE_ID) { 
            const old = getData('invoices').find(i => String(i.id) === CURRENT_EDITING_INVOICE_ID); 
            if(old) data.status = old.status; 
        } 
        let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices'))); 
        await saveDataToCloud('invoices', data, id); 
        alert("Salvato!"); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click(); 
    });

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if (!inv) return;

        if (inv.status === 'Pagata') {
            alert("Non è possibile modificare una fattura già pagata.");
            return;
        }
        if (inv.sentToAgenzia === true) {
            alert("Non è possibile modificare una fattura marcata come inviata all'Agenzia delle Entrate.");
            return;
        }

        $('.sidebar .nav-link').removeClass('active'); 
        $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
        loadInvoiceForEditing(id, false); 
    });

    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if (!inv) return;

        if (inv.status === 'Pagata') {
            alert("Non è possibile cancellare una fattura pagata.");
            return;
        }
        if (inv.sentToAgenzia === true) {
            alert("Non è possibile cancellare una fattura marcata come inviata all'Agenzia delle Entrate.");
            return;
        }

        deleteDataFromCloud('invoices', id); 
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() {
        const id = $(this).attr('data-id');
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if (!inv) return;

        // Le note di credito non hanno lo stato "Pagata"
        if (inv.type === 'Nota di Credito') {
            alert("Le note di credito non possono essere marcate come 'Pagata'.");
            return;
        }

        // Se già pagata, non fare nulla
        if (inv.status === 'Pagata') return;

        const msg = "Sei sicuro? Una volta marcata come PAGATA, la fattura non potrà più essere modificata.\n\nLo stato 'Inviata' (se presente) non viene modificato.";
        if (!confirm(msg)) return;

        await saveDataToCloud('invoices', { status: 'Pagata' }, id);
        renderInvoicesTable();
    });

    // Flag "Inviata ad ADE": blocca modifica/cancellazione
$('#invoices-table-body').on('click', '.btn-mark-sent', async function() {
        const id = $(this).attr('data-id');
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if (!inv) return;

        // Irreversibile: una volta inviato non si può più tornare indietro
        if (inv.sentToAgenzia === true) {
            alert("Questo documento è già marcato come inviato all'Agenzia delle Entrate. L'operazione è irreversibile.");
            return;
        }

        const msg = "Sei sicuro? Una volta inviata la fattura/nota di credito non potrà più essere modificata o eliminata.";
        if (!confirm(msg)) return;

        await saveDataToCloud('invoices', { sentToAgenzia: true }, id);
        renderInvoicesTable();
    });


    // XML
    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
        let id = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id');
        if (id) generateInvoiceXML(id); 
    });

    function generateInvoiceXML(invoiceId) {
    const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId));
    if (!invoice) {
        alert("Errore: fattura non trovata.");
        return;
    }

    const company = getData('companyInfo');
    const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId)) || {};

    // Tipo documento ADE (TD01 = Fattura, TD04 = Nota di Credito)
    const tipoDocumento = (invoice.type === "Nota di Credito") ? "TD04" : "TD01";

    // -----------------------------
    // 1. Dati monetari principali
    // -----------------------------
    const totalePrestazioni = safeFloat(invoice.totalePrestazioni);
    const importoBollo = safeFloat(invoice.importoBollo);
    const importoRivalsa = invoice.rivalsa ? safeFloat(invoice.rivalsa.importo) : 0;
    const totaleImponibile = safeFloat(invoice.totaleImponibile);
    const totaleDocumento = safeFloat(invoice.total);

    // -----------------------------
    // 2. Anagrafica Cedente/Prestatore
    // -----------------------------
    let anagraficaCedente = `<Anagrafica><Denominazione>${escapeXML(company.name || '')}</Denominazione></Anagrafica>`;
    if (company.nome && company.cognome) {
        anagraficaCedente =
            `<Anagrafica>` +
                `<Nome>${escapeXML(company.nome)}</Nome>` +
                `<Cognome>${escapeXML(company.cognome)}</Cognome>` +
            `</Anagrafica>`;
    }

    // -----------------------------
    // 3. Riepilogo per Natura (N2.2, N2.1, N4, …)
    // -----------------------------
    const summaryByNature = {};

    // Linee della fattura
    (invoice.lines || []).forEach(l => {
        const iva = (l.iva != null) ? String(l.iva) : "0";
        const natura = (iva === "0" && l.esenzioneIva) ? String(l.esenzioneIva) : null;

        if (natura) {
            if (!summaryByNature[natura]) {
                summaryByNature[natura] = {
                    aliquota: iva,
                    natura: natura,
                    imponibile: 0
                };
            }
            summaryByNature[natura].imponibile += safeFloat(l.subtotal);
        }
    });

    // Aggiungo la rivalsa INPS nel riepilogo come N4 (se presente)
    if (importoRivalsa > 0) {
        const k = "N4";
        if (!summaryByNature[k]) {
            summaryByNature[k] = {
                aliquota: "0.00",
                natura: k,
                imponibile: 0
            };
        }
        summaryByNature[k].imponibile += importoRivalsa;
    }

    let riepilogoXml = "";
    Object.values(summaryByNature).forEach(s => {
        riepilogoXml +=
            `<DatiRiepilogo>` +
                `<AliquotaIVA>${parseFloat(s.aliquota || "0").toFixed(2)}</AliquotaIVA>` +
                `<Natura>${escapeXML(s.natura)}</Natura>` +
                `<ImponibileImporto>${s.imponibile.toFixed(2)}</ImponibileImporto>` +
                `<Imposta>0.00</Imposta>` +
            `</DatiRiepilogo>`;
    });

    // -----------------------------
    // 4. Dati Bollo (se presente)
    // -----------------------------
    let datiBolloXml = "";

    // Regola:
    // - TD01 (Fattura): bollo sempre
    // - TD04 (Nota di Credito): bollo solo se importo (valore assoluto) > 77,47 €
    const importoDocAssoluto = Math.abs(totaleDocumento);

    if (tipoDocumento === "TD01" || (tipoDocumento === "TD04" && importoDocAssoluto > 77.47)) {
        datiBolloXml =
            `<DatiBollo>` +
                `<BolloVirtuale>SI</BolloVirtuale>` +
                `<ImportoBollo>2.00</ImportoBollo>` +
            `</DatiBollo>`;
    }

    // -----------------------------
    // 5. Dati Cassa Previdenziale (Rivalsa INPS, se presente)
    // -----------------------------
    let datiCassaXml = "";
    if (importoRivalsa > 0) {
        const aliqRiv = safeFloat(company.aliquotaInps || company.aliquotaContributi || 0);
        datiCassaXml =
            `<DatiCassaPrevidenziale>` +
                `<TipoCassa>TC22</TipoCassa>` +
                `<AlCassa>${aliqRiv.toFixed(2)}</AlCassa>` +
                `<ImportoContributoCassa>${importoRivalsa.toFixed(2)}</ImportoContributoCassa>` +
                `<ImponibileCassa>${totalePrestazioni.toFixed(2)}</ImponibileCassa>` +
                `<AliquotaIVA>0.00</AliquotaIVA>` +
                `<Natura>N4</Natura>` +
            `</DatiCassaPrevidenziale>`;
    }

    // -----------------------------
    // 6. Corpo XML
    // -----------------------------
    const progressivoInvio = (Math.random().toString(36) + "00000").slice(2, 7);
    const dataFattura = invoice.date || new Date().toISOString().slice(0, 10);
    const dataScadenza = invoice.dataScadenza || dataFattura;

    // Province sempre in maiuscolo (richiesta da Fatturacheck)
    const sedeProvinciaCed = escapeXML((company.provincia || "").toString().toUpperCase());
    const sedeProvinciaDest = escapeXML((customer.provincia || "").toString().toUpperCase());

    let xml = `<?xml version="1.0" encoding="UTF-8"?>` +
`<p:FatturaElettronica versione="FPR12"
 xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
 xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
`<FatturaElettronicaHeader>` +
  `<DatiTrasmissione>` +
    `<IdTrasmittente>` +
      `<IdPaese>IT</IdPaese>` +
      `<IdCodice>${escapeXML(company.codiceFiscale || "")}</IdCodice>` +
    `</IdTrasmittente>` +
    `<ProgressivoInvio>${progressivoInvio}</ProgressivoInvio>` +
    `<FormatoTrasmissione>FPR12</FormatoTrasmissione>` +
    `<CodiceDestinatario>${escapeXML(customer.sdi || "0000000")}</CodiceDestinatario>` +
  `</DatiTrasmissione>` +
  `<CedentePrestatore>` +
    `<DatiAnagrafici>` +
      `<IdFiscaleIVA>` +
        `<IdPaese>IT</IdPaese>` +
        `<IdCodice>${escapeXML(company.piva || "")}</IdCodice>` +
      `</IdFiscaleIVA>` +
      `<CodiceFiscale>${escapeXML(company.codiceFiscale || "")}</CodiceFiscale>` +
      anagraficaCedente +
      `<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale || "")}</RegimeFiscale>` +
    `</DatiAnagrafici>` +
    `<Sede>` +
      `<Indirizzo>${escapeXML(company.address || "")}</Indirizzo>` +
      `<NumeroCivico>${escapeXML(company.numeroCivico || "")}</NumeroCivico>` +
      `<CAP>${escapeXML(company.zip || "")}</CAP>` +
      `<Comune>${escapeXML(company.city || "")}</Comune>` +
      `<Provincia>${sedeProvinciaCed}</Provincia>` +
      `<Nazione>IT</Nazione>` +
    `</Sede>` +
  `</CedentePrestatore>` +
  `<CessionarioCommittente>` +
    `<DatiAnagrafici>` +
      (customer.piva ? (
        `<IdFiscaleIVA>` +
          `<IdPaese>IT</IdPaese>` +
          `<IdCodice>${escapeXML(customer.piva)}</IdCodice>` +
        `</IdFiscaleIVA>`
      ) : ``) +
      (customer.codiceFiscale ? `<CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale>` : ``) +
      `<Anagrafica>` +
        `<Denominazione>${escapeXML(customer.name || "")}</Denominazione>` +
      `</Anagrafica>` +
    `</DatiAnagrafici>` +
    `<Sede>` +
      `<Indirizzo>${escapeXML(customer.address || "")}</Indirizzo>` +
      `<CAP>${escapeXML(customer.cap || "")}</CAP>` +
      `<Comune>${escapeXML(customer.comune || "")}</Comune>` +
      `<Provincia>${sedeProvinciaDest}</Provincia>` +
      `<Provincia>${escapeXML(customer.provincia)}</Provincia><Nazione>${normalizeCountryCode(customer.nazione)}</Nazione></Sede>` +
  `</CessionarioCommittente>` +
`</FatturaElettronicaHeader>` +
`<FatturaElettronicaBody>` +
  `<DatiGenerali>` +
    `<DatiGeneraliDocumento>` +
      `<TipoDocumento>${tipoDocumento}</TipoDocumento>` +
      `<Divisa>EUR</Divisa>` +
      `<Data>${dataFattura}</Data>` +
      `<Numero>${escapeXML(invoice.number || "")}</Numero>` +
      datiBolloXml +
      datiCassaXml +
      `<ImportoTotaleDocumento>${totaleDocumento.toFixed(2)}</ImportoTotaleDocumento>` +
    `</DatiGeneraliDocumento>` +
  `</DatiGenerali>` +
  `<DatiBeniServizi>`;

    // Linee
    let ln = 1;
    (invoice.lines || []).forEach(l => {
        const iva = parseFloat(l.iva != null ? l.iva : 0);
        const natura = (iva === 0 && l.esenzioneIva) ? String(l.esenzioneIva) : null;

        xml += `<DettaglioLinee>` +
                `<NumeroLinea>${ln++}</NumeroLinea>` +
                `<Descrizione>${escapeXML(l.productName || "")}</Descrizione>` +
                `<Quantita>${(parseFloat(l.qty) || 0).toFixed(2)}</Quantita>` +
                `<PrezzoUnitario>${(parseFloat(l.price) || 0).toFixed(2)}</PrezzoUnitario>` +
                `<PrezzoTotale>${(parseFloat(l.subtotal) || 0).toFixed(2)}</PrezzoTotale>` +
                `<AliquotaIVA>${iva.toFixed(2)}</AliquotaIVA>` +
                (natura ? `<Natura>${escapeXML(natura)}</Natura>` : ``) +
              `</DettaglioLinee>`;
    });

    // Riepilogo IVA / Natura
    xml += riepilogoXml +
          `</DatiBeniServizi>` +
          `<DatiPagamento>` +
            `<CondizioniPagamento>TP02</CondizioniPagamento>` +
            `<DettaglioPagamento>` +
              `<ModalitaPagamento>MP05</ModalitaPagamento>` +
              `<DataScadenzaPagamento>${dataScadenza}</DataScadenzaPagamento>` +
              `<ImportoPagamento>${totaleDocumento.toFixed(2)}</ImportoPagamento>` +
              (company.iban ? `<IBAN>${escapeXML(company.iban)}</IBAN>` : ``) +
            `</DettaglioPagamento>` +
          `</DatiPagamento>` +
        `</FatturaElettronicaBody>` +
      `</p:FatturaElettronica>`;

    // Download con nome casuale tipo: IT12345678901_abc12.xml
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const filename = `IT${company.piva || ""}_${randomSuffix}.xml`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup (important for some browsers)
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 0);
}
// VIEW (Dettaglio Fattura)
    // VIEW
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const id = $(this).attr('data-id');
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if (!inv) return;

        const company = getData('companyInfo') || {};
        const customer = getData('customers').find(x => String(x.id) === String(inv.customerId)) || {};

        // Imposta il pulsante XML sul documento corrente
        $('#export-xml-btn').data('invoiceId', inv.id);
        $('#invoiceDetailModalTitle').text(`${inv.type} ${inv.number}`);

        // --- RICALCOLO IMPORTI PER VISUALIZZAZIONE (non tocca i dati salvati) ---
        const rowsSenzaBollo = (inv.lines || []).filter(l =>
            (l.productName || '').toLowerCase() !== 'rivalsa bollo'
        );
        const rigaBollo = (inv.lines || []).find(l =>
            (l.productName || '').toLowerCase() === 'rivalsa bollo'
        );

        const totPrest = rowsSenzaBollo.reduce((s, l) => s + (l.subtotal || 0), 0);
        const impBollo = rigaBollo ? (rigaBollo.subtotal || 0) : 0;

        const aliquotaInps = parseFloat(company.aliquotaInps || 0);
        const hasRivInpsFlag = !!(customer && customer.rivalsaInps);
        const rivInps = hasRivInpsFlag ? (totPrest * (aliquotaInps / 100)) : 0;

        const totImponibile = totPrest + rivInps;
        const totDocumento = totImponibile + impBollo;

        const hasRivInps = hasRivInpsFlag && rivInps > 0;
        const hasBollo = impBollo > 0;

        let h = '';

        // --- HEADER: CEDENTE / CESSIONARIO ---
        h += `
        <div class="row mb-3">
            <div class="col-6">
                <h5 class="mb-1">Cedente / Prestatore</h5>
                <div><strong>${escapeXML(company.name || '')}</strong></div>
                ${company.piva ? `<div>P.IVA: ${escapeXML(company.piva)}</div>` : ''}
                ${company.codiceFiscale ? `<div>C.F.: ${escapeXML(company.codiceFiscale)}</div>` : ''}
                ${company.address ? `<div>${escapeXML(company.address)}${company.numeroCivico ? ', ' + escapeXML(company.numeroCivico) : ''}</div>` : ''}
                ${(company.zip || company.city || company.province)
                    ? `<div>${escapeXML(company.zip || '')} ${escapeXML(company.city || '')} ${escapeXML(company.province || '')}</div>`
                    : ''}
            </div>
            <div class="col-6 text-end">
                <h5 class="mb-1">Cessionario / Committente</h5>
                <div><strong>${escapeXML(customer.name || '')}</strong></div>
                ${customer.piva ? `<div>P.IVA: ${escapeXML(customer.piva)}</div>` : ''}
                ${customer.codiceFiscale ? `<div>C.F.: ${escapeXML(customer.codiceFiscale)}</div>` : ''}
                ${customer.address ? `<div>${escapeXML(customer.address)}</div>` : ''}
                ${(customer.cap || customer.comune || customer.provincia)
                    ? `<div>${escapeXML(customer.cap || '')} ${escapeXML(customer.comune || '')} ${escapeXML(customer.provincia || '')}</div>`
                    : ''}
            </div>
        </div>
        `;

        // --- DATI DOCUMENTO (numero, data, tipo) ---
        h += `
        <div class="row mb-3">
            <div class="col-6">
                <div><strong>Numero:</strong> ${escapeXML(inv.number || '')}</div>
                <div><strong>Data:</strong> ${formatDateForDisplay(inv.date)}</div>
            </div>
            <div class="col-6 text-end">
                <div><strong>Tipo documento:</strong> ${inv.type || 'Fattura'}</div>
            </div>
        </div>
        `;

        // --- DETTAGLIO RIGHE ---
        h += `
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Descrizione</th>
                    <th class="text-end">Q.tà</th>
                    <th class="text-end">Prezzo</th>
                    <th class="text-end">Totale</th>
                </tr>
            </thead>
            <tbody>
        `;
        (inv.lines || []).forEach(l => {
            const qty = typeof l.qty === 'number' ? l.qty : parseFloat(l.qty || 0) || 0;
            const price = typeof l.price === 'number' ? l.price : parseFloat(l.price || 0) || 0;
            const subtotal = typeof l.subtotal === 'number' ? l.subtotal : parseFloat(l.subtotal || 0) || (qty * price);

            h += `
                <tr>
                    <td>${escapeXML(l.productName || '')}</td>
                    <td class="text-end">${qty.toFixed(2)}</td>
                    <td class="text-end">€ ${price.toFixed(2)}</td>
                    <td class="text-end">€ ${subtotal.toFixed(2)}</td>
                </tr>
            `;
        });
        h += `
            </tbody>
        </table>
        `;

        // --- RIEPILOGO IMPORTI ---
        h += `
        <div class="row justify-content-end">
            <div class="col-md-5">
                <table class="table table-sm mb-0">
                    <tbody>
                        <tr>
                            <th>Totale Prestazioni</th>
                            <td class="text-end">€ ${totPrest.toFixed(2)}</td>
                        </tr>
                        ${hasRivInps ? `
                        <tr>
                            <th>Rivalsa INPS</th>
                            <td class="text-end">€ ${rivInps.toFixed(2)}</td>
                        </tr>` : ''}
                        <tr>
                            <th>Totale Imponibile</th>
                            <td class="text-end">€ ${totImponibile.toFixed(2)}</td>
                        </tr>
                        ${hasBollo ? `
                        <tr>
                            <th>Marca da bollo</th>
                            <td class="text-end">€ ${impBollo.toFixed(2)}</td>
                        </tr>` : ''}
                        <tr class="table-light fw-bold">
                            <th>Totale Documento</th>
                            <td class="text-end">€ ${totDocumento.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        `;

        // --- FOOTER: TESTO FISCALE + DATI PAGAMENTO ---
        const condizioni = inv.condizioniPagamento || '';
        const modalita = inv.modalitaPagamento || '';
        const scadenza = inv.dataScadenza ? formatDateForDisplay(inv.dataScadenza) : '';
        const banca = company.banca || '';
        const iban = company.iban || '';

        h += `
        <div class="mt-3 small">
            <p>
                Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89, Legge n. 190/2014 (Regime Forfettario).
                Si richiede la non applicazione della ritenuta alla fonte a titolo d’acconto ai sensi dell’art. 1, comma 67, Legge n. 190/2014.
            </p>
        </div>
        <div class="mt-2">
            <h6>Dati di pagamento</h6>
            <table class="table table-sm mb-0">
                <tbody>
                    <tr>
                        <th>Condizioni</th>
                        <td>${escapeXML(condizioni)}</td>
                    </tr>
                    <tr>
                        <th>Modalità</th>
                        <td>${escapeXML(modalita)}</td>
                    </tr>
                    <tr>
                        <th>Scadenza</th>
                        <td>${scadenza}</td>
                    </tr>
                    <tr>
                        <th>Banca</th>
                        <td>${escapeXML(banca)}</td>
                    </tr>
                    <tr>
                        <th>IBAN</th>
                        <td>${escapeXML(iban)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        `;

        $('#invoiceDetailModalBody').html(h);
        
        // apertura sicura della modale (anche se i data-bs-* non venissero letti)
    const modalEl = document.getElementById('invoiceDetailModal');
    if (modalEl && window.bootstrap && bootstrap.Modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();
    }
    });


    $('#print-invoice-btn').click(()=>window.print());

    // Salvataggio anagrafica azienda
    $('#company-info-form').on('submit', async function(e) { 
        e.preventDefault(); 
        const d={}; 
        $(this).find('input, select, textarea').each(function(){
            if(this.id) {
                const key = this.id.replace('company-','');
                d[key] = $(this).val();
            }
        }); 
        await saveDataToCloud('companyInfo', d); 
        alert("Anagrafica azienda salvata!"); 
        renderAll();
    });

    // Salvataggio note
    $('#save-notes-btn').click(async()=>{
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }
        await saveDataToCloud('notes', {userId:currentUser.uid, text:$('#notes-textarea').val()}, currentUser.uid); 
        alert("Note salvate!"); 
    });

    // =========================================================
    // BACKUP JSON DAL CLOUD (UTENTE CORRENTE)
    // =========================================================
    $('#export-cloud-json-btn').on('click', async function () {
        try {
            if (!currentUser) {
                alert('Devi prima effettuare il login.');
                return;
            }

            // Mi assicuro di avere i dati aggiornati dal Cloud
            await loadAllDataFromCloud();

            const backup = {
                userId: currentUser.uid,
                companyInfo: globalData.companyInfo || {},
                products: globalData.products || [],
                customers: globalData.customers || [],
                invoices: globalData.invoices || [],
                notes: globalData.notes || []
            };

            const blob = new Blob(
                [JSON.stringify(backup, null, 2)],
                { type: 'application/json' }
            );

            const a = document.createElement('a');
            const today = new Date().toISOString().slice(0, 10); // es. 2025-12-01
            a.download = `gestionale-backup-${today}.json`;
            a.href = URL.createObjectURL(blob);
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            console.error('Errore export backup JSON:', err);
            alert('Errore durante il backup JSON dal Cloud.');
        }
    });

    // Import dal vecchio JSON (localStorage)
    $('#import-file-input').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                const oldData = JSON.parse(ev.target.result);
                if (!currentUser) {
                    alert("Devi essere loggato per importare i dati.");
                    return;
                }

                const newStruct = {
                    companyInfo: oldData.companyInfo || {},
                    products: oldData.products || [],
                    customers: oldData.customers || [],
                    invoices: oldData.invoices || [],
                    notes: oldData.notes || []
                };

                if (newStruct.companyInfo) {
                    await saveDataToCloud('companyInfo', newStruct.companyInfo, 'companyInfo');
                }

                for (const p of newStruct.products) {
                    const id = p.id || ('PRD' + new Date().getTime());
                    await saveDataToCloud('products', p, id);
                }

                for (const c of newStruct.customers) {
                    const id = c.id || String(getNextId(getData('customers')));
                    await saveDataToCloud('customers', c, id);
                }

                for (const inv of newStruct.invoices) {
                    const id = inv.id || String(getNextId(getData('invoices')));
                    await saveDataToCloud('invoices', inv, id);
                }

                for (const n of newStruct.notes) {
                    const id = n.id || currentUser.uid;
                    await saveDataToCloud('notes', n, id);
                }

                await loadAllDataFromCloud();
                renderAll();
                alert("Importazione dal vecchio formato completata!");

            } catch (err) {
                console.error("Errore import vecchio JSON:", err);
                alert("Errore durante l'importazione del vecchio JSON: " + err.message);
            }
        };
        reader.readAsText(file);
    });

});