/* vendite/index.js - ordini cliente, DDT, fatturazione (MODULARE) */
import { App } from '../../core/app.js';
import { adjustStockBatch } from '../../domain/inventory.service.js';

  const canDeleteDocs = () => {
  const role = App.currentUser?.role || 'User';
  return role === 'Supervisor' || role === 'Admin';
};

const recomputeCustomerOrderStatus = (order) => {
  const lines = order?.lines || [];
  const allShipped = lines.length > 0 && lines.every(l => Number(l.shippedQty || 0) >= Number(l.qty || 0));
  const anyShipped = lines.some(l => Number(l.shippedQty || 0) > 0);
  order.status = allShipped ? 'Evaso' : (anyShipped ? 'Parzialmente Evaso' : 'In lavorazione');
};


const findLinkedInvoiceForDDT = (db, ddtNumber) => {
  return (db?.invoices || []).find(inv => {
    const linked = inv?.ddtNumbers || inv?.ddts || [];
    return Array.isArray(linked) && linked.includes(ddtNumber);
  }) || null;
};

const Clienti = {
    renderOrders() {
      const db = App.db.ensure();
      const tbody = document.getElementById('customer-orders-table-body');
      if (!tbody) return;
      const canDelete = canDeleteDocs();
      tbody.innerHTML = (db.customerOrders || []).map(o => `
        <tr>
          <td>${o.number}</td>
          <td>${o.date}</td>
          <td>${o.customerName}</td>
          <td class="text-end">${App.utils.fmtMoney(o.total || 0)}</td>
          <td>${o.status || 'In lavorazione'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-num="${o.number}">Visualizza</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-order" data-num="${o.number}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
    },

    initNewOrderForm() {
      const form = document.getElementById('new-customer-order-form');
      if (!form) return;
      if (form.dataset.bound === '1') return;
      form.dataset.bound = '1';
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
        if (!numEl.value) numEl.value = App.utils.previewCustomerOrderNumber(db);
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
      numEl.value = App.utils.previewCustomerOrderNumber(db);

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
        qtyEl.value = '1';
      });
      linesTbody.addEventListener('click', (e) => {
        const i = e.target.closest('button')?.getAttribute('data-i');
        if (i!=null) { tmp.splice(Number(i),1); recalc(); }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cust = (db.customers||[]).find(x=>x.id===custSel.value);
        if (!cust || tmp.length===0) return App.ui.showToast('Seleziona cliente e aggiungi almeno una riga.', 'warning');
        const finalOrderNumber = App.utils.finalizeCustomerOrderNumber(db, numEl.value);
        const order = {
          id: App.utils.uuid(),
          number: finalOrderNumber,
          date: dateEl.value,
          customerId: cust.id,
          customerName: cust.name,
          lines: tmp.map(r=>({ ...r })),
          total: tmp.reduce((a,r)=>a+r.qty*r.price,0),
          status: 'In lavorazione'
        };
        db.customerOrders.push(order);
        numEl.value = finalOrderNumber;
        App.db.save(db);
        App.ui.showToast('Ordine cliente salvato', 'success');
        tmp.splice(0); recalc();
        // precompila prossimo numero e ripulisce campi
        numEl.value = App.utils.previewCustomerOrderNumber(db);
        dateEl.value = App.utils.todayISO();
        if (qtyEl) qtyEl.value = '1';
        try { if (prodSel?.options?.length) prodSel.dispatchEvent(new Event('change')); } catch {}
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

      const deleteOrder = (orderNumber) => {
        if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        const order = (db.customerOrders || []).find(x => x.number === orderNumber);
        if (!order) return;
        const hasDDT = (db.customerDDTs || []).some(d => d.orderNumber === order.number);
        if (hasDDT) {
          return App.ui.showToast('Impossibile eliminare: esistono DDT collegati a questo ordine.', 'warning');
        }
        if (!confirm(`Eliminare l'ordine ${order.number}?`)) return;
        const idx = (db.customerOrders || []).findIndex(x => x.number === order.number);
        if (idx >= 0) db.customerOrders.splice(idx, 1);
        App.db.save(db);
        Clienti.renderOrders();
        App.ui.showToast('Ordine eliminato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerOrderDetailModal')).hide(); } catch {}
      };

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        const action = btn.getAttribute('data-action');
        const num = btn.getAttribute('data-num');
        if (action === 'delete-order') return deleteOrder(num);
        if (action !== 'view') return;
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

        if (delBtn) {
          const hasDDT = (db.customerDDTs || []).some(d => d.orderNumber === o.number);
          delBtn.classList.toggle('d-none', !canDeleteDocs());
          delBtn.disabled = hasDDT;
          delBtn.onclick = () => deleteOrder(o.number);
        }

        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('customerOrderDetailModal')).show(); } catch {}
      });
    },
    // =============== DDT (Cliente) =================
    renderDDTs() {
      const db = App.db.ensure();
      const tbody = document.getElementById('customer-ddts-table-body');
      if (!tbody) return;
      const canDelete = canDeleteDocs();
      tbody.innerHTML = (db.customerDDTs || []).map(d => {
        const linkedInvoice = findLinkedInvoiceForDDT(db, d.number);
        const canDeleteThis = canDelete && !linkedInvoice && d.status !== 'Fatturato';
        return `
        <tr>
          <td>${d.number}</td>
          <td>${d.date}</td>
          <td>${d.customerName}</td>
          <td>${d.orderNumber}</td>
          <td>${d.status || 'Da Fatturare'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-ddt" data-num="${d.number}">Dettaglio</button>
            ${canDeleteThis ? '<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-ddt" data-num="'+d.number+'"><i class="fas fa-trash-alt"></i></button>' : ''}
          </td>
        </tr>
      `;}).join('');
    },

    initNewDDT() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const form = document.getElementById('new-customer-ddt-form');
      if (!form) return;
      if (form.dataset.bound === '1') return;
      form.dataset.bound = '1';
      const selOrder = document.getElementById('ddt-order-select');
      const details = document.getElementById('ddt-details-section');
      const custName = document.getElementById('ddt-customer-name');
      const ddtNum = document.getElementById('ddt-number');
      const ddtDate = document.getElementById('ddt-date');
      const ddtParcels = document.getElementById('ddt-parcels');
      const ddtCarrier = document.getElementById('ddt-carrier');
      const ddtTransportReason = document.getElementById('ddt-transport-reason');
      const ddtExternalAspect = document.getElementById('ddt-external-aspect');
      const ddtNotes = document.getElementById('ddt-notes');
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
        try { custName.value = ''; ddtNum.value = ''; ddtDate.value = ''; if (ddtParcels) ddtParcels.value = ''; if (ddtCarrier) ddtCarrier.value = ''; if (ddtTransportReason) ddtTransportReason.value = 'Vendita'; if (ddtExternalAspect) ddtExternalAspect.value = ''; if (ddtNotes) ddtNotes.value = ''; } catch {}
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
        if (ddtTransportReason && !ddtTransportReason.value) ddtTransportReason.value = 'Vendita';
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
        })
        // Avviso didattico: quantità da spedire oltre giacenza disponibile
        const grouped = new Map();
        shipLines.forEach(s => {
          const l = order.lines[s.i];
          const pid = l.productId;
          grouped.set(pid, (grouped.get(pid) || 0) + s.qty);
        });

        const warnings = [];
        grouped.forEach((qty, pid) => {
          const p = (db.products||[]).find(pp => String(pp.id) === String(pid));
          const available = Number(p?.stockQty || 0);
          if (qty > available) warnings.push({ code: p?.code || pid, available, qty });
        });

        if (warnings.length) {
          const lines = warnings.map(w => `- ${w.code}: richiesti ${w.qty} / disponibili ${w.available}`).join('\n');
          const ok = window.confirm(
            `Attenzione: la quantità da spedire supera la giacenza per uno o più articoli.\n\n${lines}\n\nVuoi continuare?`
          );
          if (!ok) return;
        }
