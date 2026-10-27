console.log(
    "[NAVIGATION GUARD] navigation-guard.js loaded"
);

window.easyFileToolsNavigationApproved =
    false;

/* =========================
   NAVIGATION GUARD
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* =========================
           CURRENT CONTEXT
        ========================= */

        const currentCategory =
            document.body.dataset.currentCategory ||
            "";

        const operationZone =
            document.getElementById(
                "operation-zone"
            );

        const currentOperation =
            operationZone?.dataset.operation ||
            "";

        /* =========================
           INTERNAL NAVIGATION HISTORY
        ========================= */

        const NAVIGATION_STACK_KEY =
            "easyfiletools-navigation-stack";


        function loadNavigationStack() {

            try {

                const stored =
                    sessionStorage.getItem(
                        NAVIGATION_STACK_KEY
                    );


                if (!stored) {
                    return [];
                }


                const parsed =
                    JSON.parse(
                        stored
                    );


                return Array.isArray(parsed)
                    ? parsed
                    : [];

            } catch (error) {

                console.warn(
                    "[NAVIGATION GUARD] Unable to load navigation stack:",
                    error
                );


                return [];
            }
        }


        function saveNavigationStack(
            stack
        ) {

            try {

                sessionStorage.setItem(
                    NAVIGATION_STACK_KEY,
                    JSON.stringify(
                        stack
                    )
                );

            } catch (error) {

                console.warn(
                    "[NAVIGATION GUARD] Unable to save navigation stack:",
                    error
                );
            }
        }


        function getCurrentPageUrl() {

            return (
                window.location.pathname +
                window.location.search +
                window.location.hash
            );
        }


        function rememberCurrentPage() {

            const stack =
                loadNavigationStack();


            const currentUrl =
                getCurrentPageUrl();


            /*
             * Prevent accidental duplicates.
             */

            if (
                stack[
                    stack.length - 1
                ] !== currentUrl
            ) {

                stack.push(
                    currentUrl
                );

            }


            saveNavigationStack(
                stack
            );


            console.log(
                "[NAVIGATION GUARD] Page remembered:",
                currentUrl,
                stack
            );
        }


        function getPreviousInternalPage() {

            const stack =
                loadNavigationStack();


            if (
                stack.length === 0
            ) {
                return null;
            }


            return stack[
                stack.length - 1
            ];
        }


        function removePreviousInternalPage() {

            const stack =
                loadNavigationStack();


            if (
                stack.length === 0
            ) {
                return null;
            }


            const previousPage =
                stack.pop();


            saveNavigationStack(
                stack
            );


            return previousPage;
        }


        function getCategoryFromInternalUrl(
            relativeUrl
        ) {

            if (!relativeUrl) {
                return "";
            }


            try {

                const url =
                    new URL(
                        relativeUrl,
                        window.location.origin
                    );


                const parts =
                    url.pathname
                        .split("/")
                        .filter(Boolean);


                if (
                    parts.length === 0
                ) {
                    return "";
                }


                return parts[0];

            } catch (error) {

                console.warn(
                    "[NAVIGATION GUARD] Unable to read previous page category:",
                    error
                );


                return "";
            }
        }

        /* =========================
           GO BACK BUTTON STATE
        ========================= */

        const goBackBtn =
            document.getElementById(
                "goBackBtn"
            );


        function updateGoBackButtonState() {

            if (!goBackBtn) {
                return;
            }


            const previousPage =
                getPreviousInternalPage();


            const enabled =
                Boolean(
                    previousPage
                );


            goBackBtn.disabled =
                !enabled;


            goBackBtn.setAttribute(
                "aria-disabled",
                enabled
                    ? "false"
                    : "true"
            );


            console.log(
                "[NAVIGATION GUARD] Go back enabled:",
                enabled
            );
        }


        updateGoBackButtonState();



        console.log(
            "[NAVIGATION GUARD] Current context:",
            {
                category:
                    currentCategory,

                operation:
                    currentOperation
            }
        );


        /* =========================
           NAVIGATION LINKS
        ========================= */

        /* =========================
        GET OPERATION STATE
        ========================= */

        function getOperationState() {

            let operationState =
                null;

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:operation-state-requested",
                    {
                        detail: {

                            respond:
                                state => {

                                    operationState =
                                        state;
                                }
                        }
                    }
                )
            );

            return operationState;
        }  
        
        /* =========================
        CLASSIFY NAVIGATION
        ========================= */

        function classifyNavigation(
            currentCategory,
            targetCategory
        ) {

            if (!targetCategory) {
                return "homepage";
            }

            if (
                currentCategory &&
                currentCategory === targetCategory
            ) {
                return "same-category";
            }

            return "different-category";
        }

        /* =========================
        WORKSPACE CATEGORY
        ========================= */

        const storageCategoryByTarget = {

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


        /* =========================
        PREPARE WORKSPACE
        ========================= */

        async function prepareWorkspaceForNavigation(
            targetCategory
        ) {

            /*
            * Homepage is neutral:
            * keep the current workspace.
            */

            if (!targetCategory) {
                return;
            }


            if (
                typeof loadSelectedFiles !==
                "function"
            ) {
                return;
            }


            const storedData =
                await loadSelectedFiles();


            if (
                !storedData ||
                !storedData.files ||
                storedData.files.length === 0
            ) {
                return;
            }


            const storedCategory =
                storedData.category || "";


            const expectedCategory =
                storageCategoryByTarget[
                    targetCategory
                ] || "";


            /*
            * Unknown destination:
            * do not destroy anything.
            */

            if (!expectedCategory) {

                console.warn(
                    "[NAVIGATION GUARD] Unknown target category:",
                    targetCategory
                );

                return;
            }


            /*
            * Same workspace category:
            * keep source files.
            */

            if (
                storedCategory ===
                expectedCategory
            ) {

                console.log(
                    "[NAVIGATION GUARD] Workspace preserved:",
                    storedCategory
                );

                return;
            }


            /*
            * Different category:
            * destroy previous workspace.
            */

            if (
                typeof clearStoredFiles ===
                "function"
            ) {

                await clearStoredFiles();

                console.log(
                    "[NAVIGATION GUARD] Workspace cleared:",
                    storedCategory,
                    "→",
                    expectedCategory
                );
            }
        }

        /* =========================
        CHECK PROTECTION NEED
        ========================= */

        function needsNavigationProtection(
            navigationType,
            operationState
        ) {

            if (!operationState) {
                return false;
            }

            return (
                operationState.hasOutputFiles === true &&
                operationState.downloadAllCompleted !== true
            );
        }

        /* =========================
        OBSERVE NAVIGATION
        ========================= */

        document.addEventListener(
            "click",
            async (event) => {

                const link =
                    event.target.closest(
                        "[data-easyfile-navigation]"
                    );

                if (!link) {
                    return;
                }

                const targetCategory =
                    link.dataset.targetCategory ||
                    "";

                const targetUrl =
                    link.href ||
                    "";

                const operationState =
                    getOperationState();

                const navigationType =
                    classifyNavigation(
                        currentCategory,
                        targetCategory
                    );

                const needsProtection =
                    needsNavigationProtection(
                        navigationType,
                        operationState
                    );

                console.log(
                    "[NAVIGATION GUARD] Navigation type:",
                    navigationType
                );

                console.log(
                    "[NAVIGATION GUARD] Needs protection:",
                    needsProtection
                );

                console.log(
                    "[NAVIGATION GUARD] Navigation detected:",
                    {
                        fromCategory:
                            currentCategory,

                        fromOperation:
                            currentOperation,

                        targetCategory:
                            targetCategory,

                        targetUrl:
                            targetUrl
                    }
                );

                console.log(
                    "[NAVIGATION GUARD] Operation state:",
                    operationState
                );

                if (!needsProtection) {

                    /*
                    * Homepage:
                    * preserve workspace and allow
                    * normal navigation.
                    */

                    if (!targetCategory) {

                        rememberCurrentPage();

                        return;
                    }


                    /*
                    * Category/tool navigation:
                    * check workspace before leaving.
                    */

                    event.preventDefault();

                    await prepareWorkspaceForNavigation(
                        targetCategory
                    );

                    rememberCurrentPage();

                    window.easyFileToolsNavigationApproved =
                        true;

                    window.location.href =
                        targetUrl;

                    return;
                }

                event.preventDefault();

                const action =
                    await showNavigationWarningModal(
                        "Processed files not downloaded",
                        "Some processed files have not been downloaded. What would you like to do before leaving this page?"
                    );

                console.log(
                    "[NAVIGATION GUARD] Protected navigation action:",
                    action
                );

                if (
                    action === "leave"
                ) {

                    await prepareWorkspaceForNavigation(
                        targetCategory
                    );

                    rememberCurrentPage();

                    window.easyFileToolsNavigationApproved =
                        true;

                    window.location.href =
                        targetUrl;

                    return;
                }

                if (
                    action === "download"
                ) {

                    document.dispatchEvent(
                        new CustomEvent(
                            "easyfiletools:download-all-requested"
                        )
                    );

                    return;
                }
            }
        );

        /* =========================
           GO BACK
        ========================= */

        if (goBackBtn) {

            goBackBtn.addEventListener(
                "click",
                async () => {

                    if (
                        goBackBtn.disabled
                    ) {
                        return;
                    }


                    const previousPage =
                        getPreviousInternalPage();


                    if (!previousPage) {

                        updateGoBackButtonState();

                        return;
                    }


                    const targetCategory =
                        getCategoryFromInternalUrl(
                            previousPage
                        );


                    const operationState =
                        getOperationState();


                    const needsProtection =
                        needsNavigationProtection(
                            "previous-page",
                            operationState
                        );


                    console.log(
                        "[NAVIGATION GUARD] Go back requested:",
                        {
                            previousPage,
                            targetCategory,
                            needsProtection
                        }
                    );


                    /* =========================
                       GO BACK NOW
                    ========================= */

                    const performGoBack =
                        async () => {

                            await prepareWorkspaceForNavigation(
                                targetCategory
                            );


                            const targetUrl =
                                removePreviousInternalPage();


                            if (!targetUrl) {

                                updateGoBackButtonState();

                                return;
                            }


                            window.easyFileToolsNavigationApproved =
                                true;


                            window.location.href =
                                targetUrl;
                        };


                    /* =========================
                       NO PROTECTION
                    ========================= */

                    if (
                        !needsProtection
                    ) {

                        await performGoBack();

                        return;
                    }


                    /* =========================
                       PROTECTION
                    ========================= */

                    const action =
                        await showNavigationWarningModal(
                            "Processed files not downloaded",
                            "Some processed files have not been downloaded. What would you like to do before leaving this page?"
                        );


                    if (
                        action ===
                        "leave"
                    ) {

                        await performGoBack();

                        return;
                    }


                    if (
                        action ===
                        "download"
                    ) {

                        document.dispatchEvent(
                            new CustomEvent(
                                "easyfiletools:download-all-requested"
                            )
                        );

                        return;
                    }

                }
            );
        }

    }
);