/* acquisti/index.js - ordini fornitore, DDT in entrata (MODULARE) */
import { App } from '../../core/app.js';
import { adjustStockBatch, adjustQuarantineBatch } from '../../domain/inventory.service.js';

  const canDeleteDocs = () => {
  const role = App.currentUser?.role || 'User';
  return role === 'Supervisor' || role === 'Admin';
};

const recomputeSupplierOrderStatus = (order) => {
  const lines = order?.lines || [];
  const anyQuarantine = lines.some(l => Number(l.quarantineQty || 0) > 0);
  const allReceived = lines.length > 0 && lines.every(l => Number(l.receivedQty || 0) >= Number(l.qty || 0));
  const anyReceived = lines.some(l => Number(l.receivedQty || 0) > 0);
  order.status = anyQuarantine ? 'Aperto con riserva' : (allReceived ? 'Completato' : (anyReceived ? 'Parzialmente Ricevuto' : 'Inviato'));
};

const lineAcceptedQty = (line, ddt = null) => {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.acceptedQty || 0);
  return ddt?.refused ? 0 : (ddt?.withReserve ? 0 : Number(line?.qty || 0));
};
const lineReserveQty = (line, ddt = null) => {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.reserveQty || 0);
  return ddt?.withReserve ? Number(line?.qty || 0) : 0;
};
const lineRefusedQty = (line, ddt = null) => {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.refusedQty || 0);
  return ddt?.refused ? Number(line?.qty || 0) : 0;
};
const receivedLikeQty = (line, ddt = null) => lineAcceptedQty(line, ddt) + lineReserveQty(line, ddt);
const computeSupplierDDTStatus = (ddt) => {
  const lines = ddt?.lines || [];
  const accepted = lines.reduce((a, l) => a + lineAcceptedQty(l, ddt), 0);
  const reserved = lines.reduce((a, l) => a + lineReserveQty(l, ddt), 0);
  const refused = lines.reduce((a, l) => a + lineRefusedQty(l, ddt), 0);
  if (refused > 0 && accepted + reserved === 0) return 'Respinto totale';
  if (refused > 0 && reserved > 0) return 'Parzialmente respinto con riserva';
  if (refused > 0) return 'Parzialmente respinto';
  if (reserved > 0) return 'Ricevuto con riserva';
  return 'Ricevuto';
};
const lineOutcomeLabel = (line, ddt = null) => {
  const a = lineAcceptedQty(line, ddt);
  const r = lineReserveQty(line, ddt);
  const x = lineRefusedQty(line, ddt);
  if (x > 0 && a + r === 0) return 'Respinta';
  if (x > 0 && r > 0) return 'Mista (riserva + respinta)';
  if (x > 0) return 'Mista';
  if (r > 0) return 'Con riserva';
  return 'Accettata';
};

