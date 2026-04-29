function monthKey(dstr) {
  return (dstr || '').slice(0, 7);
}

function ensureQualityStatsContainers() {
  const section = document.getElementById('statistiche');
  if (!section) return { rejectedBody: null, reserveBody: null, rejectedPct: null, reservePct: null, rejectedCount: null, reserveCount: null };

  let wrap = document.getElementById('quality-stats-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'quality-stats-wrap';
    wrap.className = 'mt-4';
    wrap.innerHTML = `
      <div class="row">
        <div class="col-lg-6 mb-4">
          <div class="card h-100">
            <div class="card-header">Ordini Respinti</div>
            <div class="card-body">
              <p class="mb-1"><strong>Percentuale ordini con almeno una riga respinta:</strong> <span id="stats-rejected-pct">0%</span></p>
              <p class="text-muted mb-3">Ordini coinvolti: <span id="stats-rejected-count">0 / 0</span></p>
              <div class="table-responsive">
                <table class="table table-sm table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Fornitore</th>
                      <th>Ordine</th>
                      <th>DDT</th>
                      <th>Prodotto</th>
                      <th>Q.tà respinta</th>
                      <th>Motivazione</th>
                    </tr>
                  </thead>
                  <tbody id="stats-rejected-body"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-6 mb-4">
          <div class="card h-100">
            <div class="card-header">Ordini con Riserva</div>
            <div class="card-body">
              <p class="mb-1"><strong>Percentuale ordini con almeno una riga ricevuta con riserva:</strong> <span id="stats-reserve-pct">0%</span></p>
              <p class="text-muted mb-3">Ordini coinvolti: <span id="stats-reserve-count">0 / 0</span></p>
              <div class="table-responsive">
                <table class="table table-sm table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Fornitore</th>
                      <th>Ordine</th>
                      <th>DDT</th>
                      <th>Prodotto</th>
                      <th>Q.tà con riserva</th>
                      <th>Motivazione</th>
                    </tr>
                  </thead>
                  <tbody id="stats-reserve-body"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    section.appendChild(wrap);
  }

  return {
    rejectedBody: document.getElementById('stats-rejected-body'),
    reserveBody: document.getElementById('stats-reserve-body'),
    rejectedPct: document.getElementById('stats-rejected-pct'),
    reservePct: document.getElementById('stats-reserve-pct'),
    rejectedCount: document.getElementById('stats-rejected-count'),
    reserveCount: document.getElementById('stats-reserve-count')
  };
}

function lineAcceptedQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.acceptedQty || 0);
  return ddt?.refused ? 0 : (ddt?.withReserve ? 0 : Number(line?.qty || 0));
}
function lineReserveQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.reserveQty || 0);
  return ddt?.withReserve ? Number(line?.qty || 0) : 0;
}
function lineRefusedQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.refusedQty || 0);
  return ddt?.refused ? Number(line?.qty || 0) : 0;
}

function renderSupplierQualityStats(d) {
  const ui = ensureQualityStatsContainers();
  if (!ui.rejectedBody || !ui.reserveBody) return;

  const orders = d.supplierOrders || [];
  const ddts = d.supplierDDTs || [];
  const totalOrders = orders.length;

  const rejectedRows = [];
  const reserveRows = [];
  const rejectedOrders = new Set();
  const reserveOrders = new Set();

  ddts.forEach(ddt => {
    (ddt.lines || []).forEach(line => {
      const refusedQty = lineRefusedQty(line, ddt);
      const reserveQty = lineReserveQty(line, ddt);
      const note = (line?.lineNotes || ddt?.notes || '').trim();
      const product = line?.description || line?.productName || line?.code || line?.productId || '-';
      const common = {
        supplierName: ddt?.supplierName || '-',
        orderNumber: ddt?.orderNumber || '-',
        ddtNumber: ddt?.number || '-',
        product,
        note: note || '—',
        date: ddt?.date || ''
      };
      if (refusedQty > 0) {
        rejectedOrders.add(ddt?.orderNumber || `__ddt_${ddt?.number || Math.random()}`);
        rejectedRows.push({ ...common, qty: refusedQty });
      }
      if (reserveQty > 0) {
        reserveOrders.add(ddt?.orderNumber || `__ddt_${ddt?.number || Math.random()}`);
        reserveRows.push({ ...common, qty: reserveQty });
      }
    });
  });

  const pct = (num, den) => den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '0%';
  ui.rejectedPct.textContent = pct(rejectedOrders.size, totalOrders);
  ui.reservePct.textContent = pct(reserveOrders.size, totalOrders);
  ui.rejectedCount.textContent = `${rejectedOrders.size} / ${totalOrders}`;
  ui.reserveCount.textContent = `${reserveOrders.size} / ${totalOrders}`;

  const sortRows = rows => rows.sort((a, b) => {
    const s = String(a.supplierName).localeCompare(String(b.supplierName));
    if (s !== 0) return s;
    const dcmp = String(a.date).localeCompare(String(b.date));
    if (dcmp !== 0) return dcmp;
    const ocmp = String(a.orderNumber).localeCompare(String(b.orderNumber));
    if (ocmp !== 0) return ocmp;
    return String(a.product).localeCompare(String(b.product));
  });

  const renderRows = (tbody, rows, qtyLabel) => {
    const ordered = sortRows(rows);
    tbody.innerHTML = ordered.length ? ordered.map(r => `
      <tr>
        <td>${r.supplierName}</td>
        <td>${r.orderNumber}</td>
        <td>${r.ddtNumber}</td>
        <td>${r.product}</td>
        <td>${r.qty}</td>
        <td>${r.note}</td>
      </tr>`).join('') : `<tr><td colspan="6" class="text-muted">Nessun ordine ${qtyLabel}.</td></tr>`;
  };

  renderRows(ui.rejectedBody, rejectedRows, 'respinto');
  renderRows(ui.reserveBody, reserveRows, 'con riserva');
}

export function createStats({ db, utils }) {
  return {
    renderForRole(user) {
      const ctx1 = document.getElementById('statChart1');
      const ctx2 = document.getElementById('statChart2');
      if (!ctx1 || !ctx2) return;

      const d = db.ensure();

      // destroy previous charts if any
      if (window.App?._charts) {
        window.App._charts.forEach(ch => { try { ch.destroy(); } catch {} });
      }
      const charts = [];
      if (user?.role === 'User') {
        // Statistiche di movimentazione magazzino per utenti User
        const inbound = {};
        const outbound = {};

        (d.supplierDDTs || []).forEach(ddt => {
          (ddt.lines || []).forEach(l => {
            const key = l.productId || l.description || 'N/D';
            inbound[key] = (inbound[key] || 0) + lineAcceptedQty(l, ddt) + lineReserveQty(l, ddt);
          });
        });
        (d.customerDDTs || []).forEach(ddt => {
          (ddt.lines || []).forEach(l => {
            const key = l.productId || l.description || 'N/D';
            outbound[key] = (outbound[key] || 0) + Number(l.qty || 0);
          });
        });

        const inboundTop = Object.entries(inbound).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const outboundTop = Object.entries(outbound).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const ch1 = new Chart(ctx1, {
          type: 'bar',
          data: { labels: inboundTop.map(x => x[0]), datasets: [{ label: 'Q.tà in entrata', data: inboundTop.map(x => x[1]) }] },
          options: { plugins: { legend: { display: false } } }
        });
        const ch2 = new Chart(ctx2, {
          type: 'bar',
          data: { labels: outboundTop.map(x => x[0]), datasets: [{ label: 'Q.tà in uscita', data: outboundTop.map(x => x[1]) }] },
          options: { plugins: { legend: { display: false } } }
        });

        charts.push(ch1, ch2);
        document.getElementById('chart1Title').textContent = 'Top 5 Prodotti movimentati in Entrata';
        document.getElementById('chart2Title').textContent = 'Top 5 Prodotti movimentati in Uscita';
      } else {
        const orders = d.customerOrders || [];
        const byMonth = {};
        orders.forEach(o => {
          const k = monthKey(o.date || utils.todayISO());
          byMonth[k] = (byMonth[k] || 0) + (o.total || 0);
        });
        const mkeys = Object.keys(byMonth).sort();
        const vals = mkeys.map(k => byMonth[k]);

        const byCust = {};
        orders.forEach(o => { byCust[o.customerName] = (byCust[o.customerName] || 0) + (o.total || 0); });
        const clabels = Object.keys(byCust);
        const cvals = clabels.map(k => byCust[k]);

        const ch1 = new Chart(ctx1, {
          type: 'line',
          data: { labels: mkeys, datasets: [{ label: '€ per mese', data: vals, tension: .3 }] },
          options: { plugins: { legend: { display: false } } }
        });
        const ch2 = new Chart(ctx2, {
          type: 'doughnut',
          data: { labels: clabels, datasets: [{ data: cvals }] }
        });

        charts.push(ch1, ch2);
        document.getElementById('chart1Title').textContent = 'Fatturato Ordini per Mese';
        document.getElementById('chart2Title').textContent = 'Valore Ordini per Cliente';
      }

      renderSupplierQualityStats(d);

      // keep reference on global App for destroy on next render
      window.App._charts = charts;
    }
  };
}
