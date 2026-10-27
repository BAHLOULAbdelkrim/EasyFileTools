console.log("common/operation-zone.js loaded");

/* =========================
   OPERATION ZONE
========================= */

document.addEventListener("DOMContentLoaded", async () => {

    const operationZone =
        document.getElementById("operation-zone");

    if (!operationZone) return;

    const operationSuccessTitle =
        operationZone.dataset.successTitle ||
        "Operation completed";

    const operationSuccessMessage =
        operationZone.dataset.successMessage ||
        "All files were processed successfully.";

    const operationSlug =
        (
            operationZone.dataset.operation ||
            "processed-files"
        )
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            );

    /* =========================
       FICHIERS DE L'OPÉRATION
    ========================= */

    let operationFiles = [];

    let operationIsDownloading =
        false;

    /* =========================
    GENERIC RESULT LIFECYCLE
    ========================= */


    /*
    * Stable file identifier.
    *
    * Important:
    * Cut Audio already uses the same
    * name + size + lastModified logic.
    */

    function getOperationFileKey(
        file
    ) {

        if (!file) {
            return "";
        }


        return [

            file.name || "",

            file.size || 0,

            file.lastModified || 0

        ].join("::");

    }

    /*
    * Find the file concerned by a
    * settings-change event.
    */

    function findOperationFileIndex(
        detail
    ) {

        if (
            Number.isInteger(
                detail.index
            ) &&
            detail.index >= 0 &&
            detail.index <
                operationFiles.length
        ) {

            return detail.index;
        }


        const key =
            detail.key ||
            (
                detail.file
                    ? getOperationFileKey(
                        detail.file
                    )
                    : ""
            );


        if (!key) {
            return -1;
        }


        return operationFiles.findIndex(
            fileData =>
                fileData.fileKey ===
                key
        );
    }

    function itemHasOperationResult(
        item
    ) {

        if (!item) {

            return false;

        }


        if (item.result) {

            return true;

        }


        return (
            Array.isArray(
                item.outputs
            ) &&
            item.outputs.length > 0
        );

    }


    function getOperationResultPreview(
        item
    ) {

        if (!item) {

            return null;

        }


        if (item.result) {

            return item.result;

        }


        if (
            Array.isArray(
                item.outputs
            ) &&
            item.outputs.length > 0
        ) {

            return item.outputs[0];

        }


        return null;

    }    

    /*
    * Notify the generic file-list UI
    * that a result became stale/current.
    */

    function notifyResultStaleState(
        index,
        stale,
        externalKey = null
    ) {

        const fileData =
            operationFiles[index];


        if (!fileData) {
            return;
        }


        const resultItem =
            window
                .EasyFileOperationResults
                ?.getItem?.(
                    index
                );


        const result =
            getOperationResultPreview(
                resultItem
            );


        const outputs =
            Array.isArray(
                resultItem?.outputs
            )
                ? resultItem.outputs
                : [];


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:file-operation-stale-changed",
                {
                    detail: {

                        index,

                        key:
                            externalKey ||
                            fileData.fileKey,

                        stale:
                            Boolean(stale),

                        outputs,

                        outputCount:
                            outputs.length,

                        outputUrl:
                            result?.outputUrl ||
                            null,

                        outputName:
                            result?.outputName ||
                            null,

                        outputSize:
                            result?.outputSize ||
                            0,

                        outputFormat:
                            result?.outputFormat ||
                            null,

                        completedLabel:
                            result?.completedLabel ||
                            "Processed",

                        category:
                            operationZone.dataset.category ||
                            "",

                        operation:
                            operationZone.dataset.operation ||
                            ""

                    }
                }
            )
        );
    }

    /* =========================
    BATCH RESULT NOTIFICATION
    ========================= */

    function notifyBatchResultStaleState(
        stale
    ) {

        const batch =
            window
                .EasyFileOperationResults
                ?.getBatch?.();


        const result =
            batch?.result ||
            {};


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:batch-result-stale-changed",
                {
                    detail: {

                        stale:
                            Boolean(
                                stale
                            ),

                        outputUrl:
                            result.outputUrl ||
                            null,

                        outputName:
                            result.outputName ||
                            null,

                        outputSize:
                            result.outputSize ||
                            0,

                        outputFormat:
                            result.outputFormat ||
                            null,

                        completedLabel:
                            result.completedLabel ||
                            "Processed",

                        category:
                            operationZone.dataset
                                .category ||
                            "",

                        operation:
                            operationZone.dataset
                                .operation ||
                            ""

                    }
                }
            )
        );
    }

    /*
    * Before replacing a stale result,
    * protect results that were never downloaded.
    */

    async function confirmBeforeProcessing() {

        const results =
            window.EasyFileOperationResults;

        const messages =
            window.EasyFileOperationMessages;


        if (
            !results ||
            !messages
        ) {

            return true;
        }


        const staleCount =
            results
                .getStaleUndownloadedCount();


        if (
            staleCount === 0
        ) {

            return true;
        }


        return await messages
            .confirmReplaceResult(
                staleCount
            );
    }

    /*
    * Public generic API.
    *
    * Every operation can call this
    * immediately before starting.
    */

    /* =========================
    PUBLIC SETTINGS API
    ========================= */

    function operationSettingsChanged(
        {
            operation = null,
            scope = "file",
            index = null,
            key = null,
            file = null,
            inputs = null,
            settings = {}
        } = {}
    ) {

        const currentOperation =
            operation ||
            operationZone.dataset.operation ||
            "";


        if (!currentOperation) {

            console.warn(
                "[OPERATION LIFECYCLE] Missing operation name."
            );

            return;
        }


        /*
        * This is the ONLY public gateway
        * used by operation-specific scripts
        * to report parameter changes.
        */

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:operation-settings-changed",
                {
                    detail: {

                        operation:
                            currentOperation,

                        scope,

                        index,

                        key,

                        file,

                        inputs,

                        settings:
                            settings || {}

                    }
                }
            )
        );

    }

    /* =========================
    COMPLETE BATCH RESULT
    ========================= */

    function completeBatchResult(
        {
            outputUrl = null,
            outputBlob = null,
            outputName = null,
            outputSize = 0,
            outputFormat = null,
            completedLabel = "Processed"
        } = {}
    ) {

        const results =
            window.EasyFileOperationResults;


        if (!results) {
            return;
        }

        const previousBatch =
            results.getBatch();


        const wasStale =
            previousBatch?.stale ===
            true;

        results.completeBatch(
            {
                outputUrl,
                outputBlob,
                outputName,
                outputSize,
                outputFormat,
                completedLabel
            }
        );


        if (wasStale) {

            notifyBatchResultStaleState(
                false
            );
        }


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:batch-result-completed",
                {
                    detail: {

                        outputUrl,

                        outputBlob,

                        outputName,

                        outputSize,

                        outputFormat,

                        completedLabel,

                        operation:
                            operationZone.dataset
                                .operation ||
                            "",

                        category:
                            operationZone.dataset
                                .category ||
                            ""

                    }
                }
            )
        );
    }

    /* =========================
    BATCH DOWNLOADED
    ========================= */

    function markBatchResultDownloaded() {

        const results =
            window.EasyFileOperationResults;


        if (!results) {
            return;
        }


        const batch =
            results.getBatch();


        if (!batch?.result) {
            return;
        }


        results.markDownloaded();


        console.log(
            "[OPERATION LIFECYCLE] Batch result downloaded"
        );
    }

    function getBatchResult() {

        const batch =
            window
                .EasyFileOperationResults
                ?.getBatch?.();


        if (
            !batch ||
            !batch.result
        ) {

            return null;
        }


        return {

            ...batch.result

        };
    }

    function clearBatchResult() {

        window
            .EasyFileOperationResults
            ?.clearBatch?.();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:batch-result-cleared"
            )
        );
    }

    window.EasyFileOperationLifecycle = {

        settingsChanged:
            operationSettingsChanged,

        confirmBeforeProcessing,

        completeBatchResult,

        markBatchResultDownloaded,

        getBatchResult,

        clearBatchResult

    };

    /* =========================
    NOTIFY OPERATION FILES
    ========================= */

    /*
     * Generic settings lifecycle: every operation returns to its initial
     * choices when its last input disappears (Clear All or single removal).
     * Reset DOM controls before operation-specific handlers are notified,
     * then let the settings UIs clear their private JS state via this event.
     */
    function resetEmptyOperationSettings() {
        const fieldset = document.getElementById("operationParametersFieldset");
        if (!fieldset) return;
        fieldset.querySelectorAll("input, select, textarea").forEach(control => {
            if (control.type === "file" || control.type === "hidden") return;
            if (control.type === "checkbox" || control.type === "radio") {
                control.checked = control.defaultChecked;
            } else if (control.tagName === "SELECT") {
                const initial = Array.from(control.options).findIndex(option => option.defaultSelected);
                control.selectedIndex = initial >= 0 ? initial : 0;
            } else {
                control.value = control.defaultValue;
            }
        });
        fieldset.querySelectorAll("button.active, button[aria-pressed='true']").forEach(button => {
            button.classList.remove("active");
            if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
        });
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-settings-reset", {
            detail: { operation: operationZone.dataset.operation || "" }
        }));
        window.EasyFileUIControls?.init?.(fieldset);
    }

    function notifyOperationFilesUpdated() {

        if (operationFiles.length === 0) resetEmptyOperationSettings();

        const results =
            window.EasyFileOperationResults;

        const config =
            window.EasyFileOperationConfig
                ?.get?.(
                    operationZone.dataset.operation ||
                    ""
                );


        if (results) {

            results.setMode(
                config?.resultMode ||
                "per-file"
            );

            results.setInputs(
                operationFiles
            );
        }        

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:operation-files-updated",
                {
                    detail: {
                        files:
                            operationFiles,

                        category:
                            operationZone.dataset.category || "",

                        operation:
                            operationZone.dataset.operation || ""
                    }
                }
            )
        );

        // Operation-specific renderers may paint their default preset on the
        // same update. When there are no inputs, no choice stays highlighted.
        if (operationFiles.length === 0) {
            queueMicrotask(() => {
                document.querySelectorAll(
                    "#operationParametersFieldset button.active, #operationParametersFieldset button[aria-pressed='true']"
                ).forEach(button => {
                    button.classList.remove("active");
                    if (button.hasAttribute("aria-pressed")) {
                        button.setAttribute("aria-pressed", "false");
                    }
                });
            });
        }
    }

    /* =========================
       LUCIDE ICONS
    ========================= */

    if (typeof createLocalIcons === "function") {

        createLocalIcons(operationZone);

    }
    else if (typeof lucide !== "undefined") {

        lucide.createIcons({
            attrs: {
                "stroke-width": 2
            }
        });

    }

    /* =========================
       GO TO TOP
    ========================= */

    const goToTopBtn =
        document.getElementById("goToTopBtn");

    if (goToTopBtn) {

        goToTopBtn.addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }



