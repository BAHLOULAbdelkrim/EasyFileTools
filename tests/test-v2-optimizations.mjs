import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('The only optional script loader deduplicates simultaneous PDF requests', async () => {
  let injected = [];
  const window = {};
  const doc = {
    createElement: tag => ({ tag, remove(){ this.removed=true; } }),
    head: { appendChild(script){ injected.push(script); } }
  };
  vm.runInNewContext(read('themes/high-tech-theme/static/js/common/optional-dependencies.js'),
    { window, document: doc, setTimeout, clearTimeout, console });
  const a = window.EasyFileDependencies.ensurePdfJs();
  const b = window.EasyFileDependencies.ensurePdfJs();
  assert.equal(injected.length, 1);
  assert.strictEqual(a, b);
  window.pdfjsLib = {getDocument(){}, GlobalWorkerOptions: {}};
  injected[0].onload();
  await Promise.all([a,b]);
  assert.match(window.pdfjsLib.GlobalWorkerOptions.workerSrc, /pdf\.worker\.min\.js$/);
  await window.EasyFileDependencies.ensurePdfJs();
  assert.equal(injected.length, 1);
});

test('JSZip is loaded only when needed and failures can be retried', async () => {
  let injected=[];
  const window={};
  const doc={createElement: () => ({remove(){}}),head:{appendChild(x){injected.push(x)}}};
  vm.runInNewContext(read('themes/high-tech-theme/static/js/common/optional-dependencies.js'),
    {window,document:doc,setTimeout,clearTimeout});
  const a=window.EasyFileDependencies.ensureJsZip();
  assert.equal(injected.length,1);
  injected[0].onerror();
  await assert.rejects(a, /Unable to load ZIP/);
  const b=window.EasyFileDependencies.ensureJsZip();
  assert.equal(injected.length,2);
  window.JSZip=function JSZip(){};
  injected[1].onload();
  await b;
});

test('HTML references static local CSS, not Tailwind Play CDN or eager PDF.js/JSZip', () => {
  const h=read('layouts/partials/head.html');
  assert.doesNotMatch(h, /cdn\.tailwindcss\.com/);
  assert.match(h, /tailwind-compat\.css/);
  assert.doesNotMatch(h, /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?:pdf\.js|jszip)/);
  assert.match(h, /optional-dependencies\.js/);
  assert.match(read('static/css/common/tailwind-compat.css'),/\.hidden/);
  assert.match(read('themes/high-tech-theme/static/js/common/operation/operation-downloads.js'),/ensureJsZip\(/);
  assert.match(read('themes/high-tech-theme/static/js/document/pdf-to-image/pdf-image-converter.js'),/ensurePdfJs\(/);
  assert.match(read('themes/high-tech-theme/static/js/document/compress-pdf/pdf-compressor.js'),/ensurePdfJs\(/);
});

test('Cut Audio never requests FFmpeg for waveform preview', () => {
  const js=read('themes/high-tech-theme/static/js/audio/cut-audio/audio-cut-ui.js');
  assert.doesNotMatch(js, /createWaveformPeaksWithFFmpeg|getFFmpeg\(|resetFFmpeg\(/);
  assert.match(js, /MANUAL_WAVEFORM_MAX_BYTES/);
  assert.match(js, /state\.waveformMode = shouldUseLightweightWaveform/);
  assert.match(js, /decodeAudioData\(/);
  assert.match(js, /state\.waveformMode === "timeline"/);
});

test('Social sharing image exists at 1200 x 630',()=>{
  const img=fs.readFileSync(path.join(root,'static/images/filemorning_share.png'));
  assert.equal(img.readUInt32BE(16),1200);
  assert.equal(img.readUInt32BE(20),630);
  assert.match(read('layouts/partials/seo/metadata.html'), /images\/filemorning_share\.png/);
});

test('All 19 tools have English use-case and limitation guidance',()=>{
  const tools=JSON.parse(read('data/seo/tools.json'));
  assert.equal(Object.keys(tools).length,19);
  for (const [id,x] of Object.entries(tools)) {
    assert.ok(x.examples?.[0] && x.limitations?.[0], id);
    assert.ok(x.faq?.length>=2, id);
  }
  assert.match(read('layouts/partials/seo/tool-help.html'), /Example use cases/);
});

test('English notifications, legal page drafts and EN-only internationalization',()=>{
  const n=read('themes/high-tech-theme/static/js/common/notifications.js');
  for(const word of ['Erreur','Succès','Avertissement'])assert.doesNotMatch(n,new RegExp(`title: "${word}"`));
  for(const name of ['privacy','legal','contact']){
    assert.match(read(`content/${name}/_index.md`),/draft: true/);
  }
  assert.match(read('i18n/en.toml'),/Privacy Policy/);
  const h=read('layouts/partials/seo/metadata.html');
  assert.doesNotMatch(h,/hreflang="fr"|hreflang="ar"/);
});
