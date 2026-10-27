console.log(
    "[OPERATION CONTROLLER] operation-controller.js loaded"
);


/* =========================================
   OPERATION CONTROLLER
========================================= */

(() => {

    const STATUS =
        Object.freeze({

            IDLE:
                "idle",

            READY:
                "ready",

            RUNNING:
                "running",

            PAUSED:
                "paused",

            CANCELLING:
                "cancelling",

            CANCELLED:
                "cancelled",

            COMPLETED:
                "completed",

            ERROR:
                "error"

        });


    let operationId =
        null;

    let operationConfig =
        null;

    let adapter =
        null;

    let runBtn =
        null;

    let cancelBtn =
        null;

    let pauseBtn =
        null;

    let controlsBound =
        false;

    // A cancelled job may still be settling asynchronously. Never allow a new
    // run to overlap the worker that is being terminated.
    let activeRunPromise = null;

    let state = {

        status:
            STATUS.IDLE,

        error:
            null

    };

    // Last validity signal received from the operation UI/adapter.
    // It lets the controller recover correctly after ephemeral results
    // are discarded by navigation, refresh or BFCache restoration.
    let lastReadySignal = false;

    /* =========================================
    CONTROLS
    ========================================= */

    function renderControls() {

        if (!operationConfig) {
            return;
        }


        const status =
            state.status;


        const ready =
            status ===
            STATUS.READY;


        const terminalRunnable =
            lastReadySignal &&
            (
                status === STATUS.COMPLETED ||
                status === STATUS.CANCELLED ||
                status === STATUS.ERROR
            );


        const runnable =
            !activeRunPromise &&
            (ready || terminalRunnable);


        const running =
            status ===
            STATUS.RUNNING;


        const paused =
            status ===
            STATUS.PAUSED;


        if (runBtn) {

            runBtn.disabled =
                !runnable;

            runBtn.classList.toggle(
                "active",
                runnable
            );
        }


        if (cancelBtn) {

            // Never present a cancellation that the adapter cannot perform.
            const enabled =
                (running || paused ||
                    (status === STATUS.CANCELLED && Boolean(activeRunPromise))) &&
                typeof adapter?.cancel === "function";


            cancelBtn.disabled =
                !enabled;

            cancelBtn.classList.toggle(
                "active",
                enabled
            );
        }


        if (pauseBtn) {

            const supportsPause =
                typeof adapter?.pause ===
                    "function" &&
                typeof adapter?.resume ===
                    "function";


            const enabled =
                (
                    running ||
                    paused
                ) &&
                supportsPause;


            pauseBtn.disabled =
                !enabled;

            pauseBtn.classList.toggle(
                "active",
                enabled
            );


            pauseBtn.innerHTML =
                paused

                    ? `
                        <i data-lucide="play"></i>
                        Resume
                    `

                    : `
                        <i data-lucide="pause"></i>
                        Pause
                    `;


            if (
                typeof createLocalIcons ===
                "function"
            ) {

                createLocalIcons(
                    pauseBtn
                );
            }
        }
    }

    /* =========================================
    SETTINGS LOCK
    ========================================= */

    function isSettingsLocked() {

        return (
            state.status ===
                STATUS.RUNNING ||
            state.status ===
                STATUS.PAUSED ||
            state.status ===
                STATUS.CANCELLING
        );
    }

    /* =========================================
       STATE
    ========================================= */

    function getState() {

        return {

            operationId,

            config:
                operationConfig,

            ...state,

            settingsLocked:
                isSettingsLocked()

        };
    }


    function emitState() {

        const currentState =
            getState();

        renderControls();

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:operation-state-changed",
                {
                    detail:
                        currentState
                }
            )
        );


        console.log(
            "[OPERATION CONTROLLER] State:",
            currentState.status
        );
    }


    function setStatus(
        status,
        error = null
    ) {

        state.status =
            status;

        state.error =
            error;

        emitState();
    }


    /* =========================================
       READY
    ========================================= */

    function setReady(
        ready
    ) {

        lastReadySignal = Boolean(ready);

        if (
            state.status ===
                STATUS.RUNNING ||
            state.status ===
                STATUS.PAUSED ||
            state.status ===
                STATUS.CANCELLING
        ) {
            return;
        }

        /*
         * A completed operation remains COMPLETED while its current result
         * still matches the loaded files/settings. File-list refreshes and
         * result rendering may call setReady(), but they must not make the UI
         * look runnable again until something genuinely becomes stale.
         */
        if (
            ready &&
            state.status === STATUS.COMPLETED &&
            window.EasyFileOperationResults?.hasCurrentResult?.()
        ) {
            return;
        }

        setStatus(
            ready
                ? STATUS.READY
                : STATUS.IDLE
        );
    }


    /* =========================================
       ADAPTER
    ========================================= */

    function registerAdapter(
        operationAdapter
    ) {

        if (
            !operationAdapter ||
            typeof operationAdapter.run !==
                "function"
        ) {

            console.error(
                "[OPERATION CONTROLLER] Invalid adapter"
            );

            return false;
        }


        adapter =
            operationAdapter;


        console.log(
            "[OPERATION CONTROLLER] Adapter registered:",
            operationId
        );


        return true;
    }


    /* =========================================
       RUN
    ========================================= */

    async function run() {

        if (!adapter) {

            console.error(
                "[OPERATION CONTROLLER] No adapter registered"
            );

            return false;
        }


        const runnableStatus =
            state.status === STATUS.READY ||
            (
                lastReadySignal &&
                (
                    state.status === STATUS.COMPLETED ||
                    state.status === STATUS.CANCELLED ||
                    state.status === STATUS.ERROR
                )
            );


        if (!runnableStatus || activeRunPromise) {
            return false;
        }


        const results =
            window
                .EasyFileOperationResults;


        /*
         * GENERIC RE-RUN CONTRACT
         * -----------------------
         * The order here is important:
         *
         * 1) If the CURRENT files + settings already have a current result,
         *    do not execute again and do not ask to replace anything. The
         *    operation is already up to date.
         *
         * 2) Only when an existing result is STALE (files/settings changed)
         *    may the replacement-protection dialog be relevant.
         *
         * This preserves the long-standing EasyFile rule while still keeping
         * the Run button available after COMPLETED/CANCELLED/ERROR.
         */
        const hasCurrentResult =
            results?.hasCurrentResult?.() === true;


        if (hasCurrentResult) {
            window.EasyFileOperationMessages
                ?.info?.(
                    "Operation completed",
                    "This operation has already been completed with the current files and settings."
                );

            console.log(
                "[OPERATION CONTROLLER] Run skipped — current result already exists."
            );

            return false;
        }


        /*
         * A replacement confirmation is only meaningful for an OLD/STALE
         * generated result that would actually be superseded by this run.
         */
        const hasPreviousResult =
            results?.hasResult?.() === true;

        const undownloadedCount =
            results?.getUndownloadedCount?.() || 0;


        if (
            hasPreviousResult &&
            undownloadedCount > 0
        ) {
            const allowed = await window.EasyFileOperationMessages
                ?.confirmReplaceResult?.(undownloadedCount);

            if (allowed === false) {
                console.log(
                    "[OPERATION CONTROLLER] Replacement cancelled — previous results preserved."
                );
                return false;
            }
        }

        setStatus(
            STATUS.RUNNING
        );


        try {

            // Register the task before yielding, so Cancel can wait until
            // the engine has actually stopped (including Pause -> Cancel).
            const pending = Promise.resolve(adapter.run());
            activeRunPromise = pending;
            try {
                await pending;
            } finally {
                if (activeRunPromise === pending) {
                    activeRunPromise = null;
                    // Re-enable Run only after the worker has really settled.
                    renderControls();
                }
            }


            if (
                state.status ===
                    STATUS.CANCELLED ||
                state.status ===
                    STATUS.CANCELLING
            ) {

                return false;
            }


            setStatus(
                STATUS.COMPLETED
            );


            /*
             * Some operations (notably image transforms) are
             * intentionally repeatable with the same files.
             * Their UI should return to READY after exposing the
             * completed state, just like the mature Audio tools.
             */
            if (
                operationConfig
                    ?.restoreReadyAfterCompletion ===
                true
            ) {

                window.setTimeout(
                    () => {

                        if (
                            state.status ===
                            STATUS.COMPLETED
                        ) {

                            setStatus(
                                STATUS.READY
                            );
                        }

                    },
                    0
                );
            }


            return true;

        }
        catch (error) {

            if (
                state.status === STATUS.CANCELLED ||
                state.status === STATUS.CANCELLING
            ) {
                return false;
            }


            console.error(
                "[OPERATION CONTROLLER] Operation failed:",
                error
            );


            setStatus(
                STATUS.ERROR,
                error
            );


            return false;
        }
    }


    /* =========================================
       PAUSE
    ========================================= */

    async function pause() {
        if (state.status !== STATUS.RUNNING || !adapter?.pause) return false;

        // Reserve PAUSED synchronously. Cancel can now safely interrupt pause,
        // even if terminating a FFmpeg worker is asynchronous.
        setStatus(STATUS.PAUSED);
        try {
            await adapter.pause();
            return state.status === STATUS.PAUSED;
        } catch (error) {
            // A pending Pause must NEVER overwrite CANCELLED/CANCELLING.
            if (state.status === STATUS.CANCELLING ||
                state.status === STATUS.CANCELLED) return false;
            setStatus(STATUS.ERROR, error);
            return false;
        }
    }

    /* =========================================
       RESUME
    ========================================= */
    async function resume() {
        if (state.status !== STATUS.PAUSED || !adapter?.resume) return false;
        setStatus(STATUS.RUNNING);
        try {
            await adapter.resume();
            return state.status === STATUS.RUNNING;
        } catch (error) {
            if (state.status === STATUS.CANCELLING ||
                state.status === STATUS.CANCELLED) return false;
            setStatus(STATUS.ERROR, error);
            return false;
        }
    }

    /* =========================================
       CANCEL — COMMON CONTRACT
    ========================================= */
    async function cancel() {
        // Until the old promise settles, keep Cancel available as a retry;
        // Run stays locked so we cannot create a second worker.
        if (state.status === STATUS.CANCELLED && activeRunPromise &&
            typeof adapter?.cancel === 'function') {
            window.EasyFileOperationProgress?.reset?.();
            try { await adapter.cancel(); return true; }
            catch (error) {
                console.error('[OPERATION CONTROLLER] Repeated cancellation failed:', error);
                return false;
            }
        }
        if ((state.status !== STATUS.RUNNING && state.status !== STATUS.PAUSED) ||
            typeof adapter?.cancel !== 'function') return false;

        // UI reset is immediate; do not wait for the encoder to terminate.
        setStatus(STATUS.CANCELLING);
        window.EasyFileOperationProgress?.reset?.();
        document.dispatchEvent(new CustomEvent(
            'easyfiletools:operation-cancel-requested',
            { detail: { operation: operationId } }
        ));

        try {
            await adapter.cancel();
            // Never wait indefinitely for an unresponsive adapter: the UI
            // must acknowledge Cancel even if a legacy job never settles.
            // Run remains disabled while activeRunPromise is pending.
        } catch (error) {
            console.error('[OPERATION CONTROLLER] Cancellation failed:', error);
            setStatus(STATUS.ERROR, error);
            window.EasyFileOperationMessages?.operationError?.(error);
            return false;
        }

        window.EasyFileOperationProgress?.reset?.();
        setStatus(STATUS.CANCELLED);
        return true;
    }


    /* =========================================
       RESET
    ========================================= */

    function reset() {

        adapter =
            null;

        state = {

            status:
                STATUS.IDLE,

            error:
                null

        };

        lastReadySignal = false;


        emitState();
    }

    /* =========================================
    CONTROL EVENTS
    ========================================= */

    function bindControlEvents() {

        if (controlsBound) {
            return;
        }


        if (runBtn) {

            runBtn.addEventListener(
                "click",
                async () => {

                    /*
                    * Non-migrated operations keep
                    * their existing listeners.
                    */

                    if (!adapter) {
                        return;
                    }


                    if (runBtn.disabled) {
                        return;
                    }


                    await run();
                }
            );
        }


        if (cancelBtn) {

            cancelBtn.addEventListener(
                "click",
                async () => {

                    if (!adapter) {
                        return;
                    }


                    if (cancelBtn.disabled) {
                        return;
                    }


                    await cancel();
                }
            );
        }


        if (pauseBtn) {

            pauseBtn.addEventListener(
                "click",
                async () => {

                    if (!adapter) {
                        return;
                    }


                    if (pauseBtn.disabled) {
                        return;
                    }


                    if (
                        state.status ===
                        STATUS.PAUSED
                    ) {

                        await resume();
                    }
                    else {

                        await pause();
                    }
                }
            );
        }


        controlsBound =
            true;
    }

    /* =========================================
       INITIALIZE
    ========================================= */

    function initialize() {

        const operationZone =
            document.getElementById(
                "operation-zone"
            );


        if (!operationZone) {

            return false;
        }

        runBtn =
            document.getElementById(
                "convertBtn"
            );

        cancelBtn =
            document.getElementById(
                "cancelOperationBtn"
            );

        pauseBtn =
            document.getElementById(
                "pauseOperationBtn"
            );

        bindControlEvents();

        operationId =
            operationZone.dataset.operation ||
            null;


        operationConfig =
            window
                .EasyFileOperationConfig
                ?.get?.(
                    operationId
                ) ||
            null;


        console.log(
            "[OPERATION CONTROLLER] Initialized:",
            {
                operationId,
                operationConfig
            }
        );


        emitState();


        return true;
    }


    /* =========================================
       EPHEMERAL RESULTS DISCARDED
    ========================================= */

    document.addEventListener(
        "easyfiletools:operation-results-discarded",
        () => {
            if (
                state.status === STATUS.RUNNING ||
                state.status === STATUS.PAUSED ||
                state.status === STATUS.CANCELLING
            ) {
                return;
            }

            setStatus(
                lastReadySignal
                    ? STATUS.READY
                    : STATUS.IDLE
            );
        }
    );

    /* =========================================
       PUBLIC API
    ========================================= */

    window.EasyFileOperationController =
        Object.freeze({

            STATUS,

            initialize,

            registerAdapter,

            setReady,

            run,

            pause,

            resume,

            cancel,

            reset,

            getState,

            isSettingsLocked

        });


    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

})();