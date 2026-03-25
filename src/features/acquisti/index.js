/* acquisti/index.js - ordini fornitore, DDT in entrata (MODULARE) */
import { App } from '../../core/app.js';
import { adjustStockBatch } from '../../domain/inventory.service.js';

  const canDeleteDocs = () => {
  const role = App.currentUser?.role || 'User';
  return role === 'Supervisor' || role === 'Admin';
};

const recomputeSupplierOrderStatus = (order) => {
  const lines = order?.lines || [];
  const allReceived = lines.length > 0 && lines.every(l => Number(l.receivedQty || 0) >= Number(l.qty || 0));
  const anyReceived = lines.some(l => Number(l.receivedQty || 0) > 0);
  order.status = allReceived ? 'Completato' : (anyReceived ? 'Parzialmente Ricevuto' : 'Inviato');
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
      numEl.value = App.utils.nextSupplierOrderNumber(db);
      App.db.save(db);

      const tmp = [];
      const resetForm = () => {
        // pulizia campi (evita che restino i dati precedenti)
        form.reset();
        tmp.splice(0);
        if (linesTbody) linesTbody.innerHTML = '';
        if (totEl) totEl.textContent = App.utils.fmtMoney(0);
        dateEl.value = App.utils.todayISO();
        // non forziamo un nuovo numero qui per evitare incrementi inutili: verrà aggiornato dopo il salvataggio
        if (!numEl.value) numEl.value = App.utils.nextSupplierOrderNumber(db);
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
        const order = {
          id: App.utils.uuid(),
          number: numEl.value,
          date: dateEl.value,
          supplierId: sup.id,
          supplierName: sup.name,
          lines: tmp.map(r=>({ ...r })),
          total: tmp.reduce((a,r)=>a+r.qty*r.price,0),
          status: 'Inviato'
        };
        db.supplierOrders.push(order);
        App.db.save(db);
        App.ui.showToast('Ordine fornitore salvato', 'success');
        tmp.splice(0); recalc();
        // precompila il prossimo numero e ripulisce i campi
        numEl.value = App.utils.nextSupplierOrderNumber(db);
        dateEl.value = App.utils.todayISO();
        if (qtyEl) qtyEl.value = '1';
        try { if (prodSel?.options?.length) prodSel.dispatchEvent(new Event('change')); } catch {}
        App.db.save(db);
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
          const resid = Math.max(0, qty - rec);
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
            if (line) line.receivedQty = Math.max(0, Number(line.receivedQty || 0) - Number(dl.qty || 0));
          });
          recomputeSupplierOrderStatus(order);
        }

        try {
          const restoreChanges = (ddt.lines || []).map(dl => {
            const pid = dl.productId || (db.products || []).find(pp => String(pp.description || '') === String(dl.description || ''))?.id;
            const q = Number(dl.qty || 0);
            return pid && q ? { productId: pid, delta: -q } : null;
          }).filter(Boolean);
          if (restoreChanges.length) {
            adjustStockBatch(restoreChanges, { reason: 'CANCELLA_DDT_FORNITORE', ref: ddt.number });
          }
        } catch (err) {
          return App.ui.showToast((err && err.message) ? err.message : 'Ripristino magazzino non completato', 'warning');
        }

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
        html += `<table class="table table-sm"><thead><tr><th>Descrizione</th><th class="text-end">Qtà</th><th class="text-end">Prezzo</th></tr></thead><tbody>`;
        (d.lines || []).forEach(l => {
          html += `<tr><td>${l.description || ''}</td><td class="text-end">${l.qty || 0}</td><td class="text-end">${App.utils.fmtMoney(l.price || 0)}</td></tr>`;
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

            const fillOpenOrders = () => {
        const curDb = App.db.ensure();
        const prev = selOrder.value;
        const openOrders = (curDb.supplierOrders || []).filter(o => (o.lines||[]).some(l => (l.receivedQty||0) < (l.qty||0)));
        selOrder.innerHTML = '<option selected disabled value="">Seleziona un ordine...</option>'
          + openOrders.map(o => `<option value="${o.number}">${o.number} - ${o.supplierName}</option>`).join('');
        if (prev) selOrder.value = prev;
      };
      fillOpenOrders();
      const resetDDTForm = () => {
        form.reset();
        if (details) details.classList.add('d-none');
        if (tbody) tbody.innerHTML = '';
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
          const residual = (l.qty || 0) - (l.receivedQty || 0);
          if (residual <= 0) return '';
          return `<tr data-i="${i}">
            <td>${l.productName}</td>
            <td class="text-end">${l.qty}</td>
            <td class="text-end">${residual}</td>
            <td class="text-end"><input type="number" min="0" max="${residual}" value="${residual}" class="form-control form-control-sm text-end ddt-rec-qty"></td>
          </tr>`;
        }).join('');
        tbody.innerHTML = rows;
        details.classList.remove('d-none');
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const number = selOrder.value;
        const order = (db.supplierOrders||[]).find(o => o.number === number);
        if (!order) return App.ui.showToast('Seleziona un ordine valido', 'warning');
        const recLines = [];
        tbody.querySelectorAll('tr').forEach(tr => {
          const i = parseInt(tr.getAttribute('data-i'), 10);
          const l = order.lines[i];
          const q = parseFloat(tr.querySelector('.ddt-rec-qty').value || '0');
          if (q > 0) recLines.push({ i, qty: q });
        });
        if (recLines.length === 0) return App.ui.showToast('Nessuna quantità da registrare.', 'warning');

        // Update stock (atomico)
        try {
          const changes = recLines.map(s => ({ productId: order.lines[s.i].productId, delta: s.qty }));
          adjustStockBatch(changes, { reason: 'DDT_FORNITORE', ref: ddtNum.value });
        } catch (err) {
          return App.ui.showToast(err.message || 'Errore aggiornamento magazzino', 'danger');
        }

        // Update order receivedQty
        recLines.forEach(s => {
          const line = order.lines[s.i];
          line.receivedQty = (line.receivedQty || 0) + s.qty;
        });
        recomputeSupplierOrderStatus(order);

        // Create inbound DDT
        const newDDT = {
          id: App.utils.uuid(),
          number: ddtNum.value,
          date: ddtDate.value,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          orderNumber: order.number,
          lines: recLines.map(s => {
            const l = order.lines[s.i];
            return { productId: l.productId, description: l.productName, qty: s.qty, price: l.price };
          })
        };
        db.supplierDDTs.push(newDDT);
        App.db.save(db);
        App.ui.showToast('Merce in entrata registrata', 'success');
        Fornitori.renderOrders();
        Fornitori.renderDDTs();
        App.ui.showSection('elenco-ddt-fornitore');
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
      };

      App.events.on('logged-in', () => {
        this.renderOrders();
        this.wireOrderDetail();
        this.initNewOrderForm();
        this.initNewSupplierDDT();
        this.renderDDTs();
        this.wireSupplierDDTDetail();
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
