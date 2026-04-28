import fs from 'node:fs';
import path from 'node:path';

export function unique(values) {
  return [...new Set(values)];
}

export function extractIds(html) {
  return unique([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
}

export function extractScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)><\/script>/gi)].map((m) => {
    const attrs = m[1] || '';
    const src = attrs.match(/\bsrc="([^"]+)"/i)?.[1] || '';
    const type = attrs.match(/\btype="([^"]+)"/i)?.[1] || '';
    return { src, type, attrs };
  });
}

export function extractSidebarTargets(html) {
  return unique([...html.matchAll(/<a\b[^>]*\bdata-target="([^"]+)"[^>]*>/g)].map(m => m[1]));
}

export function extractContentSectionIds(html) {
  return unique([...html.matchAll(/<div\b[^>]*\bclass="[^"]*\bcontent-section\b[^"]*"[^>]*\bid="([^"]+)"/gi)].map(m => m[1]));
}

export function extractModalIds(html) {
  return unique([...html.matchAll(/<div\b[^>]*\bclass="[^"]*\bmodal\b[^"]*"[^>]*\bid="([^"]+)"/gi)].map(m => m[1]));
}

export function extractDataBsTargets(html) {
  return unique([...html.matchAll(/\bdata-bs-target="#([^"]+)"/g)].map(m => m[1]));
}

export function extractModalDataBsTargets(html) {
  return unique([...html.matchAll(/<button\b[^>]*\bdata-bs-toggle="modal"[^>]*\bdata-bs-target="#([^"]+)"/g)].map(m => m[1]));
}

export function extractStaticImports(source) {
  const imports = [];
  const patterns = [
    /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+[^'";]+?\s+from\s+['"]([^'"]+)['"]/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) imports.push(match[1]);
  }
  return imports;
}

export function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')];
  return candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || candidates[0];
}

export function collectLocalModuleGraph(entryFile) {
  const visited = new Set();
  const missing = [];
  const stack = [path.resolve(entryFile)];

  while (stack.length) {
    const file = stack.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!fs.existsSync(file)) {
      missing.push(file);
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of extractStaticImports(source)) {
      const resolved = resolveLocalImport(file, specifier);
      if (!resolved) continue;
      if (!fs.existsSync(resolved)) missing.push(resolved);
      else stack.push(resolved);
    }
  }

  return { visited: [...visited].sort(), missing: unique(missing).sort() };
}

export function analyzeBrowserSmoke({ html, rootDir }) {
  const ids = new Set(extractIds(html));
  const scripts = extractScripts(html);
  const sidebarTargets = extractSidebarTargets(html);
  const contentSectionIds = new Set(extractContentSectionIds(html));
  const modalIds = new Set(extractModalIds(html));
  const dataBsTargets = extractDataBsTargets(html);
  const checks = [];

  const add = (ok, message) => checks.push({ ok: Boolean(ok), message });

  const requiredIds = [
    'login-container',
    'login-form',
    'login-email',
    'login-password',
    'login-submit-btn',
    'main-app',
    'app-sidebar',
    'data-source-badge',
    'logout-btn',
    'toast-container'
  ];
  const missingIds = requiredIds.filter(id => !ids.has(id));
  add(!missingIds.length, missingIds.length ? `id essenziali mancanti: ${missingIds.join(', ')}` : 'id essenziali presenti');

  const requiredLibraries = [
    ['Bootstrap JS', /bootstrap@5\.3\.3\/dist\/js\/bootstrap\.bundle\.min\.js/],
    ['Chart.js', /cdn\.jsdelivr\.net\/npm\/chart\.js/],
    ['jsPDF', /jspdf@2\.5\.1\/dist\/jspdf\.umd\.min\.js/],
    ['jsPDF AutoTable', /jspdf-autotable@3\.8\.2\/dist\/jspdf\.plugin\.autotable\.min\.js/]
  ];
  const scriptSrcs = scripts.map(s => s.src).join('\n');
  for (const [name, pattern] of requiredLibraries) {
    add(pattern.test(scriptSrcs), pattern.test(scriptSrcs) ? `${name} caricato` : `${name} non trovato negli script`);
  }

  const mainScript = scripts.find(s => s.src === 'src/main.js');
  add(mainScript?.type === 'module', 'src/main.js caricato come modulo ES');
  const mainIndex = scripts.findIndex(s => s.src === 'src/main.js');
  const bootstrapIndex = scripts.findIndex(s => /bootstrap@5\.3\.3\/dist\/js\/bootstrap\.bundle\.min\.js/.test(s.src));
  add(bootstrapIndex >= 0 && mainIndex > bootstrapIndex, 'Bootstrap JS caricato prima del modulo applicativo');

  const missingSections = sidebarTargets.filter(target => !contentSectionIds.has(target));
  add(!missingSections.length, missingSections.length ? `target sidebar senza content-section: ${missingSections.join(', ')}` : 'target sidebar collegati a content-section');

  const missingDataBsTargets = dataBsTargets.filter(target => !ids.has(target));
  add(!missingDataBsTargets.length, missingDataBsTargets.length ? `data-bs-target senza id corrispondente: ${missingDataBsTargets.join(', ')}` : 'data-bs-target collegati a elementi presenti');

  const modalTargetIds = extractModalDataBsTargets(html);
  const missingModals = modalTargetIds.filter(target => !modalIds.has(target));
  add(!missingModals.length, missingModals.length ? `target modal senza modal corrispondente: ${missingModals.join(', ')}` : 'target modal collegati a modali presenti');

  const mainPath = path.join(rootDir, 'src/main.js');
  const graph = collectLocalModuleGraph(mainPath);
  add(!graph.missing.length, graph.missing.length ? `import locali mancanti: ${graph.missing.map(f => path.relative(rootDir, f)).join(', ')}` : `grafo moduli locali risolto (${graph.visited.length} file)`);

  const requiredFeatureImports = [
    './features/login/index.js',
    './features/anagrafiche/index.js',
    './features/magazzino/index.js',
    './features/vendite/index.js',
    './features/acquisti/index.js',
    './features/impostazioni/index.js'
  ];
  const mainSource = fs.readFileSync(mainPath, 'utf8');
  const missingFeatureImports = requiredFeatureImports.filter(spec => !mainSource.includes(spec));
  add(!missingFeatureImports.length, missingFeatureImports.length ? `feature non inizializzate in main.js: ${missingFeatureImports.join(', ')}` : 'feature principali importate da main.js');

  const bootOrderPatterns = [
    /await\s+App\.boot\s*\(/,
    /initLogin\s*\(/,
    /initVenditeFeature\s*\(/,
    /initAcquistiFeature\s*\(/,
    /initImpostazioniFeature\s*\(/
  ];
  add(bootOrderPatterns.every(re => re.test(mainSource)), 'bootstrap e inizializzazioni principali presenti in main.js');

  return checks;
}
