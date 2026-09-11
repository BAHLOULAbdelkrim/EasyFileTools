console.log("common/zone-chargement.js loaded");

/*
=========================================================
   ZONE DE CHARGEMENT GÉNÉRIQUE
=========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    const uploadContainer =
        document.getElementById("upload-zone-container");

    if (!uploadContainer) {
        return;
    }

    const dropZone =
        document.getElementById("drop-zone");

    const fileInput =
        document.getElementById("fileInput");

    const uploadInfo =
        document.getElementById("upload-info");

    const urlBtn =
        document.getElementById("urlBtn");

    const urlModal =
        document.getElementById("urlModal");

    const urlInput =
        document.getElementById("urlInput");

    const urlAdd =
        document.getElementById("urlAdd");

    const urlCancel =
        document.getElementById("urlCancel");

    /*
    =====================================================
       CATÉGORIE DE LA PAGE
    =====================================================
    */

    const pageCategory =
        uploadContainer.dataset.category || null;


    /*
    =====================================================
       INFORMATIONS
    =====================================================
    */

    if (uploadInfo) {

        uploadInfo.textContent =
            `Maximum : ${APP_CONFIG.maxFiles} files — ${APP_CONFIG.maxFileSizeMB} MB/file`;

    }


    /*
    =====================================================
       VALIDATION DES FICHIERS
    =====================================================
    */

    function validateFiles(files) {

        const validFiles = [];

        const currentCount =
            typeof window.getCurrentUploadFileCount === "function"
                ? window.getCurrentUploadFileCount()
                : 0;

        let count = currentCount;

        for (const file of files) {

            if (count >= APP_CONFIG.maxFiles) {

                showNotification(
                    `Maximum <strong>${APP_CONFIG.maxFiles} fichiers</strong>.`,
                    "warning"
                );

                break;
            }

            if (
                file.size >
                APP_CONFIG.maxFileSizeMB * 1024 * 1024
            ) {

                showNotification(
                    `<strong>${file.name}</strong> est trop volumineux.<br>
                    Taille maximale : <strong>${APP_CONFIG.maxFileSizeMB} Mo/file</strong>.`,
                    "error"
                );

                continue;
            }

            const category =
                getFileCategory(file.name);

            if (category === "Unknown") {

            showNotification(
                `Ce type de fichier n'est pas supporté.`,
                "error"
            );

                continue;
            }

            if (
                pageCategory &&
                category !== pageCategory
            ) {

                showNotification(
                    `<strong>${file.name}</strong> n'est pas un fichier de la catégorie
                    <strong>${pageCategory}</strong>.`,
                    "error"
                );

                continue;
            }

            validFiles.push(file);

            count++;
        }

        return validFiles;
    }


    /*
    =====================================================
       TRAITEMENT DES FICHIERS
    =====================================================
    */

    async function processFiles(files) {

        const validFiles =
            validateFiles(files);

        if (validFiles.length === 0) {
            return;
        }

        /*
        =========================================================
        TRANSMISSION AUX MOTEURS SPÉCIFIQUES
        =========================================================
        */

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:files-selected",
                {
                    detail: {
                        files: validFiles,
                        category: pageCategory
                    }
                }
            )
        );


        /*
        =========================================================
        COMPATIBILITÉ HOMEPAGE
        =========================================================
        */

        if (
            typeof window.handleUploadedFiles === "function"
        ) {

            await window.handleUploadedFiles(
                validFiles
            );
        }
        
    }


    /*
    =====================================================
       BROWSE
    =====================================================
    */

    if (fileInput) {

        fileInput.addEventListener(
            "change",
            async () => {

                await processFiles(
                    Array.from(fileInput.files)
                );

                fileInput.value = "";
            }
        );
    }

    /* 
    =====================================================
    DRAG & DROP 
    ===================================================== 
    */

    if (dropZone) {

        /* =================================================
        BLOQUER LE COMPORTEMENT NATIF DU NAVIGATEUR
        ================================================= */

        dropZone.addEventListener(
            "dragenter",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                dropZone.classList.add("dragover");

            }
        );

        dropZone.addEventListener(
            "dragover",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                event.dataTransfer.dropEffect = "copy";

                dropZone.classList.add("dragover");

            }
        );

        dropZone.addEventListener(
            "dragleave",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                dropZone.classList.remove("dragover");

            }
        );

        dropZone.addEventListener(
            "drop",
            async (event) => {

                event.preventDefault();
                event.stopPropagation();

                dropZone.classList.remove("dragover");


                const files =
                    Array.from(
                        event.dataTransfer.files
                    );


                if (files.length === 0) {
                    return;
                }


                await processFiles(files);

            }
        );

    }

    /*
    =====================================================
       FROM URL
    =====================================================
    */

    if (
        urlBtn &&
        urlModal &&
        urlInput &&
        urlAdd &&
        urlCancel
    ) {

        urlBtn.addEventListener(
            "click",
            () => {

                urlModal.classList.remove(
                    "hidden"
                );

                urlInput.focus();
            }
        );


        urlCancel.addEventListener(
            "click",
            () => {

                urlModal.classList.add(
                    "hidden"
                );

                urlInput.value = "";
            }
        );


        urlAdd.addEventListener(
            "click",
            async () => {

                const url =
                    urlInput.value.trim();

                if (!url) {

                    showNotification(
                        `Veuillez entrer une URL.`,
                        "warning"
                    );

                    return;
                }

                try {

                    const response =
                        await fetch(url);

                    if (!response.ok) {

                        throw new Error(
                            "Download failed"
                        );
                    }

                    const blob =
                        await response.blob();

                    const parsedUrl =
                        new URL(url);

                    const pathName =
                        decodeURIComponent(
                            parsedUrl.pathname
                        );

                    const fileName =
                        pathName.split("/").pop()
                        || "file";

                    const file =
                        new File(
                            [blob],
                            fileName,
                            {
                                type: blob.type
                            }
                        );

                    await processFiles(
                        [file]
                    );

                    urlInput.value = "";

                    urlModal.classList.add(
                        "hidden"
                    );

                }
                catch (error) {

                    console.error(error);

                    showNotification(
                        `Impossible de charger cette URL.`,
                        "error"
                    );
                }
            }
        );
    }

});