const operationTop =
    operationZone.querySelector(
        ".operation-top"
    );

const downloadAllBtn =
    document.getElementById(
        "downloadAllBtn"
    );

const downloadAllFormats =
    document.getElementById(
        "downloadAllFormats"
    );

/* =========================
   DOWNLOAD ALL FORMATS
========================= */

function renderDownloadAllFormats() {

    if (!downloadAllFormats) {
        return;
    }

    downloadAllFormats.innerHTML = `
        <button
            type="button"
            class="download-format-btn"
            data-download-format="zip"
        >
            ZIP
        </button>

        <button
            type="button"
            class="download-format-btn"
            data-download-format="tar.gz"
        >
            TAR.GZ
        </button>

        <button
            type="button"
            class="download-format-btn"
            data-download-format="tar"
        >
            TAR
        </button>
    `;
}

/* =========================
   DOWNLOAD ALL
========================= */

function updateDownloadAll() {

    if (!downloadAllBtn) {
        return;
    }


    const config =
        window
            .EasyFileOperationConfig
            ?.get?.(
                operationZone
                    .dataset
                    .operation ||
                ""
            );


    const resultMode =
        config?.resultMode ||
        "per-file";


    /* =========================
       BATCH
    ========================= */

    if (
        resultMode ===
        "batch"
    ) {

        if (operationTop) {
            operationTop.hidden =
                true;
        }

        downloadAllBtn.hidden =
            true;

        downloadAllBtn.disabled =
            true;

        downloadAllBtn.classList.remove(
            "active"
        );


        downloadAllFormats
            ?.classList
            .add(
                "hidden"
            );


        return;

    }


    /* =========================
       PER_FILE / MULTI_OUTPUT
    ========================= */

    if (operationTop) {
        operationTop.hidden =
            false;
    }

    downloadAllBtn.hidden =
        false;


    const results =
        window
            .EasyFileOperationResults;


    const canDownload =
        operationFiles.length > 0 &&
        results
            ?.hasCurrentResult?.() ===
            true &&
        !operationIsDownloading;


    downloadAllBtn.disabled =
        !canDownload;


    downloadAllBtn
        .classList
        .toggle(
            "active",
            canDownload
        );

}


