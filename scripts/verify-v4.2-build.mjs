#!/usr/bin/env node
// Check generated HTML and CSS for the V4.2 layout-stability features.
// The restore-pending HTML attribute is set at runtime; do not look for a static
// data-restore-pending attribute in source HTML. Hugo can also omit href quotes.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const base = resolve(process.argv[2] || 'public');
const routes = ['/audio/convert-audio/', '/images/convert-image/', '/documents/split-pdf/'];
let errors = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) errors++; };
const getAttr = (tag, attr) => {
  const match = tag.match(new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
};
const cssLinks = html => [...html.matchAll(/<link\b[^>]*>/gi)].map(x => x[0])
  .filter(t => getAttr(t, 'rel').toLowerCase().split(/\s+/).includes('stylesheet'))
  .map(t => getAttr(t, 'href'));
let cssURL = '';
for (const route of routes) {
  const file = join(base, route.slice(1), 'index.html');
  if (!existsSync(file)) { check(false, `${route}: generated index.html exists`); continue; }
  const html = readFileSync(file, 'utf8');
  const bundled = cssLinks(html).filter(h => /\/optimized\/css\/easyfile-common\.min\.[a-f0-9]+\.css(?:[?#]|$)/i.test(h));
  check(bundled.length === 1, `${route}: V4 fingerprinted common CSS`);
  if (bundled[0]) cssURL = bundled[0];
  // Hugo renders the script with the partial. JS later sets data-restore-pending.
  check(html.includes('easyfiletools:restore-hint-v42') && html.includes('restorePending') && html.includes('--easyfile-expected-rows'), `${route}: count-only restore hint script`);
  check(html.includes('display=optional'), `${route}: webfonts optional`);
}
if (cssURL) {
  let path;
  try { path = new URL(cssURL, 'http://localhost/').pathname; } catch { path = null; }
  const file = path ? join(base, path.slice(1)) : '';
  check(!!file && existsSync(file), 'V4.2 common CSS bundle exists');
  if (file && existsSync(file)) {
    const css = readFileSync(file, 'utf8');
    for (const term of ['data-restore-pending', 'easyfile-expected-rows', 'data-lucide', 'upload-info']) {
      check(css.includes(term), `bundle contains ${term}`);
    }
  }
}
if (errors) process.exitCode = 1;
else console.log('V4.2 production structure verified. Real browser/Lighthouse tests still required.');
