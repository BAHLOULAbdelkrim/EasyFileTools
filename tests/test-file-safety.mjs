/* Run: node --test tests/test-file-safety.mjs (Node 22+) */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve('themes/high-tech-theme/static/js/common');
const ctx = vm.createContext({ window: {}, console, File, Blob, TextDecoder, DataView, Uint8Array, URL, AbortController, setTimeout, clearTimeout, fetch: null, Response, ReadableStream });
const run = file => vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), ctx);
run('file-policy.js');
run('safe-html.js');
run('url-import.js');
const policy = ctx.window.EasyFilePolicy;
const uploader = ctx.window.EasyFileUrlImport;
const make = (name, size = 10, type = 'application/octet-stream') => new File([new Uint8Array(size)], name, { type });

 test('Six key category limits and unsupported extensions', () => {
    assert.equal(policy.profiles.Image.maxFileMB, 40);
    assert.equal(policy.profiles.Video.maxFiles, 3);
    assert.equal(policy.profiles.Document.maxFileMB, 60);
    assert.equal(policy.resolve({operation:'remove-background'}).maxFileMB, 20);
    assert.equal(policy.validate(make('scan.tiff'), {category:'Image'}).ok, false);
    assert.equal(policy.validate(make('scan.pdf'), {category:'Document'}).ok, true);
    assert.equal(policy.validate(make('scan.pdf'), {category:'Image'}).ok, false);
    assert.equal(policy.validate(make('big.mov',101 * 1048576),{category:'Video'}).ok,false);
    assert.equal(policy.validate(make('a.jpg'),{category:'Image',count:10}).ok,false);
    assert.equal(policy.validate(make('a.jpg'),{category:'Image',totalBytes:150 * 1048576}).ok,false);
 });
 test('HTML names are escaped, not interpreted', () => {
    const dangerous = '<img src=x onerror="alert(1)">&';
    assert.equal(ctx.easyFileEscapeHtml(dangerous), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
 });
 test('PDF and raster magic validation', async () => {
    const bad = new File(['<html>oops</html>'],'report.pdf',{type:'application/pdf'});
    assert.equal((await policy.inspect(bad)).ok,false);
    const good = new File(['%PDF-1.5\n...'],'report.pdf',{type:'application/pdf'});
    assert.equal((await policy.inspect(good)).ok,true);
    const fakePNG = new File(['not PNG'], 'photo.png',{type:'image/png'});
    assert.equal((await policy.inspect(fakePNG)).ok,false);
 });
 test('URL rejects insecure and credential-bearing URLs', async () => {
    await assert.rejects(uploader.download('http://example.org/a.pdf',{limitBytes:100}), /HTTPS/);
    await assert.rejects(uploader.download('https://user:pass@example.org/a.pdf',{limitBytes:100}), /credentials/);
    await assert.rejects(uploader.download('file:///tmp/test',{limitBytes:100}), /HTTPS/);
 });
 const fakeResponse = (chunks, type='application/pdf', headers={}) => {
    const body = new ReadableStream({start(controller) { for(const data of chunks) controller.enqueue(new TextEncoder().encode(data)); controller.close(); }});
    const response = new Response(body, {headers:{'content-type':type,...headers}});
    Object.defineProperty(response, 'url', {configurable:true, value:'https://files.example/test.pdf'});
    return response;
 };
 test('URL streams and reports incremental progress', async () => {
    ctx.fetch = async () => fakeResponse(['%PDF-','1.7\n','yes']);
    const progress=[];
    const file=await uploader.download('https://files.example/test.pdf',{limitBytes:200,onProgress:(received,total)=>progress.push(received)});
    assert.equal(file.name,'test.pdf');
    assert.equal(await file.text(),'%PDF-1.7\nyes');
    assert.equal(progress.at(-1),file.size);
    assert.ok(progress.length>=2);
 });
 test('URL aborts on declared or streamed size limit', async () => {
    ctx.fetch=async () => fakeResponse(['test'], 'application/pdf', {'content-length':'999'});
    await assert.rejects(uploader.download('https://files.example/test.pdf',{limitBytes:10}),/size/);
    ctx.fetch=async () => fakeResponse(['abcdef','ghijkl']);
    await assert.rejects(uploader.download('https://files.example/test.pdf',{limitBytes:10}),/size/);
 });
 test('URL response cannot be mistaken for file after redirect to HTTP', async () => {
    ctx.fetch=async () => {
        const response=fakeResponse(['%PDF-1.7']);
        Object.defineProperty(response,'url',{value:'http://files.example/test.pdf'});
        return response;
    };
    await assert.rejects(uploader.download('https://files.example/test.pdf',{limitBytes:100}),/non-HTTPS/);
 });
 test('Only implemented operations appear on homepage with supported files', () => {
    run('file-categories.js');
    run('operations-config.js');
    const valid = ctx.getCompatibleOperations('Image', 1, [make('photo.png')]);
    assert.ok(valid.length>0);
    assert.ok(valid.every(operation => policy.supported.has(operation.id)));
    const invalid=ctx.getCompatibleOperations('Image', 1, [make('scan.tiff')]);
    assert.equal(invalid.length,0);
    assert.equal(ctx.getCompatibleOperations('Document',1,[make('document.docx')]).length,0);
    assert.equal(ctx.getCompatibleOperations('Document',2,[make('a.pdf'),make('b.pdf')]).some(op=>op.id==='merge-pdf'),true);
 });
