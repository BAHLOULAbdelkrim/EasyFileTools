#!/usr/bin/env node
// Check the V3 guarantees on V3 and later builds.
// Starting with V4, main.css and liste-files.css are included in one common CSS bundle.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] || 'public');
const entry = join(dir, 'index.html');
if (!existsSync(entry)) {
  console.error(`Missing ${entry}. Run: hugo --minify --cleanDestinationDir`);
  process.exit(1);
}
const html = readFileSync(entry, 'utf8');
const asset = (name) => {
  const re = new RegExp('(?:^|[\\/"\\s=])(?:\\/)?(' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\.min)?\\.[a-f0-9]{16,}\\.(?:css|js))(?=[?"\\s>]|$)', 'i');
  const match = html.match(re);
  return Boolean(match && existsSync(join(dir, match[1])));
};
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};
let failures = 0;
const common = asset('optimized/css/easyfile-common');
if (common) {
  check(true, 'V4+ common CSS bundle replaces V3 individual main/liste-files CSS');
} else {
  check(asset('optimized/css/main'), 'V3 optimized/css/main');
  check(asset('optimized/css/common/liste-files'), 'V3 optimized/css/common/liste-files');
}
check(asset('optimized/js/common/file-list'), 'optimized/js/common/file-list');
check(asset('optimized/js/common/confirmation-modal'), 'optimized/js/common/confirmation-modal');
check(/fonts\.googleapis\.com[^>]*media\s*=\s*(?:["']?print["']?)/i.test(html), 'async Google Fonts');
if (failures) process.exitCode = 1;
else console.log('V3 guarantees verified on this production build (V4+ bundle supported).');
