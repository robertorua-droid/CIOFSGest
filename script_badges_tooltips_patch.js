/*!
 * script_badges_tooltips_patch.js
 * - Uniforma i badge di stato (Ordini, DDT, Fatture) aggiungendo tooltip esplicativi.
 * - Ripristina "Benvenuto Nome Cognome" in Home leggendo il nome dalla sidebar.
 * Non invasivo: funziona con rendering dinamico e coesiste con patch precedenti.
 */
(function () {
  'use strict';

  function initTooltips(root) {
    var scope = root || document;
    var nodes = [].slice.call(scope.querySelectorAll('[data-bs-toggle="tooltip"]'));
    nodes.forEach(function (el) {
      try {
        // Se già creato, getOrCreate evita duplicati
        bootstrap.Tooltip.getOrCreateInstance(el, { container: 'body' });
      } catch (e) { /* bootstrap non caricato? */ }
    });
  }

  function normalize(s) {
    return (s || '').toString().trim().toLowerCase();
  }

  function statusInfo(entityType, raw) {
    var t = normalize(raw);
    var info = { cls: 'text-bg-secondary', title: 'Stato documento' };

    var orderMap = [
      { m: ['in lavorazione','lavorazione'],               cls: 'text-bg-secondary', title: 'Ordine registrato: nessuna evasione effettuata.' },
      { m: ['parzialmente evaso','parzialmente evasa','parz. evaso','parz. evasa'], cls: 'text-bg-warning',  title: 'Ordine evaso solo in parte.' },
      { m: ['evaso','evasa','completato','completata'],    cls: 'text-bg-success',   title: 'Ordine completamente evaso.' },
      { m: ['spedito','spedita'],                          cls: 'text-bg-info',      title: 'DDT creato, merce spedita.' },
      { m: ['annullato','annullata','cancellato','cancellata'], cls: 'text-bg-danger', title: 'Ordine annullato.' }
    ];

    var ddtMap = [
      { m: ['bozza'],                  cls: 'text-bg-secondary', title: 'Documento in bozza, non definitivo.' },
      { m: ['registrato','ricevuto','ricevuta'], cls: 'text-bg-info',      title: 'DDT fornitore registrato a magazzino.' },
      { m: ['da fatturare'],           cls: 'text-bg-primary',   title: 'DDT non ancora fatturato.' },
      { m: ['parzialmente fatturato','parzialmente fatturata'], cls: 'text-bg-warning',  title: 'DDT parzialmente fatturato.' },
      { m: ['fatturato','fatturata'],  cls: 'text-bg-success',   title: 'Documento già fatturato.' },
      { m: ['annullato','annullata'],  cls: 'text-bg-danger',    title: 'Documento annullato.' }
    ];

    var invoiceMap = [
      { m: ['bozza'],    cls: 'text-bg-secondary', title: 'Fattura non definitiva.' },
      { m: ['emessa','emesso'], cls: 'text-bg-primary',   title: 'Fattura emessa.' },
      { m: ['pagata','pagato'], cls: 'text-bg-success',   title: 'Fattura saldata.' },
      { m: ['parziale','acconto'], cls: 'text-bg-warning',   title: 'Pagamento parziale / a stato avanzamento.' },
      { m: ['stornata','stornato','annullata','annullato'], cls: 'text-bg-danger',    title: 'Fattura stornata/annullata.' }
    ];

    var map = entityType === 'order' ? orderMap : entityType === 'ddt' ? ddtMap : invoiceMap;

    for (var i=0;i<map.length;i++) {
      var row = map[i];
      for (var j=0;j<row.m.length;j++) {
        if (t === row.m[j]) return { cls: row.cls, title: row.title };
      }
    }
    // match contains when lo stato arriva da varianti (es. "Parzialmente evaso (2 righe)")
    for (var i2=0;i2<map.length;i2++) {
      var row2 = map[i2];
      for (var j2=0;j2<row2.m.length;j2++) {
        if (t.indexOf(row2.m[j2]) !== -1) return { cls: row2.cls, title: row2.title };
      }
    }

    return info;
  }

  // Restituisce l'indice della colonna "Stato" cercandola nell'header, -1 se non presente.
  function getStatusColIndexFromHeader(tbody) {
    if (!tbody) return -1;
    var table = tbody.closest('table');
    if (!table) return -1;
    var headers = table.querySelectorAll('thead th');
    for (var i=0;i<headers.length;i++) {
      var h = normalize(headers[i].textContent);
      if (h === 'stato') return i;
    }
    return -1;
  }

  function ensureBadgeInCell(cell, entityType) {
    if (!cell) return;
    if (cell.dataset.tooltipEnhanced === '1') return;

    // Se esiste già uno span.badge, non riscrivere ma aggiungi solo tooltip/classi mancanti
    var existing = cell.querySelector('span.badge');
    var text = (cell.textContent || '').trim();
    var info = statusInfo(entityType, text);

    if (existing) {
      existing.classList.add('rounded-pill');
      if (!/\btext-bg-/.test(existing.className)) {
        // uniforma alle classi text-bg-*
        existing.className = 'badge rounded-pill ' + info.cls;
      }
      existing.setAttribute('data-bs-toggle', 'tooltip');
      existing.setAttribute('data-bs-title', info.title);
      cell.dataset.tooltipEnhanced = '1';
      return;
    }

    // Altrimenti crea il badge completo
    var span = document.createElement('span');
    span.className = 'badge rounded-pill ' + info.cls;
    span.textContent = text;
    span.setAttribute('data-bs-toggle', 'tooltip');
    span.setAttribute('data-bs-title', info.title);
    cell.innerHTML = '';
    cell.appendChild(span);
    cell.dataset.tooltipEnhanced = '1';
  }

  function enhanceTable(tbodySelector, entityType) {
    var tbody = document.querySelector(tbodySelector);
    if (!tbody) return;
    var statusIdx = getStatusColIndexFromHeader(tbody);
    if (statusIdx === -1) return;

    var rows = tbody.querySelectorAll('tr');
    rows.forEach(function (tr) {
      var cells = tr.children;
      if (!cells || cells.length <= statusIdx) return;
      var cell = cells[statusIdx];
      if (!cell) return;
      ensureBadgeInCell(cell, entityType);
    });
  }

  function runEnhancers() {
    enhanceTable('#customer-orders-table-body',   'order');
    enhanceTable('#supplier-orders-table-body',   'order');
    enhanceTable('#customer-ddts-table-body',     'ddt');
    enhanceTable('#supplier-ddts-table-body',     'ddt');
    enhanceTable('#invoices-table-body',          'invoice');
    initTooltips(document);
  }

  function observeBodies() {
    var ids = [
      '#customer-orders-table-body',
      '#supplier-orders-table-body',
      '#customer-ddts-table-body',
      '#supplier-ddts-table-body',
      '#invoices-table-body'
    ];
    ids.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var obs = new MutationObserver(function () { runEnhancers(); });
      obs.observe(el, { childList: true, subtree: true });
    });
    // Fallback: rielabora dopo piccoli ritardi
    setTimeout(runEnhancers, 600);
    setTimeout(runEnhancers, 1500);
    setTimeout(runEnhancers, 3000);
  }

  // --- Benvenuto Nome Cognome ------------------------------------------------
  function syncWelcome() {
    var welcome = document.getElementById('welcome-message');
    if (!welcome) return;
    var side = document.getElementById('user-name-sidebar');
    if (!side) return;
    var t = (side.textContent || '').trim();
    if (!t) return;

    // Rimuove eventuale ruolo tra parentesi
    var cleaned = t.replace(/\(.*?\)/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!/^benvenuto/i.test(welcome.textContent || '')) {
      welcome.textContent = 'Benvenuto ' + cleaned;
    } else {
      // se già c'è "Benvenuto", aggiungi/aggiorna il nome
      welcome.textContent = 'Benvenuto ' + cleaned;
    }
  }

  function observeWelcome() {
    var side = document.getElementById('user-name-sidebar');
    if (!side) return;
    var obs = new MutationObserver(function () { syncWelcome(); });
    obs.observe(side, { childList: true, characterData: true, subtree: true });
    // anche all'avvio
    syncWelcome();
  }

  document.addEventListener('DOMContentLoaded', function () {
    runEnhancers();
    observeBodies();
    observeWelcome();
  });

})();
