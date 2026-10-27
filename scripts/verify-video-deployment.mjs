#!/usr/bin/env node
// Verify that the actual HTTP preview serves the current FFmpeg/video sources.
// This catches a stale public/ build even when the local Node tests all pass.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv.find(a=>a.startsWith('--base='))?.slice(7) || 'http://127.0.0.1:4173').replace(/\/+$/,'');
const files = [
  'js/audio/convert-audio/ffmpeg-loader.js',
  'js/video/convert-video/video-converter.js',
  'js/video/convert-video/video-conversion-ui.js',
  'js/video/convert-video/video-webcodecs.js',
  'js/video/compress-video/video-compressor.js',
  'js/video/trim-video/video-trimmer.js',
  'js/video/video-to-audio/video-audio-extractor.js'
];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
let bad = 0;
for (const file of files) {
  const sourcePath = path.join(root,'themes/high-tech-theme/static',file);
  const publicPath = path.join(root,'public',file);
  let source;
  try { source = await fs.readFile(sourcePath); }
  catch(e){console.error(`SOURCE MISSING ${file}: ${e.message}`);bad++;continue;}
  let publicBuffer;
  try { publicBuffer = await fs.readFile(publicPath); }
  catch(e){console.error(`PUBLIC MISSING ${file}: rebuild with hugo --environment production`);bad++;continue;}
  if(!publicBuffer.equals(source)) {
    console.error(`STALE BUILD ${file} (source ${hash(source)}, public ${hash(publicBuffer)})`); bad++;
  } else console.log(`SOURCE=PUBLIC ${file} (${hash(source)})`);
  try {
    const res = await fetch(`${base}/${file}?audit=${hash(source)}`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const served = Buffer.from(await res.arrayBuffer());
    if(!served.equals(source)) {
      console.error(`STALE HTTP ${file} (source ${hash(source)}, HTTP ${hash(served)})`);bad++;
    } else console.log(`SOURCE=HTTP ${file}`);
  } catch(e){console.error(`HTTP ERROR ${file}: ${e.message}`);bad++;}
}
if(bad){
  console.error(`\n${bad} mismatch(es). Stop/restart your preview server after rebuilding public; close/reload the old browser tab.`);
  process.exitCode=1;
}else console.log('\nOK: deployed preview serves exactly the current video engine sources.');
