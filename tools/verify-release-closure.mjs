import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkgForVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkgForVersion.version;
const requiredFiles = [
  'package.json',
  'data/release.json',
  'CHANGELOG.md',
  'RELEASE_FINAL_1.65.0.md',
  'README_MODULARIZZAZIONE.md',
  'Manuale Tecnico.txt',
  'Manuale Utente.txt',
  'FIREBASE_SETUP.md',
  'tools/verify-firebase-only.mjs',
  'tools/verify-html-structure.mjs',
  'tools/verify-structure.mjs',
  'tools/verify-html-escaping.mjs',
  'tools/verify-printing.mjs',
  'tools/verify-browser-smoke.mjs',
  'tools/run-domain-tests.sh'
];

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
};
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));

for (const file of requiredFiles) {
  if (!exists(file)) fail(`File richiesto mancante: ${file}`);
}

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== VERSION) fail(`package.json non allineato: atteso ${VERSION}, trovato ${pkg.version}`);

const release = JSON.parse(read('data/release.json'));
if (release.current?.version !== VERSION) fail(`release.json current.version non allineato a ${VERSION}`);
if (!Array.isArray(release.history) || release.history[0]?.version !== VERSION) fail(`release.json history non parte da ${VERSION}`);

const changelog = read('CHANGELOG.md');
if (!changelog.includes(`## ${VERSION} - `)) fail(`CHANGELOG.md non contiene una sezione per ${VERSION}`);

for (const file of ['README_MODULARIZZAZIONE.md', 'Manuale Tecnico.txt', 'Manuale Utente.txt', 'FIREBASE_SETUP.md']) {
  if (!read(file).includes(VERSION)) fail(`${file} non cita la release ${VERSION}`);
}
if (!read('RELEASE_FINAL_1.65.0.md').includes('1.65.0')) fail('RELEASE_FINAL_1.65.0.md non cita la closure 1.65.0');

const scripts = pkg.scripts || {};
for (const key of ['verify:firebase-only', 'verify:html', 'verify:structure', 'verify:html-escaping', 'verify:printing', 'verify:browser-smoke', 'verify:release', 'test:domain', 'verify']) {
  if (!scripts[key]) fail(`Script npm mancante: ${key}`);
}

if (!scripts.verify.includes('verify-release-closure')) fail('npm run verify non include verify-release-closure');

const forbiddenOperationalTerms = [
  "setMode('local')",
  'migrateLocalToFirebase',
  'pullFirebaseToLocal',
  'App.db.save('
];
const scanDirs = ['src'];
function walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(js|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}
for (const file of scanDirs.flatMap(walk)) {
  const content = read(file);
  for (const term of forbiddenOperationalTerms) {
    if (content.includes(term)) fail(`Riferimento operativo vietato "${term}" in ${file}`);
  }
}

if (!process.exitCode) console.log(`✅ Release ${VERSION} coerente.`);
process.exit(process.exitCode || 0);
