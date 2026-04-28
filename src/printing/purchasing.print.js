/* purchasing.print.js - generazione PDF documenti fornitori */
import { buildPartyLines, requireJsPDF, sanitizePdfFileName } from './common.print.js';

export const buildSupplierReturnRows = (ret = {}) => (ret.lines || []).map(line => [
  line.productId || '',
  line.description || line.productName || '',
  String(line.qty || 0),
  line.reason || ret.returnReason || ret.notes || '—'
]);

export const printSupplierReturnPdf = ({ ret, db, jsPDFCtor } = {}) => {
  if (!ret) throw new Error('Reso fornitore mancante.');
  const PDF = requireJsPDF(jsPDFCtor);
  const company = db?.company || {};
  const supplier = (db?.suppliers || []).find(s => (ret.supplierId && s.id === ret.supplierId) || (ret.supplierName && s.name === ret.supplierName)) || {};
  const doc = new PDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;
  const lineGap = 5;
  const boxW = 86;
  const rightX = pageWidth - 14 - boxW;
  const companyLines = buildPartyLines(company, 'Nostra Azienda');
  const supplierLines = buildPartyLines(supplier, ret.supplierName || 'Fornitore');

  doc.setFontSize(16);
  doc.text('DDT DI RESO A FORNITORE', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.roundedRect(14, y, boxW, 24, 2, 2);
  doc.text('Mittente', 16, y + 5);
  companyLines.forEach((line, idx) => doc.text(String(line), 16, y + 10 + idx * lineGap));

  doc.roundedRect(rightX, y, boxW, 24, 2, 2);
  doc.text('Destinatario', rightX + 2, y + 5);
  supplierLines.forEach((line, idx) => doc.text(String(line), rightX + 2, y + 10 + idx * lineGap));

  y += 32;
  doc.setFontSize(11);
  doc.text(`Numero DDT di reso: ${ret.number || ''}`, 14, y);
  doc.text(`Data documento: ${ret.date || ''}`, rightX, y);
  y += 7;
  doc.text('Causale: Reso al fornitore', 14, y);
  y += 7;
  doc.text(`Rif. Ordine fornitore: ${ret.sourceOrderNumber || '—'}`, 14, y);
  doc.text(`Rif. DDT origine: ${ret.sourceDdtNumber || '—'}`, rightX, y);
  y += 9;

  const rows = buildSupplierReturnRows(ret);
  if (doc.autoTable) {
    doc.autoTable({
      startY: y,
      head: [['Codice', 'Descrizione articolo', 'Qtà resa', 'Motivazione del reso']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [230, 230, 230], textColor: 20 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 70 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 58 }
      }
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  } else {
    doc.text('Articoli resi:', 14, y);
    y += 6;
    rows.forEach(row => {
      doc.text(`${row[0]} - ${row[1]} - Qtà ${row[2]} - ${row[3]}`, 14, y);
      y += 6;
    });
    y += 2;
  }

  const transportNotes = ret.transportNotes || ret.notes || '—';
  const footerLines = [
    `Colli: ${Number(ret.packageCount || 1)}`,
    `Vettore: ${ret.carrier || '—'}`,
    `Stato reso: ${ret.status || 'Preparato'}`,
    ret.shippedAt ? `Data spedizione: ${ret.shippedAt}` : ''
  ].filter(Boolean);
  footerLines.forEach(line => {
    doc.text(String(line), 14, y);
    y += 6;
  });
  const splitNotes = doc.splitTextToSize ? doc.splitTextToSize(`Note di trasporto: ${transportNotes}`, pageWidth - 28) : [`Note di trasporto: ${transportNotes}`];
  doc.text(splitNotes, 14, y);
  doc.save(`${sanitizePdfFileName(ret.number, 'reso-fornitore')}.pdf`);
  return doc;
};
