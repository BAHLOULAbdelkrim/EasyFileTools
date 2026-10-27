import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = path => readFileSync(resolve(root, path), 'utf8');
const controllerSource = source('themes/high-tech-theme/static/js/common/operation/operation-controller.js');
const compressorSource = source('themes/high-tech-theme/static/js/video/compress-video/video-compressor.js');
const settleMicrotasks = async () => {for (let i=0; i<18; i++) await Promise.resolve();};

function makeHarness() {
  const hooks = new Map();
  const sleepQueue = [];
  const newButton = () => ({disabled: false, innerHTML: '', classList: {toggle() {}}, addEventListener() {}});
  const elements = {
    'operation-zone': {dataset: {operation: 'compress-video'}},
    convertBtn: newButton(), cancelOperationBtn: newButton(), pauseOperationBtn: newButton()
  };
  const progress = {value: 71, reset(){this.value=0;}};
  const document = {
    getElementById: key => elements[key] || null,
    addEventListener: (event, listener) => hooks.set(event, [...(hooks.get(event) || []), listener]),
    dispatchEvent: event => {for (const cb of hooks.get(event.type) || []) cb(event);}
  };
  let active = null;
  let count = 0;
  const browser = {
    convertFile() {
      count++;
      return new Promise((resolve, reject) => {active = {resolve, reject};});
    },
    async cancel() {
      if (!active) return;
      const old = active;
      active = null;
      const error = new Error('Aborted'); error.name = 'ConversionCanceledError';
      old.reject(error);
    }
  };
  class InputFile {
    constructor(){this.name = 'video.mp4';this.size = 100000;}
    async arrayBuffer(){return new ArrayBuffer(10);}
  }
  const ctx = {
    window: {EasyFileWebCodecs: browser, EasyFileOperationProgress: progress,
      EasyFileOperationConfig: {get:()=>({})}},
    document, File: InputFile, Blob, Uint8Array, Promise,
    console: {log(){}, info(){}, warn(){}, error(){}},
    CustomEvent: class {constructor(type, {detail}={}){this.type=type;this.detail=detail;}},
    setTimeout(callback){sleepQueue.push(callback);},
    getFFmpeg:async()=>{throw new Error('Unexpected FFmpeg fallback after Cancel');},
    resetFFmpeg(){},
    URL: {createObjectURL:()=> 'blob:out'}
  };
  vm.runInNewContext(compressorSource, ctx);
  vm.runInNewContext(controllerSource, ctx);
  for (const listener of hooks.get('DOMContentLoaded') || []) listener();
  const controller = ctx.window.EasyFileOperationController;
  const engine = ctx.window.VideoCompressor;
  controller.registerAdapter({
    run:()=>engine.compressFiles([new InputFile()], {container:'webm',preset:'balanced',keepSmaller:false}),
    pause:()=>engine.pause(), resume:()=>engine.resume(), cancel:()=>engine.cancel()
  });
  controller.setReady(true);
  return {controller,elements,progress,sleepQueue, get conversionCount(){return count;}};
}

test('Compress -> Pause -> Cancel: first click stops all work and re-enables Compress automatically', async()=>{
  const h = makeHarness();
  const running = h.controller.run();
  await settleMicrotasks();
  assert.equal(h.conversionCount,1);
  assert.equal(h.controller.getState().status,'running');
  const pausing = h.controller.pause();
  await pausing;
  await settleMicrotasks();
  assert.equal(h.controller.getState().status,'paused');
  h.progress.value = 83;
  const cancelling = h.controller.cancel();
  assert.equal(h.progress.value,0);
  // If a legacy timer is queued, wake it too; no replacement conversion may start.
  for (const wake of h.sleepQueue.splice(0)) wake();
  await cancelling;
  await settleMicrotasks();
  assert.equal(h.conversionCount,1, 'Cancel after Pause must not start a second conversion');
  assert.equal(await running,false, 'the cancelled run must settle without another click');
  assert.equal(h.controller.getState().status,'cancelled');
  assert.equal(h.elements.cancelOperationBtn.disabled,true);
  assert.equal(h.elements.convertBtn.disabled,false);
  assert.equal(h.progress.value,0);
});

test('Compress -> Pause -> Cancel also works when Cancel interrupts an unfinished Pause call',async()=>{
  const h=makeHarness();
  const running=h.controller.run();
  await settleMicrotasks();
  const pausing=h.controller.pause();
  const cancelling=h.controller.cancel();
  for (const wake of h.sleepQueue.splice(0)) wake();
  await cancelling;
  await pausing;
  await settleMicrotasks();
  assert.equal(h.conversionCount,1);
  assert.equal(await running,false);
  assert.equal(h.controller.getState().status,'cancelled');
  assert.equal(h.elements.cancelOperationBtn.disabled,true);
  assert.equal(h.elements.convertBtn.disabled,false);
});


test('Compress -> Pause -> Resume: sleeping batch wakes and starts exactly one intentional retry', async()=>{
  const h=makeHarness();
  const running=h.controller.run();
  await settleMicrotasks();
  const pausing=h.controller.pause();
  await pausing;
  await settleMicrotasks();
  assert.equal(h.conversionCount,1);
  await h.controller.resume();
  await settleMicrotasks();
  assert.equal(h.conversionCount,2, 'Resume must wake the paused batch without an extra click');
  assert.equal(h.controller.getState().status,'running');
  await h.controller.cancel();
  assert.equal(await running,false);
  assert.equal(h.conversionCount,2,'Cancel must not launch a third encoding');
  assert.equal(h.elements.convertBtn.disabled,false);
  assert.equal(h.elements.cancelOperationBtn.disabled,true);
});