;
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
          id: App.utils.uuid(),
          number: ddtNum.value,
          date: ddtDate.value,
          customerId: order.customerId,
          customerName: order.customerName,
          orderNumber: order.number,
          parcels: Number(ddtParcels?.value || 0) || null,
          carrier: (ddtCarrier?.value || '').trim(),
          transportReason: (ddtTransportReason?.value || '').trim(),
          externalAspect: (ddtExternalAspect?.value || '').trim(),
          notes: (ddtNotes?.value || '').trim(),
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
          const company = db.company || {};
          const customer = (db.customers||[]).find(c => String(c.id) === String(d.customerId)) || {};
          const companyAddress = [company.address || '', [company.zip || '', company.city || '', company.province ? `(${company.province})` : ''].filter(Boolean).join(' ')].filter(Boolean).join('<br>');
          const customerAddress = (customer.address || '').replace(/
/g, '<br>');
          let html = `<div class="row g-3 mb-3">`;
          html += `<div class="col-md-6"><div class="card h-100"><div class="card-body"><div class="small text-uppercase text-muted mb-1">Mittente</div><div class="fw-semibold">${company.name || 'Nostra azienda'}</div>${companyAddress ? `<div class="small mt-1">${companyAddress}</div>` : ''}</div></div></div>`;
          html += `<div class="col-md-6"><div class="card h-100"><div class="card-body"><div class="small text-uppercase text-muted mb-1">Destinatario</div><div class="fw-semibold">${d.customerName || customer.name || '-'}</div>${customerAddress ? `<div class="small mt-1">${customerAddress}</div>` : ''}</div></div></div>`;
          html += `</div>`;
          html += `<div class="row g-2 mb-3">`;
          html += `<div class="col-md-3"><strong>Numero DDT:</strong><br>${d.number}</div>`;
          html += `<div class="col-md-3"><strong>Data:</strong><br>${d.date}</div>`;
          html += `<div class="col-md-6"><strong>Riferimento Ordine:</strong><br>${d.orderNumber}</div>`;
          html += `<div class="col-md-3"><strong>Colli:</strong><br>${d.parcels ?? '-'}</div>`;
          html += `<div class="col-md-3"><strong>Vettore:</strong><br>${d.carrier || '-'}</div>`;
          html += `<div class="col-md-3"><strong>Causale trasporto:</strong><br>${d.transportReason || 'Vendita'}</div>`;
          html += `<div class="col-md-3"><strong>Aspetto esteriore:</strong><br>${d.externalAspect || '-'}</div>`;
          html += `</div>`;
          if (d.notes) html += `<div class="mb-3"><strong>Note:</strong><br>${d.notes}</div>`;
          html += `<table class="table table-sm"><thead><tr><th>Codice</th><th>Descrizione</th><th class="text-end">Qtà</th></tr></thead><tbody>`;
          d.lines.forEach(l => { const parts = String(l.description || '').split(' - '); const code = parts.length > 1 ? parts.shift() : ''; const desc = parts.length ? parts.join(' - ') : String(l.description||''); html += `<tr><td>${code || '-'}</td><td>${desc}</td><td class="text-end">${l.qty}</td></tr>`; });
          html += `</tbody></table>`;
          body.innerHTML = html;
          const delBtn = document.getElementById('delete-customer-ddt-btn');
          if (delBtn) {
            const linkedInvoice = findLinkedInvoiceForDDT(db, d.number);
            delBtn.classList.toggle('d-none', !canDeleteDocs());
            delBtn.disabled = !!linkedInvoice || d.status === 'Fatturato';
            delBtn.onclick = () => {
              if (delBtn.disabled) return;
              const actionBtn = tbody.querySelector(`button[data-action="del-ddt"][data-num="${d.number}"]`);
              if (actionBtn) actionBtn.click();
            };
          }
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('ddtDetailModal')).show(); } catch {}
          // Print
          document.getElementById('print-ddt-btn')?.addEventListener('click', () => {
            try {
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF();
              const company = db.company || {};
              const customer = (db.customers||[]).find(c => String(c.id) === String(d.customerId)) || {};
              const companyLines = [company.name || 'Nostra azienda', company.address || '', [company.zip || '', company.city || '', company.province ? `(${company.province})` : ''].filter(Boolean).join(' ')].filter(Boolean);
              const customerLines = [d.customerName || customer.name || 'Cliente', customer.address || ''].filter(Boolean);

              doc.setFontSize(15);
              doc.text('DOCUMENTO DI TRASPORTO', 14, 16);
              doc.setFontSize(11);
              doc.text(`Numero DDT: ${d.number}`, 14, 24);
              doc.text(`Data documento: ${d.date}`, 140, 24);

              doc.setDrawColor(180);
              doc.rect(14, 30, 86, 26);
              doc.rect(110, 30, 86, 26);
              doc.setFontSize(10);
              doc.text('Mittente', 16, 36);
              companyLines.forEach((line, idx) => doc.text(String(line), 16, 42 + idx * 5));
              doc.text('Destinatario', 112, 36);
              customerLines.forEach((line, idx) => doc.text(String(line), 112, 42 + idx * 5, { maxWidth: 80 }));

              doc.text(`Causale trasporto: ${d.transportReason || 'Vendita'}`, 14, 64);
              doc.text(`Riferimento ordine: ${d.orderNumber || '-'}`, 14, 70);
              doc.text(`Aspetto esteriore: ${d.externalAspect || '-'}`, 14, 76);
              doc.text(`Colli: ${d.parcels ?? '-'}`, 130, 64);
              doc.text(`Vettore: ${d.carrier || '-'}`, 130, 70);

              const rows = d.lines.map(l => {
                const parts = String(l.description || '').split(' - ');
                const code = parts.length > 1 ? parts.shift() : '';
                const desc = parts.length ? parts.join(' - ') : String(l.description || '');
                return [code || '-', desc, String(l.qty)];
              });
              doc.autoTable({ head: [['Codice','Descrizione','Qtà']], body: rows, startY: 82, styles: { fontSize: 10 }, headStyles: { fillColor: [230,230,230], textColor: 20 } });
              let y = doc.lastAutoTable.finalY + 8;
              if (d.notes) {
                doc.text('Note:', 14, y);
                doc.text(String(d.notes), 14, y + 6, { maxWidth: 180 });
              }
              doc.save(`DDT_${d.number}.pdf`);
            } catch(e){ console.error(e); }
          }, { once: true });
        } else if (btn.getAttribute('data-action') === 'del-ddt') {
          const ddt = (db.customerDDTs||[]).find(x=>x.number===num); if (!ddt) return;
          if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
          const linkedInvoice = findLinkedInvoiceForDDT(db, ddt.number);
          if (linkedInvoice || ddt.status === 'Fatturato') return App.ui.showToast(`DDT collegato alla fattura ${linkedInvoice?.number || ddt.invoiceNumber || ''}: non eliminabile.`, 'warning');
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
            recomputeCustomerOrderStatus(order);
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
              <td class="text-end">${App.utils.fmtMoney(l.price)}</td>
              <td class="text-end">${App.utils.fmtMoney(l.qty*l.price)}</td>
              <td class="text-end">${l.iva}%</td>
            </tr>`).join('');
        }
      
        if (summary) {
          summary.innerHTML = `
            <div class="d-flex justify-content-between"><span>Imponibile</span><strong>${App.utils.fmtMoney(subtotal)}</strong></div>
            <div class="d-flex justify-content-between"><span>IVA</span><strong>${App.utils.fmtMoney(ivaTotal)}</strong></div>
            <hr class="my-2"/>
            <div class="d-flex justify-content-between"><span>Totale</span><strong>${App.utils.fmtMoney(total)}</strong></div>
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
          const desc = l.description || (prod ? `${prod.code} - ${prod.description}` : '');

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
          id: App.utils.uuid(),
          number: invoiceNumber,
          date: invDate,
          customerId: cust.id,
          customerName: cust.name,
          ddtNumbers: ddts.map(d => d.number),
          ddts: ddts.map(d => d.number),
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
      const canDelete = canDeleteDocs();
      tbody.innerHTML = (db.invoices || []).map(f => `
        <tr>
          <td>${f.number}</td>
          <td>${f.date}</td>
          <td>${f.customerName}</td>
          <td class="text-end">${App.utils.fmtMoney(f.total || 0)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-invoice" data-num="${f.number}">Dettaglio</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-invoice" data-num="${f.number}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');

      if (tbody.dataset.wiredInvoices !== '1') {
        tbody.dataset.wiredInvoices = '1';
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
            html += `<div class="mb-2"><strong>DDT Inclusi:</strong> ${(inv.ddtNumbers || inv.ddts || []).join(', ')}</div>`;
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
            if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
            if (!confirm(`Eliminare la fattura ${inv.number}?`)) return;
            // rollback ddt state
            (db.customerDDTs||[]).forEach(d => {
              if ((inv.ddtNumbers || inv.ddts || []).includes(d.number)) {
                d.status = 'Da Fatturare';
                delete d.invoiceNumber;
              }
            });
            const idx = (db.invoices||[]).findIndex(x=>x.number===num);
            if (idx >= 0) db.invoices.splice(idx,1);
            App.db.save(db);
            Clienti.renderInvoices();
            Clienti.renderDDTs();
            App.ui.showToast('Fattura eliminata', 'success');
          }
        });
      }
    },

    init() {
      if (this._initDone) return;
      this._initDone = true;

      const refreshSection = (sid) => {
        if (!sid) return;
        if (sid === 'nuovo-ordine-cliente') {
          try { this.initNewOrderForm(); } catch {}
        }
        if (sid === 'elenco-ordini-cliente') this.renderOrders();
        if (sid === 'nuovo-ddt-cliente') {
          try { this.initNewDDT(); } catch {}
        }
        if (sid === 'elenco-ddt-cliente') this.renderDDTs();
        if (sid === 'fatturazione') {
          try { this.initInvoicing(); } catch {}
        }
        if (sid === 'elenco-fatture') this.renderInvoices();
      };

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

      App.events.on('db:changed', () => {
        const current = document.querySelector('.content-section:not(.d-none)')?.id;
        refreshSection(current);
      });
      App.events.on('section:changed', refreshSection);
    }
  };

  // Global hooks for overlay/patch compatibility
  window.renderCustomerOrdersTable = () => Clienti.renderOrders();


export function initVenditeFeature() {
  Clienti.init();
  // expose (compat)
  App.Clienti = Clienti;
}