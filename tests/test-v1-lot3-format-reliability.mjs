import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {inspectGeneratedFile} from '../scripts/check-generated-files.mjs';

const policySource = fs.readFileSync('themes/high-tech-theme/static/js/common/file-policy.js','utf8');
const context = vm.createContext({window:{}, Blob, File, navigator:{}, TextDecoder, Uint8Array, DataView, console});
vm.runInContext(policySource, context);
const policy = context.window.EasyFilePolicy;
const file = (name, text) => new File([Buffer.from(text, 'binary')], name);

test('V1 input inspection recognizes real WAV and refuses renamed non-WAV', async () => {
  const wave = Buffer.alloc(44); wave.write('RIFF',0);wave.write('WAVE',8);
  assert.equal((await policy.inspect(new File([wave],'music.wav'))).ok, true);
  const bad = await policy.inspect(file('music.wav', '%PDF-1.7'));
  assert.equal(bad.ok,false); assert.match(bad.reason, /\.wav/);
});
test('Ogg/FLAC containers are verified by magic, even with misleading MIME', async () => {
  for (const ext of ['ogg','oga','opus']) {
    assert.equal((await policy.inspect(file('audio.'+ext,'OggS\0\0\0\0'))).ok, true);
    assert.equal((await policy.inspect(file('audio.'+ext,'totally wrong'))).ok, false);
  }
  assert.equal((await policy.inspect(file('a.flac','fLaC\0\0'))).ok,true);
  assert.equal((await policy.inspect(file('a.flac','fLlC\0\0'))).ok,false);
});
test('MP4 and Matroska signatures are checked without pretending to validate codecs', async () => {
  assert.equal((await policy.inspect(file('movie.mp4','\0\0\0\x18ftypisom'))).ok,true);
  assert.equal((await policy.inspect(file('movie.mp4','<html>wrong'))).ok,false);
  const ebml = Buffer.from([0x1a,0x45,0xdf,0xa3,0xa3,0x81,0x00]);
  assert.equal((await policy.inspect(new File([ebml],'movie.mkv'))).ok,true);
  assert.equal((await policy.inspect(new File([ebml],'movie.webm'))).ok,true);
});
test('Image and PDF prior safeguards are not removed', async () => {
  assert.equal((await policy.inspect(file('a.pdf','%PDF-1.7\n...'))).ok,true);
  assert.equal((await policy.inspect(file('a.pdf','HTML fake'))).ok,false);
  assert.equal((await policy.inspect(file('a.jpg','not jpeg'))).ok,false);
  assert.equal(policy.validate(new File(['x'],'scan.tiff'),{category:'Image'}).ok,false);
});
test('Offline output checker reads real signature, not the file extension alone', () => {
  const b = Buffer.from;
  assert.equal(inspectGeneratedFile('picture.png',b([0x89,80,78,71,13,10,26,10])).status,'PASS');
  assert.equal(inspectGeneratedFile('picture.png',b('%PDF-1.7')).status,'FAIL');
  assert.equal(inspectGeneratedFile('photo.jpg',b([0xff,0xd8,0xff,0xe0])).status,'PASS');
  assert.equal(inspectGeneratedFile('document.pdf',b('%PDF-1.7')).status,'PASS');
  assert.equal(inspectGeneratedFile('song.wav',b('RIFF0000WAVE')).status,'PASS');
  assert.equal(inspectGeneratedFile('video.webm',Buffer.concat([b([0x1a,0x45,0xdf,0xa3]),b('webm')])).status,'PASS');
  assert.equal(inspectGeneratedFile('archive.tar',b('something')).status,'CHECK');
  assert.equal(inspectGeneratedFile('unknown.xyz',b('something')).status,'SKIP');
  assert.equal(inspectGeneratedFile('empty.pdf',b([])).status,'FAIL');
});
test('CLI detects mismatched generated files, exits nonzero, and does not read entire large file', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(),'eft-v1-lot3-'));
  try {
    await writeFile(path.join(tmp,'good.pdf'),Buffer.from('%PDF-1.5\n'));
    await writeFile(path.join(tmp,'bad.png'),Buffer.from('%PDF-1.5\n'));
    const out = spawnSync(process.execPath,['scripts/check-generated-files.mjs',tmp],{encoding:'utf8'});
    assert.equal(out.status,1);
    assert.match(out.stdout,/PASS\s+good.pdf/);
    assert.match(out.stdout,/FAIL\s+bad.png/);
    assert.match(out.stdout,/1 mismatches/);
  } finally { await rm(tmp,{recursive:true,force:true}); }
});
test('Document adapter translates known PDF encryption and parsing failures to understandable notifications', async () => {
  const source=fs.readFileSync('themes/high-tech-theme/static/js/document/document-operation-adapter.js','utf8');
  const listeners = new Map();
  let adapter, message;
  const document={
    getElementById:id=>id==='operation-zone'?{dataset:{category:'Document',operation:'split-pdf'}}:null,
    addEventListener:(type,fn)=>listeners.set(type,fn),
    dispatchEvent:()=>{}
  };
  const win={
    EasyFileOperationController:{initialize(){},registerAdapter(a){adapter=a},setReady(){}},
    EasyFileOperationConfig:{get:()=>({minFiles:1})},
    EasyFileOperationLifecycle:{settingsChanged(){}},
    SplitPdfUI:{getSettings:()=>({mode:'extract',indexes:[0]})},
    PdfSplitter:{async split(){ const err=new Error('Input document to PDFDocument.load is encrypted.');err.name='EncryptedPDFError';throw err;}}
  };
  const ctx=vm.createContext({window:win,document,console,CustomEvent:class{constructor(name,opts){this.name=name;this.detail=opts?.detail}},setTimeout,showNotification:(msg)=>{message=msg}});
  vm.runInContext(source,ctx);
  listeners.get('easyfiletools:operation-files-updated')({detail:{operation:'split-pdf',files:[new File(['%PDF-1.5'],'locked.pdf')]}});
  await assert.rejects(adapter.run(),/password-protected/);
  assert.match(message,/unlock/i);
  win.PdfSplitter.split=async()=>{const err=new Error('Invalid PDF structure');err.name='InvalidPDFException';throw err};
  await assert.rejects(adapter.run(),/damaged or invalid/);
  assert.match(message,/PDF reader/);
  win.PdfSplitter.split=async()=>{throw new Error('Out of memory')};
  await assert.rejects(adapter.run(),/Out of memory/);
});