/* =========================
   DOWNLOAD ALL ARCHIVE
========================= */

async function downloadAllArchive(
    format
) {

    if (operationIsDownloading) {
        return;
    }

    const results =
        window.EasyFileOperationResults;


    const outputFiles =
        results?.getCurrentOutputs?.() ||
        [];


    if (
        outputFiles.length === 0
    ) {

        console.warn(
            "[OPERATION ZONE] No current output available"
        );

        return;
    }

    const downloads =
        window
            .EasyFileOperationDownloads;


    if (!downloads) {

        console.error(
            "[OPERATION ZONE] Generic download manager unavailable"
        );

        return;
    }


    operationIsDownloading =
        true;
    let archiveSucceeded = false;

    updateDownloadAll();


    try {

        const success =
            await downloads
                .downloadArchive(
                    outputFiles,
                    format,
                    `EasyFileTools-${operationSlug}`
                );


        if (!success) {
            return;
        }

        archiveSucceeded = true;

        console.log(
            "[OPERATION ZONE] Download All completed:",
            format
        );


        if (
            typeof showSuccessToast ===
            "function"
        ) {

            showSuccessToast(
                "Download started",
                `Your ${format.toUpperCase()} file is ready and the download has started.`,
                2000
            );
        }

    }
    catch (error) {

        console.error(
            "[OPERATION ZONE] Download All failed:",
            error
        );

        if (typeof showNotification === "function") {
            const message = downloads.archiveErrorMessage?.(error) ||
                "The archive could not be prepared. Try fewer files or download the results individually.";
            showNotification(message, "warning", 9000);
        }

    }
    finally {

        operationIsDownloading =
            false;

        updateDownloadAll();

        // Do not announce 100% after a rejected/oversized archive.
        if (archiveSucceeded) {
            updateGlobalProgress(100, defaultProgressLabel);
        } else {
            resetOperationProgress();
        }
    }
}


