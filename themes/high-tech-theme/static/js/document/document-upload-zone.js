console.log(
    "[DOCUMENT ZONE] document-upload-zone.js loaded"
);


(() => {

    "use strict";


    let documentFileList =
        null;

    let documentFileCounter =
        null;

    let selectedPdfFiles =
        [];


    function extensionOf(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        return dot >= 0
            ? filename
                .slice(dot + 1)
                .toLowerCase()
            : "";

    }


    function keyOf(
        file
    ) {

        return [
            file.name,
            file.size,
            file.lastModified || 0
        ].join("::");

    }


    async function createPdfPreview(
        file
    ) {

        try {

            if (
                typeof getPdfThumbnail !==
                    "function"
            ) {

                return {
                    previewType: null,
                    previewUrl: null
                };
            }



            let pageCount = null;

            const thumbnail = await getPdfThumbnail(
                file,
                count => {
                    pageCount = count;
                }
            );

            return {
                previewType: thumbnail ? "image" : null,
                previewUrl: thumbnail || null,
                pageCount
            };


        }
        catch (error) {

            console.warn(
                "[DOCUMENT ZONE] Unable to create PDF thumbnail:",
                file?.name,
                error
            );


            return {
                previewType: null,
                previewUrl: null
            };

        }

    }


    function revokeUrls(
        item
    ) {

        [
            "previewUrl",
            "convertedUrl"
        ].forEach(
            property => {

                if (
                    item?.[property]
                ) {

                    try {

                        URL.revokeObjectURL(
                            item[property]
                        );

                    }
                    catch (_) {}

                }

            }
        );

    }


    window.getCurrentUploadFileCount =
        () =>
            selectedPdfFiles.length;


    document.addEventListener(

        "easyfiletools:files-selected",

        async event => {

            if (
                event.detail?.category !==
                "Document"
            ) {

                return;
            }


            await handleFiles(
                event.detail.files || []
            );

        }

    );


    document.addEventListener(

        "DOMContentLoaded",

        async () => {

            const container =
                document.querySelector(
                    '.file-list-container[data-category="Document"]'
                );


            if (
                container
            ) {

                documentFileList =
                    container.querySelector(
                        "#file-list"
                    );


                documentFileCounter =
                    container.querySelector(
                        "#fileCounter"
                    );

            }


            await loadFromStorage();

            updateCounter();

        }

    );


    async function handleFiles(
        files
    ) {

        for (
            const file
            of Array.from(files)
        ) {

            if (
                extensionOf(
                    file.name
                ) !== "pdf"
            ) {

                alert(
                    `${file.name}: this operation accepts PDF files only.`
                );

                continue;
            }


            const safety = EasyFilePolicy.validate(file, { category: "Document", operation: document.getElementById("operation-zone")?.dataset?.operation,
                count: selectedPdfFiles.length,
                totalBytes: selectedPdfFiles.reduce((sum, item) => sum + item.file.size, 0) });
            if (!safety.ok) { console.warn("[DOCUMENT] File rejected:", safety.reason); continue; }

            const key =
                keyOf(
                    file
                );


            if (
                selectedPdfFiles.some(
                    item =>
                        keyOf(
                            item.file
                        ) === key
                )
            ) {

                continue;
            }


            /*
             * Add the PDF immediately. Rendering page 1 with PDF.js
             * can take noticeably longer than adding an Audio/Image
             * file, so thumbnails must never block the file-list.
             */
            selectedPdfFiles.push({

                file,

                element:
                    null,

                previewType:
                    null,

                previewUrl:
                    null,

                convertedUrl:
                    null,

                convertedBlob:
                    null,

                convertedName:
                    null,

                convertedFormat:
                    null,

                meta:
                    {}

            });

        }


        /*
         * First paint + persistence happen before PDF thumbnails.
         * This keeps Browse/Drop perceived as instant.
         */
        render();

        updateCounter();

        await save();

        void hydrateMissingPdfPreviews();

    }


    let pdfPreviewHydrationRunning = false;


    async function hydrateMissingPdfPreviews() {

        if (pdfPreviewHydrationRunning) {
            return;
        }

        pdfPreviewHydrationRunning = true;

        try {
            /*
             * Small concurrency keeps thumbnails responsive without
             * decoding many PDFs at once on low-memory devices.
             */
            const pending =
                selectedPdfFiles.filter(
                    item =>
                        !item.previewUrl &&
                        !item.meta?.previewPending &&
                        !item.meta?.previewAttempted
                );

            let cursor = 0;

            const worker = async () => {
                while (cursor < pending.length) {
                    const item = pending[cursor++];

                    if (!selectedPdfFiles.includes(item)) {
                        continue;
                    }

                    item.meta = item.meta || {};
                    item.meta.previewPending = true;

                    const preview =
                        await createPdfPreview(item.file);

                    delete item.meta.previewPending;
                    item.meta.previewAttempted = true;

                    if (!selectedPdfFiles.includes(item)) {
                        continue;
                    }


                    item.previewType = preview.previewType;
                    item.previewUrl = preview.previewUrl;

                    if (
                        Number.isInteger(preview.pageCount) &&
                        preview.pageCount > 0
                    ) {
                        item.meta.pages = preview.pageCount;
                    }

                    render();

                }
            };

            await Promise.all([worker(), worker()]);
        }
        finally {
            pdfPreviewHydrationRunning = false;

            if (
                selectedPdfFiles.some(
                    item =>
                        !item.previewUrl &&
                        !item.meta?.previewPending &&
                        !item.meta?.previewAttempted
                )
            ) {
                void hydrateMissingPdfPreviews();
            }
        }
    }


    function render() {

        if (
            !documentFileList ||
            typeof renderFileList !==
                "function"
        ) {

            return;
        }


        renderFileList(

            selectedPdfFiles,

            documentFileList,

            {

                category:
                    "Document",

                maxSize:
                    EasyFilePolicy.resolve({ category: "Document", operation: document.getElementById("operation-zone")?.dataset?.operation }).maxFileMB * EasyFilePolicy.MB,

                enableReorder:
                    true,


                onReorder(
                    fromIndex,
                    targetIndex
                ) {

                    const [item] =
                        selectedPdfFiles
                            .splice(
                                fromIndex,
                                1
                            );


                    selectedPdfFiles
                        .splice(
                            targetIndex,
                            0,
                            item
                        );


                    render();

                    save();

                },


                async onRemove(
                    item
                ) {

                    revokeUrls(
                        item
                    );


                    selectedPdfFiles =
                        selectedPdfFiles.filter(
                            candidate =>
                                candidate !==
                                item
                        );


                    render();

                    updateCounter();

                    await save();

                }

            }

        );

    }


    function updateCounter() {

        if (
            !documentFileCounter
        ) {

            return;
        }


        const count =
            selectedPdfFiles.length;


        if (
            count === 0
        ) {

            documentFileCounter
                .textContent =
                    "0 file";


            return;
        }


        const total =
            selectedPdfFiles.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    item.file.size,
                0
            );


        documentFileCounter.innerHTML = `

            <div class="file-counter-main">

                ${count}
                ${
                    count === 1
                        ? "file"
                        : "files"
                }

                • PDF
                • ${formatFileSize(total)}

            </div>

        `;

    }


    async function save() {

        if (
            selectedPdfFiles.length ===
            0
        ) {

            await clearStoredFiles({ category: "Document" });

            return;
        }


        await saveSelectedFiles(
            selectedPdfFiles,
            "Document"
        );

    }


    async function loadFromStorage() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            return;
        }


        const data =
            await loadSelectedFiles();


        if (
            !data ||
            data.category !==
                "Document" ||
            !Array.isArray(
                data.files
            )
        ) {

            return;
        }


        selectedPdfFiles =
            [];


        for (
            const stored
            of data.files
        ) {

            const file =
                stored.file ||
                stored;


            if (
                !(file instanceof File) ||
                extensionOf(
                    file.name
                ) !== "pdf"
            ) {

                continue;
            }


            const safety = EasyFilePolicy.validate(file, { category: "Document", operation: document.getElementById("operation-zone")?.dataset?.operation,
                count: selectedPdfFiles.length, totalBytes: selectedPdfFiles.reduce((sum, entry) => sum + entry.file.size, 0) });
            if (!safety.ok) continue;
            selectedPdfFiles.push({

                file,

                element:
                    null,

                previewType:
                    null,

                previewUrl:
                    null,

                convertedUrl:
                    null,

                convertedBlob:
                    null,

                convertedName:
                    null,

                convertedFormat:
                    null,

                meta:
                    {}

            });

        }


        render();

        updateCounter();

        void hydrateMissingPdfPreviews();

    }


    document.addEventListener(

        "easyfiletools:file-operation-completed",

        event => {

            const detail =
                event.detail || {};


            if (
                detail.category !==
                "Document"
            ) {

                return;
            }


            const index =
                Number(
                    detail.index
                );


            if (
                !Number.isInteger(
                    index
                ) ||
                !selectedPdfFiles[
                    index
                ]
            ) {

                return;
            }


            const item =
                selectedPdfFiles[
                    index
                ];


            item.convertedUrl =
                detail.outputUrl ||
                null;


            item.convertedBlob =
                detail.outputBlob ||
                null;


            item.convertedName =
                detail.outputName ||
                null;


            item.convertedFormat =
                detail.outputFormat ||
                null;

        }

    );


    document.addEventListener(

        "easyfiletools:operation-results-discarded",

        () => {
            render();
        }

    );


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            selectedPdfFiles
                .forEach(
                    revokeUrls
                );


            selectedPdfFiles =
                [];


            render();

            updateCounter();

        }

    );


    window.DocumentUploadZone = {

        getFiles() {

            return selectedPdfFiles;

        },

        refresh:
            render

    };

})();