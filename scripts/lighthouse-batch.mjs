#!/usr/bin/env node
// Run Lighthouse for five key pages, mobile and desktop, and save JSON/HTML reports.
// Requires Chrome and a one-time local installation of Lighthouse: npm.cmd install --no-save --no-package-lock lighthouse.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2);
const option=(name,fallback)=>args.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const base=option('base','http://127.0.0.1:4173').replace(/\/+$/,'');
const repeat=Math.min(5,Math.max(1,Number(option('repeat','1'))||1));
const wanted=option('pages','home,convert-image,cut-audio,convert-video,pdf-to-image').split(',');
const devices=option('devices','mobile,desktop').split(',');
const throttling=option('throttling','simulate'); // simulate (default), devtools or provided
if(!['simulate','devtools','provided'].includes(throttling)) {console.error('Invalid --throttling= option. Choose simulate, devtools, provided');process.exit(2);}
const paths={home:'/', 'convert-image':'/images/convert-image/', 'cut-audio':'/audio/cut-audio/', 'convert-video':'/video/convert-video/', 'pdf-to-image':'/documents/pdf-to-image/'};
const out=path.resolve(option('out','reports/lighthouse'));
for(const p of wanted) if(!(p in paths)) { console.error(`Unknown page ${p}. Choose: ${Object.keys(paths).join(', ')}`); process.exit(2); }
for(const d of devices) if(!['mobile','desktop'].includes(d)) {console.error(`Unknown device ${d}`);process.exit(2);}
fs.mkdirSync(out,{recursive:true});
try { const response=await fetch(`${base}/`,{signal:AbortSignal.timeout(5000)}); if(!response.ok)throw new Error(String(response.status)); }
catch {console.error(`Site unreachable at ${base}. Start: node scripts/serve-public.mjs public 4173`);process.exit(2);}
// Launch the locally installed Lighthouse CLI with Node directly.
// This avoids Windows cmd.exe/npx.cmd quoting errors (EINVALIDTAGNAME).
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lighthouseCli=path.join(projectRoot,'node_modules','lighthouse','cli','index.js');
if(!fs.existsSync(lighthouseCli)){
  console.error('Lighthouse is not installed in this project.');
  console.error('Run: npm.cmd install --no-save --no-package-lock lighthouse');
  process.exit(2);
}
const rows=[];
for(const name of wanted) for(const device of devices) for(let run=1;run<=repeat;run++) {
  const tag=`${name}-${device}-${run}`;
  const prefix=path.join(out,tag);
  const flags=[`${base}${paths[name]}`,'--quiet','--chrome-flags=--headless=new --disable-gpu','--only-categories=performance,accessibility,best-practices,seo','--output=json','--output=html',`--output-path=${prefix}`,`--throttling-method=${throttling}`,'--max-wait-for-load=45000'];
  if(device==='desktop') flags.push('--preset=desktop');
  console.log(`\n[${tag}] ${base}${paths[name]}`);
  // Do not accidentally report old JSON output if the next run has an issue.
  for(const file of fs.readdirSync(out)){
    if(file.startsWith(`${tag}.report.`) && (file.endsWith('.json') || file.endsWith('.html'))) fs.unlinkSync(path.join(out,file));
  }
  const result=spawnSync(process.execPath,[lighthouseCli,...flags],{cwd:projectRoot,stdio:'inherit',timeout:180000,windowsHide:true});
  if(result.error || result.status!==0) {console.error(`FAILED ${tag}: ${result.error?.message||`exit ${result.status}`}`);continue;}
  const filename=fs.readdirSync(out).find(x=>x.startsWith(`${tag}.`) && x.endsWith('.json'));
  if(!filename) {console.error(`No JSON report found for ${tag}`);continue;}
  try {
    const data=JSON.parse(fs.readFileSync(path.join(out,filename),'utf8'));
    const pct=x=>x?.score==null?'':Math.round(x.score*100);
    const val=id=>data.audits?.[id]?.numericValue ?? null;
    rows.push({page:name,device,run,performance:pct(data.categories?.performance),accessibility:pct(data.categories?.accessibility),bestPractices:pct(data.categories?.['best-practices']),seo:pct(data.categories?.seo),LCPms:val('largest-contentful-paint'),FCPms:val('first-contentful-paint'),TBTms:val('total-blocking-time'),CLS:val('cumulative-layout-shift'),report:filename});
    console.log(`Performance ${rows.at(-1).performance}/100; LCP ${rows.at(-1).LCPms?.toFixed(0)??'?'} ms; TBT ${rows.at(-1).TBTms?.toFixed(0)??'?'} ms; CLS ${rows.at(-1).CLS??'?'}`);
  } catch(e){console.error(`Could not read report for ${tag}: ${e.message}`);}
}
const cols=['page','device','run','performance','accessibility','bestPractices','seo','LCPms','FCPms','TBTms','CLS','report'];
const csv=[cols.join(','),...rows.map(r=>cols.map(k=>String(r[k]??'')).join(','))].join('\r\n')+'\r\n';
fs.writeFileSync(path.join(out,'summary.csv'),csv);
console.log(`\nCompleted ${rows.length}/${wanted.length*devices.length*repeat}. Reports: ${out}`);
console.log('Important: navigation runs do not measure conversion processing or real-user INP. Compare against a deployed HTTPS site later.');
if(rows.length!==wanted.length*devices.length*repeat)process.exitCode=1;
