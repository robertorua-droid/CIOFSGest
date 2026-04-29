/* acquisti/index.js - ordini fornitore, DDT in entrata (MODULARE) */
import { App } from '../../core/app.js';
import { applyQuarantineBatch, applyStockBatch, validateQuarantineBatch, validateStockBatch } from '../../domain/inventory.rules.js';
import {
  applyQuarantineResolutionToOrder,
  applySupplierReceiptToOrder,
  buildQuarantineHistoryRecords,
  buildSupplierDDT,
  buildSupplierOrder,
  buildSupplierQuarantineRecords,
  buildSupplierReturnFromQuarantine,
  getSupplierDDTRestoreChanges,
  getSupplierOrderResidual,
  getSupplierReceiptInventoryChanges,
  lineOutcomeLabel,
  rollbackSupplierDDT
} from '../../domain/purchasing.service.js';
import { canDeleteDocuments } from '../../domain/permissions.service.js';
import { renderSupplierOrdersTable } from './orders.ui.js';
import { renderSupplierDDTsTable, renderSupplierReturnDDTsTable } from './ddts.ui.js';
import { renderSupplierQuarantineTables } from './quarantine.ui.js';
import { getJsPDFConstructor } from '../../printing/common.print.js';
import { printSupplierReturnPdf } from '../../printing/purchasing.print.js';
const canDeleteDocs = () => canDeleteDocuments(App.currentUser);
const h = value => App.utils.escapeHtml(value);

