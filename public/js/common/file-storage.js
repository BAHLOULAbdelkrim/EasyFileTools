/* Per-tab IndexedDB selection — navigation and reload survive; sibling tabs isolated.
 * Keys are session-scoped, not the former global "currentSession" entry.
 */
const FILE_STORAGE_DB = "FileToolsDB";
const FILE_STORAGE_STORE = "selectedFiles";
const FILE_STORAGE_SESSION_MARKER = "easyfiletools:file-session-v2";
const FILE_STORAGE_PREFIX = "selection:v2:";
let fileStorageCache = undefined;
let fileStorageLoadPromise = null;
let fileStorageSessionPromise = null;
let fileStoragePendingWrite = Promise.resolve();
let fileStorageSessionId = null;

/* V4.2: lightweight same-tab visual hint, NOT another copy of file data. */
const FILE_STORAGE_VISUAL_HINT = "easyfiletools:restore-hint-v42";
function updateFileStorageVisualHint(data) {
    const count = data?.files?.length || 0;
    if (!count) clearPendingFileRestoreLayout();
    try {
        if (!count || !fileStorageSessionId) {
            sessionStorage.removeItem(FILE_STORAGE_VISUAL_HINT);
            return;
        }
        sessionStorage.setItem(FILE_STORAGE_VISUAL_HINT, JSON.stringify({
            sessionId: fileStorageSessionId,
            category: data.category || data.files[0]?.category || "",
            count: Math.min(count, 10)
        }));
    } catch (_) { /* sessionStorage can be disabled independently of IndexedDB */ }
}
function clearPendingFileRestoreLayout() {
    // Some embedded/test contexts provide storage without a full DOM.
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
    document.querySelectorAll('.file-list-container[data-restore-pending="true"]').forEach(list => {
        list.removeAttribute("data-restore-pending");
        list.style.removeProperty("--easyfile-expected-rows");
        list.querySelector("#file-list")?.removeAttribute("aria-busy");
    });
}


function openFileStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(FILE_STORAGE_DB, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(FILE_STORAGE_STORE)) db.createObjectStore(FILE_STORAGE_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function fileStorageTransaction(db, mode, callback) {
    return new Promise((resolve, reject) => {
        let result;
        const tx = db.transaction(FILE_STORAGE_STORE, mode);
        const store = tx.objectStore(FILE_STORAGE_STORE);
        try { result = callback(store); } catch (error) { tx.abort(); reject(error); return; }
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
        tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    });
}
const newFileStorageId = () => typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function ensureFileStorageSession() {
    if (fileStorageSessionId) return fileStorageSessionId;
    if (fileStorageSessionPromise) return fileStorageSessionPromise;
    fileStorageSessionPromise = (async () => {
        let id = sessionStorage.getItem(FILE_STORAGE_SESSION_MARKER);
        if (!id || !/^[\w-]{12,100}$/.test(id)) id = newFileStorageId();
        // Duplicating a tab can also clone sessionStorage. Ask live peers before reusing its id.
        if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("easyfiletools:file-session-v2");
            const nonce = newFileStorageId();
            let collision = false;
            channel.onmessage = ({ data }) => {
                if (!data || data.nonce === nonce) return;
                if (data.type === "hello" && data.id === id) {
                    collision = true;
                    channel.postMessage({ type: "occupied", id, nonce, target: data.nonce });
                }
                if (data.type === "occupied" && data.id === id && data.target === nonce) collision = true;
            };
            channel.postMessage({ type: "hello", id, nonce });
            await new Promise(resolve => setTimeout(resolve, 180));
            if (collision) id = newFileStorageId();
            channel.close();
        }
        sessionStorage.setItem(FILE_STORAGE_SESSION_MARKER, id);
        fileStorageSessionId = id;
        // Clean orphaned snapshots; never erase another live tab's recent data.
        void pruneFileStorage().catch(error => console.warn("[FILE STORAGE] Cleanup failed:", error));
        // Listen for the complete life of this document, including after the first load.
        if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("easyfiletools:file-session-v2");
            channel.onmessage = ({ data }) => {
                if (data?.type === "hello" && data.id === fileStorageSessionId) {
                    channel.postMessage({ type: "occupied", id: fileStorageSessionId, nonce: newFileStorageId(), target: data.nonce });
                }
            };
            window.addEventListener("pagehide", () => channel.close(), { once: true });
        }
        return id;
    })();
    try { return await fileStorageSessionPromise; }
    finally { fileStorageSessionPromise = null; }
}
async function pruneFileStorage() {
    const db = await openFileStorage();
    try {
        const candidates = await new Promise((resolve, reject) => {
            const keys = [];
            const tx = db.transaction(FILE_STORAGE_STORE, "readonly");
            const request = tx.objectStore(FILE_STORAGE_STORE).openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                if (cursor.key === "currentSession") keys.push(cursor.key); // legacy global key
                else if (String(cursor.key).startsWith(FILE_STORAGE_PREFIX)
                    && cursor.key !== FILE_STORAGE_PREFIX + fileStorageSessionId
                    && (!cursor.value?.updatedAt || cursor.value.updatedAt < Date.now() - 30 * 86400_000))
                    keys.push(cursor.key);
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => resolve(keys);
            tx.onerror = () => reject(tx.error);
        });
        if (candidates.length) await fileStorageTransaction(db, "readwrite", store => {
            for (const key of candidates) store.delete(key);
        });
    } finally { db.close(); }
}

