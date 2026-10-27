console.log("cut-audio-operation.js loaded");


/* =========================================================
   CUT AUDIO OPERATION CONTROLLER
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        running:
            false,

        paused:
            false,

        cancelled:
            false,

        queue:
            [],

        currentIndex:
            0,

        results:
            new Map(),

        abortReason:
            null

    };


    /* =====================================================
       EVENT
    ===================================================== */

    function emit(
        name,
        detail = {}
    ) {

        window.dispatchEvent(
            new CustomEvent(
                name,
                {
                    detail
                }
            )
        );

    }


    /* =====================================================
       RESULT URL CLEANUP
    ===================================================== */

    function revokeResultUrl(
        result
    ) {

        if (
            result &&
            result.outputUrl
        ) {

            try {

                URL.revokeObjectURL(
                    result.outputUrl
                );

            } catch (_) {
                // Ignore
            }

        }

    }


    /* =====================================================
    RESULT STATE
    ===================================================== */

    function hasCurrentResult(
        key
    ) {

        const result =
            state.results.get(
                key
            );


        return Boolean(
            result &&
            result.stale !== true
        );
    }


    function setResultStale(
        key,
        stale
    ) {

        const result =
            state.results.get(
                key
            );


        if (!result) {
            return;
        }


        result.stale =
            Boolean(stale);

    }    


    /* =====================================================
       PREPARE QUEUE
    ===================================================== */

    function prepareQueue() {

        if (
            !window.CutAudioUI
        ) {

            throw new Error(
                "Cut Audio UI is not available."
            );

        }


        const items =
            window.CutAudioUI
                .getBatchItems();


        if (
            items.length === 0
        ) {

            throw new Error(
                "No audio file has valid Cut settings."
            );

        }


        state.queue =
            items;


        /*
         * Find first item that has not
         * already been successfully processed.
         */

        let firstPendingIndex =
            0;


        while (
            firstPendingIndex <
                state.queue.length &&
            hasCurrentResult(
                state.queue[
                    firstPendingIndex
                ].key
            )
        ) {

            firstPendingIndex++;

        }


        state.currentIndex =
            firstPendingIndex;

    }


    /* =====================================================
       GLOBAL PROGRESS
    ===================================================== */

    function calculateGlobalProgress(
        currentFileProgress
    ) {

        const total =
            state.queue.length;


        if (
            total <= 0
        ) {
            return 0;
        }


        let completed =
            0;


        state.queue.forEach(
            item => {

                if (
                    hasCurrentResult(
                        item.key
                    )
                ) {
                    completed++;
                }

            }
        );


        const totalProgress =
            completed +
            currentFileProgress;


        return Math.min(
            1,
            totalProgress /
            total
        );

    }


    /* =====================================================
       PROCESS CURRENT FILE
    ===================================================== */

    async function processItem(
        item,
        index
    ) {

        emit(
            "easyfiletools:cut-file-start",
            {

                key:
                    item.key,

                file:
                    item.file,

                index,

                total:
                    state.queue.length

            }
        );


        const engineResult =
            await window.AudioCutter
                .cutFile(
                    item.file,
                    item.settings,
                    {

                        onProgress:
                            progress => {

                                emit(
                                    "easyfiletools:cut-progress",
                                    {

                                        key:
                                            item.key,

                                        file:
                                            item.file,

                                        index,

                                        total:
                                            state.queue.length,

                                        fileProgress:
                                            progress,

                                        globalProgress:
                                            calculateGlobalProgress(
                                                progress
                                            )

                                    }
                                );

                            }

                    }
                );


        const outputUrl =
            URL.createObjectURL(
                engineResult.blob
            );


        const result = {

            key:
                item.key,
            
            stale:
                false,

            sourceFile:
                item.file,

            sourceEntry:
                item.entry,

            settings:
                {
                    ...item.settings
                },

            blob:
                engineResult.blob,

            outputUrl,

            outputName:
                engineResult.outputName,

            outputFormat:
                engineResult.outputFormat,

            outputSize:
                engineResult.outputSize,
            
            outputDuration:
                engineResult.outputDuration,

            fastCopy:
                engineResult.fastCopy

        };


        const previousResult =
            state.results.get(
                item.key
            );


        if (
            previousResult
        ) {

            revokeResultUrl(
                previousResult
            );

        }


        state.results.set(
            item.key,
            result
        );


        emit(
            "easyfiletools:cut-file-complete",
            {

                result,

                index,

                total:
                    state.queue.length,

                globalProgress:
                    calculateGlobalProgress(
                        0
                    )

            }
        );


        return result;

    }


    /* =====================================================
       START / RESUME LOOP
    ===================================================== */

    async function runQueue() {

        if (
            state.running
        ) {
            return;
        }


        if (
            !window.AudioCutter
        ) {

            throw new Error(
                "Audio Cutter engine is not available."
            );

        }


        state.running =
            true;

        state.cancelled =
            false;

        state.abortReason =
            null;


        emit(
            "easyfiletools:cut-batch-start",
            {

                total:
                    state.queue.length,

                results:
                    Array.from(
                        state.results.values()
                    )

            }
        );


        try {

            while (
                state.currentIndex <
                state.queue.length
            ) {

                if (
                    state.paused ||
                    state.cancelled
                ) {
                    break;
                }


                const item =
                    state.queue[
                        state.currentIndex
                    ];


                /*
                 * Skip files already processed.
                 */

                if (
                    hasCurrentResult(
                        item.key
                    )
                ) {

                    state.currentIndex++;

                    continue;

                }

                try {

                    await processItem(
                        item,
                        state.currentIndex
                    );


                    state.currentIndex++;

                } catch (error) {

                    /*
                     * Pause and Cancel intentionally
                     * terminate FFmpeg.
                     */

                    if (
                        state.paused ||
                        state.cancelled
                    ) {

                        break;

                    }


                    emit(
                        "easyfiletools:cut-file-error",
                        {

                            key:
                                item.key,

                            file:
                                item.file,

                            index:
                                state.currentIndex,

                            total:
                                state.queue.length,

                            error

                        }
                    );


                    throw error;

                }

            }


            if (
                state.paused
            ) {

                emit(
                    "easyfiletools:cut-paused",
                    {

                        currentIndex:
                            state.currentIndex,

                        results:
                            Array.from(
                                state.results.values()
                            )

                    }
                );


                return;

            }


            if (
                state.cancelled
            ) {

                emit(
                    "easyfiletools:cut-cancelled",
                    {

                        currentIndex:
                            state.currentIndex,

                        results:
                            Array.from(
                                state.results.values()
                            )

                    }
                );


                return;

            }


            emit(
                "easyfiletools:cut-batch-complete",
                {

                    results:
                        Array.from(
                            state.results.values()
                        )

                }
            );

        } finally {

            state.running =
                false;

        }

    }


    /* =====================================================
       START
    ===================================================== */

    async function start() {

        if (
            state.running
        ) {
            return;
        }


        state.paused =
            false;

        state.cancelled =
            false;

        state.abortReason =
            null;


        prepareQueue();


        return runQueue();

    }


    /* =====================================================
       PAUSE
    ===================================================== */

    async function pause() {

        if (
            !state.running
        ) {
            return;
        }


        state.paused =
            true;

        state.abortReason =
            "pause";


        emit(
            "easyfiletools:cut-pause-requested",
            {
                currentIndex:
                    state.currentIndex
            }
        );


        if (
            window.AudioCutter
        ) {

            await window.AudioCutter
                .cancelCurrent();

        }

    }


    /* =====================================================
       RESUME
    ===================================================== */

    async function resume() {

        if (
            state.running
        ) {
            return;
        }


        if (
            !state.paused
        ) {
            return;
        }


        state.paused =
            false;

        state.cancelled =
            false;

        state.abortReason =
            null;


        emit(
            "easyfiletools:cut-resume",
            {
                currentIndex:
                    state.currentIndex
            }
        );


        return runQueue();

    }


    /* =====================================================
       CANCEL
    ===================================================== */

    async function cancel() {

        const wasRunning =
            state.running;

        const wasPaused =
            state.paused;


        if (
            !wasRunning &&
            !wasPaused
        ) {
            return;
        }

        state.cancelled =
            true;

        state.paused =
            false;

        state.abortReason =
            "cancel";


        emit(
            "easyfiletools:cut-cancel-requested",
            {
                currentIndex:
                    state.currentIndex
            }
        );


        if (
            wasRunning &&
            window.AudioCutter
        ) {

            await window.AudioCutter
                .cancelCurrent();

        }


        /*
        * Si l'opération était déjà en pause,
        * aucune boucle FFmpeg active ne pourra
        * émettre cut-cancelled.
        */
        if (
            wasPaused
        ) {

            emit(
                "easyfiletools:cut-cancelled",
                {

                    currentIndex:
                        state.currentIndex,

                    results:
                        Array.from(
                            state.results.values()
                        )

                }
            );
        }


    }


    /* =====================================================
       CLEAR RESULTS
    ===================================================== */

    function clearResults() {

        state.results.forEach(
            result => {

                revokeResultUrl(
                    result
                );

            }
        );


        state.results.clear();

        state.currentIndex =
            0;


        emit(
            "easyfiletools:cut-results-cleared"
        );

    }


    /* =====================================================
       GET RESULTS
    ===================================================== */

    function getResults() {

        return Array.from(
            state.results.values()
        );

    }


    /* =====================================================
       GET STATE
    ===================================================== */

    function getState() {

        return {

            running:
                state.running,

            paused:
                state.paused,

            cancelled:
                state.cancelled,

            currentIndex:
                state.currentIndex,

            queueLength:
                state.queue.length,

            results:
                getResults()

        };

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.CutAudioOperation = {

        start,

        pause,

        resume,

        cancel,

        clearResults,

        getResults,

        getState,

        setResultStale

    };

})();