const Fornitori = {
    renderOrders() {
      const db = App.db.ensure();
      const tbody = document.getElementById('supplier-orders-table-body');
      if (!tbody) return;
      const canDelete = canDeleteDocs();
      tbody.innerHTML = (db.supplierOrders || []).map(o => `
        <tr>
          <td>${o.number}</td>
          <td>${o.date}</td>
          <td>${o.supplierName}</td>
          <td class="text-end">${App.utils.fmtMoney(o.total || 0)}</td>
          <td>${o.status || 'Inviato'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-num="${o.number}">Visualizza</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-order" data-num="${o.number}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
    },

    initNewOrderForm() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const form = document.getElementById('new-supplier-order-form');
      if (!form) return;
      if (form.dataset.bound === '1') return;
      form.dataset.bound = '1';
      const supSel = document.getElementById('order-supplier-select');
      const dateEl = document.getElementById('order-supplier-date');
      const numEl = document.getElementById('order-supplier-number');
      const prodSel = document.getElementById('order-supplier-product-select');
      const qtyEl = document.getElementById('order-supplier-product-qty');
      const priceEl = document.getElementById('order-supplier-product-price');
      const addBtn = document.getElementById('add-product-to-supplier-order-btn');
      const linesTbody = document.getElementById('supplier-order-lines-tbody');
      const totEl = document.getElementById('supplier-order-total');
      const fillSelects = () => {
        const curDb = App.db.ensure();
        const prevSup = supSel.value;
        const prevProd = prodSel.value;
        supSel.innerHTML = (curDb.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        prodSel.innerHTML = (curDb.products || []).map(p => `<option value="${p.id}" data-price="${p.purchasePrice||0}">${p.code} - ${p.description}</option>`).join('');
        if (prevSup) supSel.value = prevSup;
        if (prevProd) prodSel.value = prevProd;
      };
      fillSelects();
      App.events.on('suppliers:changed', fillSelects);
      App.events.on('products:changed', fillSelects);
      App.events.on('db:changed', fillSelects);

      dateEl.value = App.utils.todayISO();
      numEl.value = App.utils.previewSupplierOrderNumber(db);

      const tmp = [];
      const resetForm = () => {
        // pulizia campi (evita che restino i dati precedenti)
        form.reset();
        tmp.splice(0);
        if (linesTbody) linesTbody.innerHTML = '';
        if (totEl) totEl.textContent = App.utils.fmtMoney(0);
        dateEl.value = App.utils.todayISO();
        // non forziamo un nuovo numero qui per evitare incrementi inutili: verrà aggiornato dopo il salvataggio
        if (!numEl.value) numEl.value = App.utils.previewSupplierOrderNumber(db);
        // default quantità
        if (qtyEl) qtyEl.value = '1';
        // price da prodotto selezionato
        try { if (prodSel?.options?.length) prodSel.dispatchEvent(new Event('change')); } catch {}
      };
      // reset quando si entra nella sezione
      App.events.on('section:changed', (sid) => {
        if (sid === 'nuovo-ordine-fornitore') {
          fillSelects();
          resetForm();
        }
        if (sid === 'elenco-ordini-fornitore') Fornitori.renderOrders();
      });

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
          </tr>`).join('');
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
        tmp.push({ productId: pid, productName: `${p.code} - ${p.description}`, qty, price, receivedQty: 0 });
        recalc();
        qtyEl.value = '1';
      });
      linesTbody.addEventListener('click', (e) => {
        const i = e.target.closest('button')?.getAttribute('data-i');
        if (i!=null) { tmp.splice(Number(i),1); recalc(); }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const sup = (db.suppliers||[]).find(x=>x.id===supSel.value);
        if (!sup || tmp.length===0) return App.ui.showToast('Seleziona fornitore e aggiungi almeno una riga.', 'warning');
        const finalOrderNumber = App.utils.finalizeSupplierOrderNumber(db, numEl.value);
        const order = {
          id: App.utils.uuid(),
          number: finalOrderNumber,
          date: dateEl.value,
          supplierId: sup.id,
          supplierName: sup.name,
          lines: tmp.map(r=>({ ...r })),
          total: tmp.reduce((a,r)=>a+r.qty*r.price,0),
          status: 'Inviato'
        };
        db.supplierOrders.push(order);
        numEl.value = finalOrderNumber;
        App.db.save(db);
        App.ui.showToast('Ordine fornitore salvato', 'success');
        tmp.splice(0); recalc();
        // precompila il prossimo numero e ripulisce i campi
        numEl.value = App.utils.previewSupplierOrderNumber(db);
        dateEl.value = App.utils.todayISO();
        if (qtyEl) qtyEl.value = '1';
        try { if (prodSel?.options?.length) prodSel.dispatchEvent(new Event('change')); } catch {}
        Fornitori.renderOrders();
        App.ui.showSection('elenco-ordini-fornitore');
      });
    },

    wireOrderDetail() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });

      const tbody = document.getElementById('supplier-orders-table-body');
      if (!tbody) return;
      if (tbody.dataset.wiredView === '1') return;
      tbody.dataset.wiredView = '1';

      const deleteOrder = (orderNumber) => {
        if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        const order = (db.supplierOrders || []).find(x => x.number === orderNumber);
        if (!order) return;
        const hasDDT = (db.supplierDDTs || []).some(d => d.orderNumber === order.number);
        if (hasDDT) {
          return App.ui.showToast('Impossibile eliminare: esistono DDT collegati a questo ordine.', 'warning');
        }
        if (!confirm(`Eliminare l'ordine ${order.number}?`)) return;
        const idx = (db.supplierOrders || []).findIndex(x => x.number === order.number);
        if (idx >= 0) db.supplierOrders.splice(idx, 1);
        App.db.save(db);
        Fornitori.renderOrders();
        App.ui.showToast('Ordine eliminato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierOrderDetailModal')).hide(); } catch {}
      };

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        const action = btn.getAttribute('data-action');
        const num = btn.getAttribute('data-num');
        if (action === 'delete-order') return deleteOrder(num);
        if (action !== 'view') return;
        const o = (db.supplierOrders || []).find(x => x.number === num);
        if (!o) return;

        const title = document.getElementById('supplierOrderDetailModalTitle');
        const body = document.getElementById('supplierOrderDetailModalBody');
        const delBtn = document.getElementById('delete-supplier-order-btn');
        if (title) title.textContent = `Dettaglio Ordine Fornitore ${o.number}`;

        let html = `<div class="mb-2"><strong>Fornitore:</strong> ${o.supplierName || ''}</div>`;
        html += `<div class="mb-2"><strong>Data:</strong> ${o.date || ''}</div>`;
        html += `<div class="mb-2"><strong>Stato:</strong> ${o.status || 'Inviato'}</div>`;
        html += `<div class="mb-3"><strong>Totale:</strong> ${App.utils.fmtMoney(o.total || 0)}</div>`;

        html += `<table class="table table-sm">
          <thead><tr>
            <th>Prodotto</th>
            <th class="text-end">Ord.</th>
            <th class="text-end">Ricevuto</th>
            <th class="text-end">Residuo</th>
            <th class="text-end">Prezzo</th>
            <th class="text-end">Imponibile</th>
          </tr></thead><tbody>`;
        (o.lines || []).forEach(l => {
          const qty = Number(l.qty || 0);
          const rec = Number(l.receivedQty || 0);
          const quar = Number(l.quarantineQty || 0);
          const resid = Math.max(0, qty - rec - quar);
          const price = Number(l.price || 0);
          html += `<tr>
            <td>${l.productName || l.description || ''}</td>
            <td class="text-end">${qty}</td>
            <td class="text-end">${rec}</td>
            <td class="text-end">${resid}</td>
            <td class="text-end">${App.utils.fmtMoney(price)}</td>
            <td class="text-end">${App.utils.fmtMoney(qty * price)}</td>
          </tr>`;
        });
        html += `</tbody></table>`;

        if (body) body.innerHTML = html;
        if (delBtn) {
          const hasDDT = (db.supplierDDTs || []).some(d => d.orderNumber === o.number);
          delBtn.classList.toggle('d-none', !canDeleteDocs());
          delBtn.disabled = hasDDT;
          delBtn.onclick = () => deleteOrder(o.number);
        }

        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierOrderDetailModal')).show(); } catch {}
      });
    },

    wireSupplierDDTDetail() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });

      const tbody = document.getElementById('supplier-ddts-table-body');
      if (!tbody) return;
      if (tbody.dataset.wiredDetail === '1') return;
      tbody.dataset.wiredDetail = '1';

      const deleteSupplierDDT = (num) => {
        if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        const ddt = (db.supplierDDTs || []).find(x => x.number === num);
        if (!ddt) return;
        if (!confirm(`Eliminare il DDT fornitore ${ddt.number}?`)) return;

        const order = (db.supplierOrders || []).find(o => o.number === ddt.orderNumber);
        if (order) {
          (ddt.lines || []).forEach(dl => {
            const line = (order.lines || []).find(l => String(l.productId || '') === String(dl.productId || ''))
              || (order.lines || []).find(l => String(l.productName || l.description || '') === String(dl.description || ''));
            if (line) {
              line.receivedQty = Math.max(0, Number(line.receivedQty || 0) - Number(dl.acceptedQty || 0));
              line.quarantineQty = Math.max(0, Number(line.quarantineQty || 0) - Number(dl.reserveQty || 0));
            }
          });
          recomputeSupplierOrderStatus(order);
        }

        try {
          const restoreStock = (ddt.lines || []).map(dl => {
            const pid = dl.productId || (db.products || []).find(pp => String(pp.description || '') === String(dl.description || ''))?.id;
            const q = Number(dl.acceptedQty || 0);
            return pid && q ? { productId: pid, delta: -q } : null;
          }).filter(Boolean);
          const restoreQuarantine = (ddt.lines || []).map(dl => {
            const pid = dl.productId || (db.products || []).find(pp => String(pp.description || '') === String(dl.description || ''))?.id;
            const q = Number(dl.reserveQty || 0);
            return pid && q ? { productId: pid, delta: -q } : null;
          }).filter(Boolean);
          if (restoreStock.length) adjustStockBatch(restoreStock, { reason: 'CANCELLA_DDT_FORNITORE', ref: ddt.number });
          if (restoreQuarantine.length) adjustQuarantineBatch(restoreQuarantine, { reason: 'CANCELLA_DDT_FORNITORE', ref: ddt.number });
        } catch (err) {
          return App.ui.showToast((err && err.message) ? err.message : 'Ripristino magazzino non completato', 'warning');
        }

        db.supplierQuarantine = (db.supplierQuarantine || []).filter(q => String(q.ddtNumber||'') !== String(num));
        const idx = (db.supplierDDTs || []).findIndex(x => x.number === num);
        if (idx >= 0) db.supplierDDTs.splice(idx, 1);
        App.db.save(db);
        Fornitori.renderOrders();
        Fornitori.renderDDTs();
        App.ui.showToast('DDT fornitore eliminato', 'success');
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierDdtDetailModal')).hide(); } catch {}
      };

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        const action = btn.getAttribute('data-action');
        const num = btn.getAttribute('data-num');
        if (action === 'del-supplier-ddt') return deleteSupplierDDT(num);
        if (action !== 'view-supplier-ddt') return;
        const d = (db.supplierDDTs || []).find(x => x.number === num);
        if (!d) return;

        const title = document.getElementById('supplierDdtDetailModalTitle');
        const body = document.getElementById('supplierDdtDetailModalBody');
        const delBtn = document.getElementById('delete-supplier-ddt-btn');
        if (title) title.textContent = `Dettaglio DDT Fornitore ${d.number}`;

        const dest = d.customerName || (db.company?.name || 'Nostra Sede');

        let html = `<div class="mb-2"><strong>Fornitore:</strong> ${d.supplierName || ''}</div>`;
        html += `<div class="mb-2"><strong>Data:</strong> ${d.date || ''}</div>`;
        html += `<div class="mb-2"><strong>Destinazione:</strong> ${dest}</div>`;
        html += `<div class="mb-3"><strong>Riferimento Ordine:</strong> ${d.orderNumber || ''}</div>`;
        html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà gestita</th><th class="text-end">Accettata</th><th class="text-end">Riserva</th><th class="text-end">Respinta</th><th>Esito</th><th>Motivazione</th><th class="text-end">Prezzo</th></tr></thead><tbody>`;
        (d.lines || []).forEach(l => {
          html += `<tr><td>${l.description || ''}</td><td class="text-end">${l.qty || 0}</td><td class="text-end">${l.acceptedQty || 0}</td><td class="text-end">${l.reserveQty || 0}</td><td class="text-end">${l.refusedQty || 0}</td><td>${lineOutcomeLabel(l,d)}</td><td>${l.lineNotes || '—'}</td><td class="text-end">${App.utils.fmtMoney(l.price || 0)}</td></tr>`;
        });
        html += `</tbody></table>`;

        if (body) body.innerHTML = html;
        if (delBtn) {
          delBtn.classList.toggle('d-none', !canDeleteDocs());
          delBtn.disabled = false;
          delBtn.onclick = () => deleteSupplierDDT(d.number);
        }

        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierDdtDetailModal')).show(); } catch {}
      });
    },
    // DDT fornitore (merce in entrata)
    renderDDTs() {
      const db = App.db.ensure();
      const tbody = document.getElementById('supplier-ddts-table-body');
      if (!tbody) return;
      const canDelete = canDeleteDocs();
      tbody.innerHTML = (db.supplierDDTs || []).map(d => `
        <tr>
          <td>${d.number}</td>
          <td>${d.date}</td>
          <td>${d.supplierName}</td>
          <td>${d.customerName || (db.company?.name || 'Nostra Sede')}</td>
          <td>${d.orderNumber}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-supplier-ddt" data-num="${d.number}">Dettaglio</button>
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="del-supplier-ddt" data-num="${d.number}"><i class="fas fa-trash-alt"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
    },

    renderReturnDDTs() {
      const db = App.db.ensure();
      const tbody = document.getElementById('supplier-return-ddts-table-body');
      if (!tbody) return;
      tbody.innerHTML = (db.supplierReturnDDTs || []).length ? (db.supplierReturnDDTs || []).map(r => `
        <tr>
          <td>${r.number || ''}</td>
          <td>${r.date || ''}</td>
          <td>${r.supplierName || ''}</td>
          <td>${r.sourceOrderNumber || ''}</td>
          <td>${r.sourceDdtNumber || ''}</td>
          <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="view-supplier-return" data-num="${r.number}">Dettaglio</button></td>
        </tr>
      `).join('') : `<tr><td colspan="6" class="text-muted">Nessun reso fornitore registrato.</td></tr>`;
    },

    wireSupplierReturnDetail() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const tbody = document.getElementById('supplier-return-ddts-table-body');
      if (!tbody || tbody.dataset.wiredDetail === '1') return;
      tbody.dataset.wiredDetail = '1';
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action="view-supplier-return"]'); if (!btn) return;
        const num = btn.getAttribute('data-num');
        const ret = (db.supplierReturnDDTs || []).find(x => x.number === num);
        if (!ret) return;
        const title = document.getElementById('supplierReturnDetailModalTitle');
        const body = document.getElementById('supplierReturnDetailModalBody');
        const printBtn = document.getElementById('print-supplier-return-pdf-btn');
        if (title) title.textContent = `Dettaglio Reso Fornitore ${ret.number}`;
        if (body) body.innerHTML = supplierReturnHtml(ret);
        if (printBtn) printBtn.onclick = () => printSupplierReturnPdf(ret);
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierReturnDetailModal')).show(); } catch {}
      });
    },

    initNewSupplierDDT() {
      let db = App.db.ensure();
      App.events.on('db:changed', d => { db = d; });
      const form = document.getElementById('new-supplier-ddt-form');
      if (!form) return;
      if (form.dataset.bound === '1') return;
      form.dataset.bound = '1';
      const selOrder = document.getElementById('ddt-supplier-order-select');
      const details = document.getElementById('ddt-supplier-details-section');
      const supName = document.getElementById('ddt-supplier-name');
      const ddtNum = document.getElementById('ddt-supplier-number');
      const ddtDate = document.getElementById('ddt-supplier-date');
      const tbody = document.getElementById('ddt-supplier-products-tbody');
      const notesEl = document.getElementById('ddt-supplier-notes');

      const fillOpenOrders = () => {
        const curDb = App.db.ensure();
        const prev = selOrder.value;
        const openOrders = (curDb.supplierOrders || []).filter(o => (o.lines||[]).some(l => (Number(l.receivedQty||0) + Number(l.quarantineQty||0)) < Number(l.qty||0) || Number(l.quarantineQty||0) > 0));
        selOrder.innerHTML = '<option selected disabled value="">Seleziona un ordine...</option>'
          + openOrders.map(o => `<option value="${o.number}">${o.number} - ${o.supplierName}</option>`).join('');
        if (prev && openOrders.some(o => o.number === prev)) selOrder.value = prev;
      };
      fillOpenOrders();
      const resetDDTForm = () => {
        form.reset();
        if (details) details.classList.add('d-none');
        if (tbody) tbody.innerHTML = '';
        if (notesEl) notesEl.value = '';
        fillOpenOrders();
      };
      App.events.on('section:changed', (sid) => {
        if (sid === 'nuovo-ddt-fornitore') resetDDTForm();
        if (sid === 'elenco-ddt-fornitore') Fornitori.renderDDTs();
      });

      App.events.on('supplierOrders:changed', fillOpenOrders);
      App.events.on('suppliers:changed', fillOpenOrders);
      App.events.on('db:changed', fillOpenOrders);

      selOrder.addEventListener('change', () => {
        const number = selOrder.value;
        const order = (db.supplierOrders||[]).find(o => o.number === number);
        if (!order) return;
        supName.value = order.supplierName;
        ddtNum.value = App.utils.nextSupplierDDTNumber(db);
        ddtDate.value = App.utils.todayISO();
        App.db.save(db);

        const rows = order.lines.map((l,i) => {
          const residual = Math.max(0, Number(l.qty || 0) - Number(l.receivedQty || 0) - Number(l.quarantineQty || 0));
          if (residual <= 0) return '';
          return `<tr data-i="${i}">
            <td>${l.productName}</td>
            <td class="text-end">${l.qty}</td>
            <td class="text-end">${residual}</td>
            <td class="text-end"><input type="number" min="0" max="${residual}" value="${residual}" class="form-control form-control-sm text-end ddt-acc-qty"></td>
            <td class="text-end"><input type="number" min="0" max="${residual}" value="0" class="form-control form-control-sm text-end ddt-res-qty"></td>
            <td class="text-end"><input type="number" min="0" max="${residual}" value="0" class="form-control form-control-sm text-end ddt-ref-qty"></td>
            <td><input type="text" class="form-control form-control-sm ddt-line-notes" placeholder="Motivazione per riserva/respingimento"></td>
          </tr>`;
        }).join('');
        tbody.innerHTML = rows;
        details.classList.remove('d-none');
      });

      tbody.addEventListener('input', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const accEl = tr.querySelector('.ddt-acc-qty');
        const resEl = tr.querySelector('.ddt-res-qty');
        const refEl = tr.querySelector('.ddt-ref-qty');
        const residual = Number(tr.children[2]?.textContent || 0);
        const vals = [accEl, resEl, refEl].map(el => Math.max(0, Number(el.value || 0)));
        let sum = vals[0] + vals[1] + vals[2];
        if (sum > residual) {
          // riduci il campo modificato per rispettare il massimo
          const others = (e.target === accEl ? vals[1] + vals[2] : e.target === resEl ? vals[0] + vals[2] : vals[0] + vals[1]);
          e.target.value = Math.max(0, residual - others);
        }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const number = selOrder.value;
        const order = (db.supplierOrders||[]).find(o => o.number === number);
        if (!order) return App.ui.showToast('Seleziona un ordine valido', 'warning');
        const handledLines = [];
        let validationError = null;
        tbody.querySelectorAll('tr').forEach(tr => {
          if (validationError) return;
          const i = parseInt(tr.getAttribute('data-i'), 10);
          const l = order.lines[i];
          const residual = Math.max(0, Number(l.qty || 0) - Number(l.receivedQty || 0) - Number(l.quarantineQty || 0));
          const acceptedQty = Math.max(0, Number(tr.querySelector('.ddt-acc-qty')?.value || 0));
          const reserveQty = Math.max(0, Number(tr.querySelector('.ddt-res-qty')?.value || 0));
          const refusedQty = Math.max(0, Number(tr.querySelector('.ddt-ref-qty')?.value || 0));
          const lineNotes = (tr.querySelector('.ddt-line-notes')?.value || '').trim();
          const handled = acceptedQty + reserveQty + refusedQty;
          if (handled > residual) {
            validationError = `La somma delle quantità per ${l.productName} supera il residuo.`;
            return;
          }
          if ((reserveQty > 0 || refusedQty > 0) && !lineNotes) {
            validationError = `Inserisci una motivazione per la riga ${l.productName} con riserva o respingimento.`;
            tr.querySelector('.ddt-line-notes')?.focus();
            return;
          }
          if (handled > 0) {
            handledLines.push({ i, acceptedQty, reserveQty, refusedQty, lineNotes, qty: handled });
          }
        });
        if (validationError) return App.ui.showToast(validationError, 'warning');
        if (handledLines.length === 0) return App.ui.showToast('Nessuna quantità da registrare.', 'warning');

        try {
          const stockChanges = handledLines
            .map(s => ({ productId: order.lines[s.i].productId, delta: Number(s.acceptedQty || 0) }))
            .filter(x => x.delta > 0);
          const quarantineChanges = handledLines
            .map(s => ({ productId: order.lines[s.i].productId, delta: Number(s.reserveQty || 0) }))
            .filter(x => x.delta > 0);
          if (stockChanges.length) adjustStockBatch(stockChanges, { reason: 'DDT_FORNITORE', ref: ddtNum.value });
          if (quarantineChanges.length) adjustQuarantineBatch(quarantineChanges, { reason: 'DDT_FORNITORE_RISERVA', ref: ddtNum.value });
        } catch (err) {
          return App.ui.showToast(err.message || 'Errore aggiornamento magazzino', 'danger');
        }

        handledLines.forEach(s => {
          const line = order.lines[s.i];
          line.receivedQty = Number(line.receivedQty || 0) + Number(s.acceptedQty || 0);
          line.quarantineQty = Number(line.quarantineQty || 0) + Number(s.reserveQty || 0);
        });
        recomputeSupplierOrderStatus(order);

        const generalNotes = (notesEl?.value || '').trim();
        const totalReserved = handledLines.reduce((a, s) => a + Number(s.reserveQty || 0), 0);
        const totalRefused = handledLines.reduce((a, s) => a + Number(s.refusedQty || 0), 0);
        db.supplierQuarantine = db.supplierQuarantine || [];
        const newDDT = {
          id: App.utils.uuid(),
          number: ddtNum.value,
          date: ddtDate.value,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          orderNumber: order.number,
          withReserve: totalReserved > 0,
          refused: totalRefused > 0 && handledLines.every(s => Number(s.acceptedQty || 0) + Number(s.reserveQty || 0) === 0),
          notes: generalNotes,
          lines: handledLines.map(s => {
            const l = order.lines[s.i];
            return {
              productId: l.productId,
              description: l.productName,
              qty: s.qty,
              acceptedQty: s.acceptedQty,
              reserveQty: s.reserveQty,
              refusedQty: s.refusedQty,
              lineNotes: s.lineNotes,
              price: l.price
            };
          })
        };
        newDDT.status = computeSupplierDDTStatus(newDDT);
        db.supplierDDTs.push(newDDT);
        handledLines.forEach(s => {
          if (Number(s.reserveQty || 0) > 0) {
            const l = order.lines[s.i];
            db.supplierQuarantine.push({
              id: App.utils.uuid(),
              date: ddtDate.value,
              supplierId: order.supplierId,
              supplierName: order.supplierName,
              orderId: order.id,
              orderNumber: order.number,
              ddtId: newDDT.id,
              ddtNumber: newDDT.number,
              productId: l.productId,
              description: l.productName || l.description,
              qty: Number(s.reserveQty || 0),
              note: s.lineNotes || generalNotes || '',
              status: 'In quarantena'
            });
          }
        });
        App.db.save(db);
        App.ui.showToast('DDT fornitore registrato', 'success');
        Fornitori.renderOrders();
        Fornitori.renderDDTs();
        App.ui.showSection('elenco-ddt-fornitore');
      });
    },



    renderQuarantine() {
      const db = App.db.ensure();
      const tbody = document.getElementById('supplier-quarantine-table-body');
      const histBody = document.getElementById('supplier-quarantine-history-table-body');
      if (!tbody) return;
      const canManage = canDeleteDocs();
      const rows = (db.supplierQuarantine || []).filter(q => q.status === 'In quarantena');
      tbody.innerHTML = rows.length ? rows.map(q => `
        <tr>
          <td>${q.date || ''}</td>
          <td>${q.supplierName || ''}</td>
          <td>${q.orderNumber || ''}</td>
          <td>${q.ddtNumber || ''}</td>
          <td>${q.description || ''}</td>
          <td class="text-end">${q.qty || 0}</td>
          <td>${q.note || '—'}</td>
          <td class="text-end">
            ${canManage ? `<button class="btn btn-sm btn-outline-success" data-action="release-q" data-id="${q.id}">Svincola</button>
            <button class="btn btn-sm btn-outline-warning ms-1" data-action="return-q" data-id="${q.id}">Reso fornitore</button>
            <button class="btn btn-sm btn-outline-danger ms-1" data-action="destroy-q" data-id="${q.id}">Da distruggere</button>` : '<span class="text-muted">Solo Supervisor</span>'}
          </td>
        </tr>`).join('') : `<tr><td colspan="8" class="text-muted">Nessuna merce in quarantena.</td></tr>`;
      if (histBody) {
        const historyRows = (db.supplierQuarantine || []).filter(q => q.status !== 'In quarantena');
        histBody.innerHTML = historyRows.length ? historyRows.map(q => `
          <tr>
            <td>${q.resolvedAt || ''}</td>
            <td>${q.supplierName || ''}</td>
            <td>${q.orderNumber || ''}</td>
            <td>${q.description || ''}</td>
            <td class="text-end">${q.qty || 0}</td>
            <td>${q.status || ''}</td>
            <td>${q.returnDdtNumber || '—'}</td>
            <td>${q.note || '—'}</td>
          </tr>`).join('') : `<tr><td colspan="8" class="text-muted">Nessuna quarantena chiusa.</td></tr>`;
      }
    },

    wireQuarantine() {
      const tbody = document.getElementById('supplier-quarantine-table-body');
      if (!tbody || tbody.dataset.bound === '1') return;
      tbody.dataset.bound = '1';
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]'); if (!btn) return;
        if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
        const db = App.db.ensure();
        const id = btn.getAttribute('data-id');
        const rec = (db.supplierQuarantine || []).find(x => String(x.id) === String(id));
        if (!rec || rec.status !== 'In quarantena') return;
        const order = (db.supplierOrders || []).find(o => String(o.id) === String(rec.orderId) || String(o.number) === String(rec.orderNumber));
        const line = (order?.lines || []).find(l => String(l.productId || '') === String(rec.productId || '')) || (order?.lines || []).find(l => String(l.productName || l.description || '') === String(rec.description || ''));
        const action = btn.getAttribute('data-action');
        const isRelease = action === 'release-q';
        const isReturn = action === 'return-q';
        const isDestroy = action === 'destroy-q';
        const actionLabel = isRelease ? 'svincolare' : (isReturn ? 'rendere al fornitore' : 'marcare come da distruggere');
        if (!confirm(`Vuoi ${actionLabel} ${rec.qty} pz di ${rec.description}?`)) return;
        let closingNote = String(rec.note || '').trim();
        if (isReturn || isDestroy) {
          const entered = prompt(`Inserisci la motivazione per ${isReturn ? 'il reso al fornitore' : 'la distruzione'}:`, closingNote || '');
          if (entered === null) return;
          closingNote = String(entered || '').trim();
          if (!closingNote) {
            return App.ui.showToast('Inserisci una motivazione per chiudere la quarantena.', 'warning');
          }
        }
        try {
          adjustQuarantineBatch([{ productId: rec.productId, delta: -Number(rec.qty || 0) }], { reason: isRelease ? 'SVINCOLO_QUARANTENA' : (isReturn ? 'RESO_DA_QUARANTENA' : 'DISTRUZIONE_DA_QUARANTENA'), ref: rec.ddtNumber });
          if (isRelease) {
            adjustStockBatch([{ productId: rec.productId, delta: Number(rec.qty || 0) }], { reason: 'SVINCOLO_QUARANTENA', ref: rec.ddtNumber });
          }
        } catch (err) {
          return App.ui.showToast(err.message || 'Errore aggiornamento quarantena', 'danger');
        }
        if (line) {
          line.quarantineQty = Math.max(0, Number(line.quarantineQty || 0) - Number(rec.qty || 0));
          if (isRelease) line.receivedQty = Number(line.receivedQty || 0) + Number(rec.qty || 0);
        }
        if (isReturn) {
          db.supplierReturnDDTs = Array.isArray(db.supplierReturnDDTs) ? db.supplierReturnDDTs : [];
          const returnNumber = App.utils.nextSupplierReturnDDTNumber(db);
          const returnDoc = {
            id: App.utils.uuid(),
            number: returnNumber,
            date: App.utils.todayISO(),
            supplierId: rec.supplierId,
            supplierName: rec.supplierName,
            sourceOrderId: rec.orderId,
            sourceOrderNumber: rec.orderNumber,
            sourceDdtId: rec.ddtId,
            sourceDdtNumber: rec.ddtNumber,
            status: 'Reso al fornitore',
            notes: closingNote,
            lines: [{
              productId: rec.productId,
              productName: rec.description,
              description: rec.description,
              qty: Number(rec.qty || 0),
              reason: closingNote
            }]
          };
          db.supplierReturnDDTs.push(returnDoc);
          rec.returnDdtNumber = returnNumber;
        }
        rec.note = closingNote || rec.note || '';
        rec.status = isRelease ? 'Svincolata' : (isReturn ? 'Resa al fornitore' : 'Da distruggere');
        rec.resolvedAt = App.utils.todayISO();
        rec.resolutionType = isRelease ? 'release' : (isReturn ? 'return' : 'destroy');
        if (order) recomputeSupplierOrderStatus(order);
        App.db.save(db);
        this.renderOrders();
        this.renderQuarantine();
        this.renderReturnDDTs();
        App.ui.showToast(
          isRelease ? 'Merce svincolata e caricata a magazzino.' : (isReturn ? `Creato ${rec.returnDdtNumber || 'DDT di reso'} e rimossa la merce dalla quarantena.` : 'Merce marcata come da distruggere e rimossa dalla quarantena.'),
          'success'
        );
      });
    },

    init() {
      if (this._initDone) return;
      this._initDone = true;

      const refreshSection = (sid) => {
        if (!sid) return;
        if (sid === 'nuovo-ordine-fornitore') {
          try { this.initNewOrderForm(); } catch {}
        }
        if (sid === 'elenco-ordini-fornitore') this.renderOrders();
        if (sid === 'nuovo-ddt-fornitore') {
          try { this.initNewSupplierDDT(); } catch {}
        }
        if (sid === 'elenco-ddt-fornitore') this.renderDDTs();
        if (sid === 'quarantena-fornitori') this.renderQuarantine();
        if (sid === 'elenco-resi-fornitore') this.renderReturnDDTs();
      };

      App.events.on('logged-in', () => {
        this.renderOrders();
        this.wireOrderDetail();
        this.initNewOrderForm();
        this.initNewSupplierDDT();
        this.renderDDTs();
        this.wireSupplierDDTDetail();
        this.renderQuarantine();
        this.wireQuarantine();
        this.renderReturnDDTs();
        this.wireSupplierReturnDetail();
      });

      App.events.on('db:changed', () => {
        const current = document.querySelector('.content-section:not(.d-none)')?.id;
        refreshSection(current);
      });
      App.events.on('section:changed', refreshSection);
    }
  };

  // Global hook for overlay/patch compatibility
  window.renderSupplierOrdersTable = () => Fornitori.renderOrders();


export function initAcquistiFeature() {
  Fornitori.init();
  App.Fornitori = Fornitori;
}
