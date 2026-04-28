#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const requiredFiles = [
  'src/domain/inventory.rules.js',
  'src/domain/masterdata.rules.js',
  'src/domain/permissions.service.js',
  'src/domain/referentialIntegrity.service.js',
  'src/domain/sales.service.js',
  'src/domain/purchasing.service.js',
  'src/domain/backup.service.js',
  'src/domain/stats.service.js',
  'src/domain/macerated.service.js',
  'src/features/magazzino/macerated.ui.js',
  'tests/macerated.service.test.mjs',
  'src/core/dbMutation.js',
  'tests/dbMutation.test.mjs',
  'tools/run-domain-tests.mjs',
  'src/features/vendite/orders.ui.js',
  'src/features/vendite/ddts.ui.js',
  'src/features/vendite/invoices.ui.js',
  'src/features/acquisti/orders.ui.js',
  'src/features/acquisti/ddts.ui.js',
  'src/features/acquisti/quarantine.ui.js',
  'src/features/impostazioni/company.ui.js',
  'src/features/impostazioni/users.ui.js',
  'src/features/impostazioni/advanced.ui.js',
  'src/features/impostazioni/release.ui.js',
  'src/printing/common.print.js',
  'src/printing/sales.print.js',
  'src/printing/purchasing.print.js',
  'tests/printing.test.mjs',
  'tools/verify-printing.mjs',
  'src/core/firestore/conflict.js',
  'tests/firestore.conflict.test.mjs',
  'tests/browser-smoke.test.mjs',
  'tools/verify-browser-smoke.mjs',
  'tools/browser-smoke-lib.mjs'
];

let ok = true;
for (const file of requiredFiles) {
  if (fs.existsSync(path.join(root, file))) console.log(`✅ ${file}`);
  else { console.error(`❌ manca ${file}`); ok = false; }
}

const forbiddenFeaturePatterns = [
  [/App\.db\.save\s*\(/, 'i moduli feature devono usare App.db.mutate(), non App.db.save() diretto'],
  [/adjustStockBatch\s*\(/, 'i flussi feature complessi devono applicare le regole inventario dentro mutate()'],
  [/adjustQuarantineBatch\s*\(/, 'i flussi feature complessi devono applicare le regole quarantena dentro mutate()']
];

for (const dir of ['src/features']) {
  const stack = [path.join(root, dir)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const rel = path.relative(root, full);
        const content = fs.readFileSync(full, 'utf8');
        for (const [pattern, message] of forbiddenFeaturePatterns) {
          if (pattern.test(content)) {
            console.error(`❌ ${rel}: ${message}`);
            ok = false;
          }
        }
      }
    }
  }
}

// Nessun salvataggio DB diretto fuori dal wrapper: i moduli applicativi devono passare da mutate().
const directSaveScanRoots = ['src/core', 'src/domain', 'src/features'];
for (const dir of directSaveScanRoots) {
  const stack = [path.join(root, dir)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const rel = path.relative(root, full);
        if (rel === 'src/core/db.js') continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/\b(?:App\.)?db\.save\s*\(/.test(content)) {
          console.error(`❌ ${rel}: salvataggio DB diretto vietato; usare db.mutate()/App.db.mutate().`);
          ok = false;
        }
      }
    }
  }
}

const sourceChecks = [
  ['src/core/db.js', 'createMutationRunner'],
  ['src/core/home.js', "db.mutate('home:save-user-notes'"],
  ['src/domain/inventory.service.js', 'inventory.rules.js'],
  ['src/domain/masterdata.service.js', 'masterdata.rules.js'],
  ['src/domain/masterdata.rules.js', 'referentialIntegrity.service.js'],
  ['src/features/vendite/index.js', 'permissions.service.js'],
  ['src/features/acquisti/index.js', 'permissions.service.js'],
  ['src/features/vendite/index.js', 'App.db.mutate'],
  ['src/features/acquisti/index.js', 'App.db.mutate'],
  ['src/features/impostazioni/advanced.ui.js', 'App.db.mutate'],
  ['src/features/magazzino/index.js', 'App.db.mutate'],
  ['src/features/login/index.js', 'App.db.mutate'],
  ['src/features/vendite/index.js', '../../printing/sales.print.js'],
  ['src/features/acquisti/index.js', '../../printing/purchasing.print.js'],
  ['src/core/db.js', 'assertRemoteRevision'],
  ['src/core/firestore/repository.js', 'getRemoteRevision'],
  ['src/core/firestore/constants.js', "app: 'meta/app'"] 
];

for (const [file, text] of sourceChecks) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (content.includes(text)) console.log(`✅ ${file} integra ${text}`);
  else { console.error(`❌ ${file} non integra ${text}`); ok = false; }
}


const uiSplitChecks = [
  ['src/features/vendite/index.js', './orders.ui.js'],
  ['src/features/vendite/index.js', './ddts.ui.js'],
  ['src/features/vendite/index.js', './invoices.ui.js'],
  ['src/features/acquisti/index.js', './orders.ui.js'],
  ['src/features/acquisti/index.js', './ddts.ui.js'],
  ['src/features/acquisti/index.js', './quarantine.ui.js'],
  ['src/features/impostazioni/index.js', './company.ui.js'],
  ['src/features/impostazioni/index.js', './users.ui.js'],
  ['src/features/impostazioni/index.js', './advanced.ui.js'],
  ['src/features/impostazioni/index.js', './release.ui.js'],
  ['src/features/magazzino/index.js', './macerated.ui.js'],
  ['src/features/magazzino/macerated.ui.js', '../../domain/macerated.service.js']
];

for (const [file, text] of uiSplitChecks) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (content.includes(text)) console.log('✅ ' + file + ' usa modulo UI ' + text);
  else { console.error('❌ ' + file + ' non usa modulo UI ' + text); ok = false; }
}

if (!ok) process.exit(1);
console.log('\nVerifica struttura logica completata con esito positivo.');
process.exit(process.exitCode || 0);
