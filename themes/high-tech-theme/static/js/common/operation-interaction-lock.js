console.log(
    "[OPERATION LOCK] operation-interaction-lock.js loaded"
);


/* =========================================================
   GENERIC OPERATION INTERACTION LOCK

   Policy:
   - EMPTY: upload/navigation remain available, operation
     parameters stay disabled until at least one file exists.
   - RUNNING / PAUSED / CANCELLING: the page becomes
     read-only except Pause/Resume, Cancel, progress display,
     scrolling and Go to top.
   - READY / COMPLETED / CANCELLED / ERROR: normal page
     interactions are restored.
========================================================= */

(() => {

    "use strict";


    const PROCESSING_STATUSES =
        new Set([
            "running",
            "paused",
            "cancelling"
        ]);


    let processingLocked =
        false;

    let fileCount =
        0;

    let operationId =
        "";


    function setManagedInert(
        element,
        locked
    ) {

        if (!element) {
            return;
        }


        if (locked) {

            if (!element.inert) {

                element.dataset
                    .operationLockManagedInert =
                    "true";

                element.inert =
                    true;
            }

            return;
        }


        if (
            element.dataset
                .operationLockManagedInert ===
            "true"
        ) {

            element.inert =
                false;

            delete element.dataset
                .operationLockManagedInert;
        }

    }


    function setManagedDisabled(
        element,
        locked
    ) {

        if (!element) {
            return;
        }


        if (locked) {

            if (!element.disabled) {

                element.dataset
                    .operationLockManagedDisabled =
                    "true";

                element.disabled =
                    true;
            }

            return;
        }


        if (
            element.dataset
                .operationLockManagedDisabled ===
            "true"
        ) {

            element.disabled =
                false;

            delete element.dataset
                .operationLockManagedDisabled;
        }

    }


    function setNavigationLinksLocked(
        locked
    ) {

        document
            .querySelectorAll(
                "[data-easyfile-navigation]"
            )
            .forEach(
                link => {

                    setManagedInert(
                        link,
                        locked
                    );

                }
            );

    }


    function updateParametersState() {

        const fieldset =
            document.getElementById(
                "operationParametersFieldset"
            );


        if (!fieldset) {
            return;
        }


        const disabled =
            processingLocked ||
            fileCount === 0;


        fieldset.disabled =
            disabled;

        fieldset.setAttribute(
            "aria-disabled",
            disabled
                ? "true"
                : "false"
        );

    }


    function applyProcessingLock() {

        document.body.classList.toggle(
            "operation-interaction-locked",
            processingLocked
        );


        document
            .getElementById(
                "operation-zone"
            )
            ?.setAttribute(
                "aria-busy",
                processingLocked
                    ? "true"
                    : "false"
            );


        /*
         * Large interaction regions. `inert` is deliberately
         * used instead of changing every child `disabled`
         * property, so each operation keeps its own local UI
         * rules when the lock is released.
         */
        [
            document.getElementById(
                "upload-zone-container"
            ),
            /*
             * Do not make the whole file list inert: long lists
             * remain scrollable so local progress bars can still
             * be inspected. Click/drag actions inside the list are
             * blocked by the generic capture guards below.
             */
            document.querySelector(
                ".operation-top"
            ),
            /*
             * Fieldset.disabled covers standard form controls, while inert
             * also freezes custom interactive surfaces such as image
             * preview canvases used by Replace Colors and future tools.
             */
            document.querySelector(
                ".operation-parameters-content"
            ),
            document.getElementById(
                "downloadAllFormats"
            ),
            document.querySelector(
                ".more-operations"
            ),
            document.querySelector(
                ".site-header"
            ),
            document.querySelector(
                ".auth-bar"
            ),
            document.querySelector(
                ".site-footer"
            ),
            document.querySelector(
                ".operation-home"
            ),
            document.getElementById(
                "goBackBtn"
            )
        ].forEach(
            element => {

                setManagedInert(
                    element,
                    processingLocked
                );

            }
        );


        /*
         * Also covers format-guide links and any future
         * internal navigation carrying the generic marker.
         */
        setNavigationLinksLocked(
            processingLocked
        );


        /*
         * Clear All belongs to the file list rather than the
         * operation zone, so it is outside the inert regions
         * above. Disable it explicitly while processing. The
         * previous disabled state is restored afterwards.
         */
        setManagedDisabled(
            document.getElementById(
                "categoryClearAllBtn"
            ),
            processingLocked
        );


        updateParametersState();

    }


    function applyAll() {

        updateParametersState();
        applyProcessingLock();

    }


    function isAllowedWhileProcessing(
        target
    ) {

        return Boolean(
            target?.closest?.(
                "#pauseOperationBtn, " +
                "#cancelOperationBtn, " +
                "#goToTopBtn"
            )
        );

    }


    /*
     * Safety net for browsers/environments where `inert`
     * support is incomplete and for future interactive
     * controls that may be added outside the known regions.
     */
    document.addEventListener(
        "click",
        event => {

            if (
                !processingLocked ||
                isAllowedWhileProcessing(
                    event.target
                )
            ) {
                return;
            }


            const actionable =
                event.target?.closest?.(
                    "a, button, input, select, textarea, label, " +
                    "[contenteditable='true'], [draggable='true']"
                );


            if (!actionable) {
                return;
            }


            event.preventDefault();
            event.stopImmediatePropagation();

        },
        true
    );


    [
        "dragstart",
        "dragover",
        "drop"
    ].forEach(
        eventName => {

            document.addEventListener(
                eventName,
                event => {

                    if (!processingLocked) {
                        return;
                    }


                    const protectedRegion =
                        event.target?.closest?.(
                            "#upload-zone-container, .file-list-container"
                        );


                    if (!protectedRegion) {
                        return;
                    }


                    event.preventDefault();
                    event.stopImmediatePropagation();

                },
                true
            );

        }
    );




    /* =====================================================
       LEGACY / NON-CONTROLLER OPERATION EVENTS

       The Audio tools already expose precise controller
       states. Older Image/Video/Document operations still
       emit the shared started/ended lifecycle events, so
       listening to them makes the interaction policy truly
       generic today and future-proofs the migration path.
    ===================================================== */

    document.addEventListener(
        "easyfiletools:operation-started",
        () => {

            processingLocked =
                true;

            applyProcessingLock();

        }
    );


    document.addEventListener(
        "easyfiletools:operation-ended",
        () => {

            processingLocked =
                false;

            applyProcessingLock();

        }
    );


    document.addEventListener(
        "easyfiletools:operation-state-changed",
        event => {

            const detail =
                event.detail || {};


            if (
                operationId &&
                detail.operationId &&
                detail.operationId !==
                    operationId
            ) {
                return;
            }


            processingLocked =
                PROCESSING_STATUSES.has(
                    detail.status
                );


            applyProcessingLock();


            console.log(
                "[OPERATION LOCK] Processing lock:",
                processingLocked,
                detail.status || "unknown"
            );

        }
    );


    document.addEventListener(
        "easyfiletools:operation-files-updated",
        event => {

            const detail =
                event.detail || {};


            if (
                operationId &&
                detail.operation &&
                detail.operation !==
                    operationId
            ) {
                return;
            }


            fileCount =
                Array.isArray(
                    detail.files
                )
                    ? detail.files.length
                    : 0;


            applyAll();


            console.log(
                "[OPERATION LOCK] File count:",
                fileCount
            );

        }
    );


    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            fileCount =
                0;

            applyAll();

        }
    );


    window.EasyFileOperationInteractionLock =
        Object.freeze({

            isLocked() {

                return processingLocked;

            }

        });


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


            operationId =
                operationZone.dataset
                    .operation ||
                "";


            const controllerState =
                window
                    .EasyFileOperationController
                    ?.getState?.();


            processingLocked =
                PROCESSING_STATUSES.has(
                    controllerState?.status
                );


            applyAll();

        }
    );

})();
