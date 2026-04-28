/* vendite/index.js - ordini cliente, DDT, fatturazione (MODULARE) */
import { App } from '../../core/app.js';
import { applyStockBatch, validateStockBatch } from '../../domain/inventory.rules.js';
import {
  applyShipmentToOrder,
  buildCustomerDDT,
  buildCustomerOrder,
  buildInvoice,
  buildInvoiceLines,
  calculateInvoiceTotals,
  findLinkedInvoiceForDDT,
  getDDTRestoreStockChanges,
  getOpenCustomerOrders,
  getShipmentStockWarnings,
  markDDTsInvoiced,
  rollbackCustomerDDT,
  rollbackInvoiceDDTState
} from '../../domain/sales.service.js';
import { canDeleteDocuments } from '../../domain/permissions.service.js';
import { renderCustomerOrdersTable } from './orders.ui.js';
import { renderCustomerDDTsTable } from './ddts.ui.js';
import { renderInvoicesTable } from './invoices.ui.js';
import { getJsPDFConstructor } from '../../printing/common.print.js';
import { printCustomerDDTPdf, printInvoicePdf } from '../../printing/sales.print.js';
const canDeleteDocs = () => canDeleteDocuments(App.currentUser);
const h = value => App.utils.escapeHtml(value);

const Clienti = {
    renderOrders() {
      const db = App.db.ensure();
      renderCustomerOrdersTable({
        db,
        tbody: document.getElementById('customer-orders-table-body'),
        canDelete: canDeleteDocs(),
        h,
        fmtMoney: App.utils.fmtMoney
      });
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
        custSel.innerHTML = (curDb.customers || []).map(c => `<option value="${h(c.id)}">${h(c.name)}</option>`).join('');
        prodSel.innerHTML = (curDb.products || []).map(p => `<option value="${h(p.id)}" data-price="${Number(p.salePrice||0)}">${h(p.code)} - ${h(p.description)}</option>`).join('');
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
            <td>${h(r.productName)}</td>
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
        const order = buildCustomerOrder({
          id: App.utils.uuid(),
          number: finalOrderNumber,
          date: dateEl.value,
          customer: cust,
          lines: tmp
        });
        App.db.mutate('sales:create-customer-order', currentDb => {
          currentDb.customerOrders = currentDb.customerOrders || [];
          currentDb.customerOrders.push(order);
          return { orderNumber: order.number };
        });
        db = App.db.ensure();
        numEl.value = finalOrderNumber;
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
        App.db.mutate('sales:delete-customer-order', currentDb => {
          const idx = (currentDb.customerOrders || []).findIndex(x => x.number === order.number);
          if (idx >= 0) currentDb.customerOrders.splice(idx, 1);
          return { orderNumber: order.number };
        });
        db = App.db.ensure();
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

        if (title) title.textContent = `Dettaglio Ordine Cliente ${h(o.number)}`;

        const lines = (o.lines || []);
        let html = `<div class="mb-2"><strong>Cliente:</strong> ${o.customerName || ''}</div>`;
        html += `<div class="mb-2"><strong>Data:</strong> ${o.date || ''}</div>`;
        html += `<div class="mb-2"><strong>Stato:</strong> ${h(o.status || 'In lavorazione')}</div>`;
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
            <td>${h(l.productName || l.description || '')}</td>
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
      renderCustomerDDTsTable({
        db,
        tbody: document.getElementById('customer-ddts-table-body'),
        canDelete: canDeleteDocs(),
        h,
        findLinkedInvoiceForDDT
      });
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
        const openOrders = getOpenCustomerOrders(curDb);
        selOrder.innerHTML = '<option selected disabled value="">Seleziona un ordine...</option>'
          + openOrders.map(o => `<option value="${h(o.number)}">${h(o.number)} - ${h(o.customerName)}</option>`).join('');
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

        const rows = order.lines.map((l,i) => {
          const residual = (l.qty || 0) - (l.shippedQty || 0);
          if (residual <= 0) return '';
          return `<tr data-i="${i}">
            <td>${h(l.productName)}</td>
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
        const warnings = getShipmentStockWarnings(db, order, shipLines);

        if (warnings.length) {
          const lines = warnings.map(w => `- ${w.code}: richiesti ${w.qty} / disponibili ${w.available}`).join('\n');
          const ok = window.confirm(
            `Attenzione: la quantità da spedire supera la giacenza per uno o più articoli.\n\n${lines}\n\nVuoi continuare?`
          );
          if (!ok) return;
        }
;
        if (shipLines.length === 0) return App.ui.showToast('Nessuna quantità da spedire.', 'warning');

        let newDDT = null;
        try {
          App.db.mutate('sales:create-customer-ddt', currentDb => {
            const currentOrder = (currentDb.customerOrders || []).find(o => o.number === number);
            if (!currentOrder) throw new Error('Ordine non trovato.');
            const changes = shipLines.map(s => ({ productId: currentOrder.lines[s.i].productId, delta: -s.qty }));
            validateStockBatch(currentDb, changes);
            applyStockBatch(currentDb, changes);
            applyShipmentToOrder(currentOrder, shipLines);
            newDDT = buildCustomerDDT({
              id: App.utils.uuid(),
              number: ddtNum.value,
              date: ddtDate.value,
              order: currentOrder,
              shipLines,
              parcels: ddtParcels?.value,
              carrier: ddtCarrier?.value,
              transportReason: ddtTransportReason?.value,
              externalAspect: ddtExternalAspect?.value,
              notes: ddtNotes?.value
            });
            currentDb.customerDDTs = currentDb.customerDDTs || [];
            currentDb.customerDDTs.push(newDDT);
            return { ddtNumber: newDDT.number, orderNumber: currentOrder.number };
          });
          db = App.db.ensure();
        } catch (err) {
          return App.ui.showToast(err.message || 'Giacenza insufficiente', 'danger');
        }

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
          title.textContent = `Dettaglio DDT ${h(d.number)}`;
          const company = db.company || {};
          const customer = (db.customers||[]).find(c => String(c.id) === String(d.customerId)) || {};
          const companyAddress = [company.address || '', [company.zip || '', company.city || '', company.province ? `(${company.province})` : ''].filter(Boolean).join(' ')].filter(Boolean).join('<br>');
          const customerAddress = (customer.address || '').replace(/\n/g, '<br>');
          let html = `<div class="row g-3 mb-3">`;
          html += `<div class="col-md-6"><div class="card h-100"><div class="card-body"><div class="small text-uppercase text-muted mb-1">Mittente</div><div class="fw-semibold">${h(company.name || 'Nostra azienda')}</div>${companyAddress ? `<div class="small mt-1">${companyAddress}</div>` : ''}</div></div></div>`;
          html += `<div class="col-md-6"><div class="card h-100"><div class="card-body"><div class="small text-uppercase text-muted mb-1">Destinatario</div><div class="fw-semibold">${h(d.customerName || customer.name || '-')}</div>${customerAddress ? `<div class="small mt-1">${customerAddress}</div>` : ''}</div></div></div>`;
          html += `</div>`;
          html += `<div class="row g-2 mb-3">`;
          html += `<div class="col-md-3"><strong>Numero DDT:</strong><br>${h(d.number)}</div>`;
          html += `<div class="col-md-3"><strong>Data:</strong><br>${h(d.date)}</div>`;
          html += `<div class="col-md-6"><strong>Riferimento Ordine:</strong><br>${h(d.orderNumber)}</div>`;
          html += `<div class="col-md-3"><strong>Colli:</strong><br>${d.parcels ?? '-'}</div>`;
          html += `<div class="col-md-3"><strong>Vettore:</strong><br>${h(d.carrier || '-')}</div>`;
          html += `<div class="col-md-3"><strong>Causale trasporto:</strong><br>${h(d.transportReason || 'Vendita')}</div>`;
          html += `<div class="col-md-3"><strong>Aspetto esteriore:</strong><br>${h(d.externalAspect || '-')}</div>`;
          html += `</div>`;
          if (d.notes) html += `<div class="mb-3"><strong>Note:</strong><br>${h(d.notes)}</div>`;
          html += `<table class="table table-sm"><thead><tr><th>Codice</th><th>Descrizione</th><th class="text-end">Qtà</th></tr></thead><tbody>`;
          d.lines.forEach(l => { const parts = String(l.description || '').split(' - '); const code = parts.length > 1 ? parts.shift() : ''; const desc = parts.length ? parts.join(' - ') : String(l.description||''); html += `<tr><td>${h(code || '-')}</td><td>${h(desc)}</td><td class="text-end">${l.qty}</td></tr>`; });
          html += `</tbody></table>`;
          body.innerHTML = html;
          const delBtn = document.getElementById('delete-customer-ddt-btn');
          if (delBtn) {
            const linkedInvoice = findLinkedInvoiceForDDT(db, d.number);
            delBtn.classList.toggle('d-none', !canDeleteDocs());
            delBtn.disabled = !!linkedInvoice || d.status === 'Fatturato';
            delBtn.onclick = () => {
              if (delBtn.disabled) return;
              const actionBtn = tbody.querySelector(`button[data-action="del-ddt"][data-num="${h(d.number)}"]`);
              if (actionBtn) actionBtn.click();
            };
          }
          try { bootstrap.Modal.getOrCreateInstance(document.getElementById('ddtDetailModal')).show(); } catch {}
          // Print
          document.getElementById('print-ddt-btn')?.addEventListener('click', () => {
            try {
              printCustomerDDTPdf({ ddt: d, db, jsPDFCtor: getJsPDFConstructor() });
            } catch (e) {
              console.error(e);
              App.ui.showToast(e?.message || 'Errore nella generazione del PDF DDT.', 'danger');
            }
          }, { once: true });
        } else if (btn.getAttribute('data-action') === 'del-ddt') {
          const ddt = (db.customerDDTs||[]).find(x=>x.number===num); if (!ddt) return;
          if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
          const linkedInvoice = findLinkedInvoiceForDDT(db, ddt.number);
          if (linkedInvoice || ddt.status === 'Fatturato') return App.ui.showToast(`DDT collegato alla fattura ${linkedInvoice?.number || ddt.invoiceNumber || ''}: non eliminabile.`, 'warning');
          if (!confirm(`Eliminare il DDT ${ddt.number}?`)) return;
          // rollback stock and order shippedQty
          try {
            App.db.mutate('sales:delete-customer-ddt', currentDb => {
              const liveDDT = (currentDb.customerDDTs || []).find(x => x.number === num);
              if (!liveDDT) return { ddtNumber: num, deleted: false };
              const order = (currentDb.customerOrders || []).find(o => o.number === liveDDT.orderNumber);
              if (order) rollbackCustomerDDT(currentDb, liveDDT);
              const restoreChanges = getDDTRestoreStockChanges(currentDb, liveDDT);
              if (restoreChanges.length) {
                validateStockBatch(currentDb, restoreChanges);
                applyStockBatch(currentDb, restoreChanges);
              }
              const idx = (currentDb.customerDDTs || []).findIndex(x => x.number === num);
              if (idx >= 0) currentDb.customerDDTs.splice(idx, 1);
              return { ddtNumber: num, deleted: idx >= 0 };
            });
            db = App.db.ensure();
          } catch (err) {
            App.ui.showToast((err && err.message) ? err.message : 'Ripristino stock non completato', 'warning');
          }
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
          + (curDb.customers||[]).map(c => `<option value="${h(c.id)}">${h(c.name)}</option>`).join('');
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
              <input class="form-check-input invoice-ddt-check" type="checkbox" value="${h(d.number)}" id="chk-${h(d.number)}" checked>
              <label class="form-check-label" for="chk-${h(d.number)}">${h(d.number)} — ${h(d.date)}</label>
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
        const lines = buildInvoiceLines(db, ddts);
        const { subtotal, ivaTotal, total } = calculateInvoiceTotals(lines);

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
              <td>${h(l.description)}</td>
              <td class="text-end">${l.qty}</td>
              <td class="text-end">${App.utils.fmtMoney(l.price)}</td>
              <td class="text-end">${App.utils.fmtMoney(l.qty*l.price)}</td>
              <td class="text-end">${h(l.iva)}%</td>
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

        const invLines = buildInvoiceLines(db, ddts);

        const invoice = buildInvoice({
          id: App.utils.uuid(),
          number: invoiceNumber,
          date: invDate,
          customer: cust,
          ddts,
          lines: invLines
        });

        App.db.mutate('sales:create-invoice', currentDb => {
          currentDb.invoices = currentDb.invoices || [];
          currentDb.invoices.push(invoice);
          const liveDDTs = (currentDb.customerDDTs || []).filter(d => (ddts || []).some(sel => sel.number === d.number));
          markDDTsInvoiced(liveDDTs, invoiceNumber);
          return { invoiceNumber };
        });
        db = App.db.ensure();
        App.ui.showToast('Fattura emessa', 'success');
        Clienti.renderDDTs();
        Clienti.renderInvoices();
        resetInvoicing();
      });
    },

    renderInvoices() {
      const db = App.db.ensure();
      const tbody = document.getElementById('invoices-table-body');
      renderInvoicesTable({
        db,
        tbody,
        canDelete: canDeleteDocs(),
        h,
        fmtMoney: App.utils.fmtMoney
      });
      if (!tbody) return;

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
            let html = `<div class="mb-2"><strong>Cliente:</strong> ${h(inv.customerName)}</div>`;
            html += `<div class="mb-2"><strong>Data:</strong> ${h(inv.date)}</div>`;
            html += `<div class="mb-2"><strong>DDT Inclusi:</strong> ${h((inv.ddtNumbers || inv.ddts || []).join(', '))}</div>`;
            html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà</th><th class="text-end">Prezzo</th><th class="text-end">Imponibile</th><th class="text-end">IVA</th></tr></thead><tbody>`;
            inv.lines.forEach(l => { html += `<tr><td>${h(l.description)}</td><td class="text-end">${l.qty}</td><td class="text-end">${App.utils.fmtMoney(l.price)}</td><td class="text-end">${App.utils.fmtMoney(l.qty*l.price)}</td><td class="text-end">${h(l.iva)}%</td></tr>`; });
            html += `</tbody></table>`;
            body.innerHTML = html;
            try { bootstrap.Modal.getOrCreateInstance(document.getElementById('invoiceDetailModal')).show(); } catch {}
            // Print
            document.getElementById('print-invoice-btn')?.addEventListener('click', () => {
              try {
                printInvoicePdf({ invoice: inv, jsPDFCtor: getJsPDFConstructor() });
              } catch (e) {
                console.error(e);
                App.ui.showToast(e?.message || 'Errore nella generazione della fattura PDF.', 'danger');
              }
            }, { once: true });
          } else if (btn.getAttribute('data-action') === 'del-invoice') {
            const inv = (db.invoices||[]).find(x=>x.number===num); if (!inv) return;
            if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
            if (!confirm(`Eliminare la fattura ${inv.number}?`)) return;
            App.db.mutate('sales:delete-invoice', currentDb => {
              const liveInvoice = (currentDb.invoices || []).find(x => x.number === num);
              if (liveInvoice) rollbackInvoiceDDTState(currentDb, liveInvoice);
              const idx = (currentDb.invoices || []).findIndex(x => x.number === num);
              if (idx >= 0) currentDb.invoices.splice(idx, 1);
              return { invoiceNumber: num, deleted: idx >= 0 };
            });
            db = App.db.ensure();
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