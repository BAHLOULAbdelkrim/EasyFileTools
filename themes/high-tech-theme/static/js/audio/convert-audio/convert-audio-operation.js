console.log(
    "[CONVERT AUDIO OPERATION] convert-audio-operation.js loaded"
);

/* =========================
   CONVERT AUDIO OPERATION
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const operationZone =
            document.getElementById(
                "operation-zone"
            );

        if (!operationZone) {
            return;
        }

        if (
            operationZone.dataset.operation !==
            "convert-audio"
        ) {
            return;
        }

        /* =========================
           FILES
        ========================= */

        let conversionFiles =
            [];

        let selectedConversionFormat =
            null;


        /*
        * Signature of the last successfully
        * completed conversion.
        */

        let lastCompletedConversionSignature =
            null;


        /*
        * Files successfully converted
        * during the current run.
        */

        let currentRunConvertedIndexes =
            new Set();


        const chooseFormatLabel =
            document.getElementById(
                "chooseFormatLabel"
            );

        const operationController =
            window.EasyFileOperationController;


        /* =========================
        CONVERSION SIGNATURE
        ========================= */

        function getCurrentConversionSignature() {

            if (
                conversionFiles.length === 0 ||
                !selectedConversionFormat
            ) {

                return null;
            }


            /*
            * For Convert Audio, file order does
            * not affect the individual results.
            */

            const files =
                conversionFiles
                    .map(
                        fileData => {

                            const file =
                                fileData?.file ||
                                fileData;


                            if (!file) {

                                return "";
                            }


                            return [
                                file.name || "",
                                file.size || 0,
                                file.lastModified || 0,
                                file.type || ""
                            ].join("::");

                        }
                    )
                    .filter(Boolean)
                    .sort();


            return JSON.stringify(
                {
                    files,

                    format:
                        selectedConversionFormat
                }
            );
        }


        /* =========================
        GENERIC CONTROLLER ADAPTER
        ========================= */

        const convertAudioAdapter = {

        async run() {

            if (
                conversionFiles.length === 0 ||
                !selectedConversionFormat
            ) {

                return;
            }


            const currentConversionSignature =
                getCurrentConversionSignature();


            /*
            * Nothing changed since the last
            * successful conversion.
            */

            if (
                lastCompletedConversionSignature &&
                currentConversionSignature ===
                    lastCompletedConversionSignature
            ) {

                if (
                    typeof showNotification ===
                    "function"
                ) {

                    showNotification(
                        "This operation has already been completed with the current files and settings.",
                        "info"
                    );
                }


                console.log(
                    "[CONVERT AUDIO] Already completed — skipped."
                );


                return;
            }


            /*
            * A genuinely new conversion is
            * about to start.
            */

            currentRunConvertedIndexes =
                new Set();


                console.log(
                    "[CONVERT AUDIO ADAPTER] Run requested:",
                    {
                        files:
                            conversionFiles.length,

                        format:
                            selectedConversionFormat
                    }
                );


                /*
                * Wait for the real conversion
                * to finish before resolving run().
                */

                const ended =
                    new Promise(
                        resolve => {

                            document.addEventListener(
                                "easyfiletools:conversion-ended",
                                event => {

                                    resolve(
                                        event.detail || {}
                                    );

                                },
                                {
                                    once: true
                                }
                            );

                        }
                    );


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-requested",
                        {
                            detail: {

                                files:
                                    conversionFiles,

                                category:
                                    operationZone.dataset
                                        .category ||
                                    "",

                                format:
                                    selectedConversionFormat

                            }
                        }
                    )
                );

                const endDetail =
                    await ended;

                /*
                * Save the signature only when every
                * requested file was actually converted
                * successfully during this run.
                */

                const conversionCompletedSuccessfully =
                    endDetail.cancelled !== true &&

                    conversionFiles.length > 0 &&

                    currentRunConvertedIndexes.size ===
                        conversionFiles.length;


                if (
                    conversionCompletedSuccessfully
                ) {

                    lastCompletedConversionSignature =
                        currentConversionSignature;


                    console.log(
                        "[CONVERT AUDIO] Successful conversion signature saved:",
                        lastCompletedConversionSignature
                    );
                }
                else {

                    console.log(
                        "[CONVERT AUDIO] Conversion signature not saved:",
                        {
                            cancelled:
                                endDetail.cancelled === true,

                            converted:
                                currentRunConvertedIndexes.size,

                            expected:
                                conversionFiles.length
                        }
                    );
                }

                // Resolving run() without a valid result made the generic
                // controller show "Conversion completed" after FFmpeg failures.
                // Cancellation is managed by the controller's own state.
                if (
                    endDetail.cancelled !== true &&
                    !conversionCompletedSuccessfully
                ) {
                    const message =
                        "Audio conversion failed: " +
                        "no valid result was produced for all selected files. " +
                        "Check the source file and try again.";

                    if (typeof showNotification === "function") {
                        showNotification(message, "error", 6000);
                    }

                    throw new Error(message);
                }

            },

            async cancel() {

                console.log(
                    "[CONVERT AUDIO ADAPTER] Cancel requested"
                );


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-cancel-requested",
                        {
                            detail: {

                                category:
                                    operationZone.dataset.category ||
                                    ""

                            }
                        }
                    )
                );
            },

            async pause() {

                console.log(
                    "[CONVERT AUDIO ADAPTER] Pause requested"
                );


                const paused =
                    new Promise(
                        resolve => {

                            document.addEventListener(
                                "easyfiletools:conversion-paused",
                                () => {

                                    resolve();

                                },
                                {
                                    once: true
                                }
                            );

                        }
                    );


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-pause-requested",
                        {
                            detail: {

                                category:
                                    operationZone.dataset.category ||
                                    ""

                            }
                        }
                    )
                );


                await paused;
            },


            async resume() {

                console.log(
                    "[CONVERT AUDIO ADAPTER] Resume requested"
                );


                const resumed =
                    new Promise(
                        resolve => {

                            document.addEventListener(
                                "easyfiletools:conversion-resumed",
                                () => {

                                    resolve();

                                },
                                {
                                    once: true
                                }
                            );

                        }
                    );


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-resume-requested",
                        {
                            detail: {

                                category:
                                    operationZone.dataset.category ||
                                    ""

                            }
                        }
                    )
                );


                await resumed;
            }

        };

        operationController
            ?.registerAdapter?.(
                convertAudioAdapter
            );

        /* =========================
        CONVERT BUTTON
        ========================= */

        function updateReadyState() {

            const ready =
                conversionFiles.length > 0 &&
                selectedConversionFormat !== null;


            operationController
                ?.setReady?.(
                    ready
                );
        }

        /* =========================
        CHOOSE FORMAT LABEL
        ========================= */

        function updateChooseFormatLabel() {

            if (!chooseFormatLabel) {
                return;
            }

            const hasFiles =
                conversionFiles.length > 0;

            if (hasFiles) {

                chooseFormatLabel.classList.add(
                    "active"
                );
            }
            else {

                chooseFormatLabel.classList.remove(
                    "active"
                );
            }
        }

        document.addEventListener(
            "easyfiletools:operation-files-updated",
            (event) => {

                const detail =
                    event.detail || {};

                if (
                    detail.operation !==
                    "convert-audio"
                ) {
                    return;
                }

                conversionFiles =
                    Array.isArray(
                        detail.files
                    )
                        ? detail.files
                        : [];

                console.log(
                    "[CONVERT AUDIO OPERATION] Files updated:",
                    conversionFiles.length
                );

                updateChooseFormatLabel();
                updateReadyState();

            }

        );

        /* =========================
        FILES CLEARED
        ========================= */

        document.addEventListener(
            "easyfiletools:files-cleared",
            () => {

                    conversionFiles =
                        [];

                    selectedConversionFormat =
                        null;

                    lastCompletedConversionSignature =
                        null;

                    currentRunConvertedIndexes =
                        new Set();

                    updateReadyState();

                    updateChooseFormatLabel();

            }
        );

        /* =========================
        CONVERSION FORMAT SELECTED
        ========================= */

        document.addEventListener(
            "easyfiletools:conversion-format-selected",
            (event) => {

                selectedConversionFormat =
                    event.detail?.format || null;

                console.log(
                    "[CONVERT AUDIO OPERATION] Selected conversion format:",
                    selectedConversionFormat
                );

                if (
                    selectedConversionFormat
                ) {

                    window.EasyFileOperationLifecycle
                        ?.settingsChanged?.(
                            {

                                operation:
                                    "convert-audio",

                                scope:
                                    "all",

                                settings: {

                                    format:
                                        selectedConversionFormat

                                }

                            }
                        );

                }

                updateReadyState();

            }
        );

        /* =========================
        FILE CONVERSION PROGRESS
        → GENERIC OPERATION PROGRESS
        ========================= */

        document.addEventListener(
            "easyfiletools:file-conversion-progress",
            (event) => {

                const detail =
                    event.detail || {};

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-file-progress",
                        {
                            detail: {
                                ...detail,

                                category:
                                    operationZone.dataset.category || "",

                                operation:
                                    operationZone.dataset.operation || ""
                            }
                        }
                    )
                );

            }
        );

        /* =========================
        FILE CONVERTED
        → GENERIC OPERATION FILE COMPLETED
        ========================= */

        document.addEventListener(
            "easyfiletools:file-converted",
            (event) => {

                const detail =
                    event.detail || {};


                if (
                    Number.isInteger(
                        detail.index
                    )
                ) {

                    currentRunConvertedIndexes.add(
                        detail.index
                    );
                }


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-file-completed",
                        {
                            detail: {

                                index:
                                    detail.index,

                                outputUrl:
                                    detail.url || null,

                                outputBlob:
                                    detail.blob || null,

                                outputName:
                                    detail.outputName || null,

                                outputSize:
                                    detail.size || 0,

                                outputFormat:
                                    detail.outputFormat || null,

                                completedLabel:
                                    "Converted",

                                category:
                                    operationZone.dataset.category || "",

                                operation:
                                    operationZone.dataset.operation || ""
                            }
                        }
                    )
                );

            }
        );

        /* =========================
        FILE CONVERSION CANCELLED
        → GENERIC OPERATION FILE CANCELLED
        ========================= */

        document.addEventListener(
            "easyfiletools:conversion-cancelled",
            (event) => {

                const detail =
                    event.detail || {};

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-file-cancelled",
                        {
                            detail: {
                                ...detail,

                                category:
                                    operationZone.dataset.category || "",

                                operation:
                                    operationZone.dataset.operation || ""
                            }
                        }
                    )
                );

            }
        );

        /* =========================
        CONVERSION STARTED
        ========================= */

        document.addEventListener(
            "easyfiletools:conversion-started",
            () => {

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-started",
                        {
                            detail: {
                                category:
                                    operationZone.dataset.category || "",

                                operation:
                                    operationZone.dataset.operation || ""
                            }
                        }
                    )
                );

                console.log(
                    "[CONVERT AUDIO OPERATION] Conversion started"
                );

            }
        );

        /* =========================
        CONVERSION ENDED
        ========================= */

        document.addEventListener(
            "easyfiletools:conversion-ended",
            (event) => {

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-ended",
                        {
                            detail: {
                                ...(event.detail || {}),

                                category:
                                    operationZone.dataset.category || "",

                                operation:
                                    operationZone.dataset.operation || ""
                            }
                        }
                    )
                );

                console.log(
                    "[CONVERT AUDIO OPERATION] Conversion ended"
                );

            }
        );

    }
);

