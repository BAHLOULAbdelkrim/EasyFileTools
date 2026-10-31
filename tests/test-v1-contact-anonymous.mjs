import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestPost, onRequest } from '../functions/api/contact.js';

const env = { TURNSTILE_SECRET_KEY: 'a-very-secret-key', RESEND_API_KEY: 'other-secret', CONTACT_FROM_EMAIL: 'reports@test.example', CONTACT_TO_EMAIL: 'private-recipient@test.example' };
const origin = 'https://filemorning.com';
function form(overrides = {}) { return { kind:'problem', tool:'Convert Image', browser:'Chrome', os:'Windows', inputFormat:'PNG', outputFormat:'BMP', description:'BMP background is incorrect', steps:'Load PNG then convert to BMP', errorMessage:'', website:'', turnstileToken:'valid-test-token', ...overrides }; }
function request(body=form(), options={}) { return new Request(`${origin}/api/contact`, { method:'POST', headers: {'Origin':options.origin || origin, 'Content-Type':options.contentType || 'application/json'}, body:options.raw || JSON.stringify(body) }); }
async function invoke(payload=form(), options={}) {
  const calls=[]; const previous=globalThis.fetch;
  globalThis.fetch=async (url, init)=>{
    calls.push([url, init]);
    if (url.includes('turnstile')) return Response.json(options.verify || {success:true, hostname:'filemorning.com'});
    if (url.includes('resend')) return Response.json({id:'a-123'}, {status:options.sendStatus || 200});
    throw new Error('Unexpected URL');
  };
  try { return {res:await onRequestPost({request:request(payload,options),env:options.env || env}),calls}; }
  finally {globalThis.fetch=previous;}
}

test('anonymous report: verified once and emailed without name, email, screenshot or visitor IP',async()=>{
  const {res,calls}=await invoke();
  assert.equal(res.status,200);assert.equal(calls.length,2);
  assert.match(calls[0][0],/turnstile\/v0\/siteverify/);
  assert.ok(!String(calls[0][1].body).includes('remoteip='));
  const sent=JSON.parse(calls[1][1].body);
  assert.equal(sent.to[0], env.CONTACT_TO_EMAIL);
  assert.match(sent.text,/BMP background/);
  for(const field of ['visitorIp','remoteip','screenshot','attachment','visitorEmail']) assert.ok(!Object.hasOwn(sent,field));
  assert.doesNotMatch(sent.text,/123\.45\.67\.89/);
  assert.ok(!(await res.text()).includes(env.CONTACT_TO_EMAIL));
});
test('rejects invalid origin before any network call',async()=>{
  const {res,calls}=await invoke(form(),{origin:'https://attacker.test'});
  assert.equal(res.status,403); assert.equal(calls.length,0);
});
test('rejects non-JSON body',async()=>{
  const {res,calls}=await invoke(form(),{contentType:'text/plain'});
  assert.equal(res.status,415); assert.equal(calls.length,0);
});
test('rejects invalid Turnstile and sends no email',async()=>{
  const {res,calls}=await invoke(form(),{verify:{success:false,hostname:'filemorning.com'}});
  assert.equal(res.status,403); assert.equal(calls.length,1);
});
test('rejects Turnstile hostname mismatch',async()=>{
  const {res,calls}=await invoke(form(),{verify:{success:true,hostname:'spoofed.example'}});
  assert.equal(res.status,403); assert.equal(calls.length,1);
});
test('fail closed when encrypted settings are not configured',async()=>{
  const {res,calls}=await invoke(form(),{env:{}});
  assert.equal(res.status,503); assert.equal(calls.length,0);
});
test('description must contain no more than 30 words',async()=>{
  const {res,calls}=await invoke(form({description:Array(31).fill('word').join(' ')}));
  assert.equal(res.status,400); assert.equal(calls.length,0);
});
test('oversize streaming request rejected',async()=>{
  const {res,calls}=await invoke(form(),{raw:JSON.stringify(form({steps:'S'.repeat(30_000)}))});
  assert.equal(res.status,413); assert.equal(calls.length,0);
});
test('invalid technical formats and missing reproducibility steps rejected',async()=>{
  for(const p of [form({outputFormat:'../png'}),form({steps:''}),form({tool:''})]){
    const {res,calls}=await invoke(p); assert.equal(res.status,400); assert.equal(calls.length,0);
  }
});
test('suggestion needs only a short description',async()=>{
  const {res,calls}=await invoke(form({kind:'suggestion',tool:'',steps:''}));
  assert.equal(res.status,200); assert.equal(calls.length,2);
});
test('honeypot does not trigger delivery',async()=>{
  const {res,calls}=await invoke(form({website:'https://bot.example'}));
  assert.equal(res.status,200); assert.equal(calls.length,0);
});
test('sending provider error never leaks secrets',async()=>{
  const {res,calls}=await invoke(form(),{sendStatus:500});
  assert.equal(res.status,502); assert.equal(calls.length,2);
  assert.ok(!(await res.text()).includes(env.CONTACT_TO_EMAIL));
});
test('GET is not a send endpoint',async()=>{
  const res=onRequest(); assert.equal(res.status,405);
});
test('public files never include sender secrets or a recipient address',()=>{
  for(const f of ['layouts/_default/contact.html','static/js/contact-form.js','static/css/contact-form.css','content/contact/_index.md','content/privacy/_index.md','layouts/partials/footer.html','config.toml']){
    const s=fs.readFileSync(f,'utf8');
    for(const secret of Object.values(env)) assert.ok(!s.includes(secret),`${f} must not embed secret`);
  }
  const routes=JSON.parse(fs.readFileSync('static/_routes.json','utf8'));
  assert.deepEqual(routes.include,['/api/contact']);
});
test('legal and privacy pages remain drafts until identity and provider disclosures verified',()=>{
  for(const file of ['contact','privacy','legal']) assert.match(fs.readFileSync(`content/${file}/_index.md`,'utf8'),/^draft: true$/m);
});
