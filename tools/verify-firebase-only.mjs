#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const expectedVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const forbiddenCodePatterns = [
  /setMode\(['"]local['"]\)/,
  /migrateLocalToFirebase/,
  /pullFirebaseToLocal/,
  /DB\.load\b/,
  /data-source-mode/,
  /backup-import-local-btn/,
  /clear-local-cache-btn/,
  /localStorage\b/,
  /sessionStorage\b/
];

function rel(p) { return path.relative(root, p).replaceAll(path.sep, '/'); }
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function fail(msg) { console.error('❌ ' + msg); process.exitCode = 1; }
function ok(msg) { console.log('✅ ' + msg); }

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, 'data/release.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

if (pkg.version === expectedVersion) ok('package.json version allineata'); else fail('package.json non allineato');
if (release.current?.version === expectedVersion) ok('release.json current allineato'); else fail('release.json current non allineato');
if (changelog.includes('## ' + expectedVersion + ' - ')) ok('CHANGELOG contiene la release corrente'); else fail('CHANGELOG non contiene la release corrente');
if (!fs.existsSync(path.join(root, 'legacy'))) ok('cartella legacy assente'); else fail('cartella legacy ancora presente');

const codeAndUiFiles = walk(root).filter(p => {
  const rp = rel(p);
  return !rp.startsWith('tools/') && !rp.endsWith('.zip') && /\.(js|mjs|html)$/.test(rp);
});

for (const p of codeAndUiFiles) {
  const rp = rel(p);
  const txt = fs.readFileSync(p, 'utf8');
  for (const pat of forbiddenCodePatterns) {
    if (pat.test(txt)) fail(`pattern vietato ${pat} in ${rp}`);
  }
}
if (!process.exitCode) ok('nessun uso di modalità locale, localStorage o sessionStorage nel codice');

if (!process.exitCode) console.log('\nVerifica Firebase-only/localStorage-zero completata con esito positivo.');
process.exit(process.exitCode || 0);
