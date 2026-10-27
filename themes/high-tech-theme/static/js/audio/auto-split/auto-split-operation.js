console.log(
    "[AUTO SPLIT OPERATION] auto-split-operation.js loaded"
);


(() => {

    "use strict";


    const zone =
        document.getElementById(
            "operation-zone"
        );


    if (
        !zone ||
        zone.dataset.operation !==
            "auto-split"
    ) {

        return;

    }


    const controller =
        window
            .EasyFileOperationController;

    const chooseFormatLabel =
        document.getElementById(
            "chooseFormatLabel"
        );


    const operationConfig =
        window
            .EasyFileOperationConfig
            ?.get?.(
                "auto-split"
            ) ||
        null;


    const minFiles =
        Math.max(
            1,
            Number(
                operationConfig?.minFiles
            ) || 1
        );            

    if (!controller) {

        console.error(
            "[AUTO SPLIT OPERATION] Operation controller unavailable."
        );

        return;

    }


    const state = {

        files: [],

        settings:
            null,

        lastEndDetail:
            null

    };


    /* =========================================
       CONTROLLER
    ========================================= */

    controller.initialize?.();


    function updateReady() {

        const hasRequiredFiles =
            state.files.length >=
            minFiles;


        chooseFormatLabel
            ?.classList
            .toggle(
                "active",
                hasRequiredFiles
            );


        const ready =
            hasRequiredFiles &&
            Boolean(
                state.settings
            );


        controller.setReady(
            ready
        );

    }


    /* =========================================
       FILES
    ========================================= */

    async function syncFiles() {

        if (
            typeof loadSelectedFiles !==
                "function"
        ) {

            state.files =
                [];

            updateReady();

            return;

        }


        const data =
            await loadSelectedFiles();


        state.files =
            data &&
            Array.isArray(
                data.files
            )
                ? data.files
                : [];


        updateReady();

    }


    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                    "auto-split"
            ) {

                return;

            }


            state.files =
                Array.isArray(
                    event.detail.files
                )
                    ? event.detail.files
                    : [];


            updateReady();

        }

    );


    /* =========================================
       SETTINGS
    ========================================= */

    document.addEventListener(

        "easyfiletools:auto-split-settings-changed",

        event => {

            const valid =
                event.detail?.valid ===
                    true;


            state.settings =
                valid
                    ? event.detail
                        ?.settings ||
                        null
                    : null;


            /*
             * Feed the generic lifecycle.
             *
             * Invalid settings intentionally
             * receive their own signature so
             * previous results become stale.
             */

            window
                .EasyFileOperationLifecycle
                ?.settingsChanged?.({

                    operation:
                        "auto-split",

                    scope:
                        "all",

                    settings:
                        valid
                            ? state.settings
                            : {
                                invalid:
                                    true
                            }

                });


            updateReady();

        }

    );


    /* =========================================
       AUTO SPLITTER EVENTS
    ========================================= */

    document.addEventListener(

        "easyfiletools:auto-split-file-progress",

        event => {

            const detail =
                event.detail || {};


            /*
             * Generic global progress.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-file-progress",
                    {
                        detail: {

                            index:
                                detail.index,

                            percentage:
                                detail.percentage,

                            operation:
                                "auto-split"

                        }
                    }
                )
            );


            /*
             * Existing file-list progress UI.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:file-operation-progress",
                    {
                        detail: {

                            index:
                                detail.index,

                            percentage:
                                detail.percentage,

                            progressLabel:
                                "Splitting",

                            operation:
                                "auto-split"

                        }
                    }
                )
            );

        }

    );


    document.addEventListener(

        "easyfiletools:auto-split-file-complete",

        event => {

            const {
                index,
                file,
                segments
            } =
                event.detail || {};


            if (
                !Number.isInteger(
                    index
                ) ||
                !Array.isArray(
                    segments
                )
            ) {

                return;

            }


            /*
             * Temporary compatibility with the
             * current Auto Split results UI.
             *
             * This disappears later when the UI
             * is migrated to the generic manager.
             */

            window
                .AutoSplitUI
                ?.registerResult?.(
                    index,
                    file?.name ||
                        `File ${index + 1}`,
                    segments
                );


            /*
             * Generic MULTI_OUTPUT lifecycle.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-file-completed",
                    {
                        detail: {

                            index,

                            outputs:
                                segments,

                            completedLabel:
                                `Split • ${
                                    segments.length
                                } ${
                                    segments.length ===
                                        1
                                        ? "part"
                                        : "parts"
                                }`,

                            operation:
                                "auto-split"

                        }
                    }
                )
            );


            /*
             * Keep the current file-list UI
             * informed that this source file
             * has completed.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:file-operation-completed",
                    {
                        detail: {

                            index,

                            completedLabel:
                                `Split • ${
                                    segments.length
                                } ${
                                    segments.length ===
                                        1
                                        ? "part"
                                        : "parts"
                                }`,

                            outputCount:
                                segments.length,

                            operation:
                                "auto-split"

                        }
                    }
                )
            );

        }

    );


    document.addEventListener(

        "easyfiletools:auto-split-ended",

        event => {

            state.lastEndDetail = {

                cancelled:
                    Boolean(
                        event.detail
                            ?.cancelled
                    ),

                error:
                    event.detail
                        ?.error ||
                    null

            };

        }

    );


    /* =========================================
       CONTROLLER ADAPTER
    ========================================= */

    const adapter = {

        async run() {


    const settings =
        window
            .AutoSplitUI
            ?.getSettings?.();


    if (
        !settings ||
        state.files.length ===
            0
    ) {

        throw new Error(
            "AUTO_SPLIT_NOT_READY"
        );

    }


    const lifecycle =
        window
            .EasyFileOperationLifecycle;


    /*
    * IMPORTANT:
    *
    * Files may have been synchronized after
    * the first settings event emitted by the UI.
    *
    * Re-apply the current settings here so every
    * current input has the correct signature
    * before checking result reuse or starting
    * a new operation.
    */

    lifecycle
        ?.settingsChanged?.({

            operation:
                "auto-split",

            scope:
                "all",

            settings

        });




            state.settings =
                settings;


            state.lastEndDetail =
                null;


            /*
             * Current specific results UI.
             * The generic results state itself
             * is NOT cleared here.
             */

            window
                .AutoSplitUI
                ?.clearResults?.();


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-started",
                    {
                        detail: {

                            category:
                                "Audio",

                            operation:
                                "auto-split"

                        }
                    }
                )
            );


            await window
                .AudioAutoSplitter
                .splitFiles(
                    state.files,
                    settings
                );


            const endDetail =
                state.lastEndDetail || {

                    cancelled:
                        false,

                    error:
                        null

                };


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-ended",
                    {
                        detail: {

                            category:
                                "Audio",

                            operation:
                                "auto-split",

                            cancelled:
                                endDetail
                                    .cancelled,

                            error:
                                Boolean(
                                    endDetail
                                        .error
                                )

                        }
                    }
                )
            );


            if (
                endDetail.error
            ) {

                throw endDetail.error;

            }

        },


        async pause() {

            window
                .AudioAutoSplitter
                ?.pause?.();

        },


        async resume() {

            window
                .AudioAutoSplitter
                ?.resume?.();

        },


        async cancel() {

            await window
                .AudioAutoSplitter
                ?.cancel?.();

        }

    };


    controller.registerAdapter(
        adapter
    );



    /* =========================================
       CLEAR ALL
    ========================================= */

    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.files =
                [];


            state.lastEndDetail =
                null;


            window
                .AutoSplitUI
                ?.clearResults?.();


            updateReady();

        }

    );


    /* =========================================
       INITIAL STATE
    ========================================= */

    state.settings =
        window
            .AutoSplitUI
            ?.getSettings?.() ||
        null;


    syncFiles();

    updateReady();

})();