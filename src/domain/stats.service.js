export function monthKey(dstr) {
  return (dstr || '').slice(0, 7);
}

export function lineAcceptedQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.acceptedQty || 0);
  return ddt?.refused ? 0 : (ddt?.withReserve ? 0 : Number(line?.qty || 0));
}

export function lineReserveQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.reserveQty || 0);
  return ddt?.withReserve ? Number(line?.qty || 0) : 0;
}

export function lineRefusedQty(line, ddt = null) {
  if (line && ('acceptedQty' in line || 'reserveQty' in line || 'refusedQty' in line)) return Number(line?.refusedQty || 0);
  return ddt?.refused ? Number(line?.qty || 0) : 0;
}

function topEntries(map, limit = 5) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function buildMovementStats(db) {
  const inbound = {};
  const outbound = {};

  (db.supplierDDTs || []).forEach(ddt => {
    (ddt.lines || []).forEach(line => {
      const key = line.productId || line.description || 'N/D';
      inbound[key] = (inbound[key] || 0) + lineAcceptedQty(line, ddt) + lineReserveQty(line, ddt);
    });
  });

  (db.customerDDTs || []).forEach(ddt => {
    (ddt.lines || []).forEach(line => {
      const key = line.productId || line.description || 'N/D';
      outbound[key] = (outbound[key] || 0) + Number(line.qty || 0);
    });
  });

  return {
    inboundTop: topEntries(inbound),
    outboundTop: topEntries(outbound)
  };
}

export function buildSalesStats(db, todayISO = '') {
  const byMonth = {};
  const byCustomer = {};

  (db.customerOrders || []).forEach(order => {
    const k = monthKey(order.date || todayISO);
    byMonth[k] = (byMonth[k] || 0) + Number(order.total || 0);
    const customer = order.customerName || 'N/D';
    byCustomer[customer] = (byCustomer[customer] || 0) + Number(order.total || 0);
  });

  const months = Object.keys(byMonth).sort();
  const customers = Object.keys(byCustomer);
  return {
    months,
    monthlyValues: months.map(k => byMonth[k]),
    customers,
    customerValues: customers.map(k => byCustomer[k])
  };
}

export function percentText(num, den) {
  return den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '0%';
}

export function buildSupplierQualityStats(db) {
  const totalOrders = (db.supplierOrders || []).length;
  const rejectedRows = [];
  const reserveRows = [];
  const rejectedOrders = new Set();
  const reserveOrders = new Set();

  (db.supplierDDTs || []).forEach(ddt => {
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
        rejectedOrders.add(ddt?.orderNumber || `__ddt_${ddt?.number || product}`);
        rejectedRows.push({ ...common, qty: refusedQty });
      }
      if (reserveQty > 0) {
        reserveOrders.add(ddt?.orderNumber || `__ddt_${ddt?.number || product}`);
        reserveRows.push({ ...common, qty: reserveQty });
      }
    });
  });

  const sortRows = rows => [...rows].sort((a, b) => {
    const s = String(a.supplierName).localeCompare(String(b.supplierName));
    if (s !== 0) return s;
    const dcmp = String(a.date).localeCompare(String(b.date));
    if (dcmp !== 0) return dcmp;
    const ocmp = String(a.orderNumber).localeCompare(String(b.orderNumber));
    if (ocmp !== 0) return ocmp;
    return String(a.product).localeCompare(String(b.product));
  });

  return {
    totalOrders,
    rejectedRows: sortRows(rejectedRows),
    reserveRows: sortRows(reserveRows),
    rejectedOrdersCount: rejectedOrders.size,
    reserveOrdersCount: reserveOrders.size,
    rejectedPercent: percentText(rejectedOrders.size, totalOrders),
    reservePercent: percentText(reserveOrders.size, totalOrders)
  };
}
