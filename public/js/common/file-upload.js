
console.log("file-upload.js loaded");


/* =========================================================
   INITIALISATION D'UNE ZONE DE CHARGEMENT
========================================================= */

function initFileUpload(options) {

    const {
        zone,
        input,
        info,
        maxFiles,
        maxFileSize,
        category = null,
        getCurrentCount,
        onFiles
    } = options;


    if (!zone || !input) {
        return;
    }


    /* =====================================================
       MESSAGE DES LIMITES
    ===================================================== */

    if (info) {

        info.textContent =
            `Maximum : ${maxFiles} files — ${APP_CONFIG.maxFileSizeMB} MB/file`;

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateFiles(files) {

        const validFiles = [];

        let currentCount =
            typeof getCurrentCount === "function"
                ? getCurrentCount()
                : 0;


        for (const file of files) {

            if (currentCount >= maxFiles) {

                alert(
                    `Maximum ${maxFiles} files.`
                );

                break;

            }


            if (file.size > maxFileSize) {

                alert(
                    `${file.name} is too large. Maximum size is ${APP_CONFIG.maxFileSizeMB} MB.`
                );

                continue;

            }


            if (
                category &&
                getFileCategory(file.name) !== category
            ) {

                alert(
                    `${file.name} is not an ${category.toLowerCase()} file.`
                );

                continue;

            }


            validFiles.push(file);

            currentCount++;

        }


        return validFiles;

    }


    /* =====================================================
       BROWSE
    ===================================================== */

    input.addEventListener(
        "change",
        async () => {

            const files =
                validateFiles(
                    Array.from(input.files)
                );

            if (files.length > 0) {

                await onFiles(files);

            }

            input.value = "";

        }
    );


    /* =====================================================
       DRAG & DROP
    ===================================================== */

    zone.addEventListener(
        "dragover",
        (event) => {

            event.preventDefault();

            zone.classList.add("dragover");

        }
    );


    zone.addEventListener(
        "dragleave",
        () => {

            zone.classList.remove("dragover");

        }
    );


    zone.addEventListener(
        "drop",
        async (event) => {

            event.preventDefault();

            zone.classList.remove("dragover");

            const files =
                validateFiles(
                    Array.from(
                        event.dataTransfer.files
                    )
                );

            if (files.length > 0) {

                await onFiles(files);

            }

        }
    );


    /* =====================================================
       FROM URL
    ===================================================== */

    if (
        options.urlButton &&
        options.urlModal &&
        options.urlInput &&
        options.urlAdd &&
        options.urlCancel
    ) {

        options.urlButton.addEventListener(
            "click",
            () => {

                options.urlModal.classList.remove(
                    "hidden"
                );

                options.urlInput.focus();

            }
        );


        options.urlCancel.addEventListener(
            "click",
            () => {

                options.urlModal.classList.add(
                    "hidden"
                );

                options.urlInput.value = "";

            }
        );


        options.urlAdd.addEventListener(
            "click",
            async () => {

                const url =
                    options.urlInput.value.trim();


                if (!url) {

                    alert(
                        "Please enter an URL."
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


                    const validFiles =
                        validateFiles(
                            [file]
                        );


                    if (validFiles.length > 0) {

                        await onFiles(
                            validFiles
                        );

                    }


                    options.urlInput.value = "";

                    options.urlModal.classList.add(
                        "hidden"
                    );

                }
                catch (error) {

                    console.error(error);

                    alert(
                        "Unable to load this URL."
                    );

                }

            }
        );

    }

}

