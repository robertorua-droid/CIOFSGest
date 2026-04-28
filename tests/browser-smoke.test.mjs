import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeBrowserSmoke,
  collectLocalModuleGraph,
  extractContentSectionIds,
  extractDataBsTargets,
  extractModalDataBsTargets,
  extractModalIds,
  extractSidebarTargets,
  extractStaticImports
} from '../tools/browser-smoke-lib.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('la sidebar punta solo a sezioni contenuto presenti', () => {
  const sections = new Set(extractContentSectionIds(html));
  const missing = extractSidebarTargets(html).filter(target => !sections.has(target));
  assert.deepEqual(missing, []);
});

test('i pulsanti che aprono modali puntano a modal presenti', () => {
  const modals = new Set(extractModalIds(html));
  const missing = extractModalDataBsTargets(html).filter(target => !modals.has(target));
  assert.deepEqual(missing, []);
});

test('il grafo dei moduli locali importati da main.js è risolvibile', () => {
  const graph = collectLocalModuleGraph(path.join(root, 'src/main.js'));
  assert.deepEqual(graph.missing, []);
  assert.ok(graph.visited.some(file => file.endsWith('src/features/vendite/index.js')));
  assert.ok(graph.visited.some(file => file.endsWith('src/features/acquisti/index.js')));
});

test('estrazione import statici ignora correttamente le dipendenze esterne', () => {
  const imports = extractStaticImports(`
    import x from './local.js';
    import { y } from 'https://example.com/y.js';
    export { z } from './z.js';
  `);
  assert.deepEqual(imports, ['./local.js', 'https://example.com/y.js', './z.js']);
});

test('smoke test browser/DOM non rileva errori strutturali', () => {
  const failed = analyzeBrowserSmoke({ html, rootDir: root }).filter(check => !check.ok);
  assert.deepEqual(failed, []);
});