/* =========================
   DOWNLOAD ALL
========================= */

if (downloadAllBtn) {

    downloadAllBtn.addEventListener(
        "click",
        async () => {

            if (
                downloadAllBtn.disabled ||
                operationIsDownloading
            ) {
                return;
            }


            const config =
                window
                    .EasyFileOperationConfig
                    ?.get?.(
                        operationZone
                            .dataset
                            .operation ||
                        ""
                    );


            const resultMode =
                config?.resultMode ||
                "per-file";


            /* =========================
               BATCH
            ========================= */

            if (
                resultMode ===
                "batch"
            ) {

                try {

                    operationIsDownloading =
                        true;

                    updateDownloadAll();


                    await window
                        .EasyFileOperationDownloads
                        ?.downloadBatchResult?.();

                }
                catch (error) {

                    console.error(
                        "[OPERATION ZONE] Batch download failed:",
                        error
                    );

                }
                finally {

                    operationIsDownloading =
                        false;

                    updateDownloadAll();

                }


                return;

            }


            /* =========================
               PER_FILE / MULTI_OUTPUT
            ========================= */

            if (!downloadAllFormats) {
                return;
            }


            renderDownloadAllFormats();


            downloadAllFormats
                .classList
                .toggle(
                    "hidden"
                );

        }
    );

}

/* =========================
   DOWNLOAD ALL REQUEST
========================= */

document.addEventListener(
    "easyfiletools:download-all-requested",
    () => {

        if (
            !downloadAllBtn ||
            downloadAllBtn.disabled ||
            operationIsDownloading
        ) {
            return;
        }

        if (!downloadAllFormats) {
            return;
        }

        renderDownloadAllFormats();

        downloadAllFormats.classList.remove(
            "hidden"
        );

        downloadAllFormats.classList.add(
            "highlight"
        );

        downloadAllFormats.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        console.log(
            "[OPERATION ZONE] Download All requested externally"
        );
    }
);

if (downloadAllFormats) {

    downloadAllFormats.addEventListener(
        "click",
        async (event) => {

            const button =
                event.target.closest(
                    "[data-download-format]"
                );

            if (!button) {
                return;
            }

            const format =
                button.dataset.downloadFormat;


            console.log(
                "[OPERATION ZONE] Download format selected:",
                format
            );


            if (format === "zip") {

                downloadAllFormats.classList.add(
                    "hidden"
                );

                await downloadAllArchive("zip");

                return;
            }

            if (format === "tar.gz") {

                downloadAllFormats.classList.add(
                    "hidden"
                );

                await downloadAllArchive("tar.gz");

                return;
            }


            if (format === "tar") {

                downloadAllFormats.classList.add(
                    "hidden"
                );

                await downloadAllArchive("tar");

                return;
            }

        }
    );
}

