console.log(
    "common/zone-chargement.js loaded"
);


/*
=========================================================
   ZONE DE CHARGEMENT GÉNÉRIQUE
=========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const uploadContainer =
            document.getElementById(
                "upload-zone-container"
            );


        if (!uploadContainer) {
            return;
        }


        const dropZone =
            document.getElementById(
                "drop-zone"
            );


        const fileInput =
            document.getElementById(
                "fileInput"
            );


        const uploadInfo =
            document.getElementById(
                "upload-info"
            );


        const urlBtn =
            document.getElementById(
                "urlBtn"
            );


        const urlModal =
            document.getElementById(
                "urlModal"
            );


        const urlInput =
            document.getElementById(
                "urlInput"
            );


        const urlAdd =
            document.getElementById(
                "urlAdd"
            );


        const urlCancel =
            document.getElementById(
                "urlCancel"
            );


        /*
        =====================================================
           PAGE CATEGORY
        =====================================================
        */

        const pageCategory =
            uploadContainer
                .dataset
                .category ||
            null;


        /*
         * Dynamic category used mainly
         * by the homepage.
         *
         * null:
         * no file has determined the
         * category yet.
         */

        let browseCategory =
            pageCategory;


        /*
        =====================================================
           INFORMATIONS
        =====================================================
        */

        if (
            uploadInfo
        ) {

            const profile = EasyFilePolicy.resolve({ category: pageCategory,
                operation: document.getElementById("operation-zone")?.dataset?.operation });
            uploadInfo.textContent = profile
                ? `Up to ${profile.maxFiles} files • ${profile.maxFileMB} MB/file • ${profile.maxTotalMB} MB total`
                : "Limits vary by category (Image, Audio, Video, PDF).";
        }


        /*
        =====================================================
           BROWSE FILTER
        =====================================================
        */

        function updateBrowseFilter() {

            if (!fileInput) {
                return;
            }


            /*
             * Category page:
             * only this category.
             *
             * Homepage after first file:
             * only the determined category.
             *
             * Homepage without files:
             * every EasyFile Tools format.
             */

            if (
                browseCategory
            ) {

                fileInput.accept =
                    typeof getFileCategoryAccept ===
                        "function"
                        ? getFileCategoryAccept(
                            browseCategory
                        )
                        : "";


                console.log(
                    "[UPLOAD ZONE] Browse filter:",
                    browseCategory
                );


                return;
            }


            fileInput.accept =
                typeof getAllSupportedFileAccept ===
                    "function"
                    ? getAllSupportedFileAccept()
                    : "";


            console.log(
                "[UPLOAD ZONE] Browse filter: all supported formats"
            );
        }


        /*
        =====================================================
           RESTORE HOMEPAGE CATEGORY
        =====================================================
        */

        async function syncBrowseCategoryFromStorage() {

            /*
             * A category-specific page
             * never changes category.
             */

            if (
                pageCategory
            ) {

                browseCategory =
                    pageCategory;

                updateBrowseFilter();

                return;
            }


            if (
                typeof loadSelectedFiles !==
                "function"
            ) {

                browseCategory =
                    null;

                updateBrowseFilter();

                return;
            }


            try {

                const data =
                    await loadSelectedFiles();


                const storedFiles =
                    Array.isArray(
                        data?.files
                    )
                        ? data.files
                        : [];


                if (
                    storedFiles.length ===
                    0
                ) {

                    browseCategory =
                        null;

                    updateBrowseFilter();

                    return;
                }


                const firstItem =
                    storedFiles[0];


                let category =
                    firstItem?.category ||
                    null;


                if (
                    !category &&
                    firstItem?.file
                ) {

                    category =
                        getFileCategory(
                            firstItem.file.name
                        );
                }


                if (
                    category ===
                    "Unknown"
                ) {

                    category =
                        null;
                }


                browseCategory =
                    category;


                updateBrowseFilter();

            }
            catch (
                error
            ) {

                console.warn(
                    "[UPLOAD ZONE] Unable to restore Browse category:",
                    error
                );


                browseCategory =
                    null;


                updateBrowseFilter();
            }
        }


        /*
        =====================================================
           VALIDATION DES FICHIERS
        =====================================================
        */

        function validateFiles(files, existing = []) {
            const valid = [];
            const operation = document.getElementById("operation-zone")?.dataset?.operation || null;
            let selectedCategory = pageCategory || browseCategory;
            let count = existing.length;
            let totalBytes = existing.reduce((sum, item) => sum + (item?.file || item)?.size || 0, 0);
            const seen = new Set(existing.map(item => {
                const file = item?.file || item;
                return `${file.name}::${file.size}::${file.lastModified || 0}`;
            }));
            for (const file of files) {
                const identity = `${file.name}::${file.size}::${file.lastModified || 0}`;
                if (seen.has(identity)) continue;
                const category = getFileCategory(file.name);
                if (selectedCategory && category !== selectedCategory) {
                    showNotification(`File: ${file.name} — different category.`, "error");
                    continue;
                }
                const result = EasyFilePolicy.validate(file, { category, operation, count, totalBytes });
                if (!result.ok) {
                    showNotification(`${file.name}: ${result.reason}`, "error");
                    continue;
                }
                valid.push(file);
                if (!selectedCategory) selectedCategory = category;
                seen.add(identity);
                count++;
                totalBytes += file.size;
            }
            return valid;
        }

        /*
        =====================================================
           TRAITEMENT DES FICHIERS
        =====================================================
        */

        async function processFiles(
            files
        ) {

            const existingData = await loadSelectedFiles();
            const existing = existingData?.category === (pageCategory || browseCategory)
                ? (existingData?.files || []) : [];
            const candidates = validateFiles(files, existing);
            const validFiles = [];
            for (const file of candidates) {
                const inspected = await EasyFilePolicy.inspect(file);
                if (!inspected.ok) {
                    showNotification(`${file.name}: ${inspected.reason}`, "error", 6000);
                    continue;
                }
                validFiles.push(file);
            }


            if (
                validFiles.length ===
                0
            ) {

                return;
            }


            /*
             * Homepage:
             * as soon as the first valid
             * file is accepted, lock Browse
             * to its category.
             */

            if (
                !pageCategory &&
                !browseCategory
            ) {

                const category =
                    getFileCategory(
                        validFiles[0].name
                    );


                if (
                    category !==
                    "Unknown"
                ) {

                    browseCategory =
                        category;


                    updateBrowseFilter();
                }
            }


            /*
            =====================================================
               TRANSMISSION AUX MOTEURS SPÉCIFIQUES
            =====================================================
            */

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:files-selected",
                    {
                        detail: {

                            files:
                                validFiles,

                            category:
                                pageCategory ||
                                browseCategory
                        }
                    }
                )
            );


            /*
            =====================================================
               COMPATIBILITÉ HOMEPAGE
            =====================================================
            */

            if (
                typeof window
                    .handleUploadedFiles ===
                    "function"
            ) {

                await window
                    .handleUploadedFiles(
                        validFiles
                    );
            }
        }


        /*
        =====================================================
           BROWSE
        =====================================================
        */

        if (
            fileInput
        ) {

            fileInput.addEventListener(
                "change",
                async () => {

                    await processFiles(
                        Array.from(
                            fileInput.files
                        )
                    );


                    /*
                     * Allows selecting the same
                     * physical file again later.
                     */

                    fileInput.value =
                        "";
                }
            );
        }


        /* Clicking the drop-zone button opens the same native picker as Browse.
         * Drag-and-drop remains available on the surrounding drop zone. */
        const dragBtn = document.getElementById("dragBtn");
        if (dragBtn && fileInput) {
            dragBtn.addEventListener("click", () => {
                if (!dragBtn.disabled && !fileInput.disabled) fileInput.click();
            });
        }

        /*
        =====================================================
           DRAG & DROP
        =====================================================
        */

        if (
            dropZone
        ) {

            dropZone.addEventListener(
                "dragenter",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    dropZone.classList.add(
                        "dragover"
                    );
                }
            );


            dropZone.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    event.dataTransfer.dropEffect =
                        "copy";


                    dropZone.classList.add(
                        "dragover"
                    );
                }
            );


            dropZone.addEventListener(
                "dragleave",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    dropZone.classList.remove(
                        "dragover"
                    );
                }
            );


            dropZone.addEventListener(
                "drop",
                async event => {

                    event.preventDefault();

                    event.stopPropagation();


                    dropZone.classList.remove(
                        "dragover"
                    );


                    const files =
                        Array.from(
                            event
                                .dataTransfer
                                .files
                        );


                    if (
                        files.length ===
                        0
                    ) {

                        return;
                    }


                    await processFiles(
                        files
                    );
                }
            );
        }


        /* =====================================================
           FROM URL — streamed, cancellable, bounded
        ===================================================== */
        if (urlBtn && urlModal && urlInput && urlAdd && urlCancel) {
            let controller = null;
            let busy = false;
            const progress = document.createElement("div");
            progress.id = "urlDownloadProgress";
            progress.className = "url-download-progress";
            progress.hidden = true;
            const meter = document.createElement("progress");
            meter.max = 100;
            meter.value = 0;
            meter.setAttribute("aria-label", "URL download progress");
            const progressText = document.createElement("span");
            progressText.setAttribute("role", "status");
            progressText.setAttribute("aria-live", "polite");
            progress.append(meter, progressText);
            urlInput.insertAdjacentElement("afterend", progress);
            urlBtn.addEventListener("click", () => { urlModal.classList.remove("hidden"); urlInput.focus(); });
            urlCancel.addEventListener("click", () => {
                controller?.abort();
                if (!busy) { urlModal.classList.add("hidden"); urlInput.value = ""; progress.hidden = true; progressText.textContent = ""; }
            });
            urlAdd.addEventListener("click", async () => {
                if (busy) return;
                const address = urlInput.value.trim();
                if (!address) { showNotification("Enter an HTTPS file URL.", "warning"); return; }
                let parsed;
                try { parsed = new URL(address); }
                catch { showNotification("Enter a valid HTTPS file URL.", "error"); return; }
                const operation = document.getElementById("operation-zone")?.dataset?.operation || null;
                const possibleName = EasyFileUrlImport.fileNameFromUrl(parsed);
                const category = pageCategory || browseCategory || getFileCategory(possibleName);
                const policy = EasyFilePolicy.resolve({ category, operation });
                if (!policy) { showNotification("Choose a supported file URL (Image, Audio, Video or PDF).", "error"); return; }
                const stored = await loadSelectedFiles();
                const existing = stored?.category === category ? (stored?.files || []) : [];
                const total = existing.reduce((sum, item) => sum + (item?.file || item).size, 0);
                if (existing.length >= policy.maxFiles || total >= policy.maxTotalMB * EasyFilePolicy.MB) {
                    showNotification("Selection size or file count limit reached.", "error"); return;
                }
                controller = new AbortController();
                busy = true;
                urlAdd.disabled = true;
                progress.hidden = false;
                meter.removeAttribute("value");
                progressText.textContent = "Downloading…";
                try {
                    const limit = Math.min(policy.maxFileMB * EasyFilePolicy.MB,
                        policy.maxTotalMB * EasyFilePolicy.MB - total);
                    const file = await EasyFileUrlImport.download(address, {
                        limitBytes: limit, signal: controller.signal,
                        onProgress: (received, declared) => {
                            if (declared) meter.value = Math.min(100, received / declared * 100);
                            else meter.removeAttribute("value");
                            progressText.textContent = declared
                                ? `Downloading: ${Math.round(received / declared * 100)}% (${(received / EasyFilePolicy.MB).toFixed(1)} MB)`
                                : `Downloading: ${(received / EasyFilePolicy.MB).toFixed(1)} MB`;
                        }
                    });
                    // An HTML error page is not a media file even when the URL ends in .mp3.
                    if (/^(text\/html|application\/(json|xml|xhtml\+xml))$/i.test(file.type))
                        throw new Error("The server returned a web page or API response, not a file.");
                    const result = EasyFilePolicy.validate(file, { category, operation,
                        count: existing.length, totalBytes: total });
                    if (!result.ok) throw new Error(result.reason);
                    await processFiles([file]);
                    urlInput.value = "";
                    urlModal.classList.add("hidden");
                    progress.hidden = true;
                    progressText.textContent = "";
                } catch (error) {
                    showNotification(error.message || "Unable to import this URL.", "error", 3000);
                    progress.hidden = true;
                    progressText.textContent = "";
                } finally { busy = false; urlAdd.disabled = false; controller = null; }
            });
        }

        /*
        =====================================================
           STORAGE UPDATED
        =====================================================
        */

        document.addEventListener(
            "easyfiletools:storage-updated",
            async () => {

                if (
                    !pageCategory
                ) {

                    await syncBrowseCategoryFromStorage();
                }
            }
        );


        /*
        =====================================================
           FILES CLEARED
        =====================================================
        */

        document.addEventListener(
            "easyfiletools:files-cleared",
            () => {

                if (
                    pageCategory
                ) {

                    browseCategory =
                        pageCategory;
                }
                else {

                    browseCategory =
                        null;
                }


                updateBrowseFilter();
            }
        );


        /*
        =====================================================
           INITIAL BROWSE FILTER
        =====================================================
        */

        await syncBrowseCategoryFromStorage();

    }
);