#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { analyzeBrowserSmoke } from './browser-smoke-lib.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const checks = analyzeBrowserSmoke({ html, rootDir: root });
let failed = false;
for (const check of checks) {
  if (check.ok) console.log(`✅ ${check.message}`);
  else {
    failed = true;
    console.error(`❌ ${check.message}`);
  }
}
if (failed) process.exit(1);
console.log('\nSmoke test browser/DOM completato con esito positivo.');
process.exit(process.exitCode || 0);