/* =========================
   PROGRESSION
========================= */

const globalProgress =
    document.getElementById(
        "globalProgress"
    );

const globalProgressLabel =
    document.getElementById(
        "globalProgressLabel"
    );

const defaultProgressLabel =
    globalProgressLabel?.textContent.trim() ||
    "Progress";


function updateGlobalProgress(
    percentage,
    label = null
) {

    window
        .EasyFileOperationProgress
        ?.setProgress?.(
            percentage,
            label
        );
}

function resetOperationProgress() {

    window
        .EasyFileOperationProgress
        ?.reset?.();

}

/* =========================
   GLOBAL PROGRESS STATE
========================= */

function updateGlobalProgressState() {

    const progressBlock =
        globalProgress?.closest(
            ".progress-block"
        );

    if (!progressBlock) {
        return;
    }

    const hasFiles =
        operationFiles.length > 0;

    progressBlock.classList.toggle(
        "active",
        hasFiles
    );
}

/* =========================
       CHARGER LES FICHIERS
    ========================= */

    async function refreshOperationFiles() {

        console.log(
            "[OPERATION ZONE DEBUG] refreshOperationFiles()"
        );


        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            console.warn(
                "[OPERATION ZONE] loadSelectedFiles() unavailable"
            );

            return;
        }


        const data =
            await loadSelectedFiles();


        console.log(
            "[OPERATION ZONE DEBUG] Storage data:",
            data
        );


        if (
            !data ||
            !data.files ||
            data.files.length === 0
        ) {

            operationFiles = [];

            /*
             * Zero input files is a hard lifecycle boundary.
             * Old PER_FILE, MULTI_OUTPUT and especially BATCH
             * results must not survive and become downloadable
             * after a completely new selection is added later.
             */
            const results =
                window.EasyFileOperationResults;

            results?.reset?.();

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:batch-result-cleared"
                )
            );

            notifyOperationFilesUpdated();

            updateDownloadAll();

            resetOperationProgress();

            updateGlobalProgressState();

            console.log(
                "[OPERATION ZONE] No stored files"
            );

            return;

        }


        /* =========================
        SYNCHRONIZE INPUT FILES
        ========================= */

        operationFiles =
            data.files.map(
                storedFile => {

                    return {

                        file:
                            storedFile.file,

                        fileKey:
                            getOperationFileKey(
                                storedFile.file
                            )

                    };
                }
            );


        console.log(
            "[OPERATION ZONE] Files synchronized:",
            operationFiles.length
        );


        notifyOperationFilesUpdated();


        updateDownloadAll();
        updateGlobalProgressState();
    }

    /* =========================
    INITIALISATION
    ========================= */

    resetOperationProgress();

    renderDownloadAllFormats();

    await refreshOperationFiles();

    /* =========================
       STOCKAGE MIS À JOUR
    ========================= */

    document.addEventListener(
        "easyfiletools:storage-updated",
        async () => {

            await refreshOperationFiles();

        }
    );

    /* =========================
    OPERATION SETTINGS CHANGED
    ========================= */

    document.addEventListener(
        "easyfiletools:operation-settings-changed",
        event => {

            const detail =
                event.detail || {};


            const currentOperation =
                operationZone.dataset.operation ||
                "";


            if (
                detail.operation &&
                detail.operation !==
                    currentOperation
            ) {

                return;
            }


            const results =
                window.EasyFileOperationResults;


            if (!results) {
                return;
            }


            /* =========================
            BATCH SETTINGS
            ========================= */

            if (
                detail.scope ===
                "batch"
            ) {

                const previousBatch =
                    results.getBatch();


                const previousStale =
                    previousBatch?.stale ===
                    true;


                results.setBatchSettings(
                    Array.isArray(
                        detail.inputs
                    )
                        ? detail.inputs
                        : operationFiles,

                    detail.settings || {}
                );


                const batchState =
                    results.getBatch();


                const stale =
                    batchState?.stale ===
                    true;


                if (
                    previousStale !== stale &&
                    batchState?.result
                ) {

                    notifyBatchResultStaleState(
                        stale
                    );
                }


                updateDownloadAll();

                return;
            }


            /* =========================
            ALL FILES SETTINGS
            ========================= */

            if (
                detail.scope ===
                "all"
            ) {

                const previousItems =
                    results
                        .getState()
                        .items;


                results.setSettings(
                    detail.settings || {}
                );


                previousItems.forEach(
                    (
                        previousItem,
                        index
                    ) => {

                        const resultItem =
                            results.getItem(
                                index
                            );


                        if (!resultItem) {
                            return;
                        }


                        const previousStale =
                            previousItem.stale ===
                            true;


                        const stale =
                            resultItem.stale ===
                            true;

                        if (
                            previousStale !== stale &&
                            itemHasOperationResult(
                                resultItem
                            )
                        ) {

                            notifyResultStaleState(
                                index,
                                stale,
                                resultItem.key
                            );

                        }
                    }
                );


                updateDownloadAll();

                return;
            }


            /* =========================
            ONE FILE SETTINGS
            ========================= */

            const index =
                findOperationFileIndex(
                    detail
                );


            if (
                index < 0
            ) {

                return;
            }


            const previousItem =
                results.getItem(
                    index
                );


            const previousStale =
                previousItem?.stale ===
                true;


            results.setFileSettings(
                index,
                detail.settings || {}
            );


            const resultItem =
                results.getItem(
                    index
                );


            if (resultItem) {

                const stale =
                    resultItem.stale ===
                    true;

                if (
                    previousStale !== stale &&
                    itemHasOperationResult(
                        resultItem
                    )
                ) {

                    notifyResultStaleState(
                        index,
                        stale,
                        resultItem.key
                    );

                }

            }


            updateDownloadAll();
        }
    );

    /* =========================
    GLOBAL CONVERSION PROGRESS
    ========================= */

    // A late worker callback must never repaint progress after Cancel.
    let ignoreCancelledProgress = false;
    document.addEventListener('easyfiletools:operation-cancel-requested', event => {
        if (event.detail?.operation !== operationZone.dataset.operation) return;
        ignoreCancelledProgress = true;
        resetOperationProgress();
        document.querySelectorAll('#file-list .file-item').forEach(item => {
            setFileItemProgress(item, 0);
        });
    });

    document.addEventListener(
        "easyfiletools:operation-file-progress",
        event => {

            const detail = event.detail || {};
            if (ignoreCancelledProgress) return;
            window.EasyFileOperationProgress?.setItemProgress?.(
                detail.index, detail.percentage
            );
        }
    );

    document.addEventListener(
        "easyfiletools:operation-file-error",
        event => {
            if (ignoreCancelledProgress) return;

            const detail =
                event.detail || {};

            const index =
                Number(detail.index);

            if (
                !Number.isInteger(index) ||
                index < 0
            ) {
                return;
            }

            window
                .EasyFileOperationProgress
                ?.setItemProgress?.(
                    index,
                    100
                );
        }
    );

    document.addEventListener(
        "easyfiletools:operation-file-completed",
        (event) => {
            if (ignoreCancelledProgress) return;

            const detail =
                event.detail || {};


            const index =
                detail.index;


            if (
                !Number.isInteger(index)
            ) {

                return;
            }


            const results =
                window.EasyFileOperationResults;


            if (!results) {
                return;
            }


            /*
            * Keep previous stale state
            * before replacing the result.
            */

            const previousItem =
                results.getItem(
                    index
                );


            const wasStale =
                previousItem?.stale ===
                true;


            /*
            * Store result in the generic
            * results manager.
            */

            const operationConfig =
                window
                    .EasyFileOperationConfig
                    ?.get?.(
                        operationZone.dataset
                            .operation ||
                        ""
                    );


            const isMultiOutput =
                operationConfig?.resultMode ===
                    "multi-output" ||
                Array.isArray(
                    detail.outputs
                );


            if (isMultiOutput) {

                results.completeMultiOutput(
                    index,
                    Array.isArray(
                        detail.outputs
                    )
                        ? detail.outputs
                        : []
                );

            }
            else {

                results.completeFile(
                    index,
                    {

                        outputUrl:
                            detail.outputUrl ||
                            null,

                        outputBlob:
                            detail.outputBlob ||
                            null,

                        outputName:
                            detail.outputName ||
                            null,

                        outputSize:
                            detail.outputSize ||
                            0,

                        outputDuration:
                            detail.outputDuration || 0,

                        outputFormat:
                            detail.outputFormat ||
                            null,

                        completedLabel:
                            detail.completedLabel ||
                            "Processed"

                    }
                );

            }

            /*
            * If the previous result was stale,
            * synchronize the file-list UI.
            */

            const resultItem =
                results.getItem(
                    index
                );


            if (
                wasStale &&
                resultItem &&
                resultItem.stale !== true
            ) {

                notifyResultStaleState(
                    index,
                    false,
                    resultItem.key
                );
            }


            window
                .EasyFileOperationProgress
                ?.setItemProgress?.(
                    index,
                    100
                );


            updateDownloadAll();
        }
    );

    /* =========================
    RESULT DOWNLOADED
    ========================= */

    document.addEventListener(
        "easyfiletools:processed-file-downloaded",
        event => {

            const detail =
                event.detail || {};


            const index =
                Number(
                    detail.index
                );


            if (
                !Number.isInteger(index) ||
                index < 0
            ) {

                return;
            }


            const results =
                window.EasyFileOperationResults;


            const resultItem =
                results
                    ?.getItem?.(
                        index
                    );


            if (
                !resultItem ||
                !resultItem.result
            ) {

                return;
            }


            results.markDownloaded(
                index
            );


            console.log(
                "[OPERATION ZONE] Result downloaded:",
                index
            );

        }
    );

    document.addEventListener(
        "easyfiletools:operation-file-cancelled",
        event => {

            const detail =
                event.detail || {};


            window
                .EasyFileOperationProgress
                ?.setItemProgress?.(
                    detail.index,
                    0
                );
        }
    );

    /* =========================
    ÉTAT DE CONVERSION
    ========================= */

    let operationSuccessFeedbackShown = false;

    async function showOperationSuccessFeedback() {

        if (operationSuccessFeedbackShown) {
            return;
        }

        operationSuccessFeedbackShown = true;

        updateGlobalProgress(
            100,
            defaultProgressLabel
        );

        await window
            .EasyFileOperationMessages
            ?.success?.(
                operationSuccessTitle,
                operationSuccessMessage
            );
    }

    document.addEventListener(
        "easyfiletools:operation-started",
        () => {

            operationSuccessFeedbackShown = false;
            ignoreCancelledProgress = false;

            const progress =
                window.EasyFileOperationProgress;

            const results =
                window.EasyFileOperationResults;


            progress?.setItems?.(
                operationFiles.length,
                0
            );


            const items =
                results
                    ?.getState?.()
                    ?.items || [];


            items.forEach(
                (item, index) => {

                    if (
                        itemHasOperationResult(
                            item
                        ) &&
                        item.stale !== true
                    ) {

                        progress?.setItemProgress?.(
                            index,
                            100
                        );

                    }

                }
            );


            console.log(
                "[OPERATION ZONE] Operation started"
            );
        }
    );

    document.addEventListener(
        "easyfiletools:operation-ended",
        async (event) => {

            const detail =
                event.detail || {};

            const wasCancelled =
                detail.cancelled === true;


            /* =========================
            CANCELLED
            ========================= */

            if (
                wasCancelled
            ) {
                ignoreCancelledProgress = true;
                resetOperationProgress();

                document
                    .querySelectorAll(
                        ".file-item"
                    )
                    .forEach(
                        item => {

                            setFileItemProgress(
                                item,
                                0
                            );

                        }
                    );


                console.log(
                    "[OPERATION ZONE] Operation cancelled — progress reset."
                );


                return;
            }


            /* =========================
            CHECK COMPLETE SUCCESS
            ========================= */

            const allFilesCompleted =
                window
                    .EasyFileOperationResults
                    ?.hasCurrentResult?.() ===
                true;

            // A final refresh is important for long-running PER_FILE tools:
            // the last result event may arrive just before the lifecycle end.
            updateDownloadAll();


            if (
                allFilesCompleted
            ) {

                await showOperationSuccessFeedback();

            }


            console.log(
                "[OPERATION ZONE] Operation ended",
                {

                    cancelled:
                        false,

                    allFilesCompleted:
                        allFilesCompleted

                }
            );

        }
    );


    /*
     * Controller-backed operations reach their authoritative COMPLETED
     * state just after adapters emit operation-ended. Some engines finish
     * publishing result metadata during that narrow gap, so operation-ended
     * can be too early to decide whether the success modal should appear.
     * COMPLETED is therefore the generic fallback. The per-run guard above
     * prevents duplicate modals for operations whose operation-ended check
     * already succeeded.
     */
    document.addEventListener(
        "easyfiletools:operation-state-changed",
        async (event) => {

            const detail = event.detail || {};

            if (
                detail.operationId &&
                detail.operationId !== operationZone.dataset.operation
            ) {
                return;
            }

            if (detail.status !== "completed") {
                return;
            }

            updateDownloadAll();

            await showOperationSuccessFeedback();
        }
    );

    /* =========================
    FICHIERS SUPPRIMÉS
    ========================= */

    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            operationFiles = [];

            window
                .EasyFileOperationResults
                ?.reset?.();

                updateDownloadAll();
            updateGlobalProgressState();
            resetOperationProgress();

            notifyOperationFilesUpdated();

            console.log(
                "[OPERATION ZONE] All files cleared"
            );
        }
    );

    /* =========================
    OPERATION STATE REQUEST
    ========================= */

    document.addEventListener(
        "easyfiletools:operation-state-requested",
        (event) => {

            const respond =
                event.detail?.respond;

            if (
                typeof respond !==
                "function"
            ) {
                return;
            }

            const results =
                window.EasyFileOperationResults;


            const hasFiles =
                operationFiles.length > 0;


            const hasOutputFiles =
                results?.hasResult?.() === true;


            const allFilesCompleted =
                results?.hasCurrentResult?.() ===
                true;


            const allResultsDownloaded =
                hasOutputFiles &&
                (
                    results
                        ?.getUndownloadedCount?.() ||
                    0
                ) === 0;

            respond(
                {
                    category:
                        operationZone.dataset.category || "",

                    operation:
                        operationZone.dataset.operation || "",

                    hasFiles:
                        hasFiles,

                    hasOutputFiles:
                        hasOutputFiles,

                    allFilesCompleted:
                        allFilesCompleted,
                    
                    downloadAllCompleted:
                        allResultsDownloaded,

                    isDownloading:
                        operationIsDownloading
                }
            );

        }
    );



    /* =========================================================
       EPHEMERAL RESULT LIFETIME

       Generated blobs/results belong to the current operation page.
       Source files persist inside the category workspace; results do not.
       Clearing them on pagehide also fixes browser BFCache restores where
       the DOM may be reconstructed without visible outputs while the old
       in-memory result signatures still disable Run.
    ========================================================= */

    window.addEventListener(
        "pagehide",
        () => {
            window.EasyFileOperationResults?.reset?.();

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-results-discarded",
                    { detail: { reason: "pagehide" } }
                )
            );

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:batch-result-cleared"
                )
            );
        }
    );

    window.addEventListener(
        "pageshow",
        event => {
            if (!event.persisted) {
                return;
            }

            window.EasyFileOperationResults?.reset?.();

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-results-discarded",
                    { detail: { reason: "bfcache-restore" } }
                )
            );

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:batch-result-cleared"
                )
            );

            void refreshOperationFiles();
        }
    );

    /* =========================================================
    PROTECTION AVANT REFRESH / FERMETURE DE PAGE
    ========================================================= */


    window.addEventListener(
        "beforeunload",
        (event) => {

            /*
            * Une navigation interne a déjà été
            * validée par navigation-guard.js.
            *
            * Ne pas afficher un deuxième
            * avertissement natif du navigateur.
            */

            if (
                window.easyFileToolsNavigationApproved ===
                true
            ) {
                return;
            }


            const undownloadedCount =
                window
                    .EasyFileOperationResults
                    ?.getUndownloadedCount?.() ||
                0;

            const operationStatus =
                window
                    .EasyFileOperationController
                    ?.getState?.()
                    ?.status ||
                "";


            const controllerOperationInProgress =
                operationStatus ===
                    "running" ||
                operationStatus ===
                    "paused" ||
                operationStatus ===
                    "cancelling";


            const genericOperationInProgress =
                window
                    .EasyFileOperationInteractionLock
                    ?.isLocked?.() ===
                true;


            const operationInProgress =
                controllerOperationInProgress ||
                genericOperationInProgress;


            const needsProtection =
                undownloadedCount > 0 ||
                operationInProgress;


            if (!needsProtection) {
                return;
            }


            event.preventDefault();

            event.returnValue =
                "";
        }
    );


});