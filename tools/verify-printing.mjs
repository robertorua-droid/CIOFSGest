#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const required = [
  'src/printing/common.print.js',
  'src/printing/sales.print.js',
  'src/printing/purchasing.print.js',
  'tests/printing.test.mjs'
];
let ok = true;
for (const file of required) {
  if (fs.existsSync(path.join(root, file))) console.log(`✅ ${file}`);
  else { console.error(`❌ manca ${file}`); ok = false; }
}
const featureDirs = ['src/features/vendite', 'src/features/acquisti'];
const forbidden = [/\bnew\s+jsPDF\b/, /window\.jspdf/, /window\.jsPDF/, /\.autoTable\s*\(/];
for (const dir of featureDirs) {
  for (const entry of fs.readdirSync(path.join(root, dir))) {
    if (!entry.endsWith('.js')) continue;
    const rel = path.join(dir, entry);
    const content = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(content)) {
        console.error(`❌ ${rel}: logica PDF/stampa deve stare in src/printing/ (${pattern}).`);
        ok = false;
      }
    }
  }
}
const salesIndex = fs.readFileSync(path.join(root, 'src/features/vendite/index.js'), 'utf8');
const purchasingIndex = fs.readFileSync(path.join(root, 'src/features/acquisti/index.js'), 'utf8');
if (!salesIndex.includes('../../printing/sales.print.js')) { console.error('❌ vendite non usa sales.print.js'); ok = false; }
if (!purchasingIndex.includes('../../printing/purchasing.print.js')) { console.error('❌ acquisti non usa purchasing.print.js'); ok = false; }
if (!ok) process.exit(1);
console.log('\nVerifica layer stampa completata con esito positivo.');
process.exit(process.exitCode || 0);
