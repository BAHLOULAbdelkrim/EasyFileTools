#!/usr/bin/env node
// Read existing Lighthouse JSON reports. No browser, network or package required.
// Focus on the exact LCP insights and their nested resource tables; not a heuristic estimate.
import fs from 'node:fs';
import path from 'node:path';
const folder=path.resolve(process.argv[2]||'reports/lighthouse');
const match=(process.argv[3]||'').toLowerCase();
if(!fs.existsSync(folder)){ console.error('Folder missing:',folder);process.exit(1); }
const files=fs.readdirSync(folder).filter(f=>f.endsWith('.report.json')&&(!match||f.toLowerCase().includes(match))).sort();
if(!files.length){console.error('No matching *.report.json files in',folder);process.exit(1);}
function stringify(value,max=9000){ const text=JSON.stringify(value,null,2);return (text?.length>max?text.slice(0,max)+'\n…truncated…':text)||'(no details)'; }
for(const file of files){
 const data=JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
 const audits=data.audits||{};
 const n=id=>Number.isFinite(audits[id]?.numericValue)?Math.round(audits[id].numericValue)+'ms':'?';
 console.log(`\n===== ${file} =====`);
 console.log('URL:',data.finalDisplayedUrl||data.finalUrl||'?');
 console.log('TTFB audit:',n('server-response-time'),' FCP:',n('first-contentful-paint'),' LCP:',n('largest-contentful-paint'),' TBT:',n('total-blocking-time'));
 for(const name of ['lcp-breakdown-insight','lcp-discovery-insight','render-blocking-insight','font-display-insight']){
   const audit=audits[name];
   console.log(`\n## ${name}`);
   if(!audit){console.log('(not in this Lighthouse report)');continue;}
   console.log('summary:', audit.displayValue||audit.explanation||'');
   console.log('Lighthouse detail (exact):');
   console.log(stringify(audit.details));
 }
}
