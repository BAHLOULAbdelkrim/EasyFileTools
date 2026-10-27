import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readHeaderBlocks, verifyHeaderPolicy, auditProject} from '../scripts/audit-v1-security.mjs';

const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const baseline = fs.readFileSync(path.join(root, 'static/_headers'), 'utf8');

test('Lot 5: required security response headers are configured on all static paths', () => {
  assert.deepEqual(verifyHeaderPolicy(baseline), []);
  const blocks = readHeaderBlocks(baseline);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].pattern, '/*');
});

test('Lot 5: dangerous or missing header policy fails the audit', () => {
  assert.match(verifyHeaderPolicy(baseline.replace('X-Frame-Options: DENY', 'X-Frame-Options: SAMEORIGIN')).join(' '), /x-frame-options/);
  assert.match(verifyHeaderPolicy(baseline.replace("object-src 'none'", "object-src *")).join(' '), /content-security-policy/);
  assert.match(verifyHeaderPolicy(baseline.replace('Referrer-Policy: no-referrer\n', '')).join(' '), /referrer-policy/);
  assert.match(verifyHeaderPolicy(baseline + '  X-Frame-Options: DENY\n').join(' '), /Duplicate/);
});

test('Lot 5: no script-src/default-src is enforced before worker and wasm verification', () => {
  const cspLine = baseline.split(/\r?\n/).find(line => /^\s*Content-Security-Policy:/.test(line));
  assert.ok(cspLine);
  assert.doesNotMatch(cspLine, /\b(?:script-src|default-src)\b/);
  assert.match(verifyHeaderPolicy(baseline.replace('form-action \'self\'', "form-action 'self'; script-src 'self'" )).join(' '), /scripts/);
});

test('Lot 5: project dependencies exist and new _headers is present', () => {
  const {errors, notices} = auditProject(root);
  assert.deepEqual(errors, []);
  assert.ok(notices.some(x => x.includes('ffmpeg-core.wasm SHA-256') || x.includes('External FFmpeg WASM via Hugo R2 URL')));
});

test('Lot 5: a generated build must contain an identical _headers file', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'easyfile-lot5-'));
  t.after(() => fs.rmSync(folder, {force: true, recursive: true}));
  assert.match(auditProject(root, folder).errors.join(' '), /public\/_headers/);
  fs.writeFileSync(path.join(folder, '_headers'), baseline);
  assert.deepEqual(auditProject(root, folder).errors, []);
  fs.writeFileSync(path.join(folder, '_headers'), baseline.replace('DENY', 'SAMEORIGIN'));
  assert.match(auditProject(root, folder).errors.join(' '), /differs/);
});
