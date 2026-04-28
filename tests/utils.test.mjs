import assert from 'node:assert/strict';
import test from 'node:test';
import { utils } from '../src/core/utils.js';

test('escapeHtml neutralizza caratteri HTML e attributi', () => {
  assert.equal(utils.escapeHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
});