function normalizeSelection(data) {
    if (!data?.files?.length) return null;
    const files = data.files.map((stored, index) => {
        const blob = stored?.blob || stored?.file || stored;
        if (!(blob instanceof Blob)) return null;
        return { file: new File([blob], stored.name || blob.name || `file-${index + 1}`,
            { type: stored.type || blob.type || "application/octet-stream", lastModified: stored.lastModified || Date.now() }),
            index: Number.isInteger(stored.index) ? stored.index : index,
            category: stored.category || data.category || null };
    }).filter(Boolean);
    return files.length ? { files, category: data.category || null, storageVersion: 3 } : null;
}
function queueFileStorageWrite(operation) {
    const current = fileStoragePendingWrite.then(operation).catch(error => {
        document.dispatchEvent(new CustomEvent("easyfiletools:storage-error", { detail: { error } }));
        throw error;
    });
    fileStoragePendingWrite = current.catch(() => {}); // queue recovers, current caller sees error
    return current;
}
async function saveSelectedFiles(files, category) {
    await ensureFileStorageSession();
    return queueFileStorageWrite(async () => {
        if (!files?.length) return clearStoredFilesInternal({ notify: true, category });
        const persisted = files.map((item, index) => {
            const source = item?.file || item;
            if (!(source instanceof Blob)) throw new TypeError("Invalid file in selection");
            return { blob: source.slice(0, source.size, source.type || "application/octet-stream"),
                name: source.name || `file-${index + 1}`, type: source.type || "application/octet-stream",
                lastModified: source.lastModified || Date.now(), index, category };
        });
        const record = { files: persisted, category, storageVersion: 3, updatedAt: Date.now() };
        const db = await openFileStorage();
        try { await fileStorageTransaction(db, "readwrite", store => store.put(record, FILE_STORAGE_PREFIX + fileStorageSessionId)); }
        finally { db.close(); }
        fileStorageCache = normalizeSelection(record);
        updateFileStorageVisualHint(fileStorageCache);
        fileStorageLoadPromise = null;
        document.dispatchEvent(new CustomEvent("easyfiletools:storage-updated", { detail: { files: fileStorageCache.files, category } }));
    });
}
async function loadSelectedFiles() {
    await ensureFileStorageSession();
    await fileStoragePendingWrite;
    if (fileStorageCache !== undefined) return fileStorageCache;
    if (fileStorageLoadPromise) return fileStorageLoadPromise;
    fileStorageLoadPromise = (async () => {
        const db = await openFileStorage();
        try {
            const data = await new Promise((resolve, reject) => {
                const tx = db.transaction(FILE_STORAGE_STORE, "readonly");
                const request = tx.objectStore(FILE_STORAGE_STORE).get(FILE_STORAGE_PREFIX + fileStorageSessionId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
            fileStorageCache = normalizeSelection(data);
            updateFileStorageVisualHint(fileStorageCache);
            return fileStorageCache;
        } finally { db.close(); }
    })();
    try { return await fileStorageLoadPromise; }
    catch (error) {
        // No indefinite skeleton if browser storage is unavailable/denied.
        updateFileStorageVisualHint(null);
        throw error;
    }
    finally { fileStorageLoadPromise = null; }
}
async function clearStoredFilesInternal(options = {}) {
    const category = options.category || fileStorageCache?.category || null;
    const db = await openFileStorage();
    try { await fileStorageTransaction(db, "readwrite", store => store.delete(FILE_STORAGE_PREFIX + fileStorageSessionId)); }
    finally { db.close(); }
    fileStorageCache = null;
    updateFileStorageVisualHint(null);
    fileStorageLoadPromise = null;
    if (options.notify !== false) {
        document.dispatchEvent(new CustomEvent("easyfiletools:storage-updated", { detail: { files: [], category } }));
        document.dispatchEvent(new CustomEvent("easyfiletools:files-cleared", { detail: { category, source: "file-storage" } }));
    }
}
async function clearStoredFiles(options = {}) {
    const normalized = typeof options === "string" ? { category: options } : options;
    await ensureFileStorageSession();
    return queueFileStorageWrite(() => clearStoredFilesInternal(normalized || {}));
}
async function getStoredFiles() {
    return (await loadSelectedFiles())?.files || [];
}
