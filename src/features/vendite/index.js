/* vendite/index.js - ordini cliente, DDT, fatturazione (MODULARE) */
import { App } from '../../core/app.js';
import { adjustStockBatch } from '../../domain/inventory.service.js';

  const Clienti = {
    renderOrders() {
      const db = App.db.ensure();
      const tbody = document.getElementById('customer-orders-table-body');
      if (!tbody) return;
      tbody.innerHTML = (db.customerOrders || []).map(o => `
        <tr>
          <td>${o.number}</td>
          <td>${o.date}</td>
          <td>${o.customerName}</td>
          <td class="text-end">${App.utils.fmtMoney(o.total || 0)}</td>
          <td>${o.status || 'In lavorazione'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-num="${o.number}">Visualizza</button>
          </td>
        </tr>
      `).join('');
    },

    initNewOrderForm() {
      const form = document.getElementById('new-customer-order-form');
      if (!form) return;
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const custSel = document.getElementById('order-customer-select');
      const dateEl = document.getElementById('order-customer-date');
      const numEl = document.getElementById('order-customer-number');
      const prodSel = document.getElementById('order-product-select');
      const qtyEl = document.getElementById('order-product-qty');
      const priceEl = document.getElementById('order-product-price');
      const addBtn = document.getElementById('add-product-to-order-btn');
      const linesTbody = document.getElementById('order-lines-tbody');
      const totEl = document.getElementById('order-total');

      const fillSelects = () => {
        const curDb = App.db.ensure();
        const prevCust = custSel.value;
        const prevProd = prodSel.value;
        custSel.innerHTML = (curDb.customers || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        prodSel.innerHTML = (curDb.products || []).map(p => `<option value="${p.id}" data-price="${p.salePrice||0}">${p.code} - ${p.description}</option>`).join('');
        if (prevCust) custSel.value = prevCust;
        if (prevProd) prodSel.value = prevProd;
      };
      fillSelects();
      App.events.on('customers:changed', fillSelects);
      App.events.on('products:changed', fillSelects);
      App.events.on('db:changed', fillSelects);

            const resetOrderForm = () => {
        form.reset();
        tmp.splice(0);
        recalc();
        dateEl.value = App.utils.todayISO();
        if (!numEl.value) numEl.value = App.utils.nextCustomerOrderNumber(db);
        if (qtyEl) qtyEl.value = '1';
        try { if (prodSel?.options?.length) prodSel.dispatchEvent(new Event('change')); } catch {}
      };
      App.events.on('section:changed', (sid) => {
        if (sid === 'nuovo-ordine-cliente') {
          fillSelects();
          resetOrderForm();
        }
        if (sid === 'elenco-ordini-cliente') Clienti.renderOrders();
      });

dateEl.value = App.utils.todayISO();
      numEl.value = App.utils.nextCustomerOrderNumber(db);
      App.db.save(db);

      const tmp = [];
      const recalc = () => {
        const tot = tmp.reduce((a,r)=>a+r.qty*r.price,0);
        totEl.textContent = App.utils.fmtMoney(tot);
        linesTbody.innerHTML = tmp.map((r,i)=>`
          <tr>
            <td>${r.productName}</td>
            <td class="text-end">${r.qty}</td>
            <td class="text-end">${App.utils.fmtMoney(r.price)}</td>
            <td class="text-end">${App.utils.fmtMoney(r.qty*r.price)}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-danger" data-i="${i}">Rimuovi</button></td>
          </tr>
        `).join('');
      };

      prodSel.addEventListener('change', () => {
        const opt = prodSel.options[prodSel.selectedIndex];
        priceEl.value = parseFloat(opt.getAttribute('data-price') || '0');
      });
      if (prodSel.options.length) prodSel.dispatchEvent(new Event('change'));

      addBtn.addEventListener('click', () => {
        const pid = prodSel.value;
        const p = (db.products||[]).find(x=>x.id===pid);
        const qty = parseFloat(qtyEl.value || '1');
        const price = parseFloat(priceEl.value || '0');
        if (!p || qty <= 0) return App.ui.showToast('Seleziona un prodotto e una quantità > 0', 'warning');
        tmp.push({ productId: pid, productName: `${p.code} - ${p.description}`, qty, price, shippedQty: 0 });
        recalc();
      });
      linesTbody.addEventListener('click', (e) => {
        const i = e.target.closest('button')?.getAttribute('data-i');
        if (i!=null) { tmp.splice(Number(i),1); recalc(); }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cust = (db.customers||[]).find(x=>x.id===custSel.value);
        if (!cust || tmp.length===0) return App.ui.showToast('Seleziona cliente e aggiungi almeno una riga.', 'warning');
        const order = {
          number: numEl.value,
          date: dateEl.value,
          customerId: cust.id,
          customerName: cust.name,
          lines: tmp.map(r=>({ ...r })),
          total: tmp.reduce((a,r)=>a+r.qty*r.price,0),
          status: 'In lavorazione'
        };
        db.customerOrders.push(order);
        App.db.save(db);
        App.ui.showToast('Ordine cliente salvato', 'success');
        tmp.splice(0); recalc();
        // precompila prossimo numero e ripulisce campi
        numEl.value = App.utils.nextCustomerOrderNumber(db);
        dateEl.value = App.utils.todayISO();
        App.db.save(db);
        Clienti.renderOrders();
        App.ui.showSection('elenco-ordini-cliente');
      });
    },

    wireOrderDetailAndDelete() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });

      const tbody = document.getElementById('customer-orders-table-body');
      if (!tbody) return;
      if (tbody.dataset.wiredView === '1') return;
      tbody.dataset.wiredView = '1';

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        if (btn.getAttribute('data-action') !== 'view') return;
        const num = btn.getAttribute('data-num');
        const o = (db.customerOrders || []).find(x => x.number === num);
        if (!o) return;

        const title = document.getElementById('customerOrderDetailModalTitle');
        const body = document.getElementById('customerOrderDetailModalBody');
        const delBtn = document.getElementById('delete-customer-order-btn');

        if (title) title.textContent = `Dettaglio Ordine Cliente ${o.number}`;

        const lines = (o.lines || []);
        let html = `<div class="mb-2"><strong>Cliente:</strong> ${o.customerName || ''}</div>`;
        html += `<div class="mb-2"><strong>Data:</strong> ${o.date || ''}</div>`;
        html += `<div class="mb-2"><strong>Stato:</strong> ${o.status || 'In lavorazione'}</div>`;
        html += `<div class="mb-3"><strong>Totale:</strong> ${App.utils.fmtMoney(o.total || 0)}</div>`;
        html += `<table class="table table-sm">
          <thead><tr>
            <th>Prodotto</th>
            <th class="text-end">Ord.</th>
            <th class="text-end">Evaso</th>
            <th class="text-end">Residuo</th>
            <th class="text-end">Prezzo</th>
            <th class="text-end">Imponibile</th>
          </tr></thead><tbody>`;

        lines.forEach(l => {
          const qty = Number(l.qty || 0);
          const shipped = Number(l.shippedQty || 0);
          const resid = Math.max(0, qty - shipped);
          const price = Number(l.price || 0);
          html += `<tr>
            <td>${l.productName || l.description || ''}</td>
            <td class="text-end">${qty}</td>
            <td class="text-end">${shipped}</td>
            <td class="text-end">${resid}</td>
            <td class="text-end">${App.utils.fmtMoney(price)}</td>
            <td class="text-end">${App.utils.fmtMoney(qty * price)}</td>
          </tr>`;
        });
        html += `</tbody></table>`;

        if (body) body.innerHTML = html;

        // Delete order (only if no DDT exists for it)
        if (delBtn) {
          delBtn.disabled = false;
          delBtn.onclick = () => {
            const hasDDT = (db.customerDDTs || []).some(d => d.orderNumber === o.number);
            if (hasDDT) {
              return App.ui.showToast('Impossibile eliminare: esistono DDT collegati a questo ordine.', 'warning');
            }
            if (!confirm(`Eliminare l'ordine ${o.number}?`)) return;

            const idx = (db.customerOrders || []).findIndex(x => x.number === o.number);
            if (idx >= 0) db.customerOrders.splice(idx, 1);
            App.db.save(db);
            Clienti.renderOrders();
            App.ui.showToast('Ordine eliminato', 'success');

            try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerOrderDetailModal')).hide(); } catch {}
          };
        }

        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerOrderDetailModal')).show(); } catch {}
      });
    },
    // =============== DDT (Cliente) =================
    renderDDTs() {
      const db = App.db.ensure();
      const tbody = document.getElementById('customer-ddts-table-body');
      if (!tbody) return;
      tbody.innerHTML = (db.customerDDTs || []).map(d => `
        <tr>
          <td>${d.number}</td>
          <td>${d.date}</td>
          <td>${d.customerName}</td>
          <td>${d.orderNumber}</td>
          <td>${d.status || 'Da Fatturare'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-ddt" data-num="${d.number}">Dettaglio</button>
            ${d.status === 'Fatturato' ? '' : '<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-ddt" data-num="'+d.number+'"><i class="fas fa-trash-alt"></i></button>'}
          </td>
        </tr>
      `).join('');
    },

    initNewDDT() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const form = document.getElementById('new-customer-ddt-form');
      if (!form) return;
      const selOrder = document.getElementById('ddt-order-select');
      const details = document.getElementById('ddt-details-section');
      const custName = document.getElementById('ddt-customer-name');
      const ddtNum = document.getElementById('ddt-number');
      const ddtDate = document.getElementById('ddt-date');
      const tbody = document.getElementById('ddt-products-tbody');

            const fillOpenOrders = () => {
        const curDb = App.db.ensure();
        const prev = selOrder.value;
        const openOrders = (curDb.customerOrders || []).filter(o => (o.lines||[]).some(l => (l.shippedQty||0) < (l.qty||0)));
        selOrder.innerHTML = '<option selected disabled value="">Seleziona un ordine...</option>'
          + openOrders.map(o => `<option value="${o.number}">${o.number} - ${o.customerName}</option>`).join('');
        if (prev) selOrder.value = prev;
      };
      fillOpenOrders();
      const resetDDTForm = () => {
        form.reset();
        if (details) details.classList.add('d-none');
        if (tbody) tbody.innerHTML = '';
        try { custName.value = ''; ddtNum.value = ''; ddtDate.value = ''; } catch {}
        fillOpenOrders();
      };
      App.events.on('section:changed', (sid) => {
        if (sid === 'nuovo-ddt-cliente') resetDDTForm();
        if (sid === 'elenco-ddt-cliente') Clienti.renderDDTs();
      });

      App.events.on('customerOrders:changed', fillOpenOrders);
      App.events.on('customers:changed', fillOpenOrders);
      App.events.on('db:changed', fillOpenOrders);

      selOrder.addEventListener('change', () => {
        const number = selOrder.value;
        const order = (db.customerOrders||[]).find(o => o.number === number);
        if (!order) return;
        custName.value = order.customerName;
        ddtNum.value = App.utils.nextCustomerDDTNumber(db);
        ddtDate.value = App.utils.todayISO();
        App.db.save(db);

        const rows = order.lines.map((l,i) => {
          const residual = (l.qty || 0) - (l.shippedQty || 0);
          if (residual <= 0) return '';
          return `<tr data-i="${i}">
            <td>${l.productName}</td>
            <td class="text-end">${l.qty}</td>
            <td class="text-end">${residual}</td>
            <td class="text-end"><input type="number" min="0" max="${residual}" value="${residual}" class="form-control form-control-sm text-end ddt-ship-qty"></td>
          </tr>`;
        }).join('');
        tbody.innerHTML = rows;
        details.classList.remove('d-none');
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const number = selOrder.value;
        const order = (db.customerOrders||[]).find(o => o.number === number);
        if (!order) return App.ui.showToast('Seleziona un ordine valido', 'warning');
        // collect ship qty
        const shipLines = [];
        tbody.querySelectorAll('tr').forEach(tr => {
          const i = parseInt(tr.getAttribute('data-i'), 10);
          const l = order.lines[i];
          const q = parseFloat(tr.querySelector('.ddt-ship-qty').value || '0');
          if (q > 0) shipLines.push({ i, qty: q });
        });
        if (shipLines.length === 0) return App.ui.showToast('Nessuna quantità da spedire.', 'warning');

        // Validate & update stock (atomico)
        try {
          const changes = shipLines.map(s => ({ productId: order.lines[s.i].productId, delta: -s.qty }));
          adjustStockBatch(changes, { reason: 'DDT_CLIENTE', ref: ddtNum.value });
        } catch (err) {
          return App.ui.showToast(err.message || 'Giacenza insufficiente', 'danger');
        }

        // Update order shippedQty
        shipLines.forEach(s => {
          const line = order.lines[s.i];
          line.shippedQty = (line.shippedQty || 0) + s.qty;
        });

        // recompute status
        const allShipped = order.lines.every(l => (l.shippedQty||0) >= (l.qty||0));
        const anyShipped = order.lines.some(l => (l.shippedQty||0) > 0 && (l.shippedQty||0) < (l.qty||0));
        order.status = allShipped ? 'Evaso' : (anyShipped ? 'Parzialmente Evaso' : 'In lavorazione');

        // Create DDT
        const newDDT = {
          number: ddtNum.value,
          date: ddtDate.value,
          customerId: order.customerId,
          customerName: order.customerName,
          orderNumber: order.number,
          lines: shipLines.map(s => {
            const l = order.lines[s.i];
            return { productId: l.productId, description: l.productName, qty: s.qty, price: l.price, iva: 22 };
          }),
          status: 'Da Fatturare'
        };
        db.customerDDTs.push(newDDT);
        App.db.save(db);

        App.ui.showToast('DDT cliente generato', 'success');
        Clienti.renderOrders();
        Clienti.renderDDTs();
        App.ui.showSection('elenco-ddt-cliente');
      });
    },

    wireDDTDetailAndDelete() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const tbody = document.getElementById('customer-ddts-table-body');
      if (!tbody) return;

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        const num = btn.getAttribute('data-num');
        if (btn.getAttribute('data-action') === 'view-ddt') {
          const d = (db.customerDDTs||[]).find(x=>x.number===num); if (!d) return;
          const body = document.getElementById('ddtDetailModalBody');
          const title = document.getElementById('ddtDetailModalTitle');
          title.textContent = `Dettaglio DDT ${d.number}`;
          let html = `<div class="mb-2"><strong>Cliente:</strong> ${d.customerName}</div>`;
          html += `<div class="mb-2"><strong>Data:</strong> ${d.date}</div>`;
          html += `<div class="mb-2"><strong>Riferimento Ordine:</strong> ${d.orderNumber}</div>`;
          html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà</th></tr></thead><tbody>`;
          d.lines.forEach(l => { html += `<tr><td>${l.description}</td><td class="text-end">${l.qty}</td></tr>`; });
          html += `</tbody></table>`;
          body.innerHTML = html;
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('ddtDetailModal')).show(); } catch {}
          // Print
          document.getElementById('print-ddt-btn')?.addEventListener('click', () => {
            try {
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF();
              doc.setFontSize(14);
              doc.text(`DDT ${d.number}`, 14, 16);
              doc.setFontSize(11);
              doc.text(`Cliente: ${d.customerName}`, 14, 26);
              doc.text(`Data: ${d.date}`, 14, 34);
              const rows = d.lines.map(l => [l.description, String(l.qty)]);
              doc.autoTable({ head: [['Descrizione','Qtà']], body: rows, startY: 40 });
              doc.save(`DDT_${d.number}.pdf`);
            } catch(e){ console.error(e); }
          }, { once: true });
        } else if (btn.getAttribute('data-action') === 'del-ddt') {
          const ddt = (db.customerDDTs||[]).find(x=>x.number===num); if (!ddt) return;
          if (ddt.status === 'Fatturato') return App.ui.showToast('DDT già fatturato: non eliminabile.', 'warning');
          if (!confirm(`Eliminare il DDT ${ddt.number}?`)) return;
          // rollback stock and order shippedQty
          const order = (db.customerOrders||[]).find(o=>o.number===ddt.orderNumber);
          if (order) {
            ddt.lines.forEach(dl => {
              const line = (order.lines||[]).find(l => (l.productName||'') === dl.description);
              if (line) line.shippedQty = Math.max(0, (line.shippedQty||0) - (dl.qty||0));
            });

            // Ripristino stock (se possibile)
            try {
              const restoreChanges = (ddt.lines || []).map(dl => {
                const pid = dl.productId
                  || (db.products||[]).find(pp => pp.code === ((dl.description||'').split(' - ')[0]))?.id;
                const q = Number(dl.qty || 0);
                return pid && q ? { productId: pid, delta: q } : null;
              }).filter(Boolean);

              if (restoreChanges.length) {
                adjustStockBatch(restoreChanges, { reason: 'CANCELLA_DDT_CLIENTE', ref: ddt.number });
              }
            } catch (err) {
              App.ui.showToast((err && err.message) ? err.message : 'Ripristino stock non completato', 'warning');
            }
            const allShipped = order.lines.every(l => (l.shippedQty||0) >= (l.qty||0));
            const anyShipped = order.lines.some(l => (l.shippedQty||0) > 0 && (l.shippedQty||0) < (l.qty||0));
            order.status = allShipped ? 'Evaso' : (anyShipped ? 'Parzialmente Evaso' : 'In lavorazione');
          }
          // delete ddt
          const idx = (db.customerDDTs||[]).findIndex(x=>x.number===num);
          if (idx >= 0) db.customerDDTs.splice(idx,1);
          App.db.save(db);
          Clienti.renderDDTs();
          Clienti.renderOrders();
          App.ui.showToast('DDT eliminato', 'success');
        }
      });
    },

    // =============== Fatturazione ===============
    initInvoicing() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });

      const custSel = document.getElementById('invoice-customer-select');
      const ddtSection = document.getElementById('invoice-ddt-section');
      const previewSection = document.getElementById('invoice-preview-section');
      const ddtList = document.getElementById('invoice-ddt-list');
      const btnPreview = document.getElementById('generate-invoice-preview-btn');
      const btnConfirm = document.getElementById('confirm-invoice-btn');

      if (!custSel) return;

      const fillCustomers = () => {
        const curDb = App.db.ensure();
        const prev = custSel.value;
        custSel.innerHTML = '<option selected disabled value="">Seleziona un cliente...</option>'
          + (curDb.customers||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (prev) custSel.value = prev;
      };

      const fillDDTsForSelectedCustomer = () => {
        const curDb = App.db.ensure();
        const custId = custSel.value;

        if (!custId) {
          ddtSection?.classList.add('d-none');
          previewSection?.classList.add('d-none');
          if (ddtList) ddtList.innerHTML = '';
          return;
        }

        const cust = (curDb.customers||[]).find(c => String(c.id) === String(custId));
        if (!cust) return;

        const openDDT = (curDb.customerDDTs||[])
          .filter(d => String(d.customerId) === String(cust.id) && (d.status || 'Da Fatturare') === 'Da Fatturare');

        if (!openDDT.length) {
          ddtSection?.classList.add('d-none');
          previewSection?.classList.add('d-none');
          if (ddtList) ddtList.innerHTML = '';
          return;
        }

        if (ddtList) {
          ddtList.innerHTML = openDDT.map(d => `
            <div class="form-check">
              <input class="form-check-input invoice-ddt-check" type="checkbox" value="${d.number}" id="chk-${d.number}" checked>
              <label class="form-check-label" for="chk-${d.number}">${d.number} — ${d.date}</label>
            </div>`).join('');
        }

        ddtSection?.classList.remove('d-none');
        previewSection?.classList.add('d-none');
      };

      const resetInvoicing = () => {
        custSel.value = '';
        if (ddtList) ddtList.innerHTML = '';
        ddtSection?.classList.add('d-none');
        previewSection?.classList.add('d-none');
        fillCustomers();
      };

      // initial
      fillCustomers();

      App.events.on('section:changed', (sid) => {
        if (sid === 'fatturazione') resetInvoicing();
        if (sid === 'elenco-fatture') Clienti.renderInvoices();
      });

      App.events.on('customers:changed', () => { fillCustomers(); fillDDTsForSelectedCustomer(); });
      App.events.on('customerDDTs:changed', fillDDTsForSelectedCustomer);
      App.events.on('db:changed', () => { fillCustomers(); fillDDTsForSelectedCustomer(); });

      custSel.addEventListener('change', () => {
        fillDDTsForSelectedCustomer();
        const curDb = App.db.ensure();
        const cust = (curDb.customers||[]).find(c => String(c.id) === String(custSel.value));
        const openDDT = cust ? (curDb.customerDDTs||[]).filter(d => String(d.customerId) === String(cust.id) && (d.status || 'Da Fatturare') === 'Da Fatturare') : [];
        if (cust && openDDT.length === 0) App.ui.showToast('Nessun DDT da fatturare per questo cliente.', 'info');
      });

      btnPreview?.addEventListener('click', () => {
        const cust = (db.customers||[]).find(c => String(c.id) === String(custSel.value));
        if (!cust) return;

        const selected = Array.from(document.querySelectorAll('.invoice-ddt-check:checked')).map(i => i.value);
        const ddts = (db.customerDDTs||[]).filter(d => selected.includes(d.number));
        if (!ddts.length) return App.ui.showToast('Seleziona almeno un DDT.', 'warning');

        // Build preview
        const lines = [];
        ddts.forEach(d => d.lines.forEach(l => {
          const code = (l.description||'').split(' - ')[0];
          const p = (db.products||[]).find(pp => pp.code === code);
          const price = (l.price!=null) ? l.price : (p?.salePrice || 0);
          const iva = (l.iva!=null) ? l.iva : (p?.iva || 22);
          lines.push({ description: l.description, qty: l.qty, price, iva });
        }));

        // Totals
        const subtotal = lines.reduce((s, l) => s + (l.qty * l.price), 0);
        const ivaTotal = lines.reduce((s, l) => s + (l.qty * l.price * (l.iva/100)), 0);
        const total = subtotal + ivaTotal;

        // Render preview
        const preCust = document.getElementById('invoice-preview-customer');
        const preNum = document.getElementById('invoice-preview-number');
        const preDate = document.getElementById('invoice-preview-date');
        const preBody = document.getElementById('invoice-preview-lines-tbody');
        const summary = document.getElementById('invoice-summary');
        

        if (preCust) preCust.value = cust.name;
        if (preNum) preNum.value = App.utils.nextInvoiceNumber(db);
        if (preDate) preDate.value = App.utils.todayISO();
        if (preBody) {
          preBody.innerHTML = lines.map(l => `
            <tr>
              <td>${l.description}</td>
              <td class="text-end">${l.qty}</td>
              <td class="text-end">€ ${App.utils.money(l.price)}</td>
              <td class="text-end">€ ${App.utils.money(l.qty*l.price)}</td>
              <td class="text-end">${l.iva}%</td>
            </tr>`).join('');
        }
      
        if (summary) {
          summary.innerHTML = `
            <div class="d-flex justify-content-between"><span>Imponibile</span><strong>€ ${App.utils.money(subtotal)}</strong></div>
            <div class="d-flex justify-content-between"><span>IVA</span><strong>€ ${App.utils.money(ivaTotal)}</strong></div>
            <hr class="my-2"/>
            <div class="d-flex justify-content-between"><span>Totale</span><strong>€ ${App.utils.money(total)}</strong></div>
          `;
        }

        document.getElementById('invoice-preview-section')?.classList.remove('d-none');
      });

      btnConfirm?.addEventListener('click', () => {
        const cust = (db.customers||[]).find(c => String(c.id) === String(custSel.value));
        if (!cust) return;

        const selected = Array.from(document.querySelectorAll('.invoice-ddt-check:checked')).map(i => i.value);
        const ddts = (db.customerDDTs||[]).filter(d => selected.includes(d.number));
        if (!ddts.length) return App.ui.showToast('Seleziona almeno un DDT.', 'warning');

        const invoiceNumber = App.utils.nextInvoiceNumber(db);
        const invDate = (document.getElementById('invoice-preview-date')?.value) || App.utils.todayISO();

        const invLines = [];
        ddts.forEach(d => d.lines.forEach(l => {
          // normalizza righe e assegna prezzo/IVA se mancanti
          const pid = l.productId;
          const p = pid ? (db.products||[]).find(pp => String(pp.id) === String(pid)) : null;

          // fallback: prova a ricavare il codice da "COD - descrizione"
          let pByCode = null;
          if (!p && l.description) {
            const code = String(l.description).split(' - ')[0].trim();
            pByCode = (db.products||[]).find(pp => String(pp.code || '').trim() === code);
          }
          const prod = p || pByCode;

          const qty = Number(l.qty || 0);
          const price = (l.price != null && l.price !== '') ? Number(l.price) : Number(prod?.salePrice || 0);
          const iva = (l.iva != null && l.iva !== '') ? Number(l.iva) : Number(prod?.iva || 22);
          const desc = l.description || prod ? `${prod.code} - ${prod.description}` : '';

          invLines.push({
            productId: pid || prod?.id || null,
            description: desc,
            qty,
            price,
            iva
          });
        }));

        // Totali (IVA inclusa nel totale)
        const subtotal = invLines.reduce((s, l) => s + (Number(l.qty||0) * Number(l.price||0)), 0);
        const ivaTotal = invLines.reduce((s, l) => s + (Number(l.qty||0) * Number(l.price||0) * (Number(l.iva||0) / 100)), 0);
        const total = subtotal + ivaTotal;

        const invoice = {
          number: invoiceNumber,
          date: invDate,
          customerId: cust.id,
          customerName: cust.name,
          ddtNumbers: ddts.map(d => d.number),
          lines: invLines,
          subtotal,
          ivaTotal,
          total
        };

        db.invoices = db.invoices || [];
        db.invoices.push(invoice);

        // Mark ddts as invoiced
        ddts.forEach(d => { d.status = 'Fatturato'; d.invoiceNumber = invoiceNumber; });

        App.db.save(db);
        App.ui.showToast('Fattura emessa', 'success');
        Clienti.renderDDTs();
        Clienti.renderInvoices();
        resetInvoicing();
      });
    },

    renderInvoices() {
      const db = App.db.ensure();
      const tbody = document.getElementById('invoices-table-body');
      if (!tbody) return;
      tbody.innerHTML = (db.invoices || []).map(f => `
        <tr>
          <td>${f.number}</td>
          <td>${f.date}</td>
          <td>${f.customerName}</td>
          <td class="text-end">${App.utils.fmtMoney(f.total || 0)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-invoice" data-num="${f.number}">Dettaglio</button>
            <button class="btn btn-sm btn-outline-danger ms-1" data-action="del-invoice" data-num="${f.number}"><i class="fas fa-trash-alt"></i></button>
          </td>
        </tr>
      `).join('');

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        const num = btn.getAttribute('data-num');
        if (btn.getAttribute('data-action') === 'view-invoice') {
          const inv = (db.invoices||[]).find(x=>x.number===num); if (!inv) return;
          const body = document.getElementById('invoiceDetailModalBody');
          const title = document.getElementById('invoiceDetailModalTitle');
          title.textContent = `Fattura ${inv.number}`;
          let html = `<div class="mb-2"><strong>Cliente:</strong> ${inv.customerName}</div>`;
          html += `<div class="mb-2"><strong>Data:</strong> ${inv.date}</div>`;
          html += `<div class="mb-2"><strong>DDT Inclusi:</strong> ${inv.ddts.join(', ')}</div>`;
          html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà</th><th class="text-end">Prezzo</th><th class="text-end">Imponibile</th><th class="text-end">IVA</th></tr></thead><tbody>`;
          inv.lines.forEach(l => { html += `<tr><td>${l.description}</td><td class="text-end">${l.qty}</td><td class="text-end">${App.utils.fmtMoney(l.price)}</td><td class="text-end">${App.utils.fmtMoney(l.qty*l.price)}</td><td class="text-end">${l.iva}%</td></tr>`; });
          html += `</tbody></table>`;
          body.innerHTML = html;
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('invoiceDetailModal')).show(); } catch {}
          // Print
          document.getElementById('print-invoice-btn')?.addEventListener('click', () => {
            try {
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF();
              doc.setFontSize(14);
              doc.text(`Fattura ${inv.number}`, 14, 16);
              doc.setFontSize(11);
              doc.text(`Cliente: ${inv.customerName}`, 14, 26);
              doc.text(`Data: ${inv.date}`, 14, 34);
              const rows = inv.lines.map(l => [l.description, String(l.qty), (l.price||0).toFixed(2), (l.qty*l.price).toFixed(2), `${l.iva}%`]);
              doc.autoTable({ head: [['Descrizione','Qtà','Prezzo','Imponibile','IVA']], body: rows, startY: 40 });
              doc.save(`Fattura_${inv.number}.pdf`);
            } catch(e){ console.error(e); }
          }, { once: true });
        } else if (btn.getAttribute('data-action') === 'del-invoice') {
          const inv = (db.invoices||[]).find(x=>x.number===num); if (!inv) return;
          if (!confirm(`Eliminare la fattura ${inv.number}?`)) return;
          // rollback ddt state
          (db.customerDDTs||[]).forEach(d => { if (inv.ddts.includes(d.number)) d.status = 'Da Fatturare'; });
          const idx = (db.invoices||[]).findIndex(x=>x.number===num);
          if (idx >= 0) db.invoices.splice(idx,1);
          App.db.save(db);
          Clienti.renderInvoices();
          App.ui.showToast('Fattura eliminata', 'success');
        }
      });
    },

    init() {
      App.events.on('logged-in', () => {
        this.renderOrders();
        this.wireOrderDetailAndDelete();
        this.initNewOrderForm();
        this.initNewDDT();
        this.renderDDTs();
        this.wireDDTDetailAndDelete();
        this.initInvoicing();
        this.renderInvoices();
      });
    }
  };

  // Global hooks for overlay/patch compatibility
  window.renderCustomerOrdersTable = () => Clienti.renderOrders();


export function initVenditeFeature() {
  Clienti.init();
  // expose (compat)
  App.Clienti = Clienti;
}