/* =========================================================
   CUT AUDIO
   GENERIC OPERATION ZONE ADAPTER
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       DOM
    ===================================================== */

    const operationZone =
        document.getElementById(
            "operation-zone"
        );


    if (
        !operationZone ||
        operationZone.dataset.operation !==
            "cut-audio"
    ) {
        return;
    }

    const operationController =
        window.EasyFileOperationController;

    const chooseFormatLabel =
        document.getElementById(
            "chooseFormatLabel"
        );


    /* =====================================================
       FILE STATE
    ===================================================== */

    let operationFileCount =
        0;


    /* =====================================================
       ICONS
    ===================================================== */

    function refreshButtonIcons(
        element
    ) {

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                element
            );

        }
        else if (
            window.lucide &&
            typeof window.lucide
                .createIcons ===
                "function"
        ) {

            window.lucide
                .createIcons();

        }

    }


    /* =====================================================
       UI STATE
    ===================================================== */

    function getCutUiState() {

        if (
            !window.CutAudioUI
        ) {

            return {

                records:
                    [],

                batch:
                    [],

                allConfigured:
                    false

            };
        }


        const records =
            window.CutAudioUI
                .getAllRecords();


        const batch =
            window.CutAudioUI
                .getBatchItems();


        const allConfigured =
            records.length > 0 &&
            batch.length ===
                records.length;


        return {

            records,

            batch,

            allConfigured

        };

    }


    /* =====================================================
       TITLE
    ===================================================== */

    function updateParametersTitle() {

        if (
            !chooseFormatLabel
        ) {
            return;
        }


        const {
            records
        } =
            getCutUiState();


        const hasFiles =
            operationFileCount > 0 ||
            records.length > 0;


        chooseFormatLabel
            .classList
            .toggle(
                "active",
                hasFiles
            );

    }


    /* =====================================================
       REFRESH ALL
    ===================================================== */

    function updateReadyState() {

        const {
            allConfigured
        } =
            getCutUiState();


        operationController
            ?.setReady?.(
                allConfigured
            );
    }

    function updateOperationUi() {

        updateParametersTitle();

        updateReadyState();
    }

    const cutAudioAdapter = {

        async run() {

            const {
                allConfigured
            } =
                getCutUiState();


            if (!allConfigured) {
                return;
            }




            const terminal =
                new Promise(
                    (resolve, reject) => {

                        const cleanup = () => {

                            window.removeEventListener(
                                "easyfiletools:cut-batch-complete",
                                onComplete
                            );

                            window.removeEventListener(
                                "easyfiletools:cut-cancelled",
                                onCancelled
                            );

                            window.removeEventListener(
                                "easyfiletools:cut-file-error",
                                onError
                            );
                        };


                        const onComplete = () => {

                            cleanup();
                            resolve();
                        };


                        const onCancelled = () => {

                            cleanup();
                            resolve();
                        };


                        const onError = event => {

                            cleanup();

                            reject(
                                event.detail?.error ||
                                new Error(
                                    "Cut Audio failed."
                                )
                            );
                        };


                        window.addEventListener(
                            "easyfiletools:cut-batch-complete",
                            onComplete
                        );

                        window.addEventListener(
                            "easyfiletools:cut-cancelled",
                            onCancelled
                        );

                        window.addEventListener(
                            "easyfiletools:cut-file-error",
                            onError
                        );
                    }
                );


            const execution =
                window.CutAudioOperation
                    .start();


            await Promise.race([
                terminal,

                Promise.resolve(
                    execution
                ).then(
                    () => terminal
                )
            ]);
        },


        async cancel() {

            await window
                .CutAudioOperation
                .cancel();
        },


        async pause() {

            const paused =
                new Promise(
                    resolve => {

                        window.addEventListener(
                            "easyfiletools:cut-paused",
                            resolve,
                            {
                                once: true
                            }
                        );
                    }
                );


            await window
                .CutAudioOperation
                .pause();


            await paused;
        },


        async resume() {

            const resumed =
                new Promise(
                    resolve => {

                        window.addEventListener(
                            "easyfiletools:cut-resume",
                            resolve,
                            {
                                once: true
                            }
                        );
                    }
                );


            const execution =
                window.CutAudioOperation
                    .resume();


            /*
            * Le run principal reste responsable
            * de l'erreur terminale.
            */
            Promise.resolve(
                execution
            ).catch(
                () => {}
            );


            await resumed;
        }

    };


    operationController
        ?.registerAdapter?.(
            cutAudioAdapter
        );

    /* =====================================================
       GENERIC FILES
    ===================================================== */

    document.addEventListener(
        "easyfiletools:operation-files-updated",
        event => {

            const detail =
                event.detail ||
                {};


            if (
                detail.operation !==
                "cut-audio"
            ) {
                return;
            }


            operationFileCount =
                Array.isArray(
                    detail.files
                )
                    ? detail.files.length
                    : 0;


            console.log(
                "[CUT AUDIO ADAPTER] Files:",
                operationFileCount
            );


            updateOperationUi();

        }
    );


    /* =====================================================
       SETTINGS CHANGED
    ===================================================== */

    window.addEventListener(

        "easyfiletools:cut-settings-changed",

        event => {

            const detail =
                event.detail ||
                {};


            const records =
                window.CutAudioUI
                    ?.getAllRecords?.() ||
                [];


            const index =
                records.findIndex(
                    record =>
                        record.key ===
                        detail.key
                );


            const settings =
                detail.settings ||
                {};


            /*
            * Send only settings that really
            * change the generated output.
            *
            * Do not include UI-only fields such
            * as "configured".
            */

            window.EasyFileOperationLifecycle
                ?.settingsChanged?.(
                    {

                        operation:
                            "cut-audio",

                        scope:
                            "file",

                        index,

                        key:
                            detail.key,

                        file:
                            detail.file,

                        settings: {

                            start:
                                settings.start,

                            end:
                                settings.end,

                            mode:
                                settings.mode,

                            fadeInEnabled:
                                settings.fadeInEnabled,

                            fadeInDuration:
                                settings.fadeInDuration,

                            fadeOutEnabled:
                                settings.fadeOutEnabled,

                            fadeOutDuration:
                                settings.fadeOutDuration,

                            outputFormat:
                                settings.outputFormat

                        }

                    }
                );

            updateOperationUi();

        }

    );

    /* =====================================================
    GENERIC RESULT STALE STATE
    ===================================================== */

    document.addEventListener(

        "easyfiletools:file-operation-stale-changed",

        event => {

            const detail =
                event.detail ||
                {};


            if (
                detail.operation !==
                "cut-audio"
            ) {

                return;
            }


            const index =
                Number(
                    detail.index
                );


            const records =
                window.CutAudioUI
                    ?.getAllRecords?.() ||
                [];


            const record =
                Number.isInteger(index)
                    ? records[index]
                    : null;


            if (!record) {
                return;
            }


            window.CutAudioOperation
                ?.setResultStale?.(
                    record.key,
                    detail.stale === true
                );


            updateReadyState();

        }

    );

    /* =====================================================
       FILES CLEARED
    ===================================================== */

    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            operationFileCount =
                0;


            updateOperationUi();

        }
    );


    /* =====================================================
       CUT START
       → GENERIC OPERATION START
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-batch-start",
        () => {

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
                                "cut-audio"

                        }
                    }
                )
            );


            updateOperationUi();

        }
    );


    /* =====================================================
       CUT PROGRESS
       → GENERIC FILE PROGRESS
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-progress",
        event => {

            const detail =
                event.detail ||
                {};


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-file-progress",
                    {
                        detail: {

                            index:
                                detail.index,

                            percentage:
                                (
                                    Number(
                                        detail.fileProgress
                                    ) ||
                                    0
                                ) * 100,

                            category:
                                operationZone
                                    .dataset
                                    .category ||
                                "",

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:file-operation-progress",
                    {
                        detail: {

                            index:
                                detail.index,

                            percentage:
                                (
                                    Number(
                                        detail.fileProgress
                                    ) ||
                                    0
                                ) * 100,

                            progressLabel:
                                "Cutting",

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );

        }
    );


    /* =====================================================
       FILE COMPLETE
       → GENERIC FILE COMPLETE
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-file-complete",
        event => {

            const detail =
                event.detail ||
                {};


            const result =
                detail.result ||
                {};


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-file-completed",
                    {
                        detail: {

                            index:
                                detail.index,

                            outputUrl:
                                result.outputUrl ||
                                null,

                            outputBlob:
                                result.blob ||
                                null,

                            outputName:
                                result.outputName ||
                                null,

                            outputSize:
                                result.outputSize ||
                                0,

                            outputDuration:
                                result.outputDuration || 0,

                            outputFormat:
                                result.outputFormat ||
                                null,

                            completedLabel:
                                "Cut",

                            category:
                                operationZone
                                    .dataset
                                    .category ||
                                "",

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:file-operation-completed",
                    {
                        detail: {

                            index:
                                detail.index,

                            outputUrl:
                                result.outputUrl ||
                                null,

                            outputBlob:
                                result.blob ||
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
                                "Cut",

                            outputDuration:
                                result.outputDuration || 0,

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );


            updateOperationUi();

        }
    );


    /* =====================================================
       PAUSED
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-paused",
        event => {

            const index =
                event.detail
                    ?.currentIndex;


            if (
                Number.isInteger(
                    index
                )
            ) {

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-file-cancelled",
                        {
                            detail: {

                                index,

                                category:
                                    operationZone
                                        .dataset
                                        .category ||
                                    "",

                                operation:
                                    "cut-audio"

                            }
                        }
                    )
                );

            }


            updateOperationUi();

        }
    );


    /* =====================================================
       CANCELLED
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-cancelled",
        event => {

            const index =
                event.detail
                    ?.currentIndex;


            if (
                Number.isInteger(
                    index
                )
            ) {

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:operation-file-cancelled",
                        {
                            detail: {

                                index,

                                category:
                                    operationZone
                                        .dataset
                                        .category ||
                                    "",

                                operation:
                                    "cut-audio"

                            }
                        }
                    )
                );

            }


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-ended",
                    {
                        detail: {

                            cancelled:
                                true,

                            category:
                                operationZone
                                    .dataset
                                    .category ||
                                "",

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );


            updateOperationUi();

        }
    );


    /* =====================================================
       COMPLETE
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-batch-complete",
        () => {

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-ended",
                    {
                        detail: {

                            cancelled:
                                false,

                            category:
                                operationZone
                                    .dataset
                                    .category ||
                                "",

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );


            updateOperationUi();

        }
    );


    /* =====================================================
       ERROR
    ===================================================== */

    window.addEventListener(
        "easyfiletools:cut-file-error",
        event => {

            console.error(
                "[CUT AUDIO] File processing error:",
                event.detail?.error
            );


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-ended",
                    {
                        detail: {

                            cancelled:
                                false,

                            error:
                                true,

                            category:
                                operationZone
                                    .dataset
                                    .category ||
                                "",

                            operation:
                                "cut-audio"

                        }
                    }
                )
            );


            updateOperationUi();

        }
    );


    /* =====================================================
       INITIAL STATE
    ===================================================== */

    setTimeout(
        updateOperationUi,
        0
    );

})();