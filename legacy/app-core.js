/* app-core.js - core utilities, DB, small router, home widgets, stats */
(function (global) {
  'use strict';
  if (!global.App) global.App = {};
  const App = global.App;

  // ========================
  // Config & DB
  // ========================
  App.config = {
    DB_KEY: 'gestionale_ol_db'
  };

  App.db = {
    _key: App.config.DB_KEY,
    load() {
      try {
        const raw = localStorage.getItem(this._key);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    save(db) {
      localStorage.setItem(this._key, JSON.stringify(db));
      return db;
    },
    ensure() {
      let db = this.load();
      if (!db) {
        db = {
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
        this.save(db);
      }
      return db;
    }
  };

  // ========================
  // Utilities
  // ========================
  App.utils = {
    uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
    }); },
    todayISO() { return new Date().toISOString().slice(0,10); },
    fmtMoney(n) {
      const v = (typeof n === 'number') ? n : parseFloat(n || 0);
      const num = isNaN(v) ? 0 : v;
      return '€ ' + num.toFixed(2).replace('.', ',');
    },
    // Numbering helpers
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

  // ========================
  // UI helpers
  // ========================
  App.ui = {
    showToast(message, type) {
      if (typeof global.showToast === 'function') return global.showToast(message, type);
      // fallback toast
      const id = 'toast-container';
      let container = document.getElementById(id);
      if (!container) {
        container = document.createElement('div');
        container.id = id;
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = 1080;
        document.body.appendChild(container);
      }
      const el = document.createElement('div');
      el.className = 'toast align-items-center text-bg-' + (type||'info') + ' border-0';
      el.setAttribute('role', 'alert');
      el.innerHTML = '<div class="d-flex"><div class="toast-body">' + message +
        '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';
      container.appendChild(el);
      try {
        new bootstrap.Toast(el, { delay: 2500 }).show();
        el.addEventListener('hidden.bs.toast', () => el.remove());
      } catch { console.log('[Toast]', message); }
    },
    setSidebarUserLabel(user) {
      const el = document.getElementById('user-name-sidebar');
      if (el && user) el.textContent = `Utente: ${user.surname} (${user.role})`;
    },
    setCompanySidebarName(db) {
      const el = document.getElementById('company-name-sidebar');
      if (el && db?.company?.name) el.textContent = db.company.name;
    },
    showSection(id) {
      document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
      const target = document.getElementById(id);
      if (target) target.classList.remove('d-none');
      // nav active
      document.querySelectorAll('.sidebar .nav-link').forEach(a => a.classList.remove('active'));
      const current = document.querySelector(`.sidebar .nav-link[data-target="${id}"]`);
      if (current) current.classList.add('active');
    }
  };

  // ========================
  // Event bus
  // ========================
  App.events = (() => {
    const map = {};
    return {
      on(ev, fn){ (map[ev] = map[ev] || []).push(fn); },
      off(ev, fn){ map[ev] = (map[ev] || []).filter(f => f !== fn); },
      emit(ev, payload){ (map[ev] || []).forEach(f => f(payload)); }
    };
  })();

  // ========================
  // Home page widgets
  // ========================
  function renderClock() {
    const el = document.getElementById('current-datetime');
    if (!el) return;
    const now = new Date();
    const fmt = now.toLocaleString();
    el.textContent = fmt;
  }
  function renderCalendar() {
    const container = document.getElementById('calendar-widget');
    if (!container) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay() === 0 ? 7 : first.getDay(); // 1..7 (Mon..Sun)
    const days = last.getDate();

    let html = '<table class="table table-sm"><thead><tr>';
    ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach(d => html += `<th>${d}</th>`);
    html += '</tr></thead><tbody><tr>';
    for (let i=1;i<startDay;i++) html += '<td></td>';
    let day = 1;
    const today = now.getDate();
    for (let cell = startDay; cell <= 7; cell++) {
      html += `<td class="${day===today?'today':''}">${day}</td>`;
      day++;
    }
    html += '</tr>';
    while (day <= days) {
      html += '<tr>';
      for (let i=0;i<7;i++) {
        if (day <= days) html += `<td class="${day===today?'today':''}">${day}</td>`;
        else html += '<td></td>';
        day++;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function initNotes(user) {
    const ta = document.getElementById('notes-textarea');
    const btn = document.getElementById('save-notes-btn');
    if (!ta || !btn) return;
    const db = App.db.ensure();
    const key = user?.id || user?.surname || 'default';
    ta.value = (db.notes && db.notes[key]) || '';
    btn.addEventListener('click', () => {
      db.notes = db.notes || {};
      db.notes[key] = ta.value || '';
      App.db.save(db);
      App.ui.showToast('Note salvate', 'success');
    });
  }

  // ========================
  // Statistiche (Chart.js)
  // ========================
  function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
  function monthKey(dstr) {
    // dstr 'YYYY-MM-DD'
    return (dstr||'').slice(0,7);
  }
  function renderStatsForRole(user) {
    const ctx1 = document.getElementById('statChart1');
    const ctx2 = document.getElementById('statChart2');
    if (!ctx1 || !ctx2) return;
    const db = App.db.ensure();
    // destroy previous charts if any
    if (App._charts) { App._charts.forEach(ch => { try{ ch.destroy(); }catch{} }); }
    App._charts = [];

    if (user?.role === 'User') {
      // Top 5 by stock & low stock pie
      const prods = (db.products || []).slice();
      const top = prods.sort((a,b)=>(b.stockQty||0)-(a.stockQty||0)).slice(0,5);
      const labels1 = top.map(p=>p.code);
      const data1 = top.map(p=>p.stockQty||0);

      const low = prods.filter(p => (p.stockQty||0) < 50).sort((a,b)=>(a.stockQty||0)-(b.stockQty||0)).slice(0,5);
      const labels2 = low.map(p=>p.code);
      const data2 = low.map(p=>p.stockQty||0);

      const ch1 = new Chart(ctx1, { type: 'bar',
        data: { labels: labels1, datasets: [{ label: 'Giacenza', data: data1 }] },
        options: { plugins: { legend: { display: false } } }
      });
      const ch2 = new Chart(ctx2, { type: 'pie',
        data: { labels: labels2, datasets: [{ data: data2 }] }
      });
      App._charts.push(ch1, ch2);
      document.getElementById('chart1Title').textContent = 'Top 5 Prodotti per Giacenza';
      document.getElementById('chart2Title').textContent = 'Top 5 in esaurimento (< 50 pz)';
    } else {
      // Fatturato ordini per mese & Valore ordini per cliente
      const orders = db.customerOrders || [];
      const byMonth = {};
      orders.forEach(o => {
        const k = monthKey(o.date || App.utils.todayISO());
        byMonth[k] = (byMonth[k] || 0) + (o.total || 0);
      });
      const mkeys = Object.keys(byMonth).sort();
      const vals = mkeys.map(k => byMonth[k]);

      const byCust = {};
      orders.forEach(o => { byCust[o.customerName] = (byCust[o.customerName] || 0) + (o.total || 0); });
      const clabels = Object.keys(byCust);
      const cvals = clabels.map(k => byCust[k]);

      const ch1 = new Chart(ctx1, { type: 'line',
        data: { labels: mkeys, datasets: [{ label: '€ per mese', data: vals, tension: .3 }] },
        options: { plugins: { legend: { display: false } } }
      });
      const ch2 = new Chart(ctx2, { type: 'doughnut',
        data: { labels: clabels, datasets: [{ data: cvals }] }
      });
      App._charts.push(ch1, ch2);
      document.getElementById('chart1Title').textContent = 'Fatturato Ordini per Mese';
      document.getElementById('chart2Title').textContent = 'Valore Ordini per Cliente';
    }
  }

  // ========================
  // Public API for home/statistiche
  // ========================
  App.home = {
    start(user) {
      renderClock();
      renderCalendar();
      initNotes(user);
      if (App._clockInterval) clearInterval(App._clockInterval);
      App._clockInterval = setInterval(renderClock, 1000);
    }
  };
  App.stats = { renderForRole: renderStatsForRole };

})(window);
