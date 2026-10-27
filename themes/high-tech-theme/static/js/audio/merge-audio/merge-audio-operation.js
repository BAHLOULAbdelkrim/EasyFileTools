console.log(
    "[MERGE AUDIO OPERATION] merge-audio-operation.js loaded"
);


/* =========================================================
   MERGE AUDIO OPERATION
   BATCH REFERENCE MODEL
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       OPERATION
    ===================================================== */

    const operationZone =
        document.getElementById(
            "operation-zone"
        );


    if (
        !operationZone ||
        operationZone.dataset.operation !==
            "merge-audio"
    ) {

        return;
    }


    const operationController =
        window
            .EasyFileOperationController;


    function getLifecycle() {

        return (
            window
                .EasyFileOperationLifecycle ||
            null
        );
    }


    /* =====================================================
       DOM
    ===================================================== */

    const chooseFormatLabel =
        document.getElementById(
            "chooseFormatLabel"
        );

    const mergeBtn =
        document.getElementById(
            "convertBtn"
        );

    const downloadAllBtn =
        document.getElementById(
            "downloadAllBtn"
        );


    const downloadAllFormats =
        document.getElementById(
            "downloadAllFormats"
        );


    /* =====================================================
       EXECUTION CONTEXT
       NOT UI / CONTROLLER STATE
    ===================================================== */

    let currentRequest =
        null;


    let executionPaused =
        false;


    let executionCancelled =
        false;


    /*
     * True when the currently running
     * FFmpeg instance was intentionally
     * terminated because of Pause.
     */

    let interruptedForPause =
        false;


    let resumeResolver =
        null;

    let lastCompletedMergeSignature =
        null;        

    /* =====================================================
       HELPERS
    ===================================================== */

    function getBatchResult() {

        const genericResult =
            getLifecycle()
                ?.getBatchResult?.();

        if (
            genericResult
        ) {

            return genericResult;
        }


        const batch =
            window
                .EasyFileOperationResults
                ?.getBatch?.();


        return (
            batch?.result ||
            batch ||
            null
        );
    }

    function getCurrentMergeSignature() {

        const snapshot =
            window
                .MergeAudioUI
                ?.getLifecycleSnapshot?.();


        if (
            !snapshot
        ) {

            return null;
        }


        return JSON.stringify(
            {
                inputs:
                    snapshot.inputs ||
                    [],

                settings:
                    snapshot.settings ||
                    {}
            }
        );
    }

    function hasCurrentBatchResult() {

        const result =
            getBatchResult();


        if (
            !result
        ) {

            return false;
        }


        const hasOutput =
            Boolean(
                result.outputUrl ||
                result.outputBlob
            );


        if (
            !hasOutput ||
            result.outputStale ===
                true
        ) {

            return false;
        }


        return Boolean(

            result.currentSettingsSignature &&

            result.resultSettingsSignature &&

            result.currentSettingsSignature ===
                result.resultSettingsSignature
        );
    }

    function wakeExecution() {

        if (
            typeof resumeResolver ===
                "function"
        ) {

            const resolver =
                resumeResolver;


            resumeResolver =
                null;


            resolver();
        }
    }


    function waitForResumeOrCancel() {

        if (
            !executionPaused ||
            executionCancelled
        ) {

            return Promise.resolve();
        }


        return new Promise(
            resolve => {

                resumeResolver =
                    resolve;

            }
        );
    }


    /* =====================================================
       TITLE
    ===================================================== */

    function updateTitle() {

        if (
            !chooseFormatLabel
        ) {

            return;
        }


        const count =
            window
                .MergeAudioUI
                ?.getRecords?.()
                ?.length ||
            0;


        chooseFormatLabel
            .classList
            .toggle(
                "active",
                count >= 2
            );
    }


    /* =====================================================
    READY STATE
    ===================================================== */

    function updateReadyState() {

        updateTitle();


        const ready =
            window
                .MergeAudioUI
                ?.isValid?.() ===
            true;


        operationController
            ?.setReady?.(
                ready
            );
    }


    /* =====================================================
       GLOBAL BATCH PROGRESS
    ===================================================== */

    function setProgress(
        progress,
        label =
            "Merging progress"
    ) {

        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(progress) *
                    100
                )
            );


        window
            .EasyFileOperationProgress
            ?.setProgress?.(
                percentage,
                label
            );
    }


    /* =====================================================
       DOWNLOAD BUTTON
    ===================================================== */

    function updateBatchDownloadButton() {

        if (
            !downloadAllBtn
        ) {

            return;
        }


        const result =
            getBatchResult();


        const controllerState =
            operationController
                ?.getState?.()
                ?.status ||
            null;


        const operationActive =
            controllerState ===
                "running" ||
            controllerState ===
                "paused" ||
            controllerState ===
                "cancelling";


        const hasResult =
            Boolean(
                result &&
                (
                    result.outputUrl ||
                    result.url ||
                    result.outputBlob ||
                    result.blob
                )
            );


        const enabled =
            hasResult &&
            !operationActive;


        downloadAllBtn.disabled =
            !enabled;


        downloadAllBtn
            .classList
            .toggle(
                "active",
                enabled
            );


        /*
         * BATCH produces one file.
         * ZIP / TAR / TAR.GZ are useless.
         */

        downloadAllFormats
            ?.classList
            .add(
                "hidden"
            );
    }


    /* =====================================================
       LIFECYCLE SNAPSHOT
    ===================================================== */

    function synchronizeLifecycle() {

        const snapshot =
            window
                .MergeAudioUI
                ?.getLifecycleSnapshot?.();


        if (
            !snapshot
        ) {

            return null;
        }


        getLifecycle()
            ?.settingsChanged?.(
                {

                    operation:
                        "merge-audio",

                    scope:
                        "batch",

                    inputs:
                        snapshot.inputs,

                    settings:
                        snapshot.settings

                }
            );


        return snapshot;
    }


    /* =====================================================
       OPERATION EVENTS
    ===================================================== */

    function dispatchStarted() {

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:operation-started",
                {
                    detail: {

                        category:
                            operationZone
                                .dataset
                                .category ||
                            "",

                        operation:
                            "merge-audio"

                    }
                }
            )
        );
    }


    function dispatchEnded(
        detail = {}
    ) {

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:operation-ended",
                {
                    detail: {

                        operation:
                            "merge-audio",

                        ...detail

                    }
                }
            )
        );
    }


    /* =====================================================
       COMPLETE BATCH
    ===================================================== */

    function completeBatch(
        engineResult
    ) {

        const outputUrl =
            URL.createObjectURL(
                engineResult.blob
            );


        const result = {

            outputUrl,

            outputBlob:
                engineResult.blob,

            outputName:
                engineResult.outputName,

            outputSize:
                engineResult.outputSize,

            outputFormat:
                engineResult.outputFormat,

            fastCopy:
                engineResult.fastCopy,

            completedLabel:
                "Merged"

        };


        /*
         * EasyFileOperationResults is now
         * the canonical owner of the result.
         */

        getLifecycle()
            ?.completeBatchResult?.(
                result
            );

        /*
         * UI receives the result only for
         * rendering. It does not own it.
         */

        window
            .MergeAudioUI
            ?.showResult?.(
                result
            );


        /*
        * Remember the exact files/order/settings
        * used by this successful merge.
        */

        lastCompletedMergeSignature =
            getCurrentMergeSignature();


        return result;

    }


    /* =====================================================
       RUN ONE ENGINE ATTEMPT
    ===================================================== */

    async function executeMerge() {

        return await window
            .AudioMerger
            .mergeFiles(
                currentRequest.files,
                currentRequest.settings,
                {

                    onProgress:
                        progress => {

                            setProgress(
                                progress,
                                "Merging progress"
                            );

                        }

                }
            );
    }


    /* =====================================================
       ADAPTER RUN
    ===================================================== */

    async function run() {

        if (
            !window.AudioMerger
        ) {

            throw new Error(
                "Audio Merger engine is unavailable."
            );
        }

        const request =
            window
                .MergeAudioUI
                ?.getMergeRequest?.();


        if (
            !request
        ) {

            throw new Error(
                "Merge Audio settings are invalid."
            );
        }


        /* =================================================
        ALREADY MERGED
        ================================================= */

        const currentMergeSignature =
            getCurrentMergeSignature();


        if (
            lastCompletedMergeSignature &&
            currentMergeSignature ===
                lastCompletedMergeSignature
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
                "[MERGE AUDIO] Already merged — skipped."
            );


            return;
        }


        /*
        * Synchronize current order/settings
        * before replacement confirmation.
        */

        synchronizeLifecycle();

        currentRequest =
            request;


        executionPaused =
            false;


        executionCancelled =
            false;


        interruptedForPause =
            false;


        resumeResolver =
            null;


        dispatchStarted();


        setProgress(
            0,
            "Merging progress"
        );


        /*
         * A paused merge restarts from 0 %
         * when Resume is requested.
         *
         * The adapter's run() promise remains
         * alive during Pause so the generic
         * controller does not interpret Pause
         * as completion.
         */

        while (
            !executionCancelled
        ) {

            try {

                const engineResult =
                    await executeMerge();


                if (
                    executionCancelled
                ) {

                    return;
                }


                /*
                 * Extremely defensive:
                 * if an engine somehow resolves
                 * after Pause instead of rejecting,
                 * wait for Resume and restart.
                 */

                if (
                    executionPaused
                ) {

                    await waitForResumeOrCancel();


                    if (
                        executionCancelled
                    ) {

                        return;
                    }


                    setProgress(
                        0,
                        "Merging progress"
                    );


                    continue;
                }


                const result =
                    completeBatch(
                        engineResult
                    );


                setProgress(
                    1,
                    "Completed"
                );


                dispatchEnded(
                    {
                        cancelled:
                            false,

                        singleOutput:
                            true
                    }
                );


                if (
                    typeof showSuccessModal ===
                    "function"
                ) {

                    await showSuccessModal(
                        "Merge completed",
                        "The audio files were merged successfully."
                    );
                }


                console.log(
                    "[MERGE AUDIO] Completed:",
                    {
                        name:
                            result.outputName,

                        size:
                            result.outputSize,

                        format:
                            result.outputFormat,

                        fastCopy:
                            result.fastCopy
                    }
                );


                return;

            }
            catch (
                error
            ) {

                /*
                 * FFmpeg was intentionally
                 * terminated by Pause.
                 */

                if (
                    interruptedForPause
                ) {

                    interruptedForPause =
                        false;


                    if (
                        executionPaused &&
                        !executionCancelled
                    ) {

                        await waitForResumeOrCancel();
                    }


                    if (
                        executionCancelled
                    ) {

                        return;
                    }


                    setProgress(
                        0,
                        "Merging progress"
                    );


                    continue;
                }


                /*
                 * FFmpeg was intentionally
                 * terminated by Cancel.
                 */

                if (
                    executionCancelled
                ) {

                    return;
                }


                console.error(
                    "[MERGE AUDIO] Merge failed:",
                    error
                );


                dispatchEnded(
                    {
                        cancelled:
                            false,

                        error:
                            true
                    }
                );


                if (
                    typeof showNotification ===
                    "function"
                ) {

                    showNotification(
                        "Unable to merge the audio files.",
                        "error"
                    );
                }


                /*
                 * Let OperationController
                 * enter ERROR state.
                 */

                throw error;
            }
        }
    }


    /* =====================================================
       ADAPTER PAUSE
    ===================================================== */

    async function pause() {

        if (
            executionCancelled ||
            executionPaused
        ) {

            return;
        }


        executionPaused =
            true;


        interruptedForPause =
            true;


        await window
            .AudioMerger
            ?.cancelCurrent?.();

    }


    /* =====================================================
       ADAPTER RESUME
    ===================================================== */

    async function resume() {

        if (
            !executionPaused ||
            executionCancelled
        ) {

            return;
        }


        executionPaused =
            false;


        /*
         * If run() is already waiting,
         * wake it.
         *
         * If FFmpeg termination has not
         * finished yet, the catch block will
         * see executionPaused === false and
         * immediately restart afterwards.
         */

        wakeExecution();


        setProgress(
            0,
            "Merging progress"
        );
    }


    /* =====================================================
       ADAPTER CANCEL
    ===================================================== */

    async function cancel() {

        executionCancelled =
            true;


        executionPaused =
            false;


        /*
         * This interruption must not later
         * be interpreted as Pause.
         */

        interruptedForPause =
            false;


        wakeExecution();

        await window
            .AudioMerger
            ?.cancelCurrent?.();


        const progress =
            window
                .EasyFileOperationProgress;


        progress
            ?.reset?.();


        progress
            ?.setLabel?.(
                "Merging progress"
            );


        dispatchEnded(
            {
                cancelled:
                    true
            }
        );

    }


    /* =====================================================
       REGISTER GENERIC ADAPTER
    ===================================================== */

    operationController
        ?.registerAdapter?.(
            {

                run,

                pause,

                resume,

                cancel

            }
        );


    /* =====================================================
       SETTINGS CHANGED
    ===================================================== */

    window.addEventListener(
        "easyfiletools:merge-settings-changed",
        event => {

            const detail =
                event.detail ||
                {};

            getLifecycle()
                ?.settingsChanged?.(
                    {

                        operation:
                            "merge-audio",

                        scope:
                            "batch",

                        inputs:
                            detail.inputs ||
                            [],

                        settings:
                            detail.settings ||
                            {}

                    }
                );


            updateReadyState();

            updateBatchDownloadButton();
        }
    );


    /* =====================================================
       FILES UPDATED
    ===================================================== */

    document.addEventListener(
        "easyfiletools:operation-files-updated",
        event => {

            if (
                event.detail
                    ?.operation !==
                "merge-audio"
            ) {

                return;
            }


            updateReadyState();

            updateBatchDownloadButton();
        }
    );


    /* =====================================================
       CONTROLLER STATE
    ===================================================== */

    document.addEventListener(
        "easyfiletools:operation-state-changed",
        event => {

            const detail =
                event.detail ||
                {};


            if (
                detail.operationId !==
                "merge-audio"
            ) {

                return;
            }


            /*
             * Keep terminal states visible. READY is restored only by a real
             * file/settings change, while the batch download button still
             * follows the controller lifecycle.
             */
            updateBatchDownloadButton();
        }
    );


    /* =====================================================
       BATCH RESULT STALE
    ===================================================== */

    document.addEventListener(
        "easyfiletools:batch-result-stale-changed",
        event => {

            const detail =
                event.detail ||
                {};


            if (
                detail.operation !==
                "merge-audio"
            ) {

                return;
            }


            window
                .MergeAudioUI
                ?.setResultStale?.(
                    detail.stale ===
                        true
                );


            updateBatchDownloadButton();
        }
    );


    /* =====================================================
       RESULT LIFETIME / NAVIGATION
    ===================================================== */

    document.addEventListener(
        "easyfiletools:operation-results-discarded",
        () => {
            currentRequest = null;
            lastCompletedMergeSignature = null;
            window.MergeAudioUI?.clearResult?.();
            updateReadyState();
            updateBatchDownloadButton();
        }
    );

    /* =====================================================
       CLEAR ALL
    ===================================================== */

    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            currentRequest =
                null;

            lastCompletedMergeSignature =
                null;                

            executionPaused =
                false;


            executionCancelled =
                false;


            interruptedForPause =
                false;


            wakeExecution();


            getLifecycle()
                ?.clearBatchResult?.();


            window
                .MergeAudioUI
                ?.clearResult?.();


            updateReadyState();

            updateBatchDownloadButton();
        }
    );

    /* =====================================================
    PREVENT IDENTICAL MERGE
    ===================================================== */

    mergeBtn
        ?.addEventListener(
            "click",
            event => {

                /*
                * Synchronize the latest
                * files / order / settings
                * before comparing signatures.
                */

                synchronizeLifecycle();


                if (
                    !hasCurrentBatchResult()
                ) {

                    return;
                }


                /*
                * The existing result already
                * corresponds exactly to the
                * current configuration.
                *
                * Stop the click before the
                * generic OperationController
                * receives it.
                */

                event.preventDefault();

                event.stopImmediatePropagation();


                if (
                    typeof showNotification ===
                    "function"
                ) {

                    showNotification(
                        "The merged audio is already up to date.",
                        "info"
                    );
                }

            },
            true
        );


    /* =====================================================
       INIT
    ===================================================== */

    downloadAllFormats
        ?.classList
        .add(
            "hidden"
        );


    updateReadyState();

    updateBatchDownloadButton();

})();