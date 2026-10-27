/* Node-only deterministic IndexedDB/BroadcastChannel scenario (no browser needed).
 * Run: node --test tests/test-storage-isolation.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

const source = fs.readFileSync('themes/high-tech-theme/static/js/common/file-storage.js','utf8');
const database = new Map();
const events = [];
const idb = {
    open() {
        const request = {};
        const db = {
            objectStoreNames: { contains: () => true },
            transaction(_store, mode) {
                const tx = { error: null };
                const operations = {
                    put(data, key) { database.set(key,structuredClone(data)); queueMicrotask(() => tx.oncomplete?.()); },
                    delete(key) { database.delete(key); queueMicrotask(() => tx.oncomplete?.()); },
                    get(key) {
                        const response = { result: undefined };
                        queueMicrotask(() => { response.result=database.get(key); response.onsuccess?.(); });
                        return response;
                    }
                };
                tx.objectStore = () => operations;
                return tx;
            },
            close() {}
        };
        queueMicrotask(() => {request.result=db; request.onsuccess?.();});
        return request;
    }
};
const storage = values => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key,value) => values.set(key,String(value))
});
const makeTab = (values=new Map()) => {
    const listeners=[];
    const ctx=vm.createContext({ console, indexedDB:idb, File, Blob, Date, crypto:webcrypto,
        setTimeout, clearTimeout, BroadcastChannel, sessionStorage:storage(values),
        document:{dispatchEvent: event=>events.push(event.type)}, CustomEvent: class {constructor(type,init){this.type=type;this.detail=init?.detail;}},
        window:{addEventListener:(_type, listener)=>listeners.push(listener)} });
    vm.runInContext(source,ctx);
    // Disable the optional orphan cleanup in this isolated IDB mock; tested separately in browsers.
    vm.runInContext('pruneFileStorage = async () => {}',ctx);
    return {ctx,values,close:()=>listeners.forEach(fn=>fn())};
};
const call = (tab,expression) => vm.runInContext(expression,tab.ctx);
test('duplicate tabs cannot overwrite one another; navigation preserves selection', async () => {
    const a=makeTab();
    const idA=await call(a,'ensureFileStorageSession()');
    await call(a,'saveSelectedFiles([new File(["AAAA"],"a.pdf")],"Document")');
    assert.equal((await call(a,'loadSelectedFiles()')).files[0].file.name,'a.pdf');
    const b=makeTab(new Map(a.values)); // Chromium duplicate-tab sessionStorage clone
    const idB=await call(b,'ensureFileStorageSession()');
    assert.notEqual(idA,idB);
    assert.equal(await call(b,'loadSelectedFiles()'),null);
    await call(b,'saveSelectedFiles([new File(["BBBB"],"b.pdf")],"Document")');
    assert.equal((await call(a,'loadSelectedFiles()')).files[0].file.name,'a.pdf');
    assert.equal((await call(b,'loadSelectedFiles()')).files[0].file.name,'b.pdf');
    await call(b,'clearStoredFiles()');
    assert.equal((await call(a,'loadSelectedFiles()')).files[0].file.name,'a.pdf');
    a.close();
    const navigated=makeTab(a.values);
    assert.equal(await call(navigated,'ensureFileStorageSession()'),idA);
    assert.equal((await call(navigated,'loadSelectedFiles()')).files[0].file.name,'a.pdf');
    navigated.close();b.close();
});
