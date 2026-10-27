import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname, join} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = p => readFileSync(join(root, p), 'utf8');
const converter = source('themes/high-tech-theme/static/js/video/convert-video/video-converter.js');
const loader = source('themes/high-tech-theme/static/js/audio/convert-audio/ffmpeg-loader.js');

function createHarness(videoCodec, audioCodec) {
  const commands=[];const emitted=[];const deleted=[];const resets=[];
  const fake={
    on(){},off(){},
    async ffprobe(args){commands.push(['probe',...args]);},
    async readFile(path){
      if(path.startsWith('eft_video_probe_')) return JSON.stringify({streams:[
        {codec_type:'video',codec_name:videoCodec},
        ...(audioCodec?[{codec_type:'audio',codec_name:audioCodec}]:[])
      ]});
      return new Uint8Array([7,8,9]);
    },
    async deleteFile(path){deleted.push(path)}
  };
  class MockFile {constructor(name){this.name=name;} async arrayBuffer(){return new Uint8Array([1,2,3]).buffer}}
  class MockEvent {constructor(name,{detail}) {this.name=name;this.detail=detail}}
  const sandbox={
    console:{log(){},info(){},warn(){},error(){},debug(){}},
    window:{},document:{dispatchEvent:e=>emitted.push(e)},CustomEvent:MockEvent,
    File:MockFile,Blob,Uint8Array,URL:{createObjectURL:()=> 'blob:fake'},
    setInterval,clearInterval,
    getFFmpeg:async()=>fake,
    writeFile:async()=>{},
    readFile:async path=>fake.readFile(path),
    deleteFile:async path=>deleted.push('WRAPPER:'+path),
    exec:async args=>{commands.push(args)},
    resetFFmpeg:async()=>{resets.push(1)}
  };
  vm.runInNewContext(converter,sandbox);
  return {commands,emitted,deleted,resets,sandbox,file:new MockFile('sample.mp4')};
}
async function run(h,settings){
  await h.sandbox.window.VideoConverter.convertFiles([h.file],{resolution:'original',quality:'fast',keepAudio:true,...settings});
  const end=h.emitted.find(e=>e.name==='easyfiletools:video-conversion-ended');
  assert.ok(end,'completion event');
  assert.equal(end.detail.error,null,`Unexpected conversion error: ${end.detail.error?.message}`);
  assert.ok(h.deleted.every(p=>!p.startsWith('WRAPPER:')),'cleanup must not reload FFmpeg');
  return h.commands.find(a=>a[0]==='-i');
}

test('Fast MP4 H264/AAC => MKV uses stream copy', async()=>{
  const args=await run(createHarness('h264','aac'),{format:'mkv'});
  assert.ok(args.includes('copy'));assert.ok(!args.includes('libx264'));
});
test('Fast MP4 H264/AAC => WebM uses accelerated VP8 encoder, no fake copy', async()=>{
  const args=await run(createHarness('h264','aac'),{format:'webm'});
  assert.ok(args.includes('libvpx'));assert.ok(args.includes('realtime'));assert.ok(args.includes('8'));
  assert.ok(!args.includes('copy'));
});
test('Fast WebM VP8/Opus => WebM preserves both streams', async()=>{
  const h=createHarness('vp8','opus');h.file=new h.sandbox.File('sample.webm');
  const args=await run(h,{format:'webm'});
  assert.equal(args.filter(a=>a==='copy').length,2);
});
test('Fast WebM VP8/AAC => WebM copies video but transcodes audio', async()=>{
  const args=await run(createHarness('vp8','aac'),{format:'webm'});
  assert.ok(args.includes('copy'));assert.ok(args.includes('libopus'));
  assert.ok(!args.includes('libvpx'));
});
test('Fast MP4 => MP4 reencodes when destination cannot support video codec', async()=>{
  const args=await run(createHarness('vp8','opus'),{format:'mp4'});
  assert.ok(args.includes('libx264'));assert.ok(args.includes('ultrafast'));
});
test('Fatal WebAssembly errors do not cause a ReferenceError', async()=>{
  class FFmpeg {
    on(){}off(){} async load(){} async exec(){throw new WebAssembly.RuntimeError('memory access out of bounds')}
    terminate(){this.terminated=true}
  }
  const sandbox={console:{log(){},error(){},debug(){}},FFmpegWASM:{FFmpeg},WebAssembly,
    Uint8Array,Date,Array,Number,String,Error};
  vm.runInNewContext(loader,sandbox);
  const ffmpeg=await sandbox.getFFmpeg();
  await assert.rejects(sandbox.exec(['-i','x.mp4','x.webm']),/crashed inside the WebAssembly runtime/);
  assert.equal(ffmpeg.terminated,true);
});
test('Out-of-memory with FFmpeg exit code 1 also resets the poisoned worker',async()=>{
  class FFmpeg {
    constructor(){this.listeners=[];}
    on(ev,fn){if(ev==='log')this.listeners.push(fn)}
    off(ev,fn){this.listeners=this.listeners.filter(x=>x!==fn)}
    async load(){}
    async exec(){for(const fn of this.listeners)fn({message:'Failed to inject frame into filter network: Out of memory'});return 1;}
    terminate(){this.terminated=true}
  }
  const sandbox={console:{log(){},error(){},debug(){}},FFmpegWASM:{FFmpeg},WebAssembly,
    Uint8Array,Date,Array,Number,String,Error};
  vm.runInNewContext(loader,sandbox);
  const ffmpeg=await sandbox.getFFmpeg();
  await assert.rejects(sandbox.exec(['-i','x.mp4','x.webm']),/Out of memory/);
  assert.equal(ffmpeg.terminated,true);
});

test('A rejected stream-copy can safely fall back to encoding without losing the input',async()=>{
  const h=createHarness('h264','aac');
  h.sandbox.exec=async args=>{
    h.commands.push(args);
    if(args.includes('copy'))throw new Error('muxer rejected input bitstream');
  };
  await run(h,{format:'mkv'});
  const runs=h.commands.filter(a=>a[0]==='-i');
  assert.equal(runs.length,2);
  assert.ok(runs[0].includes('copy'));
  assert.ok(runs[1].includes('libx264'));
});


test('FFmpeg is released after a completed batch so a second conversion gets a fresh worker',async()=>{
  const h=createHarness('h264','aac');
  await run(h,{format:'mkv'});
  assert.equal(h.resets.length,1);
  h.emitted.length=0;
  await run(h,{format:'webm'});
  assert.equal(h.resets.length,2);
});

test('FFmpeg is also released if a conversion fails',async()=>{
  const h=createHarness('h264','aac');
  h.sandbox.exec=async()=>{throw new Error('Simulated encoder error')};
  await h.sandbox.window.VideoConverter.convertFiles([h.file],{
    resolution:'original',quality:'fast',keepAudio:true,format:'webm'
  });
  const end=h.emitted.find(e=>e.name==='easyfiletools:video-conversion-ended');
  assert.match(end?.detail?.error?.message||'',/Simulated encoder error/);
  assert.equal(h.resets.length,1);
});

test('All four video engines release FFmpeg at the end of each batch',()=>{
  for (const name of [
    'convert-video/video-converter.js',
    'compress-video/video-compressor.js',
    'trim-video/video-trimmer.js',
    'video-to-audio/video-audio-extractor.js'
  ]) {
    const file=source('themes/high-tech-theme/static/js/video/'+name);
    assert.match(file,/Release the FFmpeg WebAssembly worker after each batch/);
    assert.match(file,/resetFFmpeg\(\)/);
  }
});
