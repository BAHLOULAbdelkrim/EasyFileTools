console.log("file-storage.js loaded");

/* =========================================================
   STOCKAGE DES FICHIERS SÉLECTIONNÉS
   ========================================================= */

const FILE_STORAGE_DB = "FileToolsDB";
const FILE_STORAGE_STORE = "selectedFiles";
const FILE_STORAGE_KEY = "currentSession";

/*
=========================================================

   CACHE EN MÉMOIRE

========================================================= */

let fileStorageCache =
    undefined;

let fileStorageLoadPromise =
    null;

/* =========================================================
   OUVRIR / CRÉER LA BASE INDEXEDDB
   ========================================================= */

function openFileStorage() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(FILE_STORAGE_DB, 1);

        request.onupgradeneeded = (event) => {

            const db = event.target.result;

            if (!db.objectStoreNames.contains(FILE_STORAGE_STORE)) {

                db.createObjectStore(FILE_STORAGE_STORE);
            }
        };

        request.onsuccess = () => {

            resolve(request.result);
        };

        request.onerror = () => {

            console.error(
                "Unable to open file storage:",
                request.error
            );

            reject(request.error);
        };
    });
}


/* =========================================================
   SAUVEGARDER LA SÉLECTION
   ========================================================= */

async function saveSelectedFiles(files, category) {

    if (!files || files.length === 0) {

        await clearStoredFiles();

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:storage-updated",
                {
                    detail: {
                        files: [],
                        category: category
                    }
                }
            )
        );

        return;
    }

    try {

        const db =
            await openFileStorage();

        const transaction =
            db.transaction(
                FILE_STORAGE_STORE,
                "readwrite"
            );

        const store =
            transaction.objectStore(
                FILE_STORAGE_STORE
            );

        const filesToStore =
            files.map((fileData, index) => {

                return {
                    file: fileData.file,
                    index: index,
                    category: category
                };

            });

        const dataToStore = {
            files: filesToStore,
            category: category
        };

        store.put(
            dataToStore,
            FILE_STORAGE_KEY
        );

        await new Promise((resolve, reject) => {

            transaction.oncomplete =
                resolve;

            transaction.onerror = () => {
                reject(transaction.error);
            };

            transaction.onabort = () => {
                reject(transaction.error);
            };

        });

        db.close();

        fileStorageCache =
            dataToStore;

        fileStorageLoadPromise =
            null;

        console.log(
            "[FILE STORAGE] Selection saved:",
            filesToStore.length,
            "file(s)"
        );

        /* =========================================
           NOTIFIER LES AUTRES COMPOSANTS
        ========================================= */

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:storage-updated",
                {
                    detail: {
                        files: filesToStore,
                        category: category
                    }
                }
            )
        );

    }
    catch (error) {

        console.error(
            "[FILE STORAGE] Save failed:",
            error
        );

    }
}

/* =========================================================
   RÉCUPÉRER LA SÉLECTION
   ========================================================= */

async function loadSelectedFiles() {

    /* =====================================================
       DONNÉES DÉJÀ DISPONIBLES EN MÉMOIRE
    ===================================================== */

    if (
        fileStorageCache !== undefined
    ) {

        console.log(
            "[FILE STORAGE] Selection loaded from memory"
        );

        return fileStorageCache;
    }


    /* =====================================================
       LECTURE INDEXEDDB DÉJÀ EN COURS
    ===================================================== */

    if (fileStorageLoadPromise) {

        console.log(
            "[FILE STORAGE] Reusing current IndexedDB load"
        );

        return fileStorageLoadPromise;
    }


    /* =====================================================
       NOUVELLE LECTURE INDEXEDDB
    ===================================================== */

    fileStorageLoadPromise =
        (async () => {

            try {

                const db =
                    await openFileStorage();

                const transaction =
                    db.transaction(
                        FILE_STORAGE_STORE,
                        "readonly"
                    );

                const store =
                    transaction.objectStore(
                        FILE_STORAGE_STORE
                    );

                const request =
                    store.get(
                        FILE_STORAGE_KEY
                    );

                const data =
                    await new Promise(
                        (resolve, reject) => {

                            request.onsuccess =
                                () => {

                                    resolve(
                                        request.result ||
                                        null
                                    );
                                };

                            request.onerror =
                                () => {

                                    reject(
                                        request.error
                                    );
                                };
                        }
                    );

                db.close();

                if (
                    !data ||
                    !data.files ||
                    data.files.length === 0
                ) {

                    fileStorageCache =
                        null;

                    return null;
                }

                fileStorageCache =
                    data;

                console.log(
                    "[FILE STORAGE] Selection loaded from IndexedDB:",
                    data.files.length,
                    "file(s)"
                );

                return data;

            }
            catch (error) {

                console.error(
                    "[FILE STORAGE] Load failed:",
                    error
                );

                return null;
            }
            finally {

                fileStorageLoadPromise =
                    null;
            }

        })();

    return fileStorageLoadPromise;
}

/* =========================================================
   SUPPRIMER LA SÉLECTION SAUVEGARDÉE
   ========================================================= */

async function clearStoredFiles() {

    try {

        const db = await openFileStorage();

        const transaction =
            db.transaction(
                FILE_STORAGE_STORE,
                "readwrite"
            );

        const store =
            transaction.objectStore(
                FILE_STORAGE_STORE
            );

        store.delete(FILE_STORAGE_KEY);

        await new Promise((resolve, reject) => {

            transaction.oncomplete = resolve;

            transaction.onerror = () => {
                reject(transaction.error);
            };

            transaction.onabort = () => {
                reject(transaction.error);
            };
        });

        db.close();

        fileStorageCache =
            null;

        fileStorageLoadPromise =
            null;

        console.log(
            "[FILE STORAGE] Stored selection cleared"
        );

    }
    catch (error) {

        console.error(
            "[FILE STORAGE] Clear failed:",
            error
        );
    }
}


/* =========================================================
   RÉCUPÉRER DIRECTEMENT LES FICHIERS STOCKÉS
   ========================================================= */

async function getStoredFiles() {

    const data =
        await loadSelectedFiles();

    if (
        !data ||
        !data.files ||
        data.files.length === 0
    ) {

        return [];

    }

    return data.files;
}