
/*!
 * Patch: status badges + tooltips + welcome full name
 * Requires: Bootstrap 5 (bundle) already loaded in the page (for Tooltip)
 * Safe to include after the main script.js (does NOT break existing logic)
 * v1.0.0 - 2025-11-21
 */
(function () {
  'use strict';

  // ---- Bootstrap Tooltip helper ----
  function initTooltips(root) {
    try {
      var els = (root || document).querySelectorAll('[data-bs-toggle="tooltip"]');
      els.forEach(function (el) {
        // Avoid re-instantiating a Tooltip on the same node
        if (!el._bsTooltip) {
          var t = new bootstrap.Tooltip(el, {container: 'body'});
          el._bsTooltip = t;
        }
      });
    } catch (e) {
      // Bootstrap not available yet — retry shortly
      setTimeout(function(){ initTooltips(root); }, 400);
    }
  }

  // ---- Status metadata ----
  var STATUS_META = {
    order: {
      "in lavorazione": {cls: "bg-secondary", tip: "Ordine registrato ma non ancora evaso."},
      "parzialmente evaso": {cls: "bg-warning text-dark", tip: "Ordine evaso solo in parte (uno o più DDT)."},
      "evaso": {cls: "bg-success", tip: "Ordine completamente evaso."},
      "spedito": {cls: "bg-info text-dark", tip: "Merce spedita (DDT emesso), non ancora fatturata."},
      "annullato": {cls: "bg-danger", tip: "Ordine annullato; non movimenta più il magazzino."}
    },
    ddt: {
      "emesso": {cls: "bg-primary", tip: "DDT cliente emesso e consegnato."},
      "ricevuto": {cls: "bg-primary", tip: "DDT fornitore registrato (merce in entrata)."},
      "parzialmente fatturato": {cls: "bg-warning text-dark", tip: "Alcune righe del DDT già fatturate."},
      "fatturato": {cls: "bg-success", tip: "DDT interamente fatturato."},
      "annullato": {cls: "bg-danger", tip: "DDT annullato."}
    },
    invoice: {
      "emessa": {cls: "bg-primary", tip: "Fattura emessa e registrata."},
      "pagata": {cls: "bg-success", tip: "Saldo registrato."},
      "parziale": {cls: "bg-warning text-dark", tip: "Pagamento parziale registrato."},
      "stornata": {cls: "bg-danger", tip: "Fattura stornata/annullata."}
    }
  };

  // Normalize free-text statuses to our keys
  function normalizeStatus(s) {
    if (!s) return "";
    var t = (""+s).trim().toLowerCase();
    // common abbreviations / partials
    if (t.startsWith("evas")) t = "evaso";
    if (t.startsWith("parz")) t = "parzialmente evaso";
    if (t === "parziale pagamento" || t === "parz. pagamento") t = "parziale";
    return t;
  }

  function badgeHTML(entityType, rawStatus) {
    var st = normalizeStatus(rawStatus);
    var meta = (STATUS_META[entityType] && STATUS_META[entityType][st]) || null;
    var cls = meta ? meta.cls : "bg-secondary";
    var tip = meta ? meta.tip : ("Stato: " + rawStatus);
    var txt = rawStatus && rawStatus.trim() ? rawStatus.trim() : "—";
    return '<span class="badge '+cls+'" data-bs-toggle="tooltip" data-bs-title="'+escapeHtml(tip)+'">'+escapeHtml(txt)+'</span>';
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, function(m){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
    });
  }

  // Find "Stato" column and replace raw text with a badge
  function enhanceStatusInSection(sectionSelector, entityType) {
    var section = document.querySelector(sectionSelector);
    if (!section) return;
    var table = section.querySelector("table");
    if (!table) return;
    var ths = Array.from(table.querySelectorAll("thead th"));
    var idx = ths.findIndex(function(th){ return th.textContent.trim().toLowerCase() === "stato"; });
    if (idx === -1) return;

    var rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach(function(tr){
      var cell = tr.children[idx];
      if (!cell) return;
      if (cell.dataset && cell.dataset.enhanced === "1") return;
      var statusText = cell.textContent || "";
      cell.innerHTML = badgeHTML(entityType, statusText);
      cell.dataset.enhanced = "1";
    });
    initTooltips(section);
  }

  // Observe dynamic table rendering
  function observeSection(sectionSelector, entityType) {
    var section = document.querySelector(sectionSelector);
    if (!section) return;
    var obs = new MutationObserver(function(){
      enhanceStatusInSection(sectionSelector, entityType);
    });
    obs.observe(section, {childList: true, subtree: true});
    // initial run
    enhanceStatusInSection(sectionSelector, entityType);
  }

  // Update welcome message with full name mirrored from the sidebar
  function syncWelcomeWithSidebar() {
    var sidebarNameEl = document.getElementById("user-name-sidebar");
    var welcomeEl = document.getElementById("welcome-message");
    if (!sidebarNameEl || !welcomeEl) return;

    var apply = function(){
      var name = (sidebarNameEl.textContent || "").trim();
      if (name) {
        // Keep the "Benvenuto" already present and append ", Nome Cognome"
        var base = "Benvenuto";
        var hasPrefix = (welcomeEl.textContent || "").trim().toLowerCase().startsWith("benvenuto");
        if (!hasPrefix) base = "";
        welcomeEl.textContent = base ? (base + ", " + name) : ("Benvenuto, " + name);
      }
    };

    // Initial
    apply();
    // Listen for future changes
    var mo = new MutationObserver(apply);
    mo.observe(sidebarNameEl, {characterData: true, childList: true, subtree: true});
    // also re-apply when we navigate sections
    document.addEventListener("click", function(e){
      var t = e.target;
      if (t && t.closest && t.closest(".sidebar .nav-link")) {
        setTimeout(apply, 50);
      }
    });
  }

  // Run once DOM is ready
  function onReady(fn){
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  onReady(function(){
    // Observe the 5 sections that show a "Stato" column
    observeSection("#elenco-ordini-cliente", "order");
    observeSection("#elenco-ordini-fornitore", "order");
    observeSection("#elenco-ddt-cliente", "ddt");
    observeSection("#elenco-ddt-fornitore", "ddt");
    observeSection("#elenco-fatture", "invoice");

    // Welcome message sync
    syncWelcomeWithSidebar();

    // Global tooltip init (in case static markup already contains tooltips)
    initTooltips(document);
  });
})();
