#!/usr/bin/env node
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
let failed = false;
const fail = (msg) => { console.error('❌ ' + msg); failed = true; };
const ok = (msg) => console.log('✅ ' + msg);

const forbidden = [
  /Accesso emergenza/i,
  /admin\s*<\/code>\s*\/\s*<code>gestionale/i,
  /oppure admin/i,
  /Local Storage/i,
  /localStorage\b/i,
  /sessionStorage\b/i
];
for (const re of forbidden) {
  if (re.test(html)) fail(`testo o riferimento HTML obsoleto trovato: ${re}`);
}
if (!failed) ok('nessun testo HTML obsoleto su login locale/localStorage');

const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const ids = new Set();
const duplicates = new Set();
for (const id of idMatches) {
  if (ids.has(id)) duplicates.add(id);
  ids.add(id);
}
if (duplicates.size) fail('id HTML duplicati: ' + [...duplicates].join(', '));
else ok('id HTML univoci');

const navTargets = [...html.matchAll(/<a\b[^>]*\bdata-target="([^"]+)"[^>]*>/g)].map(m => m[1]);
const missingTargets = navTargets.filter(target => !ids.has(target));
if (missingTargets.length) fail('data-target senza sezione corrispondente: ' + [...new Set(missingTargets)].join(', '));
else ok('tutti i data-target della sidebar hanno un id corrispondente');

const requiredMarkers = [
  '[LOGIN]',
  '[APP SHELL]',
  '[VISTE] Home e dashboard',
  '[VISTE] Anagrafiche',
  '[VISTE] Magazzino',
  '[VISTE] Clienti / Vendite',
  '[VISTE] Fornitori / Acquisti',
  '[VISTE] Impostazioni e release',
  '[MODALI]'
];
const missingMarkers = requiredMarkers.filter(marker => !html.includes(marker));
if (missingMarkers.length) fail('marker strutturali mancanti: ' + missingMarkers.join(', '));
else ok('marker strutturali presenti in index.html');

if (failed) process.exit(1);
console.log('\nVerifica struttura HTML completata con esito positivo.');
process.exit(process.exitCode || 0);
