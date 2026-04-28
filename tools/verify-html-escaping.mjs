#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
let ok = true;

const requiredEscapedRenderers = [
  ['src/core/utils.js', 'escapeHtml(value)'],
  ['src/features/anagrafiche/customers.ui.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/anagrafiche/products.ui.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/anagrafiche/suppliers.ui.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/magazzino/index.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/magazzino/macerated.ui.js', 'renderMaceratedProductsTable({ db, tbody, h })'],
  ['src/features/vendite/index.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/acquisti/index.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/impostazioni/users.ui.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/features/impostazioni/release.ui.js', 'const h = value => App.utils.escapeHtml(value);'],
  ['src/core/stats.js', 'function escapeHtml(value)']
];

for (const [file, marker] of requiredEscapedRenderers) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (content.includes(marker)) console.log(`✅ ${file}: escape disponibile`);
  else { console.error(`❌ ${file}: manca ${marker}`); ok = false; }
}

const forbiddenSnippets = [
  ['src/features/anagrafiche/customers.ui.js', '<td>${c.name || \'\'}</td>'],
  ['src/features/anagrafiche/products.ui.js', '<td>${p.description || \'\'}</td>'],
  ['src/features/anagrafiche/suppliers.ui.js', '<td>${s.name || \'\'}</td>'],
  ['src/features/magazzino/index.js', '<td>${p.description}</td>'],
  ['src/features/vendite/index.js', '<td>${l.description}</td>'],
  ['src/features/vendite/index.js', '${inv.customerName}</div>'],
  ['src/features/acquisti/index.js', '<td>${l.description || \'\'}</td>'],
  ['src/features/impostazioni/users.ui.js', '<td>${u.email || \'\'}</td>'],
  ['src/features/impostazioni/release.ui.js', '`<li>${x}</li>`']
];

for (const [file, snippet] of forbiddenSnippets) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (!content.includes(snippet)) console.log(`✅ ${file}: assente interpolazione non escapata nota`);
  else { console.error(`❌ ${file}: interpolazione non escapata residua: ${snippet}`); ok = false; }
}

if (!ok) process.exit(1);
console.log('\nVerifica escaping HTML completata con esito positivo.');
process.exit(process.exitCode || 0);
