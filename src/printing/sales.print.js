/* sales.print.js - generazione PDF documenti clienti */
import { buildPartyLines, requireJsPDF, sanitizePdfFileName, splitCodeDescription } from './common.print.js';

export const buildCustomerDDTRows = (ddt = {}) => (ddt.lines || []).map(line => {
  const parsed = splitCodeDescription(line.description || '');
  return [parsed.code, parsed.description, String(line.qty || 0)];
});

export const buildInvoiceRows = (invoice = {}) => (invoice.lines || []).map(line => [
  line.description || '',
  String(line.qty || 0),
  Number(line.price || 0).toFixed(2),
  Number((line.qty || 0) * (line.price || 0)).toFixed(2),
  `${line.iva ?? 0}%`
]);

export const printCustomerDDTPdf = ({ ddt, db, jsPDFCtor } = {}) => {
  if (!ddt) throw new Error('DDT cliente mancante.');
  const PDF = requireJsPDF(jsPDFCtor);
  const doc = new PDF();
  const company = db?.company || {};
  const customer = (db?.customers || []).find(c => String(c.id) === String(ddt.customerId)) || {};
  const companyLines = buildPartyLines(company, 'Nostra azienda');
  const customerLines = [ddt.customerName || customer.name || 'Cliente', customer.address || ''].filter(Boolean);

  doc.setFontSize(15);
  doc.text('DOCUMENTO DI TRASPORTO', 14, 16);
  doc.setFontSize(11);
  doc.text(`Numero DDT: ${ddt.number || ''}`, 14, 24);
  doc.text(`Data documento: ${ddt.date || ''}`, 140, 24);

  doc.setDrawColor(180);
  doc.rect(14, 30, 86, 26);
  doc.rect(110, 30, 86, 26);
  doc.setFontSize(10);
  doc.text('Mittente', 16, 36);
  companyLines.forEach((line, idx) => doc.text(String(line), 16, 42 + idx * 5));
  doc.text('Destinatario', 112, 36);
  customerLines.forEach((line, idx) => doc.text(String(line), 112, 42 + idx * 5, { maxWidth: 80 }));

  doc.text(`Causale trasporto: ${ddt.transportReason || 'Vendita'}`, 14, 64);
  doc.text(`Riferimento ordine: ${ddt.orderNumber || '-'}`, 14, 70);
  doc.text(`Aspetto esteriore: ${ddt.externalAspect || '-'}`, 14, 76);
  doc.text(`Colli: ${ddt.parcels ?? '-'}`, 130, 64);
  doc.text(`Vettore: ${ddt.carrier || '-'}`, 130, 70);

  const rows = buildCustomerDDTRows(ddt);
  doc.autoTable({
    head: [['Codice', 'Descrizione', 'Qtà']],
    body: rows,
    startY: 82,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20 }
  });
  const finalY = doc.lastAutoTable?.finalY || 82;
  let y = finalY + 8;
  if (ddt.notes) {
    doc.text('Note:', 14, y);
    doc.text(String(ddt.notes), 14, y + 6, { maxWidth: 180 });
  }
  doc.save(`DDT_${sanitizePdfFileName(ddt.number, 'ddt')}.pdf`);
  return doc;
};

export const printInvoicePdf = ({ invoice, jsPDFCtor } = {}) => {
  if (!invoice) throw new Error('Fattura mancante.');
  const PDF = requireJsPDF(jsPDFCtor);
  const doc = new PDF();
  doc.setFontSize(14);
  doc.text(`Fattura ${invoice.number || ''}`, 14, 16);
  doc.setFontSize(11);
  doc.text(`Cliente: ${invoice.customerName || ''}`, 14, 26);
  doc.text(`Data: ${invoice.date || ''}`, 14, 34);
  doc.autoTable({
    head: [['Descrizione', 'Qtà', 'Prezzo', 'Imponibile', 'IVA']],
    body: buildInvoiceRows(invoice),
    startY: 40
  });
  doc.save(`Fattura_${sanitizePdfFileName(invoice.number, 'fattura')}.pdf`);
  return doc;
};
