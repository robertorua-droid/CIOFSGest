function monthKey(dstr) {
  return (dstr || '').slice(0, 7);
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
        const prods = (d.products || []).slice();
        const top = prods.sort((a, b) => (b.stockQty || 0) - (a.stockQty || 0)).slice(0, 5);
        const labels1 = top.map(p => p.code);
        const data1 = top.map(p => p.stockQty || 0);

        const low = prods.filter(p => (p.stockQty || 0) < 50).sort((a, b) => (a.stockQty || 0) - (b.stockQty || 0)).slice(0, 5);
        const labels2 = low.map(p => p.code);
        const data2 = low.map(p => p.stockQty || 0);

        const ch1 = new Chart(ctx1, {
          type: 'bar',
          data: { labels: labels1, datasets: [{ label: 'Giacenza', data: data1 }] },
          options: { plugins: { legend: { display: false } } }
        });
        const ch2 = new Chart(ctx2, {
          type: 'pie',
          data: { labels: labels2, datasets: [{ data: data2 }] }
        });

        charts.push(ch1, ch2);
        document.getElementById('chart1Title').textContent = 'Top 5 Prodotti per Giacenza';
        document.getElementById('chart2Title').textContent = 'Top 5 in esaurimento (< 50 pz)';
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

      // keep reference on global App for destroy on next render
      window.App._charts = charts;
    }
  };
}
