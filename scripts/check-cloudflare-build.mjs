#!/usr/bin/env node
// Fail closed before Pages publishes an incomplete/stale FFmpeg configuration.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.resolve(projectRoot, process.argv[2] || 'public');
const MAX = 25 * 1024 * 1024;
const faults=[];
let count=0;
function scan(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name);
  if(item.isDirectory()) scan(full);
  else if(item.isFile()){
   count++;
   if(fs.statSync(full).size>MAX) faults.push(`Asset >25 MiB: ${path.relative(publicDir,full)}`);
   if(/\.(bak|old|orig|tmp)$/i.test(item.name)) faults.push(`Backup exposed: ${path.relative(publicDir,full)}`);
   if(item.name==='ffmpeg-core.wasm') faults.push('Local FFmpeg WASM still present in published files');
  }
 }
}
if(!fs.existsSync(publicDir)) faults.push('Missing public/: Hugo build has not run.');
else scan(publicDir);
const homepage=path.join(publicDir,'index.html');
if(fs.existsSync(homepage)){
 const html=fs.readFileSync(homepage,'utf8');
 // Hugo --minify may remove HTML attribute quotes; accept both valid forms.
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 const tag=tags.find(x=>/\bname=(?:["']?easyfile-ffmpeg-wasm-url["']?)(?:\s|>)/i.test(x));
 const matched=tag?.match(/\bcontent=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
 const url=matched?.[1]||matched?.[2]||matched?.[3]||'';
 if(!url) faults.push('No FFmpeg R2 URL found: set HUGO_PARAMS_FFMPEGWASMURL in the Pages build environment.');
 else if(!/^https:\/\/[^\s<>"']+$/.test(url)) faults.push('FFmpeg R2 URL is not a valid HTTPS URL.');
 else console.log(`FFmpeg R2 URL configured: ${url}`);
}else faults.push('Missing public/index.html');
for(const file of ['js/audio/convert-audio/lib/ffmpeg-core.js','js/audio/convert-audio/ffmpeg-loader.js']) {
 if(!fs.existsSync(path.join(publicDir,file))) faults.push('Missing published FFmpeg JS: '+file);
}
if(count>20000) faults.push('More than 20,000 published assets (Free Pages limit).');
console.log(`Checked ${count} published assets.`);
if(faults.length){console.error('Preflight FAILED:\n'+faults.map(x=>' - '+x).join('\n'));process.exitCode=1}
else console.log('Preflight OK: clean static assets, configured external FFmpeg WASM.');
