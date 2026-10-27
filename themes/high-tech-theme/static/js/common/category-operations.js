console.log("category-operations.js loaded");


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /* =====================================================
           PAGE DE CATÉGORIE UNIQUEMENT
        ===================================================== */

        const currentSection =
            document.body.dataset.currentCategory || "";

        if (!currentSection) {
            return;
        }


        const categoryMap = {

            audio:
                "Audio",

            video:
                "Video",

            images:
                "Image",

            documents:
                "Document",

            presentations:
                "Presentation",

            spreadsheets:
                "Spreadsheet",

            "vector-graphics":
                "Vector",

            archives:
                "Archive",

            code:
                "Code",

            "cad-3d":
                "3D & CAD"

        };


        const currentCategory =
            categoryMap[currentSection];

        if (!currentCategory) {
            return;
        }


        const categoryClearAllBtn =
            document.getElementById(
                "categoryClearAllBtn"
            );


        /* =====================================================
           CLEAR ALL — ÉTAT DU BOUTON
        ===================================================== */

        async function updateCategoryClearAllButton() {

            if (!categoryClearAllBtn) {
                return;
            }


            const storedData =
                await loadSelectedFiles();


            const hasFiles =
                !!(
                    storedData &&
                    storedData.category ===
                        currentCategory &&
                    Array.isArray(
                        storedData.files
                    ) &&
                    storedData.files.length > 0
                );


            const interactionLocked =
                window
                    .EasyFileOperationInteractionLock
                    ?.isLocked?.() ===
                true;


            categoryClearAllBtn.disabled =
                !hasFiles ||
                interactionLocked;

            categoryClearAllBtn.classList.toggle(
                "active",
                hasFiles
            );
        }


        /* =====================================================
           CLEAR ALL — ACTION
        ===================================================== */

        if (categoryClearAllBtn) {

            categoryClearAllBtn.addEventListener(
                "click",
                async () => {

                    if (
                        window
                            .EasyFileOperationInteractionLock
                            ?.isLocked?.()
                    ) {
                        return;
                    }


                    if (
                        categoryClearAllBtn.disabled
                    ) {
                        return;
                    }


                    const operationZone =
                        document.getElementById(
                            "operation-zone"
                        );

                    const undownloadedCount =
                        operationZone
                            ? (
                                window
                                    .EasyFileOperationResults
                                    ?.getUndownloadedCount?.() ||
                                0
                            )
                            : 0;

                    const operationConfig =
                        operationZone
                            ? window
                                .EasyFileOperationConfig
                                ?.get?.(
                                    operationZone
                                        .dataset
                                        .operation ||
                                    ""
                                )
                            : null;

                    const hasDownloadAll =
                        operationConfig?.resultMode !==
                            "batch";


                    if (
                        undownloadedCount > 0 &&
                        hasDownloadAll &&
                        typeof showClearAllWarningModal ===
                            "function"
                    ) {

                        const action =
                            await showClearAllWarningModal(
                                "Processed files not downloaded",
                                "Some processed files have not been downloaded with <strong>Download All</strong>.<br><br>Clearing all files will permanently discard them."
                            );


                        if (action === "cancel") {
                            return;
                        }


                        if (action === "download") {

                            document.dispatchEvent(
                                new CustomEvent(
                                    "easyfiletools:download-all-requested"
                                )
                            );

                            return;
                        }


                        if (action !== "clear") {
                            return;
                        }
                    }
                    else {

                        const warningMessage =
                            undownloadedCount > 0
                                ? "A processed result has not been downloaded yet.<br><br>Clearing all files will permanently discard it."
                                : "Are you sure you want to remove <strong>all files</strong>?";

                        const confirmed =
                            await showConfirmationModal(
                                "Clear all files?",
                                warningMessage
                            );


                        if (!confirmed) {
                            return;
                        }
                    }


                    await clearStoredFiles({
                        category: currentCategory
                    });

                    await updateCategoryClearAllButton();


                    console.log(
                        "[CATEGORY OPERATIONS] All files cleared:",
                        currentCategory
                    );
                }
            );
        }


        /* =====================================================
           METTRE À JOUR LES OUTILS
        ===================================================== */

        async function updateCategoryOperations() {

            const storedData =
                await loadSelectedFiles();

            const fileCount =
                (
                    storedData &&
                    storedData.category ===
                        currentCategory
                )
                    ? storedData.files.length
                    : 0;


            const operations =
                FILE_OPERATIONS[
                    currentCategory
                ] || [];


            operations.forEach(
                operation => {

                    const links =
                        document.querySelectorAll(
                            `a[href="${operation.url}"]`
                        );


                    links.forEach(link => {

                        const minFiles =
                            operation.minFiles || 1;


                        /*
                         * Aucun fichier :
                         * tous les outils restent accessibles.
                         */

                        const disabled =
                            fileCount > 0 &&
                            fileCount < minFiles;


                        link.classList.toggle(
                            "operation-disabled",
                            disabled
                        );


                        if (disabled) {

                            link.setAttribute(
                                "aria-disabled",
                                "true"
                            );

                            link.dataset.disabledReason =
                                `Requires at least ${minFiles} files`;

                        }
                        else {

                            link.removeAttribute(
                                "aria-disabled"
                            );

                            delete link.dataset.disabledReason;

                        }

                    });

                }
            );

        }


        /* =====================================================
           BLOQUER LE CLIC SUR UN OUTIL INCOMPATIBLE
        ===================================================== */

        document.addEventListener(
            "click",
            event => {

                const link =
                    event.target.closest(
                        "a.operation-disabled"
                    );

                if (!link) {
                    return;
                }


                event.preventDefault();

                event.stopPropagation();


                const message =
                    link.dataset.disabledReason ||
                    "This operation is not available for the current files.";


                if (
                    typeof showToast ===
                    "function"
                ) {

                    showToast(message);

                }
                else {

                    console.log(
                        "[CATEGORY OPERATIONS]",
                        message
                    );
                }

            },
            true
        );


        /* =====================================================
           STORAGE CHANGED
        ===================================================== */

        document.addEventListener(
            "easyfiletools:storage-updated",
            () => {

                updateCategoryOperations();
                updateCategoryClearAllButton();

            }
        );


        document.addEventListener(
            "easyfiletools:files-cleared",
            () => {

                updateCategoryOperations();
                updateCategoryClearAllButton();

            }
        );


        /* =====================================================
           INITIALISATION
        ===================================================== */

        await updateCategoryOperations();
        await updateCategoryClearAllButton();

    }
);