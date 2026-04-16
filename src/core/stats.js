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
        const shippedByProduct = {};
        (d.customerDDTs || []).forEach(ddt => {
          (ddt.lines || []).forEach(line => {
            const key = line.productCode || line.code || line.description || line.productName || 'N/D';
            shippedByProduct[key] = (shippedByProduct[key] || 0) + Number(line.qty || 0);
          });
        });

        const receivedByProduct = {};
        (d.supplierDDTs || []).forEach(ddt => {
          if (ddt.rejected) return;
          (ddt.lines || []).forEach(line => {
            const key = line.productCode || line.code || line.description || line.productName || 'N/D';
            receivedByProduct[key] = (receivedByProduct[key] || 0) + Number(line.qty || 0);
          });
        });

        const topOut = Object.entries(shippedByProduct)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const topIn = Object.entries(receivedByProduct)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const fallbackLow = (d.products || [])
          .slice()
          .sort((a, b) => Number(a.stockQty || 0) - Number(b.stockQty || 0))
          .slice(0, 5)
          .map(p => [p.code || p.description || 'N/D', Number(p.stockQty || 0)]);

        const labels1 = (topOut.length ? topOut : fallbackLow).map(([label]) => label);
        const data1 = (topOut.length ? topOut : fallbackLow).map(([, qty]) => qty);
        const labels2 = (topIn.length ? topIn : fallbackLow).map(([label]) => label);
        const data2 = (topIn.length ? topIn : fallbackLow).map(([, qty]) => qty);

        const ch1 = new Chart(ctx1, {
          type: 'bar',
          data: { labels: labels1, datasets: [{ label: topOut.length ? 'Qtà spedita' : 'Giacenza', data: data1 }] },
          options: { plugins: { legend: { display: false } } }
        });
        const ch2 = new Chart(ctx2, {
          type: 'bar',
          data: { labels: labels2, datasets: [{ label: topIn.length ? 'Qtà ricevuta' : 'Giacenza', data: data2 }] },
          options: { plugins: { legend: { display: false } } }
        });

        charts.push(ch1, ch2);
        document.getElementById('chart1Title').textContent = topOut.length
          ? 'Prodotti più movimentati in uscita'
          : 'Prodotti con giacenza più bassa';
        document.getElementById('chart2Title').textContent = topIn.length
          ? 'Prodotti più movimentati in entrata'
          : 'Prodotti con giacenza più bassa';
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
