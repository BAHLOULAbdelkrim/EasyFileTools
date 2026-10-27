console.log(
    "[OPERATION RESULTS] operation-results.js loaded"
);


/* =========================================
   OPERATION RESULTS
========================================= */

(() => {

    const RESULT_MODES =
        window.EasyFileOperationConfig
            ?.RESULT_MODES || {

                PER_FILE:
                    "per-file",

                BATCH:
                    "batch",

                MULTI_OUTPUT:
                    "multi-output"

            };


    let state = {

        mode:
            RESULT_MODES.PER_FILE,

        items:
            [],

        batch: {
            currentSignature:
                null,

            resultSignature:
                null,

            stale:
                false,

            downloaded:
                false,

            result:
                null
        }

    };


    /* =========================================
       NORMALIZE / SIGNATURE
    ========================================= */

    function normalize(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }


        if (
            typeof value ===
            "number"
        ) {

            return Number.isFinite(
                value
            )
                ? Number(
                    value.toFixed(6)
                )
                : null;
        }


        if (
            Array.isArray(
                value
            )
        ) {

            return value.map(
                normalize
            );
        }


        if (
            typeof value ===
            "object"
        ) {

            const normalized =
                {};


            Object.keys(
                value
            )
                .sort()
                .forEach(
                    key => {

                        const item =
                            value[key];


                        if (
                            item === undefined ||
                            typeof item ===
                                "function"
                        ) {
                            return;
                        }


                        normalized[key] =
                            normalize(
                                item
                            );
                    }
                );


            return normalized;
        }


        return value;
    }


    function createSignature(
        value
    ) {

        return JSON.stringify(
            normalize(
                value
            )
        );
    }


    /* =========================================
       FILE KEY
    ========================================= */

    function getFileKey(
        input
    ) {

        const file =
            input?.file ||
            input;


        if (
            typeof File !==
                "undefined" &&
            file instanceof File
        ) {

            return [

                file.name || "",

                file.size || 0,

                file.lastModified || 0,

                file.type || ""

            ].join("::");
        }


        return String(
            input ?? ""
        );
    }

    /* =========================================
    OUTPUT HELPERS
    ========================================= */

    function getOutputUrl(
        output
    ) {

        return (
            output?.outputUrl ||
            output?.url ||
            null
        );

    }


    function revokeOutputUrl(
        output,
        preservedUrls = null
    ) {

        const outputUrl =
            getOutputUrl(
                output
            );


        if (!outputUrl) {

            return;

        }


        if (
            preservedUrls instanceof Set &&
            preservedUrls.has(
                outputUrl
            )
        ) {

            return;

        }


        /*
        * Only Object URLs created by
        * URL.createObjectURL() must be revoked.
        */

        if (
            typeof outputUrl !==
                "string" ||
            !outputUrl.startsWith(
                "blob:"
            )
        ) {

            return;

        }


        try {

            URL.revokeObjectURL(
                outputUrl
            );

        }
        catch (_) {

            // Ignore cleanup errors.

        }

    }


    function revokeOutputs(
        outputs = [],
        preservedUrls = null
    ) {

        if (
            !Array.isArray(
                outputs
            )
        ) {

            return;

        }


        outputs.forEach(
            output => {

                revokeOutputUrl(
                    output,
                    preservedUrls
                );

            }
        );

    }


    function syncMultiOutputDownloadedState(
        item
    ) {

        if (!item) {

            return false;

        }


        const outputs =
            Array.isArray(
                item.outputs
            )
                ? item.outputs
                : [];


        item.downloaded =
            outputs.length > 0 &&
            outputs.every(
                output =>
                    output?.downloaded ===
                    true
            );


        return item.downloaded;

    }

    /* =========================================
       STALE
    ========================================= */

    function refreshItemStale(
        item
    ) {

        if (!item) {
            return;
        }


        const hasResult =
            Boolean(
                item.result
            ) ||
            (
                Array.isArray(
                    item.outputs
                ) &&
                item.outputs.length > 0
            );


        /*
        * No result yet:
        * there is nothing that can be stale.
        */

        if (!hasResult) {

            item.stale =
                false;

            return;

        }


        /*
        * A completed result without the
        * signature that produced it cannot
        * safely be considered current.
        */

        if (
            !item.resultSignature
        ) {

            item.stale =
                true;

            return;

        }


        item.stale =
            item.resultSignature !==
            item.currentSignature;
    }


    function refreshBatchStale() {

        if (
            !state.batch.resultSignature
        ) {

            state.batch.stale =
                false;

            return;
        }


        state.batch.stale =
            state.batch.resultSignature !==
            state.batch.currentSignature;
    }


    /* =========================================
       MODE
    ========================================= */

    function setMode(
        mode
    ) {

        if (
            !Object.values(
                RESULT_MODES
            ).includes(
                mode
            )
        ) {

            return false;
        }


        state.mode =
            mode;


        return true;
    }


    /* =========================================
       INPUTS
    ========================================= */

    function setInputs(
        inputs = []
    ) {

        const previousItems =
            state.items;


        state.items =
            inputs.map(
                input => {

                    const key =
                        getFileKey(
                            input
                        );


                    const previous =
                        previousItems.find(
                            item =>
                                item.key ===
                                key
                        );


                    return previous || {

                        key,

                        input,

                        currentSignature:
                            null,

                        resultSignature:
                            null,

                        stale:
                            false,

                        downloaded:
                            false,

                        result:
                            null,

                        outputs:
                            []

                    };
                }
            );

        /*
        * Clean results belonging to inputs
        * that are no longer present.
        */

        const activeKeys =
            new Set(
                state.items.map(
                    item =>
                        item.key
                )
            );


        previousItems.forEach(
            item => {

                if (
                    activeKeys.has(
                        item.key
                    )
                ) {

                    return;

                }


                revokeOutputUrl(
                    item.result
                );


                revokeOutputs(
                    item.outputs
                );

            }
        );

        const inputKeys =
            state.items.map(
                item =>
                    item.key
            );


        state.batch.currentSignature =
            createSignature(
                {
                    inputs:
                        inputKeys,

                    settings:
                        null
                }
            );


        refreshBatchStale();
    }


    /* =========================================
       SETTINGS — ALL FILES
    ========================================= */

    function setSettings(
        settings = {}
    ) {

        const signature =
            createSignature(
                settings
            );


        state.items.forEach(
            item => {

                item.currentSignature =
                    signature;

                refreshItemStale(
                    item
                );
            }
        );


        state.batch.currentSignature =
            createSignature(
                {
                    inputs:
                        state.items.map(
                            item =>
                                item.key
                        ),

                    settings
                }
            );


        refreshBatchStale();
    }

    /* =========================================
    SETTINGS — BATCH
    ========================================= */

    function setBatchSettings(
        inputs = null,
        settings = {}
    ) {

        const inputKeys =
            Array.isArray(
                inputs
            )
                ? inputs.map(
                    getFileKey
                )
                : state.items.map(
                    item =>
                        item.key
                );


        state.batch.currentSignature =
            createSignature(
                {
                    inputs:
                        inputKeys,

                    settings
                }
            );


        refreshBatchStale();


        return true;
    }

    /* =========================================
       SETTINGS — ONE FILE
    ========================================= */

    function setFileSettings(
        index,
        settings = {}
    ) {

        const item =
            state.items[index];


        if (!item) {
            return false;
        }


        item.currentSignature =
            createSignature(
                settings
            );


        refreshItemStale(
            item
        );


        return true;
    }


    /* =========================================
       COMPLETE PER FILE
    ========================================= */

    function completeFile(
        index,
        result
    ) {

        const item =
            state.items[index];


        if (!item) {
            return false;
        }


        /* =========================
        CLEAN PREVIOUS OBJECT URL
        ========================= */

        const previousOutputUrl =
            item.result?.outputUrl ||
            item.result?.url ||
            null;


        const nextOutputUrl =
            result?.outputUrl ||
            result?.url ||
            null;


        if (
            previousOutputUrl &&
            previousOutputUrl !==
                nextOutputUrl
        ) {

            try {

                URL.revokeObjectURL(
                    previousOutputUrl
                );

            }
            catch (_) {
                // Ignore cleanup errors.
            }
        }


        /* =========================
        STORE CURRENT RESULT
        ========================= */

        item.result =
            result;


        item.resultSignature =
            item.currentSignature;


        item.stale =
            false;


        item.downloaded =
            false;


        return true;
    }

    /* =========================================
       COMPLETE MULTI OUTPUT
    ========================================= */

    function completeMultiOutput(
        index,
        outputs = []
    ) {

        const item =
            state.items[index];


        if (
            !item ||
            !Array.isArray(
                outputs
            )
        ) {

            return false;

        }


        /*
        * Every generated output has its
        * own download state.
        */

        const nextOutputs =
            outputs
                .filter(
                    Boolean
                )
                .map(
                    output => ({

                        ...output,

                        downloaded:
                            false

                    })
                );


        /*
        * Preserve Object URLs that are
        * reused by the new result.
        */

        const preservedUrls =
            new Set(
                nextOutputs
                    .map(
                        getOutputUrl
                    )
                    .filter(
                        Boolean
                    )
            );


        /*
        * Clean previous outputs before
        * replacing them.
        */

        revokeOutputs(
            item.outputs,
            preservedUrls
        );


        item.outputs =
            nextOutputs;


        item.resultSignature =
            item.currentSignature;


        item.stale =
            false;


        syncMultiOutputDownloadedState(
            item
        );


        return true;

    }

    /* =========================================
       COMPLETE BATCH
    ========================================= */

    function completeBatch(
        result
    ) {

        /* =========================
        CLEAN PREVIOUS OBJECT URL
        ========================= */

        const previousOutputUrl =
            state.batch.result
                ?.outputUrl ||
            state.batch.result
                ?.url ||
            null;


        const nextOutputUrl =
            result?.outputUrl ||
            result?.url ||
            null;


        if (
            previousOutputUrl &&
            previousOutputUrl !==
                nextOutputUrl
        ) {

            try {

                URL.revokeObjectURL(
                    previousOutputUrl
                );

            }
            catch (_) {
                // Ignore cleanup errors.
            }
        }


        /* =========================
        STORE CURRENT RESULT
        ========================= */

        state.batch.result =
            result;


        state.batch.resultSignature =
            state.batch.currentSignature;


        state.batch.stale =
            false;


        state.batch.downloaded =
            false;


        return true;
    }

    /* =========================================
       RESULT STATE
    ========================================= */

    function itemHasResult(
        item
    ) {

        if (
            state.mode ===
            RESULT_MODES.MULTI_OUTPUT
        ) {

            return (
                Array.isArray(
                    item.outputs
                ) &&
                item.outputs.length > 0
            );
        }


        return Boolean(
            item.result
        );
    }


    function hasResult() {

        if (
            state.mode ===
            RESULT_MODES.BATCH
        ) {

            return Boolean(
                state.batch.result
            );
        }


        return state.items.some(
            itemHasResult
        );
    }


    function hasCurrentResult() {

        if (
            state.mode ===
            RESULT_MODES.BATCH
        ) {

            return (
                Boolean(
                    state.batch.result
                ) &&
                state.batch.stale !==
                    true
            );
        }

        return (
            state.items.length > 0 &&
            state.items.every(
                item =>
                    itemHasResult(
                        item
                    ) &&

                    Boolean(
                        item.resultSignature
                    ) &&

                    item.resultSignature ===
                        item.currentSignature &&

                    item.stale !==
                        true
            )
        );

    }

    /* =========================================
    GET RESULTS
    ========================================= */

    function getItem(
        index
    ) {

        const item =
            state.items[index];


        if (!item) {

            return null;

        }


        return {

            ...item,

            outputs:
                Array.isArray(
                    item.outputs
                )
                    ? item.outputs.map(
                        output => ({

                            ...output

                        })
                    )
                    : []

        };

    }


    function getBatch() {

        return {
            ...state.batch
        };
    }

    /* =========================================
    CURRENT OUTPUTS
    ========================================= */

    function getCurrentOutputs() {

        /* =========================
        BATCH
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.BATCH
        ) {

            if (
                !state.batch.result ||
                state.batch.stale === true
            ) {

                return [];
            }


            return [
                state.batch.result
            ];
        }


        /* =========================
        MULTI OUTPUT
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.MULTI_OUTPUT
        ) {

            return state.items.flatMap(
                item => {

                    if (
                        item.stale === true ||
                        !Array.isArray(
                            item.outputs
                        )
                    ) {

                        return [];
                    }


                    return item.outputs;
                }
            );
        }


        /* =========================
        PER FILE
        ========================= */

        return state.items
            .filter(
                item =>
                    item.result &&
                    item.stale !== true
            )
            .map(
                item =>
                    item.result
            );
    }

    /* =========================================
    STALE + NOT DOWNLOADED
    ========================================= */

    function getStaleUndownloadedCount() {

        /* =========================
        BATCH
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.BATCH
        ) {

            return (
                state.batch.result &&
                state.batch.stale ===
                    true &&
                state.batch.downloaded !==
                    true
            )
                ? 1
                : 0;

        }


        /* =========================
        MULTI OUTPUT
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.MULTI_OUTPUT
        ) {

            return state.items.reduce(
                (
                    count,
                    item
                ) => {

                    if (
                        item.stale !==
                            true ||
                        !Array.isArray(
                            item.outputs
                        )
                    ) {

                        return count;

                    }


                    return (
                        count +
                        item.outputs.filter(
                            output =>
                                output?.downloaded !==
                                    true
                        ).length
                    );

                },
                0
            );

        }


        /* =========================
        PER FILE
        ========================= */

        return state.items.filter(
            item =>
                Boolean(
                    item.result
                ) &&
                item.stale ===
                    true &&
                item.downloaded !==
                    true
        ).length;

    }

    /* =========================================
    UNDOWNLOADED RESULTS
    ========================================= */

    function getUndownloadedCount() {

        /* =========================
        BATCH
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.BATCH
        ) {

            return (
                state.batch.result &&
                state.batch.downloaded !==
                    true
            )
                ? 1
                : 0;

        }


        /* =========================
        MULTI OUTPUT
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.MULTI_OUTPUT
        ) {

            return state.items.reduce(
                (
                    count,
                    item
                ) => {

                    if (
                        !Array.isArray(
                            item.outputs
                        )
                    ) {

                        return count;

                    }


                    return (
                        count +
                        item.outputs.filter(
                            output =>
                                output?.downloaded !==
                                    true
                        ).length
                    );

                },
                0
            );

        }


        /* =========================
        PER FILE
        ========================= */

        return state.items.filter(
            item =>
                Boolean(
                    item.result
                ) &&
                item.downloaded !==
                    true
        ).length;

    }

    /* =========================================
    DOWNLOADED
    ========================================= */

    function markOutputDownloaded(
        index,
        outputIndex
    ) {

        const item =
            state.items[index];


        if (
            !item ||
            !Array.isArray(
                item.outputs
            ) ||
            !Number.isInteger(
                outputIndex
            ) ||
            outputIndex < 0 ||
            outputIndex >=
                item.outputs.length
        ) {

            return false;

        }


        item.outputs[
            outputIndex
        ].downloaded =
            true;


        syncMultiOutputDownloadedState(
            item
        );


        return true;

    }


    function markFileOutputsDownloaded(
        index
    ) {

        const item =
            state.items[index];


        if (
            !item ||
            !Array.isArray(
                item.outputs
            ) ||
            item.outputs.length ===
                0
        ) {

            return false;

        }


        item.outputs.forEach(
            output => {

                output.downloaded =
                    true;

            }
        );


        syncMultiOutputDownloadedState(
            item
        );


        return true;

    }


    function markDownloaded(
        index = null
    ) {

        /* =========================
        BATCH
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.BATCH
        ) {

            if (
                !state.batch.result
            ) {

                return false;

            }


            state.batch.downloaded =
                true;


            return true;

        }


        /* =========================
        ONE INPUT
        ========================= */

        if (
            Number.isInteger(
                index
            )
        ) {

            if (
                state.mode ===
                RESULT_MODES.MULTI_OUTPUT
            ) {

                return (
                    markFileOutputsDownloaded(
                        index
                    )
                );

            }


            const item =
                state.items[index];


            if (
                !item ||
                !itemHasResult(
                    item
                )
            ) {

                return false;

            }


            item.downloaded =
                true;


            return true;

        }


        /* =========================
        ALL MULTI OUTPUTS
        ========================= */

        if (
            state.mode ===
            RESULT_MODES.MULTI_OUTPUT
        ) {

            state.items.forEach(
                (
                    item,
                    itemIndex
                ) => {

                    if (
                        Array.isArray(
                            item.outputs
                        ) &&
                        item.outputs.length > 0
                    ) {

                        markFileOutputsDownloaded(
                            itemIndex
                        );

                    }

                }
            );


            return true;

        }


        /* =========================
        ALL PER-FILE RESULTS
        ========================= */

        state.items.forEach(
            item => {

                if (
                    itemHasResult(
                        item
                    )
                ) {

                    item.downloaded =
                        true;

                }

            }
        );


        return true;

    }

    /* =========================================
    CLEAR BATCH
    ========================================= */

    function clearBatch() {

        const result =
            state.batch.result;


        const outputUrl =
            result?.outputUrl ||
            result?.url ||
            null;


        if (outputUrl) {

            try {

                URL.revokeObjectURL(
                    outputUrl
                );

            }
            catch (_) {
                // Ignore cleanup errors.
            }
        }


        state.batch = {

            currentSignature:
                null,

            resultSignature:
                null,

            stale:
                false,

            downloaded:
                false,

            result:
                null

        };


        return true;
    }

    /* =========================================
       RESET
    ========================================= */

    function reset() {

        const mode =
            state.mode;


        /*
        * Release every Object URL before
        * dropping the result state.
        */

        state.items.forEach(
            item => {

                revokeOutputUrl(
                    item.result
                );


                revokeOutputs(
                    item.outputs
                );

            }
        );


        revokeOutputUrl(
            state.batch.result
        );


        state = {

            mode,

            items:
                [],

            batch: {

                currentSignature:
                    null,

                resultSignature:
                    null,

                stale:
                    false,

                downloaded:
                    false,

                result:
                    null

            }

        };

    }

    /* =========================================
       GET STATE
    ========================================= */

    function getState() {

        return {

            mode:
                state.mode,

            items:
                state.items.map(
                    item => ({
                        ...item,

                        outputs:
                            Array.isArray(
                                item.outputs
                            )
                                ? item.outputs.map(
                                    output => ({

                                        ...output

                                    })
                                )
                                : []

                    })
                ),

            batch:
                {
                    ...state.batch
                },

            hasResult:
                hasResult(),

            hasCurrentResult:
                hasCurrentResult()

        };
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.EasyFileOperationResults =
        Object.freeze({

            setMode,

            setInputs,

            setSettings,

            setBatchSettings,

            setFileSettings,

            completeFile,

            completeMultiOutput,

            completeBatch,

            hasResult,

            hasCurrentResult,

            getItem,

            getBatch,

            getCurrentOutputs,

            getStaleUndownloadedCount,

            getUndownloadedCount,

            markOutputDownloaded,

            markFileOutputsDownloaded,

            markDownloaded,

            clearBatch,

            reset,

            getState

        });

})();