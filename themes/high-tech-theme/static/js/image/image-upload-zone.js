console.log(
    "[IMAGE ZONE] image-upload-zone.js loaded"
);


/* =========================================================
   IMAGE UPLOAD ADAPTER
========================================================= */

(() => {

    "use strict";


    let imageFileList =
        null;

    let imageFileCounter =
        null;


    let imageSelectedFiles =
        [];


    /*
     * Raster/vector inputs currently supported
     * by the implemented browser-side Image tools.
     */

    const CONVERT_IMAGE_INPUT_FORMATS =
        new Set([
            "jpg",
            "jpeg",
            "png",
            "webp",
            "avif",
            "bmp",
            "svg"
        ]);


    /* =====================================================
       HELPERS
    ===================================================== */

    function getExtension(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        if (
            dot === -1 ||
            dot ===
                filename.length - 1
        ) {

            return "";
        }


        return filename
            .slice(dot + 1)
            .toLowerCase();

    }


    function createKey(
        file
    ) {

        return [
            file.name,
            file.size,
            file.lastModified || 0
        ].join("::");

    }


    function revokeFileUrls(
        fileData
    ) {

        if (
            fileData?.previewUrl
        ) {

            try {

                URL.revokeObjectURL(
                    fileData.previewUrl
                );

            }
            catch (_) {
                // Ignore
            }
        }


        if (
            fileData?.convertedUrl
        ) {

            try {

                URL.revokeObjectURL(
                    fileData.convertedUrl
                );

            }
            catch (_) {
                // Ignore
            }
        }

    }


    /* =====================================================
       CURRENT COUNT
    ===================================================== */

    window.getCurrentUploadFileCount =
        () => {

            return imageSelectedFiles.length;

        };


    /* =====================================================
       FILES FROM GENERIC UPLOAD
    ===================================================== */

    document.addEventListener(

        "easyfiletools:files-selected",

        async event => {

            const files =
                event.detail?.files || [];


            const category =
                event.detail?.category;


            if (
                category !==
                "Image"
            ) {

                return;
            }


            await handleImageFiles(
                files
            );

        }

    );


    /* =====================================================
       INIT
    ===================================================== */

    document.addEventListener(

        "DOMContentLoaded",

        async () => {

            const container =
                document.querySelector(
                    '.file-list-container[data-category="Image"]'
                );


            if (
                container
            ) {

                imageFileList =
                    container.querySelector(
                        "#file-list"
                    );


                imageFileCounter =
                    container.querySelector(
                        "#fileCounter"
                    );

            }


            await loadImageFilesFromStorage();

            updateImageCounter();

        }

    );


    /* =====================================================
       HANDLE FILES
    ===================================================== */

    async function handleImageFiles(
        files
    ) {

        const incoming =
            Array.from(
                files
            );


        for (
            const file of incoming
        ) {

            if (
                getFileCategory(
                    file.name
                ) !== "Image"
            ) {

                continue;
            }


            const extension =
                getExtension(
                    file.name
                );


            if (
                !CONVERT_IMAGE_INPUT_FORMATS
                    .has(
                        extension
                    )
            ) {

                alert(
                    `${file.name}: this image format is not supported by the current Image tools yet.`
                );


                continue;
            }


            const safety = EasyFilePolicy.validate(file, { category: "Image", operation: document.getElementById("operation-zone")?.dataset?.operation,
                count: imageSelectedFiles.length,
                totalBytes: imageSelectedFiles.reduce((sum, item) => sum + item.file.size, 0) });
            if (!safety.ok) { console.warn("[IMAGE] File rejected:", safety.reason); continue; }

            const key =
                createKey(
                    file
                );


            const duplicate =
                imageSelectedFiles
                    .some(
                        item =>
                            createKey(
                                item.file
                            ) === key
                    );


            if (
                duplicate
            ) {

                continue;
            }


            const fileData = {

                file,

                convertedUrl:
                    null,

                convertedBlob:
                    null,

                convertedName:
                    null,

                convertedFormat:
                    null,

                element:
                    null,

                meta:
                    {},

                previewUrl:
                    URL.createObjectURL(
                        file
                    ),

                previewType:
                    "image"

            };


            if (
                typeof getImageDimensions ===
                "function"
            ) {

                fileData.meta.dimensions =
                    await getImageDimensions(
                        file
                    );

            }


            imageSelectedFiles.push(
                fileData
            );

        }


        refreshImageFileList();

        updateImageCounter();

        await saveImageFilesToStorage();

    }


    /* =====================================================
       RENDER
    ===================================================== */

    function refreshImageFileList() {

        if (
            !imageFileList ||
            typeof renderFileList !==
                "function"
        ) {

            return;
        }


        renderFileList(

            imageSelectedFiles,

            imageFileList,

            {

                category:
                    "Image",

                maxSize:
                    EasyFilePolicy.resolve({ category: "Image", operation: document.getElementById("operation-zone")?.dataset?.operation }).maxFileMB * EasyFilePolicy.MB,

                enableReorder:
                    true,


                onReorder:
                    (
                        fromIndex,
                        targetIndex
                    ) => {

                        const [
                            dragged
                        ] =
                            imageSelectedFiles
                                .splice(
                                    fromIndex,
                                    1
                                );


                        imageSelectedFiles
                            .splice(
                                targetIndex,
                                0,
                                dragged
                            );


                        refreshImageFileList();

                        updateImageCounter();

                        saveImageFilesToStorage();

                    },


                onRemove:
                    async fileData => {

                        revokeFileUrls(
                            fileData
                        );


                        imageSelectedFiles =
                            imageSelectedFiles
                                .filter(
                                    item =>
                                        item.file !==
                                        fileData.file
                                );


                        refreshImageFileList();

                        updateImageCounter();

                        await saveImageFilesToStorage();

                    }

            }

        );

    }


    /* =====================================================
       COUNTER
    ===================================================== */

    function updateImageCounter() {

        if (
            !imageFileCounter
        ) {

            return;
        }


        const count =
            imageSelectedFiles.length;


        if (
            count === 0
        ) {

            imageFileCounter.textContent =
                "0 file";


            return;
        }


        const totalSize =
            imageSelectedFiles.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.file.size,
                0
            );


        const mainText =
            `${count} ${
                count > 1
                    ? "files"
                    : "file"
            } • Image • ${
                formatFileSize(
                    totalSize
                )
            }`;


        const hintText =
            count >= 2
                ? `
                    <div class="drag-hint">
                        <i data-lucide="move-vertical"></i>
                        Drag & drop to reorder
                    </div>
                `
                : "";


        imageFileCounter.innerHTML = `

            <div class="file-counter-main">
                ${mainText}
            </div>

            ${hintText}

        `;


        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                imageFileCounter
            );

        }

    }


    /* =====================================================
       LOAD STORAGE
    ===================================================== */

    async function loadImageFilesFromStorage() {

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
            !Array.isArray(
                data.files
            )
        ) {

            return;
        }


        const imageFiles =
            data.files.filter(
                item =>
                    item.category ===
                    "Image"
            );


        imageSelectedFiles =
            [];


        for (
            const item of imageFiles
        ) {

            const extension =
                getExtension(
                    item.file.name
                );


            if (
                !CONVERT_IMAGE_INPUT_FORMATS
                    .has(
                        extension
                    )
            ) {

                continue;
            }


            const safety = EasyFilePolicy.validate(item.file, { category: "Image", operation: document.getElementById("operation-zone")?.dataset?.operation,
                count: imageSelectedFiles.length, totalBytes: imageSelectedFiles.reduce((sum, entry) => sum + entry.file.size, 0) });
            if (!safety.ok) continue;

            const fileData = {

                file:
                    item.file,

                convertedUrl:
                    null,

                convertedBlob:
                    null,

                convertedName:
                    null,

                convertedFormat:
                    null,

                element:
                    null,

                meta:
                    {},

                previewUrl:
                    URL.createObjectURL(
                        item.file
                    ),

                previewType:
                    "image"

            };


            if (
                typeof getImageDimensions ===
                "function"
            ) {

                fileData.meta.dimensions =
                    await getImageDimensions(
                        fileData.file
                    );

            }


            imageSelectedFiles.push(
                fileData
            );

        }


        console.log(
            "[IMAGE ZONE] Files injected:",
            imageSelectedFiles.length
        );


        refreshImageFileList();

        updateImageCounter();

    }


    /* =====================================================
       SAVE
    ===================================================== */

    async function saveImageFilesToStorage() {

        if (
            imageSelectedFiles.length ===
            0
        ) {

            await clearStoredFiles({ category: "Image" });

            return;
        }


        await saveSelectedFiles(
            imageSelectedFiles,
            "Image"
        );

    }


    /* =====================================================
       CONVERSION RESULT SYNC
    ===================================================== */

    document.addEventListener(

        "easyfiletools:file-operation-completed",

        event => {

            const detail =
                event.detail || {};


            if (
                detail.operation !==
                "convert-image"
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
                !imageSelectedFiles[
                    index
                ]
            ) {

                return;
            }


            const fileData =
                imageSelectedFiles[
                    index
                ];


            fileData.convertedUrl =
                detail.outputUrl ||
                null;


            fileData.convertedBlob =
                detail.outputBlob ||
                null;


            fileData.convertedName =
                detail.outputName ||
                null;


            fileData.convertedFormat =
                detail.outputFormat ||
                null;

        }

    );


    /* =====================================================
       CLEAR ALL
    ===================================================== */

    document.addEventListener(

        "easyfiletools:operation-results-discarded",

        () => {
            refreshImageFileList();
        }

    );


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            imageSelectedFiles
                .forEach(
                    revokeFileUrls
                );


            imageSelectedFiles =
                [];


            refreshImageFileList();

            updateImageCounter();

        }

    );


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.ImageUploadZone = {

        getFiles() {

            return imageSelectedFiles;

        },


        refresh:
            refreshImageFileList

    };

})();