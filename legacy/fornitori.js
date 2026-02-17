/* fornitori.js - supplier orders and incoming DDT */
(function (global) {
  'use strict';
  const { App } = global;

  const Fornitori = {
    renderOrders() {
      const db = App.db.ensure();
      const tbody = document.getElementById('supplier-orders-table-body');
      if (!tbody) return;
      tbody.innerHTML = (db.supplierOrders || []).map(o => `
        <tr>
          <td>${o.number}</td>
          <td>${o.date}</td>
          <td>${o.supplierName}</td>
          <td class="text-end">${App.utils.fmtMoney(o.total || 0)}</td>
          <td>${o.status || 'Inviato'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-num="${o.number}">Visualizza</button>
          </td>
        </tr>
      `).join('');
    },

    initNewOrderForm() {
      const db = App.db.ensure();
      const form = document.getElementById('new-supplier-order-form');
      if (!form) return;
      const supSel = document.getElementById('order-supplier-select');
      const dateEl = document.getElementById('order-supplier-date');
      const numEl = document.getElementById('order-supplier-number');
      const prodSel = document.getElementById('order-supplier-product-select');
      const qtyEl = document.getElementById('order-supplier-product-qty');
      const priceEl = document.getElementById('order-supplier-product-price');
      const addBtn = document.getElementById('add-product-to-supplier-order-btn');
      const linesTbody = document.getElementById('supplier-order-lines-tbody');
      const totEl = document.getElementById('supplier-order-total');

      supSel.innerHTML = (db.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      prodSel.innerHTML = (db.products || []).map(p => `<option value="${p.id}" data-price="${p.purchasePrice||0}">${p.code} - ${p.description}</option>`).join('');
      dateEl.value = App.utils.todayISO();
      numEl.value = App.utils.nextSupplierOrderNumber(db);
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
        Fornitori.renderOrders();
        App.ui.showSection('elenco-ordini-fornitore');
      });
    },

    // DDT fornitore (merce in entrata)
    renderDDTs() {
      const db = App.db.ensure();
      const tbody = document.getElementById('supplier-ddts-table-body');
      if (!tbody) return;
      tbody.innerHTML = (db.supplierDDTs || []).map(d => `
        <tr>
          <td>${d.number}</td>
          <td>${d.date}</td>
          <td>${d.supplierName}</td>
          <td>${d.customerName || (db.company?.name || 'Nostra Sede')}</td>
          <td>${d.orderNumber}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="view-supplier-ddt" data-num="${d.number}">Dettaglio</button>
          </td>
        </tr>
      `).join('');
    },

    initNewSupplierDDT() {
      const db = App.db.ensure();
      const form = document.getElementById('new-supplier-ddt-form');
      if (!form) return;
      const selOrder = document.getElementById('ddt-supplier-order-select');
      const details = document.getElementById('ddt-supplier-details-section');
      const supName = document.getElementById('ddt-supplier-name');
      const ddtNum = document.getElementById('ddt-supplier-number');
      const ddtDate = document.getElementById('ddt-supplier-date');
      const tbody = document.getElementById('ddt-supplier-products-tbody');

      const openOrders = (db.supplierOrders || []).filter(o => (o.lines||[]).some(l => (l.receivedQty||0) < (l.qty||0)));
      selOrder.innerHTML = '<option selected disabled value="">Seleziona un ordine...</option>'
        + openOrders.map(o => `<option value="${o.number}">${o.number} - ${o.supplierName}</option>`).join('');

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

        recLines.forEach(s => {
          const line = order.lines[s.i];
          line.receivedQty = (line.receivedQty || 0) + s.qty;
          // stock increase
          const code = (line.productName||'').split(' - ')[0];
          const p = (db.products||[]).find(pp => pp.code === code) || (db.products||[]).find(pp => pp.id === line.productId);
          if (p) p.stockQty = (p.stockQty || 0) + s.qty;
        });
        const allReceived = order.lines.every(l => (l.receivedQty||0) >= (l.qty||0));
        const anyReceived = order.lines.some(l => (l.receivedQty||0) > 0 && (l.receivedQty||0) < (l.qty||0));
        order.status = allReceived ? 'Completato' : (anyReceived ? 'Parzialmente Ricevuto' : 'Inviato');

        // Create inbound DDT
        const newDDT = {
          number: ddtNum.value,
          date: ddtDate.value,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          orderNumber: order.number,
          lines: recLines.map(s => {
            const l = order.lines[s.i];
            return { description: l.productName, qty: s.qty, price: l.price };
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
      App.events.on('logged-in', () => {
        this.renderOrders();
        this.initNewOrderForm();
        this.initNewSupplierDDT();
        this.renderDDTs();
      });
    }
  };

  // Global hook for overlay/patch compatibility
  window.renderSupplierOrdersTable = () => Fornitori.renderOrders();

  document.addEventListener('DOMContentLoaded', () => Fornitori.init());
  App.Fornitori = Fornitori;

})(window);
