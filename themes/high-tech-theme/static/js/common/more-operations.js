console.log("more-operations.js loaded");


document.addEventListener(
    "DOMContentLoaded",
    () => {

        const containers =
            document.querySelectorAll(
                ".more-operations"
            );

        /* =====================================================
        CORRESPONDANCE CATÉGORIE → SLUG DE NAVIGATION
        ===================================================== */

        const categorySlugMap = {

            Audio:
                "audio",

            Video:
                "video",

            Image:
                "images",

            Document:
                "documents",

            Presentation:
                "presentations",

            Spreadsheet:
                "spreadsheets",

            Vector:
                "vector-graphics",

            Archive:
                "archives",

            Code:
                "code",

            "3D & CAD":
                "cad-3d"

        };

        containers.forEach(
            container => {

                const category =
                    container.dataset.category;

                const currentOperation =
                    container.dataset.currentOperation;

                const targetCategory =
                    categorySlugMap[category] || "";

                const list =
                    container.querySelector(
                        ".more-operations-list"
                    );


                if (
                    !category ||
                    !currentOperation ||
                    !list
                ) {
                    return;
                }


                const operations =
                    FILE_OPERATIONS[
                        category
                    ] || [];


                const availableOperations =
                    operations.filter(
                        operation =>
                            operation &&
                            operation.id !== currentOperation &&
                            operation.kind !== "guide" &&
                            operation.isGuide !== true &&
                            window.EasyFilePolicy?.supported?.has(operation.id) === true
                    );


                /* =====================================================
                AFFICHAGE DES OPÉRATIONS
                ===================================================== */

                function renderOperations(
                    expanded = false
                ) {

                    list.innerHTML = "";


                    const operationsToDisplay =
                        expanded
                            ? availableOperations
                            : availableOperations.slice(
                                0,
                                4
                            );


                    operationsToDisplay.forEach(
                        operation => {

                            const link =
                                document.createElement(
                                    "a"
                                );


                            link.className =
                                "more-operation-btn";

                            link.href =
                                operation.url;


                            link.innerHTML = `

                                <i
                                    data-lucide="${operation.icon}">
                                </i>

                                <span>
                                    ${operation.name}
                                </span>

                            `;


                            /* =============================================
                            NAVIGATION PROTÉGÉE
                            ============================================= */

                            link.setAttribute(
                                "data-easyfile-navigation",
                                ""
                            );

                            link.setAttribute(
                                "data-target-category",
                                targetCategory
                            );

                            /* =============================================
                            COMPATIBILITÉ AVEC LES FICHIERS CHARGÉS
                            ============================================= */

                            const minFiles =
                                operation.minFiles || 1;

                            loadSelectedFiles().then(
                                storedData => {

                                    const fileCount =
                                        (
                                            storedData &&
                                            storedData.category === category
                                        )
                                            ? storedData.files.length
                                            : 0;


                                    /*
                                    * Comme sur la page de catégorie :
                                    *
                                    * 0 fichier
                                    * → outil accessible
                                    *
                                    * 1+ fichier
                                    * → minFiles doit être respecté
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

                                }
                            );

                            /* =============================================
                            BLOQUER UNE OPÉRATION INCOMPATIBLE
                            ============================================= */

                            link.addEventListener(
                                "click",
                                event => {

                                    if (
                                        !link.classList.contains(
                                            "operation-disabled"
                                        )
                                    ) {
                                        return;
                                    }


                                    event.preventDefault();

                                    event.stopImmediatePropagation();


                                    const message =
                                        link.dataset.disabledReason ||
                                        "This operation is not available for the current files.";


                                    if (
                                        typeof showToast ===
                                        "function"
                                    ) {

                                        showToast(message);

                                    }

                                },
                                true
                            );                            

                            list.appendChild(
                                link
                            );                            

                        }
                    );


                    /* =================================================
                    BOUTON DÉPLIER / REPLIER
                    ================================================= */

                    if (
                        availableOperations.length >
                        4
                    ) {

                        const toggleButton =
                            document.createElement(
                                "button"
                            );


                        toggleButton.type =
                            "button";

                        toggleButton.className =
                            "more-operation-btn more-operations-toggle";


                        if (expanded) {

                            toggleButton.innerHTML = `

                                <i
                                    data-lucide="chevrons-left">
                                </i>

                                <span>
                                    Reduce
                                </span>

                            `;

                        }
                        else {

                            toggleButton.innerHTML = `

                                <span>
                                    More
                                </span>

                                <i
                                    data-lucide="chevrons-right">
                                </i>

                            `;

                        }


                        toggleButton.addEventListener(
                            "click",
                            () => {

                                renderOperations(
                                    !expanded
                                );

                            }
                        );


                        list.appendChild(
                            toggleButton
                        );

                    }


                    createLocalIcons(
                        container
                    );

                }


                /* =====================================================
                AFFICHAGE INITIAL
                ===================================================== */

                renderOperations(false);


                createLocalIcons(
                    container
                );

            }
        );

    }
);