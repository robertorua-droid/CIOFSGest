import {
  buildMovementStats,
  buildSalesStats,
  buildSupplierQualityStats
} from '../domain/stats.service.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
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

function renderQualityRows(tbody, rows, qtyLabel) {
  tbody.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${escapeHtml(r.supplierName)}</td>
      <td>${escapeHtml(r.orderNumber)}</td>
      <td>${escapeHtml(r.ddtNumber)}</td>
      <td>${escapeHtml(r.product)}</td>
      <td>${escapeHtml(r.qty)}</td>
      <td>${escapeHtml(r.note)}</td>
    </tr>`).join('') : `<tr><td colspan="6" class="text-muted">Nessun ordine ${qtyLabel}.</td></tr>`;
}

function renderSupplierQualityStats(d) {
  const ui = ensureQualityStatsContainers();
  if (!ui.rejectedBody || !ui.reserveBody) return;

  const stats = buildSupplierQualityStats(d);
  ui.rejectedPct.textContent = stats.rejectedPercent;
  ui.reservePct.textContent = stats.reservePercent;
  ui.rejectedCount.textContent = `${stats.rejectedOrdersCount} / ${stats.totalOrders}`;
  ui.reserveCount.textContent = `${stats.reserveOrdersCount} / ${stats.totalOrders}`;
  renderQualityRows(ui.rejectedBody, stats.rejectedRows, 'respinto');
  renderQualityRows(ui.reserveBody, stats.reserveRows, 'con riserva');
}

export function createStats({ db, utils }) {
  return {
    renderForRole(user) {
      const ctx1 = document.getElementById('statChart1');
      const ctx2 = document.getElementById('statChart2');
      if (!ctx1 || !ctx2) return;

      const d = db.ensure();

      if (window.App?._charts) {
        window.App._charts.forEach(ch => { try { ch.destroy(); } catch {} });
      }
      const charts = [];
      if (user?.role === 'User') {
        const { inboundTop, outboundTop } = buildMovementStats(d);
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
        const sales = buildSalesStats(d, utils.todayISO());
        const ch1 = new Chart(ctx1, {
          type: 'line',
          data: { labels: sales.months, datasets: [{ label: '€ per mese', data: sales.monthlyValues, tension: .3 }] },
          options: { plugins: { legend: { display: false } } }
        });
        const ch2 = new Chart(ctx2, {
          type: 'doughnut',
          data: { labels: sales.customers, datasets: [{ data: sales.customerValues }] }
        });

        charts.push(ch1, ch2);
        document.getElementById('chart1Title').textContent = 'Fatturato Ordini per Mese';
        document.getElementById('chart2Title').textContent = 'Valore Ordini per Cliente';
      }

      renderSupplierQualityStats(d);
      window.App._charts = charts;
    }
  };
}
