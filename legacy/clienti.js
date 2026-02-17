/* clienti.js - customer orders, DDT, invoicing */
(function (global) {
  'use strict';
  const { App } = global;

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
      const db = App.db.ensure();
      const custSel = document.getElementById('order-customer-select');
      const dateEl = document.getElementById('order-customer-date');
      const numEl = document.getElementById('order-customer-number');
      const prodSel = document.getElementById('order-product-select');
      const qtyEl = document.getElementById('order-product-qty');
      const priceEl = document.getElementById('order-product-price');
      const addBtn = document.getElementById('add-product-to-order-btn');
      const linesTbody = document.getElementById('order-lines-tbody');
      const totEl = document.getElementById('order-total');

      custSel.innerHTML = (db.customers || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      prodSel.innerHTML = (db.products || []).map(p => `<option value="${p.id}" data-price="${p.salePrice||0}">${p.code} - ${p.description}</option>`).join('');
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
        Clienti.renderOrders();
        App.ui.showSection('elenco-ordini-cliente');
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
      const db = App.db.ensure();
      const form = document.getElementById('new-customer-ddt-form');
      if (!form) return;
      const selOrder = document.getElementById('ddt-order-select');
      const details = document.getElementById('ddt-details-section');
      const custName = document.getElementById('ddt-customer-name');
      const ddtNum = document.getElementById('ddt-number');
      const ddtDate = document.getElementById('ddt-date');
      const tbody = document.getElementById('ddt-products-tbody');

      const openOrders = (db.customerOrders || []).filter(o => {
        // if any residual to ship
        return (o.lines||[]).some(l => (l.shippedQty||0) < (l.qty||0));
      });
      selOrder.innerHTML = '<option selected disabled value="">Seleziona un ordine...</option>'
        + openOrders.map(o => `<option value="${o.number}">${o.number} - ${o.customerName}</option>`).join('');

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

        // Update order shippedQty & stock
        shipLines.forEach(s => {
          const line = order.lines[s.i];
          line.shippedQty = (line.shippedQty || 0) + s.qty;
          // stock decrease
          const code = (line.productName||'').split(' - ')[0];
          const p = (db.products||[]).find(pp => pp.code === code) || (db.products||[]).find(pp => pp.id === line.productId);
          if (p) p.stockQty = (p.stockQty || 0) - s.qty;
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
            return { description: l.productName, qty: s.qty, price: l.price, iva: 22 };
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
      const db = App.db.ensure();
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
              const code = (dl.description||'').split(' - ')[0];
              const p = (db.products||[]).find(pp => pp.code === code);
              if (p) p.stockQty = (p.stockQty || 0) + (dl.qty||0);
            });
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
      const db = App.db.ensure();
      const custSel = document.getElementById('invoice-customer-select');
      const ddtSection = document.getElementById('invoice-ddt-section');
      const previewSection = document.getElementById('invoice-preview-section');
      const ddtList = document.getElementById('invoice-ddt-list');
      const btnPreview = document.getElementById('generate-invoice-preview-btn');
      const btnConfirm = document.getElementById('confirm-invoice-btn');

      if (!custSel) return;

      // Load customers
      custSel.innerHTML = '<option selected disabled value="">Seleziona un cliente...</option>'
        + (db.customers||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');

      custSel.addEventListener('change', () => {
        const cust = (db.customers||[]).find(c=>c.id===custSel.value);
        const openDDT = (db.customerDDTs||[]).filter(d=>d.customerId===cust.id && d.status==='Da Fatturare');
        if (openDDT.length === 0) {
          ddtSection.classList.add('d-none'); previewSection.classList.add('d-none');
          App.ui.showToast('Nessun DDT da fatturare per questo cliente.', 'info');
          return;
        }
        ddtList.innerHTML = openDDT.map(d => `
          <div class="form-check">
            <input class="form-check-input invoice-ddt-check" type="checkbox" value="${d.number}" id="chk-${d.number}" checked>
            <label class="form-check-label" for="chk-${d.number}">${d.number} — ${d.date}</label>
          </div>`).join('');
        ddtSection.classList.remove('d-none');
        previewSection.classList.add('d-none');
      });

      btnPreview?.addEventListener('click', () => {
        const cust = (db.customers||[]).find(c=>c.id===custSel.value); if (!cust) return;
        const selected = Array.from(document.querySelectorAll('.invoice-ddt-check:checked')).map(i=>i.value);
        const ddts = (db.customerDDTs||[]).filter(d=>selected.includes(d.number));
        if (ddts.length === 0) return App.ui.showToast('Seleziona almeno un DDT.', 'warning');

        // Build preview
        const lines = [];
        ddts.forEach(d => d.lines.forEach(l => {
          // Keep original pricing where available; fallback to product price
          const code = (l.description||'').split(' - ')[0];
          const p = (db.products||[]).find(pp => pp.code === code);
          const price = (l.price!=null) ? l.price : (p?.salePrice || 0);
          const iva = (l.iva!=null) ? l.iva : (p?.iva || 22);
          lines.push({ description: l.description, qty: l.qty, price, iva });
        }));

        const previewBody = document.getElementById('invoice-preview-lines-tbody');
        previewBody.innerHTML = lines.map((r,i)=>`
          <tr>
            <td>${r.description}</td>
            <td class="text-end">${r.qty}</td>
            <td class="text-end">${App.utils.fmtMoney(r.price)}</td>
            <td class="text-end">${App.utils.fmtMoney(r.qty*r.price)}</td>
            <td class="text-end">${r.iva}%</td>
          </tr>`).join('');

        document.getElementById('invoice-preview-customer').value = cust.name;
        const num = App.utils.nextInvoiceNumber(db);
        document.getElementById('invoice-preview-number').value = num;
        document.getElementById('invoice-preview-date').value = App.utils.todayISO();
        App.db.save(db);

        // Summary by IVA
        const byIva = {};
        lines.forEach(r => {
          const imponibile = r.qty*r.price;
          byIva[r.iva] = (byIva[r.iva] || 0) + imponibile;
        });
        let html = '<ul class="list-group">';
        let total = 0, totalIva = 0;
        Object.keys(byIva).sort().forEach(k => {
          const imponibile = byIva[k];
          const ivaVal = imponibile * (parseInt(k,10)/100);
          total += imponibile; totalIva += ivaVal;
          html += `<li class="list-group-item d-flex justify-content-between"><span>Imponibile ${k}%</span><strong>${App.utils.fmtMoney(imponibile)}</strong></li>`;
        });
        html += `<li class="list-group-item d-flex justify-content-between"><span>IVA totale</span><strong>${App.utils.fmtMoney(totalIva)}</strong></li>`;
        html += `<li class="list-group-item d-flex justify-content-between"><span><strong>TOTALE FATTURA</strong></span><strong>${App.utils.fmtMoney(total+totalIva)}</strong></li>`;
        html += '</ul>';
        document.getElementById('invoice-summary').innerHTML = html;

        previewSection.classList.remove('d-none');
      });

      btnConfirm?.addEventListener('click', () => {
        const cust = (db.customers||[]).find(c=>c.id===custSel.value); if (!cust) return;
        const selected = Array.from(document.querySelectorAll('.invoice-ddt-check:checked')).map(i=>i.value);
        const ddts = (db.customerDDTs||[]).filter(d=>selected.includes(d.number));
        if (ddts.length === 0) return;

        // Persist invoice
        const num = document.getElementById('invoice-preview-number').value;
        const date = document.getElementById('invoice-preview-date').value;
        const rows = Array.from(document.querySelectorAll('#invoice-preview-lines-tbody tr')).map(tr => ({
          description: tr.children[0].textContent.trim(),
          qty: parseFloat(tr.children[1].textContent||'0'),
          price: parseFloat((tr.children[2].textContent||'€ 0,00').replace(/[€\s.]/g,'').replace(',', '.')),
          iva: parseInt(tr.children[4].textContent||'22', 10)
        }));
        const total = rows.reduce((a,r)=>a+r.qty*r.price,0);
        const invoice = {
          number: num,
          date,
          customerId: cust.id,
          customerName: cust.name,
          ddts: ddts.map(d=>d.number),
          lines: rows,
          total
        };
        db.invoices.push(invoice);
        // Mark DDTs as billed
        ddts.forEach(d => { d.status = 'Fatturato'; });
        App.db.save(db);
        App.ui.showToast('Fattura generata', 'success');
        // Render invoice list
        Clienti.renderInvoices();
        // Reset sections
        document.getElementById('invoice-preview-section').classList.add('d-none');
        document.getElementById('invoice-ddt-section').classList.add('d-none');
        custSel.value = '';
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
        this.initNewOrderForm();
        this.renderDDTs();
        this.wireDDTDetailAndDelete();
        this.initInvoicing();
        this.renderInvoices();
      });
    }
  };

  // Global hooks for overlay/patch compatibility
  window.renderCustomerOrdersTable = () => Clienti.renderOrders();

  document.addEventListener('DOMContentLoaded', () => Clienti.init());
  App.Clienti = Clienti;

})(window);
