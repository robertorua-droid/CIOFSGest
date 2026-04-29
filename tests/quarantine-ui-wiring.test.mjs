import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/features/acquisti/index.js', 'utf8');

test('la modal di gestione quarantena viene collegata agli eventi in fase di login', () => {
  assert.match(source, /wireQuarantineManageModal\s*\(\)\s*\{/);
  const loggedInBlock = source.match(/App\.events\.on\('logged-in',\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/);
  assert.ok(loggedInBlock, 'blocco logged-in non trovato');
  assert.match(loggedInBlock[1], /this\.wireQuarantineManageModal\s*\(\s*\)/);
});

test('il pulsante conferma gestione quarantena chiama processQuarantineManage', () => {
  assert.match(source, /confirm-quarantine-manage-btn[\s\S]*addEventListener\('click',[\s\S]*processQuarantineManage\s*\(\s*\)/);
});

test('i campi quantità aggiornano il controllo somma in input', () => {
  for (const id of ['quarantine-release-qty', 'quarantine-return-qty', 'quarantine-destroy-qty']) {
    assert.ok(source.includes(`'${id}'`), `campo non collegato: ${id}`);
  }
  assert.match(source, /addEventListener\('input',\s*\(\)\s*=>\s*this\.updateQuarantineManageCheck\s*\(\s*\)\)/);
});
