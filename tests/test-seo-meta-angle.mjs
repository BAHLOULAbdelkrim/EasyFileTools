import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'scripts', 'check-seo.mjs');
const labels = [
  ['audio/speech-to-text', 'Speech to Text'],
  ['documents/text-to-speech', 'Text to Speech'],
  ['images/image-to-gif', 'Image to GIF'],
  ['images/image-to-video', 'Image to Video'],
  ['presentations/presentation-to-video', 'Presentation to Video'],
  ['video/video-to-gif', 'Video to GIF'],
  ['video/video-to-image', 'Video to Image'],
];

function buildFixture(meta) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'eft-seo7-'));
  fs.mkdirSync(path.join(temp, 'images'));
  fs.writeFileSync(path.join(temp, 'robots.txt'), 'User-agent: *\nAllow: /');
  fs.writeFileSync(path.join(temp, 'sitemap.xml'), '<urlset/>');
  fs.writeFileSync(path.join(temp, 'images/filemorning_share.png'), 'PNG');
  fs.writeFileSync(path.join(temp, 'index.html'), '<html lang=en><head><title>Home</title><meta name=description content=Homepage><meta name=robots content=\"index, follow\"><link rel=canonical href=\"https://example.com/\"><meta property=og:image content=\"https://example.com/images/filemorning_share.png\"></head></html>');
  for (const [slug, attr] of Object.entries(meta)) {
    const dir = path.join(temp, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang=en><head><title>Test | EasyFile Tools</title>
      ${attr}
      <meta name=robots content="noindex, follow">
      <link rel=canonical href="https://example.com/${slug}/">
      <meta property=og:image content="https://example.com/images/filemorning_share.png"></head><body>Test</body></html>`);
  }
  return temp;
}

function runValidator(dir) {
  return spawnSync(process.execPath, [validator, dir], { encoding: 'utf8' });
}

test('corrects seven coming-soon titles and descriptions without modifying URLs', () => {
  for (const [slug, name] of labels) {
    const body = fs.readFileSync(path.join(root, 'content', slug, '_index.md'), 'utf8');
    assert.match(body, new RegExp(`^title: "${name}"$`, 'm'));
    assert.match(body, new RegExp(`^description: "${name} is planned for a future release`, 'm'));
    assert.match(body, new RegExp(`^url: "/${slug}/"$`, 'm'));
    assert.doesNotMatch(body, /-->/);
  }
});

test('SEO audit accepts > in quoted attributes including all seven former page names', () => {
  const meta = Object.fromEntries(labels.map(([slug, name], i) => {
    const former = name.replace(' to ', ' --> ');
    const quote = i % 2 === 0 ? '"' : "'";
    return [slug, `<meta name=description content=${quote}${former} is planned for a future release${quote}>`];
  }));
  const dir = buildFixture(meta);
  try {
    const result = runValidator(dir);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /8 HTML pages; 1 explicitly indexable; 0 errors; 0 warnings/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SEO audit still detects an actually missing meta description', () => {
  const dir = buildFixture({ 'audio/speech-to-text': '' });
  try {
    const result = runValidator(dir);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /Missing meta description/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
