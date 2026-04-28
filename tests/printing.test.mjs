import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPartyLines, sanitizePdfFileName, splitCodeDescription } from '../src/printing/common.print.js';
import { buildCustomerDDTRows, buildInvoiceRows, printInvoicePdf } from '../src/printing/sales.print.js';
import { buildSupplierReturnRows } from '../src/printing/purchasing.print.js';

test('common print helpers normalizzano righe e nomi file', () => {
  assert.deepEqual(buildPartyLines({ name: 'ACME', address: 'Via Roma', zip: '00100', city: 'Roma', province: 'RM' }), ['ACME', 'Via Roma', '00100 Roma (RM)']);
  assert.deepEqual(splitCodeDescription('P001 - Prodotto prova'), { code: 'P001', description: 'Prodotto prova' });
  assert.equal(sanitizePdfFileName('F/001:2026'), 'F-001-2026');
});

test('sales print helpers costruiscono righe DDT e fattura', () => {
  assert.deepEqual(buildCustomerDDTRows({ lines: [{ description: 'P001 - Bancale', qty: 3 }] }), [['P001', 'Bancale', '3']]);
  assert.deepEqual(buildInvoiceRows({ lines: [{ description: 'Bancale', qty: 2, price: 10, iva: 22 }] }), [['Bancale', '2', '10.00', '20.00', '22%']]);
});

test('purchasing print helper costruisce righe reso fornitore', () => {
  assert.deepEqual(buildSupplierReturnRows({ returnReason: 'Difetto', lines: [{ productId: 'P1', description: 'Prodotto', qty: 1 }] }), [['P1', 'Prodotto', '1', 'Difetto']]);
});

test('printInvoicePdf usa il costruttore PDF iniettato', () => {
  const calls = [];
  class FakePdf {
    setFontSize(size) { calls.push(['font', size]); }
    text(...args) { calls.push(['text', ...args]); }
    autoTable(args) { calls.push(['table', args.body.length]); }
    save(name) { calls.push(['save', name]); }
  }
  const doc = printInvoicePdf({ invoice: { number: 'F/1', customerName: 'Cliente', date: '2026-04-25', lines: [] }, jsPDFCtor: FakePdf });
  assert.equal(doc instanceof FakePdf, true);
  assert.deepEqual(calls.at(-1), ['save', 'Fattura_F-1.pdf']);
});
