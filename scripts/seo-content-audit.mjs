#!/usr/bin/env node
// Source-level SEO review for candidate pages we actually intend to index.
import fs from 'node:fs';
import path from 'node:path';
const content=path.resolve('content');
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const full=path.join(dir,item.name);
 if(item.isDirectory())walk(full);else if(item.name==='_index.md'||item.name==='index.md')files.push(full);
}}
walk(content);
const get=(fm,key)=>{
 const match=fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`,'mi'));
 if(!match)return '';
 return match[1].replace(/\s+#.*$/,'').trim().replace(/^["']|["']$/g,'');
};
const rows=[];const errors=[],warnings=[];
for(const file of files){
 const raw=fs.readFileSync(file,'utf8');
 if(!raw.startsWith('---'))continue;
 const end=raw.indexOf('\n---',3);if(end===-1)continue;
 const fm=raw.slice(3,end);
 const rel=path.relative(content,file).replaceAll('\\','/');
 const draft=get(fm,'draft')==='true';
 const cat=['audio/_index.md','video/_index.md','images/_index.md','documents/_index.md'].includes(rel);
 const active=get(fm,'available')==='true';
 const qualifies=!draft&&(rel==='_index.md'||cat||active||get(fm,'seoIndex')==='true');
 if(!qualifies)continue;
 const title=get(fm,'seoTitle')||get(fm,'title');
 const desc=get(fm,'description');
 const operation=get(fm,'operation');
 rows.push({rel,title,desc,operation});
 if(!title)errors.push(`${rel}: missing title`);
 if(!desc||/^\.*$/.test(desc))errors.push(`${rel}: missing or placeholder description`);
 if(desc.length<80)warnings.push(`${rel}: short description (${desc.length} characters), review for clarity`);
 if(desc.length>190)warnings.push(`${rel}: long description (${desc.length} characters); search result snippets may truncate`);
}
for(const key of ['title','desc']){
 const seen=new Map();for(const row of rows){const text=row[key].toLowerCase();if(seen.has(text))errors.push(`duplicate ${key}: ${row.rel} and ${seen.get(text)}`);else seen.set(text,row.rel);}
}
const help=JSON.parse(fs.readFileSync('data/seo/tools.json','utf8'));
const active=rows.filter(x=>x.operation);
for(const x of active){const obj=help[x.operation];if(!obj?.steps?.length||!obj?.faq?.length||!obj?.examples?.length||!obj?.limitations?.length)errors.push(`${x.rel}: missing detailed on-page help content`);}
console.log(`SEO content: ${rows.length} candidate indexable pages; ${active.length} available operations; ${Object.keys(help).length} tool help entries.`);
for(const s of errors)console.error('ERROR',s);
for(const s of warnings)console.warn('REVIEW',s);
console.log(`${errors.length} errors; ${warnings.length} editorial review points. Draft / unavailable pages excluded.`);
if(errors.length)process.exitCode=1;
