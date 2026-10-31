#!/usr/bin/env node
// SEO audit of Hugo's generated HTML; accepts quoted and unquoted HTML attributes.
// Usage: node scripts/check-seo.mjs public
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] || 'public');
const errors = [];
const warnings = [];
let checked = 0;
let indexable = 0;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() && /\.html$/i.test(entry.name) ? [full] : [];
  });
}

// HTML minification may unquote attributes and leave > inside quoted values.
// Stop at > only when it is outside single or double quotes.
function tags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi'))].map(match => match[0]);
}
function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`(?:<\\w+|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>"'=\x60]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}
function tagMatching(html, tagName, attrs) {
  return tags(html, tagName).find(tag => Object.entries(attrs).every(([name, expected]) => {
    const value = attribute(tag, name);
    return typeof expected === 'function' ? expected(value) : value?.toLowerCase() === String(expected).toLowerCase();
  }));
}
function localAssetCheck(relative, url, warn) {
  if (!url?.startsWith('/') || url.startsWith('//')) return;
  const clean = url.split(/[?#]/, 1)[0];
  let rel;
  try { rel = decodeURIComponent(clean).replace(/^\/+/, ''); }
  catch { warn(`Malformed asset URL: ${url}`); return; }
  if (!rel || !/\.(?:js|css|png|jpe?g|svg|webp|ico)$/i.test(rel)) return;
  const candidate = path.resolve(out, rel);
  if (!candidate.startsWith(`${out}${path.sep}`) || !fs.existsSync(candidate)) {
    warn(`Local asset not found: /${rel}`);
  }
}

if (!fs.existsSync(out)) {
  console.error(`Missing Hugo output directory: ${out}\nRun: hugo --minify`);
  process.exit(2);
}

for (const file of walk(out)) {
  const relative = path.relative(out, file).replaceAll(path.sep, '/');
  const html = fs.readFileSync(file, 'utf8');
  checked++;
  const error = message => errors.push(`${relative}: ${message}`);
  const warn = message => warnings.push(`${relative}: ${message}`);

  const htmlTag = tags(html, 'html')[0] || '';
  const lang = attribute(htmlTag, 'lang');
  if (!/^en(?:-|$)/i.test(lang || '')) error('Expected English html lang');
  if (!/<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title\s*>/i.test(html)) error('Missing title');

  const description = tagMatching(html, 'meta', { name: 'description' });
  if (!description || !attribute(description, 'content')?.trim()) error('Missing meta description');
  const robots = tagMatching(html, 'meta', { name: 'robots' });
  if (!robots || !attribute(robots, 'content')?.trim()) error('Missing robots meta');
  const robotsText = robots ? attribute(robots, 'content') || '' : '';
  if (/(?:^|[\s,])index(?:[\s,]|$)/i.test(robotsText) && !/(?:^|[\s,])noindex(?:[\s,]|$)/i.test(robotsText)) indexable++;

  // An explicit canonical is intentionally omitted for the site's 404 page.
  if (relative !== '404.html') {
    const canonical = tagMatching(html, 'link', { rel: 'canonical' });
    if (!/^https?:\/\//i.test(canonical ? attribute(canonical, 'href') || '' : '')) warn('Missing absolute canonical');
  }

  const ogImage = tagMatching(html, 'meta', { property: 'og:image' });
  if (!/^https?:\/\//i.test(ogImage ? attribute(ogImage, 'content') || '' : '')) error('Missing absolute Open Graph image');

  for (const script of tags(html, 'script')) {
    const src = attribute(script, 'src') || '';
    if (/^https:\/\/cdn\.tailwindcss\.com(?:\/|$)/i.test(src)) error('Tailwind Play CDN is still present');
    if (/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?:pdf\.js|jszip)\//i.test(src)) error('Third-party PDF/ZIP script still eagerly loaded');
    localAssetCheck(relative, src, warn);
  }
  for (const link of tags(html, 'link')) localAssetCheck(relative, attribute(link, 'href'), warn);
  for (const img of tags(html, 'img')) localAssetCheck(relative, attribute(img, 'src'), warn);
}

for (const relative of ['robots.txt', 'sitemap.xml', 'images/filemorning_share.png']) {
  if (!fs.existsSync(path.join(out, relative))) errors.push(`${relative} missing from Hugo output`);
}
if (indexable === 0) warnings.push('No explicitly indexable pages detected. Check robots directives.');

console.log(`SEO audit: ${checked} HTML pages; ${indexable} explicitly indexable; ${errors.length} errors; ${warnings.length} warnings`);
for (const message of errors) console.error('ERROR', message);
for (const message of warnings.slice(0, 50)) console.warn('WARN ', message);
if (warnings.length > 50) console.warn(`... plus ${warnings.length - 50} warnings`);
if (errors.length) process.exitCode = 1;
