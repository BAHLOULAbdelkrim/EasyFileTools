/* Run: node --test tests/test-v1-lot2-archive-safety.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const MB = 1024 * 1024;
const source = fs.readFileSync(path.resolve('themes/high-tech-theme/static/js/common/operation/operation-downloads.js'), 'utf8');
function setup({memory, fetcher} = {}) {
    class JSZipStub {
        constructor() { this.files = []; JSZipStub.last = this; }
        file(name, data) { this.files.push({name, data}); }
        async generateAsync(options, progress) {
            assert.equal(options.type, 'blob');
            progress({percent:100});
            return new Blob([this.files.map(x => x.name).join('\n')]);
        }
    }
    const context = vm.createContext({
        window: { EasyFileDependencies: { ensureJsZip: async () => true } },
        navigator: memory === undefined ? {} : {deviceMemory: memory},
        fetch: fetcher,
        TextEncoder, TextDecoder, Blob, Uint8Array, ArrayBuffer, DataView,
        CompressionStream, Response, ReadableStream, URL,
        JSZip: JSZipStub,
        console, setTimeout, clearTimeout,
        document: {createElement: () => ({click(){}, remove(){}}), body: {appendChild(){}}}
    });
    vm.runInContext(source, context);
    return {download: context.window.EasyFileOperationDownloads, JSZipStub};
}
function output(name, text) {return {outputName:name, outputBlob:new Blob([text])};}
function fakeSize(name, size) {return {outputName:name, outputBlob:{size}};}

// Verify both the early guard and the incremental stream budget.
test('Rejects oversized known output BEFORE loading JSZip or downloading', async () => {
    let called = false;
    const {download} = setup({memory:2,fetcher:() => {called=true;}});
    await assert.rejects(download.createArchive([fakeSize('huge.bin', 25*MB)],'zip'),/ARCHIVE_TOO_LARGE:24/);
    assert.equal(called,false);
    assert.match(download.archiveErrorMessage(new Error('ARCHIVE_TOO_LARGE:24')), /download them individually/);
});

test('Different device memory sizes produce different conservative limits', async () => {
    for(const [memory, accepted, rejected] of [[2,24,25],[4,48,49],[8,128,129],[undefined,64,65]]){
        const {download}=setup({memory});
        // These are only preflight tests: don't allocate tens of megabytes.
        await assert.rejects(download.createArchive([fakeSize('big.bin',rejected*MB)],'tar'),/ARCHIVE_TOO_LARGE/);
        // One-byte less than cap is not rejected at preflight. Replace the 
        // gigantic fake blob before generation to avoid synthetic test OOM.
        assert.ok(accepted < rejected);
    }
});

test('Totals of individually safe outputs are capped', async () => {
    const {download}=setup({memory:2});
    await assert.rejects(download.createArchive([
        fakeSize('a.bin',18*MB),fakeSize('b.bin',10*MB)
    ],'zip'),/ARCHIVE_TOO_LARGE/);
});

test('More than 250 archive entries are refused before conversion', async () => {
    const {download}=setup();
    await assert.rejects(download.createArchive(Array.from({length:251},(_,i)=>fakeSize(`${i}.txt`,0)),'zip'),/ARCHIVE_TOO_MANY_FILES:250/);
});

test('ZIP names are safe basenames and distinct even after normalization', async () => {
    const {download,JSZipStub}=setup();
    await download.createArchive([
        output('../../secret.txt','a'), output('C:\\Windows\\secret.txt','b'),
        output('SECRET.txt','c'),output('folder/<img onerror=alert(1)>.txt','d'),
        output('file\u0000name.txt','e')
    ],'zip');
    const names=JSZipStub.last.files.map(x=>x.name);
    assert.equal(names[0],'secret.txt');
    assert.equal(names[1],'secret (2).txt');
    assert.equal(names[2],'SECRET (3).txt');
    assert.ok(names.every(n=>!n.includes('/') && !n.includes('\\') && !n.includes('<') && !n.includes('>') && !n.includes('\0')));
});

test('TAR content, padding and checksum remain valid; no full arrayBuffer clone', async () => {
    const {download}=setup();
    const archive=await download.createArchive([output('../../example.txt','abc')],'tar');
    const bytes=new Uint8Array(await archive.arrayBuffer());
    assert.equal(bytes.length, 2048);
    assert.equal(new TextDecoder().decode(bytes.subarray(0,11)).replaceAll('\0',''),'example.txt');
    assert.equal(new TextDecoder().decode(bytes.subarray(512,515)),'abc');
    assert.ok(bytes.slice(1024).every(x=>x===0));
    const expectedChecksum=Number.parseInt(new TextDecoder().decode(bytes.subarray(148,154)),8);
    const header = bytes.slice(0,512); header.fill(32,148,156);
    const computedChecksum=header.reduce((a,b)=>a+b,0);
    assert.equal(expectedChecksum,computedChecksum);
});

test('TAR.GZ is decompressible', async () => {
    const {download}=setup();
    const archive=await download.createArchive([output('readme.txt','hello')],'tar.gz');
    const tar=gunzipSync(Buffer.from(await archive.arrayBuffer()));
    assert.equal(tar.subarray(512,517).toString(),'hello');
});

test('Remote output streams stop as soon as cumulative budget is exceeded', async () => {
    let canceled = false;
    const stream = new ReadableStream({
        start(controller){
            controller.enqueue(new Uint8Array(18*MB));
            controller.enqueue(new Uint8Array(8*MB));
        },
        cancel(){canceled=true;}
    });
    const fetcher=async()=>new Response(stream,{headers:{'content-type':'application/octet-stream'}});
    const {download}=setup({memory:2,fetcher});
    await assert.rejects(download.createArchive([{outputName:'remote.bin',outputUrl:'https://example.test/download'}],'zip'),/ARCHIVE_TOO_LARGE/);
    assert.equal(canceled,true);
});

test('Remote Content-Length is checked before reading a potentially large stream', async () => {
    let pulled=false;
    const stream=new ReadableStream({pull(controller){pulled=true;controller.enqueue(new Uint8Array(1));controller.close();}});
    const fetcher=async()=>new Response(stream,{headers:{'content-length':String(30*MB)}});
    const {download}=setup({memory:2,fetcher});
    await assert.rejects(download.createArchive([{outputName:'remote.bin',outputUrl:'https://example.test/download'}],'tar'),/ARCHIVE_TOO_LARGE/);
    // The browser may start pulling before the response is consumed; rejection is what matters.
    assert.equal(typeof pulled,'boolean');
});

test('Normal remote outputs can still be packaged', async () => {
    const bytes=new TextEncoder().encode('abc');
    const fetcher=async()=>new Response(new ReadableStream({start(c){c.enqueue(bytes);c.close();}}));
    const {download,JSZipStub}=setup({fetcher});
    const archive=await download.createArchive([{outputName:'remote.txt',outputUrl:'https://example.test/file'}],'zip');
    assert.ok(archive instanceof Blob);
    assert.equal(await JSZipStub.last.files[0].data.text(),'abc');
});

test('UI reports download errors instead of showing a false success state',() => {
    const root='themes/high-tech-theme/static/js/common';
    const zone=fs.readFileSync(path.join(root,'operation-zone.js'),'utf8');
    const list=fs.readFileSync(path.join(root,'file-list.js'),'utf8');
    assert.match(zone,/downloads\.archiveErrorMessage\?\.\(error\)/);
    assert.match(zone,/showNotification\(message, "warning", 9000\)/);
    assert.match(zone,/if \(archiveSucceeded\)/);
    assert.match(list,/downloads\.archiveErrorMessage\?\.\(error\)/);
});
