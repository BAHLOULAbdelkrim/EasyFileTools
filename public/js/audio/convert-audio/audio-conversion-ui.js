console.log(
    "[AUDIO CONVERSION UI] audio-conversion-ui.js loaded"
);


/* =========================
   AUDIO CONVERSION UI
========================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const conversionFormats =
            document.getElementById(
                "conversionFormats"
            );

        if (!conversionFormats) {
            return;
        }


        /* =========================
           STATE
        ========================= */

        let selectedFormat =
            null;

        let currentFiles =
            [];


        /* =========================
           GET AUDIO FORMATS
        ========================= */

        function getAudioFormats() {

            if (
                typeof AUDIO_CONVERSION_OUTPUT_FORMATS ===
                "undefined"
            ) {

                console.error(
                    "[AUDIO CONVERSION UI] Audio output formats unavailable"
                );

                return [];
            }

            return [
                ...AUDIO_CONVERSION_OUTPUT_FORMATS
            ];
        }

        /* =========================
           GET FILE EXTENSION
        ========================= */

        function getFileExtension(
            fileData
        ) {

            const file =
                fileData?.file;

            if (
                !file ||
                !file.name
            ) {
                return null;
            }

            const parts =
                file.name
                    .toLowerCase()
                    .split(".");

            if (
                parts.length < 2
            ) {
                return null;
            }

            return parts.pop();
        }


        /* =========================
           GET BLOCKED FORMAT
        ========================= */

        function getBlockedFormat(
            files
        ) {

            if (
                !files ||
                files.length === 0
            ) {
                return null;
            }

            const sourceFormats =
                files
                    .map(
                        getFileExtension
                    )
                    .filter(Boolean);

            if (
                sourceFormats.length === 0
            ) {
                return null;
            }

            const uniqueFormats =
                [
                    ...new Set(
                        sourceFormats
                    )
                ];

            if (
                uniqueFormats.length === 1
            ) {

                return uniqueFormats[0];
            }

            return null;
        }


        /* =========================
           DISPATCH SELECTION
        ========================= */

        function dispatchFormatSelection() {

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:conversion-format-selected",
                    {
                        detail: {
                            format:
                                selectedFormat,
                            category:
                                "Audio"
                        }
                    }
                )
            );
        }


        /* =========================
           SELECT FORMAT
        ========================= */

        function selectFormat(
            format
        ) {

            selectedFormat =
                format;

            renderFormats();

            console.log(
                "[AUDIO CONVERSION UI] Selected format:",
                selectedFormat
            );

            dispatchFormatSelection();
        }


        /* =========================
           RENDER FORMATS
        ========================= */

        function renderFormats() {

            const audioFormats =
                getAudioFormats();

            const hasFiles =
                currentFiles.length > 0;

            const blockedFormat =
                getBlockedFormat(
                    currentFiles
                );


            /* =========================
               INVALID SELECTION
            ========================= */

            if (
                selectedFormat &&
                (
                    !hasFiles ||
                    selectedFormat ===
                        blockedFormat
                )
            ) {

                console.log(
                    "[AUDIO CONVERSION UI] Selection cancelled:",
                    selectedFormat
                );

                selectedFormat =
                    null;

                dispatchFormatSelection();
            }


            /* =========================
               CLEAR
            ========================= */

            conversionFormats.innerHTML =
                "";


            /* =========================
               CREATE BUTTONS
            ========================= */

            audioFormats.forEach(
                format => {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";

                    button.className =
                        "audio-format-btn";

                    button.dataset.format =
                        format;

                    button.textContent =
                        format.toUpperCase();


                    /* =========================
                       AVAILABLE ?
                    ========================= */

                    const isBlocked =
                        !hasFiles ||
                        format ===
                            blockedFormat;


                    if (isBlocked) {

                        button.disabled =
                            true;
                    }
                    else {

                        button.disabled =
                            false;

                        button.classList.add(
                            "active"
                        );
                    }


                    /* =========================
                       SELECTED ?
                    ========================= */

                    if (
                        selectedFormat ===
                        format
                    ) {

                        button.classList.remove(
                            "active"
                        );

                        button.classList.add(
                            "selected"
                        );
                    }


                    /* =========================
                       CLICK
                    ========================= */

                    button.addEventListener(
                        "click",
                        () => {

                            if (
                                button.disabled
                            ) {
                                return;
                            }

                            selectFormat(
                                format
                            );
                        }
                    );


                    conversionFormats.appendChild(
                        button
                    );
                }
            );


            console.log(
                "[AUDIO CONVERSION UI] Formats refreshed",
                {
                    files:
                        currentFiles.length,
                    blockedFormat:
                        blockedFormat,
                    selectedFormat:
                        selectedFormat
                }
            );
        }


        /* =========================
           LOAD FILES FROM STORAGE
        ========================= */

        async function refreshFiles() {

            if (
                typeof loadSelectedFiles !==
                "function"
            ) {

                currentFiles =
                    [];

                renderFormats();

                return;
            }

            const data =
                await loadSelectedFiles();

            if (
                !data ||
                !data.files
            ) {

                currentFiles =
                    [];
            }
            else {

                currentFiles =
                    data.files;
            }

            renderFormats();
        }


        /* =========================
           STORAGE UPDATED
        ========================= */

        document.addEventListener(
            "easyfiletools:storage-updated",
            async () => {

                await refreshFiles();
            }
        );


        /* =========================
           FILES CLEARED
        ========================= */

        document.addEventListener(
            "easyfiletools:files-cleared",
            () => {

                currentFiles =
                    [];

                selectedFormat =
                    null;

                renderFormats();

                dispatchFormatSelection();
            }
        );


        /* =========================
           INITIAL RENDER
        ========================= */

        await refreshFiles();
    }
);