const supplierReturnHtml = (ret) => {
  const statusBadge = ret.status === 'Spedito al fornitore'
    ? '<span class="badge bg-success">Spedito al fornitore</span>'
    : '<span class="badge bg-warning text-dark">Preparato</span>';
  let html = `<div class="row g-3 mb-3">`;
  html += `<div class="col-md-6"><div><strong>Fornitore:</strong> ${h(ret.supplierName || '')}</div><div><strong>Data reso:</strong> ${h(ret.date || '')}</div><div><strong>Numero reso:</strong> ${h(ret.number || '')}</div></div>`;
  html += `<div class="col-md-6"><div><strong>Rif. Ordine:</strong> ${h(ret.sourceOrderNumber || '')}</div><div><strong>Rif. DDT origine:</strong> ${h(ret.sourceDdtNumber || '')}</div><div><strong>Stato:</strong> ${statusBadge}</div></div>`;
  html += `</div>`;
  html += `<div class="row g-3 mb-3">`;
  html += `<div class="col-md-6"><label class="form-label">Causale reso</label><input class="form-control" id="supplier-return-cause" value="${h(ret.returnReason || 'Reso da quarantena')}"></div>`;
  html += `<div class="col-md-3"><label class="form-label">Numero colli</label><input class="form-control" id="supplier-return-packages" type="number" min="1" value="${Number(ret.packageCount || 1)}"></div>`;
  html += `<div class="col-md-3"><label class="form-label">Vettore</label><input class="form-control" id="supplier-return-carrier" value="${h(ret.carrier || '')}" placeholder="Es. Trasporti Rossi"></div>`;
  html += `</div>`;
  html += `<div class="mb-3"><label class="form-label">Note di trasporto / annotazioni</label><textarea class="form-control" id="supplier-return-transport-notes" rows="3" placeholder="Es. reso per difetto riscontrato in controllo qualità">${h(ret.transportNotes || ret.notes || '')}</textarea></div>`;
  if (ret.shippedAt) {
    html += `<div class="mb-3 text-success"><strong>Spedito il:</strong> ${h(ret.shippedAt)}</div>`;
  }
  html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà resa</th><th>Motivazione</th></tr></thead><tbody>`;
  (ret.lines || []).forEach(l => {
    html += `<tr><td>${h(l.description || l.productName || '')}</td><td class="text-end">${l.qty || 0}</td><td>${h(l.reason || ret.notes || '—')}</td></tr>`;
  });
  html += `</tbody></table>`;
  return html;
};

const readSupplierReturnMetaFromDetail = () => ({
  returnReason: document.getElementById('supplier-return-cause')?.value?.trim() || 'Reso da quarantena',
  packageCount: Math.max(1, Number(document.getElementById('supplier-return-packages')?.value || 1)),
  carrier: document.getElementById('supplier-return-carrier')?.value?.trim() || '',
  transportNotes: document.getElementById('supplier-return-transport-notes')?.value?.trim() || ''
});

const Fornitori = {
    renderOrders() {
      const db = App.db.ensure();
      renderSupplierOrdersTable({
        db,
        tbody: document.getElementById('supplier-orders-table-body'),
        canDelete: canDeleteDocs(),
        h,
        fmtMoney: App.utils.fmtMoney
      });
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
        supSel.innerHTML = (curDb.suppliers || []).map(s => `<option value="${h(s.id)}">${h(s.name)}</option>`).join('');
        prodSel.innerHTML = (curDb.products || []).map(p => `<option value="${h(p.id)}" data-price="${Number(p.purchasePrice||0)}">${h(p.code)} - ${h(p.description)}</option>`).join('');
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
            <td>${h(r.productName)}</td>
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
        const order = buildSupplierOrder({
          id: App.utils.uuid(),
          number: finalOrderNumber,
          date: dateEl.value,
          supplier: sup,
          lines: tmp
        });
        App.db.mutate('purchasing:create-supplier-order', currentDb => {
          currentDb.supplierOrders = currentDb.supplierOrders || [];
          currentDb.supplierOrders.push(order);
          return { orderNumber: order.number };
        });
        db = App.db.ensure();
        numEl.value = finalOrderNumber;
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
        App.db.mutate('purchasing:delete-supplier-order', currentDb => {
          const idx = (currentDb.supplierOrders || []).findIndex(x => x.number === order.number);
          if (idx >= 0) currentDb.supplierOrders.splice(idx, 1);
          return { orderNumber: order.number };
        });
        db = App.db.ensure();
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
        if (title) title.textContent = `Dettaglio Ordine Fornitore ${h(o.number)}`;

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
          const resid = getSupplierOrderResidual(l);
          const price = Number(l.price || 0);
          html += `<tr>
            <td>${h(l.productName || l.description || '')}</td>
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

        try {
          App.db.mutate('purchasing:delete-supplier-ddt', currentDb => {
            const liveDDT = (currentDb.supplierDDTs || []).find(x => x.number === num);
            if (!liveDDT) return { ddtNumber: num, deleted: false };
            const order = (currentDb.supplierOrders || []).find(o => o.number === liveDDT.orderNumber);
            rollbackSupplierDDT(order, liveDDT);
            const { stockChanges, quarantineChanges } = getSupplierDDTRestoreChanges(currentDb, liveDDT);
            if (stockChanges.length) {
              validateStockBatch(currentDb, stockChanges);
              applyStockBatch(currentDb, stockChanges);
            }
            if (quarantineChanges.length) {
              validateQuarantineBatch(currentDb, quarantineChanges);
              applyQuarantineBatch(currentDb, quarantineChanges);
            }
            currentDb.supplierQuarantine = (currentDb.supplierQuarantine || []).filter(q => String(q.ddtNumber || '') !== String(num));
            const idx = (currentDb.supplierDDTs || []).findIndex(x => x.number === num);
            if (idx >= 0) currentDb.supplierDDTs.splice(idx, 1);
            return { ddtNumber: num, deleted: idx >= 0 };
          });
          db = App.db.ensure();
        } catch (err) {
          return App.ui.showToast((err && err.message) ? err.message : 'Ripristino magazzino non completato', 'warning');
        }
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
        if (title) title.textContent = `Dettaglio DDT Fornitore ${h(d.number)}`;

        const dest = d.customerName || (db.company?.name || 'Nostra Sede');

        let html = `<div class="mb-2"><strong>Fornitore:</strong> ${h(d.supplierName || '')}</div>`;
        html += `<div class="mb-2"><strong>Data:</strong> ${h(d.date || '')}</div>`;
        html += `<div class="mb-2"><strong>Destinazione:</strong> ${h(dest)}</div>`;
        html += `<div class="mb-3"><strong>Riferimento Ordine:</strong> ${h(d.orderNumber || '')}</div>`;
        html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà gestita</th><th class="text-end">Accettata</th><th class="text-end">Riserva</th><th class="text-end">Respinta</th><th>Esito</th><th>Motivazione</th><th class="text-end">Prezzo</th></tr></thead><tbody>`;
        (d.lines || []).forEach(l => {
          html += `<tr><td>${h(l.description || '')}</td><td class="text-end">${l.qty || 0}</td><td class="text-end">${l.acceptedQty || 0}</td><td class="text-end">${l.reserveQty || 0}</td><td class="text-end">${l.refusedQty || 0}</td><td>${h(lineOutcomeLabel(l,d))}</td><td>${h(l.lineNotes || '—')}</td><td class="text-end">${App.utils.fmtMoney(l.price || 0)}</td></tr>`;
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
      renderSupplierDDTsTable({
        db,
        tbody: document.getElementById('supplier-ddts-table-body'),
        canDelete: canDeleteDocs(),
        h
      });
    },

    renderReturnDDTs() {
      const db = App.db.ensure();
      renderSupplierReturnDDTsTable({
        db,
        tbody: document.getElementById('supplier-return-ddts-table-body'),
        h
      });
    },

    wireSupplierReturnDetail() {
      let db = App.db.ensure();
      let currentReturnNumber = null;
      App.events.on('db:changed', d => { db = d; });
      const tbody = document.getElementById('supplier-return-ddts-table-body');
      const saveBtn = document.getElementById('save-supplier-return-meta-btn');
      const markBtn = document.getElementById('mark-supplier-return-shipped-btn');
      const printBtn = document.getElementById('print-supplier-return-pdf-btn');
      const renderDetail = (ret) => {
        const title = document.getElementById('supplierReturnDetailModalTitle');
        const body = document.getElementById('supplierReturnDetailModalBody');
        if (title) title.textContent = `Dettaglio Reso Fornitore ${ret.number}`;
        if (body) body.innerHTML = supplierReturnHtml(ret);
        if (markBtn) {
          markBtn.disabled = ret.status === 'Spedito al fornitore';
        }
        if (printBtn) printBtn.onclick = () => {
          const live = (App.db.ensure().supplierReturnDDTs || []).find(x => x.number === ret.number) || ret;
          Object.assign(live, readSupplierReturnMetaFromDetail());
          printSupplierReturnPdf({ ret: live, db: App.db.ensure(), jsPDFCtor: getJsPDFConstructor() });
        };
      };
      if (!tbody || tbody.dataset.wiredDetail === '1') return;
      tbody.dataset.wiredDetail = '1';
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action="view-supplier-return"]'); if (!btn) return;
        const num = btn.getAttribute('data-num');
        const ret = (db.supplierReturnDDTs || []).find(x => x.number === num);
        if (!ret) return;
        currentReturnNumber = ret.number;
        renderDetail(ret);
        try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierReturnDetailModal')).show(); } catch {}
      });
      if (saveBtn && saveBtn.dataset.bound !== '1') {
        saveBtn.dataset.bound = '1';
        saveBtn.addEventListener('click', () => {
          if (!currentReturnNumber) return;
          let updatedReturn = null;
          App.db.mutate('purchasing:update-supplier-return-meta', currentDb => {
            const ret = (currentDb.supplierReturnDDTs || []).find(x => x.number === currentReturnNumber);
            if (!ret) return null;
            Object.assign(ret, readSupplierReturnMetaFromDetail());
            updatedReturn = ret;
            return { returnNumber: ret.number };
          });
          db = App.db.ensure();
          if (!updatedReturn) return;
          this.renderReturnDDTs();
          renderDetail(updatedReturn);
          App.ui.showToast('Dati del reso salvati.', 'success');
        });
      }
      if (markBtn && markBtn.dataset.bound !== '1') {
        markBtn.dataset.bound = '1';
        markBtn.addEventListener('click', () => {
          if (!currentReturnNumber) return;
          let updatedReturn = null;
          App.db.mutate('purchasing:mark-supplier-return-shipped', currentDb => {
            const ret = (currentDb.supplierReturnDDTs || []).find(x => x.number === currentReturnNumber);
            if (!ret) return null;
            if (ret.status === 'Spedito al fornitore') return { alreadyShipped: true };
            Object.assign(ret, readSupplierReturnMetaFromDetail());
            ret.status = 'Spedito al fornitore';
            ret.shippedAt = App.utils.todayISO();
            updatedReturn = ret;
            return { returnNumber: ret.number };
          });
          db = App.db.ensure();
          if (!updatedReturn) return App.ui.showToast('Il reso è già segnato come spedito.', 'info');
          this.renderReturnDDTs();
          renderDetail(updatedReturn);
          App.ui.showToast('Reso segnato come spedito al fornitore.', 'success');
        });
      }
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
          + openOrders.map(o => `<option value="${h(o.number)}">${h(o.number)} - ${h(o.supplierName)}</option>`).join('');
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

        const rows = order.lines.map((l,i) => {
          const residual = getSupplierOrderResidual(l);
          if (residual <= 0) return '';
          return `<tr data-i="${i}">
            <td>${h(l.productName)}</td>
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
          const residual = getSupplierOrderResidual(l);
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

        const generalNotes = (notesEl?.value || '').trim();
        try {
          App.db.mutate('purchasing:create-supplier-ddt', currentDb => {
          const currentOrder = (currentDb.supplierOrders || []).find(o => o.number === number);
          if (!currentOrder) throw new Error('Ordine non trovato.');
          const { stockChanges, quarantineChanges } = getSupplierReceiptInventoryChanges(currentOrder, handledLines);
          if (stockChanges.length) {
            validateStockBatch(currentDb, stockChanges);
            applyStockBatch(currentDb, stockChanges);
          }
          if (quarantineChanges.length) {
            validateQuarantineBatch(currentDb, quarantineChanges);
            applyQuarantineBatch(currentDb, quarantineChanges);
          }
          applySupplierReceiptToOrder(currentOrder, handledLines);
          const newDDT = buildSupplierDDT({
            id: App.utils.uuid(),
            number: ddtNum.value,
            date: ddtDate.value,
            order: currentOrder,
            handledLines,
            notes: generalNotes
          });
          currentDb.supplierDDTs = currentDb.supplierDDTs || [];
          currentDb.supplierQuarantine = currentDb.supplierQuarantine || [];
          currentDb.supplierDDTs.push(newDDT);
          currentDb.supplierQuarantine.push(...buildSupplierQuarantineRecords({
            uuid: App.utils.uuid,
            date: ddtDate.value,
            order: currentOrder,
            ddt: newDDT,
            handledLines,
            notes: generalNotes
          }));
          return { ddtNumber: newDDT.number, orderNumber: currentOrder.number };
          });
          db = App.db.ensure();
        } catch (err) {
          return App.ui.showToast(err.message || 'Errore aggiornamento magazzino', 'danger');
        }
        App.ui.showToast('DDT fornitore registrato', 'success');
        Fornitori.renderOrders();
        Fornitori.renderDDTs();
        App.ui.showSection('elenco-ddt-fornitore');
      });
    },



    renderQuarantine() {
      const db = App.db.ensure();
      renderSupplierQuarantineTables({
        db,
        tbody: document.getElementById('supplier-quarantine-table-body'),
        histBody: document.getElementById('supplier-quarantine-history-table-body'),
        canManage: canDeleteDocs(),
        h
      });
    },

    openQuarantineManageModal(rec) {
      const modalEl = document.getElementById('supplierQuarantineManageModal');
      if (!modalEl || !rec) return;
      this._quarantineManageId = rec.id;
      document.getElementById('supplierQuarantineManageModalTitle').textContent = `Gestisci quantità quarantena - ${h(rec.description || '')}`;
      document.getElementById('supplierQuarantineManageMeta').innerHTML = `
        <div><strong>Fornitore:</strong> ${h(rec.supplierName || '')}</div>
        <div><strong>Ordine:</strong> ${h(rec.orderNumber || '')} &nbsp; <strong>DDT origine:</strong> ${h(rec.ddtNumber || '')}</div>
      `;
      document.getElementById('quarantine-total-qty').value = Number(rec.qty || 0);
      document.getElementById('quarantine-release-qty').value = 0;
      document.getElementById('quarantine-return-qty').value = 0;
      document.getElementById('quarantine-destroy-qty').value = 0;
      document.getElementById('quarantine-resolution-note').value = String(rec.note || '');
      this.updateQuarantineManageCheck();
      try { bootstrap.Modal.getOrCreateInstance(modalEl).show(); } catch {}
    },

    updateQuarantineManageCheck() {
      const total = Number(document.getElementById('quarantine-total-qty')?.value || 0);
      const releaseQty = Math.max(0, Number(document.getElementById('quarantine-release-qty')?.value || 0));
      const returnQty = Math.max(0, Number(document.getElementById('quarantine-return-qty')?.value || 0));
      const destroyQty = Math.max(0, Number(document.getElementById('quarantine-destroy-qty')?.value || 0));
      const sum = releaseQty + returnQty + destroyQty;
      const label = document.getElementById('quarantine-sum-check');
      const help = document.getElementById('quarantine-sum-help');
      if (label) {
        label.textContent = `${sum} / ${total}`;
        label.className = sum === total ? 'text-success' : 'text-danger';
      }
      if (help) {
        help.textContent = sum === total
          ? 'La somma è corretta. Puoi confermare la gestione della quarantena.'
          : 'La somma di svincolo + reso + distruzione deve coincidere con la quantità in quarantena.';
      }
      return { total, releaseQty, returnQty, destroyQty, sum };
    },

    processQuarantineManage() {
      if (!canDeleteDocs()) return App.ui.showToast('Permesso negato: serve ruolo Supervisor.', 'warning');
      let db = App.db.ensure();
      const id = this._quarantineManageId;
      const rec = (db.supplierQuarantine || []).find(x => String(x.id) === String(id));
      if (!rec || rec.status !== 'In quarantena') return App.ui.showToast('Riga di quarantena non più disponibile.', 'warning');
      const { total, releaseQty, returnQty, destroyQty, sum } = this.updateQuarantineManageCheck();
      if (sum !== total) return App.ui.showToast('La somma delle quantità deve coincidere con la quantità in quarantena.', 'warning');
      if (total <= 0) return App.ui.showToast('Quantità in quarantena non valida.', 'warning');
      const note = String(document.getElementById('quarantine-resolution-note')?.value || '').trim();
      if ((returnQty > 0 || destroyQty > 0) && !note) return App.ui.showToast('Inserisci una motivazione finale per reso o distruzione.', 'warning');
      if (!confirm(`Confermi la gestione della quarantena?

Svincolo: ${releaseQty}
Reso: ${returnQty}
Distruzione: ${destroyQty}`)) return;
      let returnNumber = null;
      try {
        App.db.mutate('purchasing:resolve-quarantine', currentDb => {
          const liveRec = (currentDb.supplierQuarantine || []).find(x => String(x.id) === String(rec.id));
          if (!liveRec) throw new Error('Riga di quarantena non più disponibile.');
          validateQuarantineBatch(currentDb, [{ productId: liveRec.productId, delta: -Number(total || 0) }]);
          applyQuarantineBatch(currentDb, [{ productId: liveRec.productId, delta: -Number(total || 0) }]);
          if (releaseQty > 0) {
            validateStockBatch(currentDb, [{ productId: liveRec.productId, delta: Number(releaseQty || 0) }]);
            applyStockBatch(currentDb, [{ productId: liveRec.productId, delta: Number(releaseQty || 0) }]);
          }
          const order = (currentDb.supplierOrders || []).find(o => String(o.id) === String(liveRec.orderId) || String(o.number) === String(liveRec.orderNumber));
          applyQuarantineResolutionToOrder(order, liveRec, { total, releaseQty });
          if (returnQty > 0) {
            currentDb.supplierReturnDDTs = Array.isArray(currentDb.supplierReturnDDTs) ? currentDb.supplierReturnDDTs : [];
            returnNumber = App.utils.nextSupplierReturnDDTNumber(currentDb);
            currentDb.supplierReturnDDTs.push(buildSupplierReturnFromQuarantine({
              id: App.utils.uuid(),
              number: returnNumber,
              date: App.utils.todayISO(),
              rec: liveRec,
              qty: returnQty,
              note
            }));
          }
          currentDb.supplierQuarantine = currentDb.supplierQuarantine || [];
          currentDb.supplierQuarantine.push(...buildQuarantineHistoryRecords({
          uuid: App.utils.uuid,
          today: App.utils.todayISO(),
            rec: liveRec,
            note,
            releaseQty,
            returnQty,
            destroyQty,
            returnDdtNumber: returnNumber
          }));
          currentDb.supplierQuarantine = currentDb.supplierQuarantine.filter(x => String(x.id) !== String(liveRec.id));
          return { quarantineId: liveRec.id, returnDdtNumber: returnNumber };
        });
        db = App.db.ensure();
      } catch (err) {
        return App.ui.showToast(err.message || 'Errore aggiornamento quarantena', 'danger');
      }
      try { bootstrap.Modal.getOrCreateInstance(document.getElementById('supplierQuarantineManageModal')).hide(); } catch {}
      this.renderOrders();
      this.renderQuarantine();
      this.renderReturnDDTs();
      App.ui.showToast('Quarantena gestita correttamente.', 'success');
    },

    wireQuarantineManageModal() {
      const modalEl = document.getElementById('supplierQuarantineManageModal');
      if (!modalEl || modalEl.dataset.bound === '1') return;
      modalEl.dataset.bound = '1';
      ['quarantine-release-qty', 'quarantine-return-qty', 'quarantine-destroy-qty'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', () => this.updateQuarantineManageCheck());
      });
      document.getElementById('confirm-quarantine-manage-btn')?.addEventListener('click', () => this.processQuarantineManage());
      modalEl.addEventListener('hidden.bs.modal', () => { this._quarantineManageId = null; });
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
        if (btn.getAttribute('data-action') === 'manage-q') {
          this.openQuarantineManageModal(rec);
        }
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
        if (sid === 'elenco-ddt-fornitore') {
          this.renderDDTs();
          this.renderReturnDDTs();
        }
        if (sid === 'quarantena-fornitori') this.renderQuarantine();
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
