import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(path, 'utf8');
const header = read('layouts/partials/header.html');
const css = read('themes/high-tech-theme/static/css/main.css');
const keyboard = read('themes/high-tech-theme/static/js/common/keyboard-navigation.js');
const controller = read('themes/high-tech-theme/static/js/common/operation/operation-controller.js');

// Static checks are NOT a Hugo build: these guard the shape and accessibility
// of the fallback menu without trying to implement the template engine.
test('mobile navigation has a native keyboard/touch toggle and a real nav landmark', () => {
  assert.match(header, /<details class="eft-mobile-navigation">/);
  assert.match(header, /<summary>Categories/);
  assert.match(header, /<nav aria-label="Mobile categories">/);
  assert.match(header, /data-easyfile-navigation data-target-category=/);
  assert.match(header, /{{ if \$available }}/);
  assert.match(header, /Coming soon<\/span>/);
});
test('mobile categories appear only in mobile breakpoint, with keyboard focus styles', () => {
  assert.match(css, /\.eft-mobile-navigation\s*\{\s*display:\s*none;/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.eft-mobile-navigation\s*\{\s*display:\s*block;/);
  assert.match(css, /\.top-menus a:focus-visible/);
  assert.match(css, /\.eft-mobile-navigation summary:focus-visible/);
  assert.match(css, /outline:\s*3px solid/);
});
test('Escape closes the menu and returns focus to its native summary', () => {
  let handler, prevented = false, focused = false;
  const summary = {focus() { focused = true; }};
  const menu = {open:true, querySelector: () => summary};
  const document = {
    addEventListener(name, fn) { if (name === 'keydown') handler = fn; },
    querySelector(sel) { return sel === '.eft-mobile-navigation[open]' ? menu : null; }
  };
  vm.runInNewContext(keyboard, {document, console});
  handler({key:'Escape',preventDefault() {prevented=true;}});
  assert.equal(menu.open, false);
  assert.equal(focused, true);
  assert.equal(prevented, true);
});

function harness() {
  const events = {};
  const listeners = {};
  const makeBtn = () => ({
    disabled: true, classList: { toggle(){} },
    addEventListener(type, listener) { listeners[type] = listener; },
    innerHTML: '', title:'',
  });
  const runBtn = makeBtn(), cancelBtn = makeBtn(), pauseBtn = makeBtn();
  const controls = {
    'operation-zone':{dataset:{operation:'convert-image'}},
    convertBtn:runBtn, cancelOperationBtn:cancelBtn, pauseOperationBtn:pauseBtn
  };
  const document = {
    getElementById: id => controls[id]||null,
    addEventListener: (event, fn) => {events[event]=fn;},
    dispatchEvent(){}
  };
  const context = {
    document, console, CustomEvent: class {},
    window:{ EasyFileOperationConfig:{get:()=>({})} }
  };
  vm.runInNewContext(controller,context);
  events.DOMContentLoaded();
  return {api:context.window.EasyFileOperationController, runBtn, cancelBtn, pauseBtn};
}

test('running operation without cancel capability cannot claim to cancel', async () => {
  const {api, cancelBtn, pauseBtn} = harness();
  let resolveRun;
  api.registerAdapter({run: () => new Promise(resolve=>{resolveRun=resolve;})});
  api.setReady(true);
  const running = api.run();
  assert.equal(api.getState().status,'running');
  assert.equal(cancelBtn.disabled,true);
  assert.equal(pauseBtn.disabled,true);
  assert.equal(await api.cancel(),false);
  assert.equal(api.getState().status,'running');
  resolveRun();
  assert.equal(await running,true);
  assert.equal(api.getState().status,'completed');
});

test('cancel remains available when adapter supplies a genuine cancel callback', async () => {
  const {api, cancelBtn} = harness();
  let resolveRun, called = 0;
  api.registerAdapter({
    run: () => new Promise(resolve=>{resolveRun=resolve;}),
    cancel: async () => {called++;}
  });
  api.setReady(true);
  const running = api.run();
  assert.equal(cancelBtn.disabled,false);
  assert.equal(await api.cancel(),true);
  assert.equal(called,1);
  assert.equal(api.getState().status,'cancelled');
  resolveRun();
  assert.equal(await running,false);
});

test('pause control still requires both pause and resume', async () => {
  const {api, pauseBtn} = harness();
  let resolveRun;
  api.registerAdapter({run:()=>new Promise(resolve=>resolveRun=resolve),pause:async()=>{}});
  api.setReady(true);
  const running=api.run();
  assert.equal(pauseBtn.disabled,true);
  resolveRun();
  await running;
});

test('failed cancel cannot strand the interface in cancelling', async () => {
  const {api, cancelBtn} = harness();
  let resolveRun, errorNotified = false;
  api.registerAdapter({
    run: () => new Promise(resolve => {resolveRun=resolve;}),
    cancel: async () => {throw new Error('Device rejected cancellation');}
  });
  api.setReady(true);
  const running = api.run();
  assert.equal(cancelBtn.disabled,false);
  assert.equal(await api.cancel(),false);
  assert.equal(api.getState().status,'error');
  resolveRun();
  await running;
});
