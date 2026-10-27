/* Confirmation messages may use only simple emphasis and line breaks.
 * File names and all other text are inserted as text nodes, never parsed as HTML.
 */
function setSafeConfirmationMessage(element, message) {
    element.replaceChildren();
    let parent = element;
    for (const token of String(message ?? "").split(/(<br\s*\/?>|<\/?strong>)/gi)) {
        const tag = token.toLowerCase();
        if (/^<br\s*\/?>$/.test(tag)) element.appendChild(document.createElement("br"));
        else if (tag === "<strong>") {
            parent = document.createElement("strong");
            element.appendChild(parent);
        } else if (tag === "</strong>") parent = element;
        else if (token) parent.appendChild(document.createTextNode(token));
    }
}

console.log("common/confirmation-modal.js loaded");

/* =========================================================
   MODAL DE CONFIRMATION GÉNÉRIQUE
========================================================= */

function showConfirmationModal(
    title,
    message
) {

    return new Promise((resolve) => {

        const modal =
            document.getElementById(
                "confirmation-modal"
            );

        const titleElement =
            document.getElementById(
                "confirmation-modal-title"
            );

        const messageElement =
            document.getElementById(
                "confirmation-modal-message"
            );

        const cancelBtn =
            document.getElementById(
                "confirmation-modal-cancel"
            );

        const confirmBtn =
            document.getElementById(
                "confirmation-modal-confirm"
            );


        if (
            !modal ||
            !titleElement ||
            !messageElement ||
            !cancelBtn ||
            !confirmBtn
        ) {

            console.warn(
                "[CONFIRMATION MODAL] Elements unavailable"
            );

            resolve(false);

            return;

        }


        /* =================================================
           CONTENU
        ================================================= */

        titleElement.textContent =
            title;

        setSafeConfirmationMessage(messageElement, message);


        /* =================================================
           AFFICHER
        ================================================= */

        modal.classList.remove(
            "hidden"
        );


        /* =================================================
           SÉLECTION PAR DÉFAUT
        ================================================= */

        let selectedAction =
            "cancel";


        function updateSelection() {

            cancelBtn.classList.toggle(
                "active-focus",
                selectedAction === "cancel"
            );

            confirmBtn.classList.toggle(
                "active-focus",
                selectedAction === "confirm"
            );

        }


        updateSelection();


        /* =================================================
           TERMINER
        ================================================= */

        function closeModal(
            confirmed
        ) {

            modal.classList.add(
                "hidden"
            );

            document.removeEventListener(
                "keydown",
                handleKeydown
            );

            cancelBtn.removeEventListener(
                "click",
                handleCancel
            );

            confirmBtn.removeEventListener(
                "click",
                handleConfirm
            );

            resolve(
                confirmed
            );

        }


        /* =================================================
           CANCEL
        ================================================= */

        function handleCancel() {

            closeModal(
                false
            );

        }


        /* =================================================
           CONFIRM
        ================================================= */

        function handleConfirm() {

            closeModal(
                true
            );

        }


        /* =================================================
           CLAVIER
        ================================================= */

        function handleKeydown(event) {

            if (
                event.key === "Escape"
            ) {

                event.preventDefault();

                closeModal(
                    false
                );

                return;

            }


            if (
                event.key === "ArrowLeft"
            ) {

                event.preventDefault();

                selectedAction =
                    "cancel";

                updateSelection();

                return;

            }


            if (
                event.key === "ArrowRight"
            ) {

                event.preventDefault();

                selectedAction =
                    "confirm";

                updateSelection();

                return;

            }


            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                if (
                    selectedAction === "cancel"
                ) {

                    closeModal(
                        false
                    );

                }
                else {

                    closeModal(
                        true
                    );

                }

            }

        }


        /* =================================================
           ÉVÉNEMENTS
        ================================================= */

        cancelBtn.addEventListener(
            "click",
            handleCancel
        );

        confirmBtn.addEventListener(
            "click",
            handleConfirm
        );

        document.addEventListener(
            "keydown",
            handleKeydown
        );


        /* =================================================
           FOCUS
        ================================================= */

        cancelBtn.focus();

    });

}


/* =========================================================
   MODAL DE MESSAGE GÉNÉRIQUE
========================================================= */

function showMessageModal(
    type,
    title,
    message
) {

    return new Promise((resolve) => {

        const modal =
            document.getElementById(
                "confirmation-modal"
            );

        const box =
            modal?.querySelector(
                ".confirmation-modal-box"
            );

        const header =
            modal?.querySelector(
                ".confirmation-modal-header"
            );

        const titleElement =
            document.getElementById(
                "confirmation-modal-title"
            );

        const messageElement =
            document.getElementById(
                "confirmation-modal-message"
            );

        const cancelBtn =
            document.getElementById(
                "confirmation-modal-cancel"
            );

        const confirmBtn =
            document.getElementById(
                "confirmation-modal-confirm"
            );

        if (
            !modal ||
            !box ||
            !header ||
            !titleElement ||
            !messageElement ||
            !cancelBtn ||
            !confirmBtn
        ) {

            console.warn(
                "[MESSAGE MODAL] Elements unavailable"
            );

            resolve();

            return;
        }


        /* =================================================
           TYPES
        ================================================= */

        const modalTypes = {

            success: {
                icon: "circle-check",
                buttonText: "OK"
            },

            warning: {
                icon: "triangle-alert",
                buttonText: "OK"
            },

            error: {
                icon: "circle-x",
                buttonText: "OK"
            },

            info: {
                icon: "info",
                buttonText: "OK"
            }

        };


        const config =
            modalTypes[type] ||
            modalTypes.info;


        /* =================================================
           TYPE VISUEL
        ================================================= */

        box.classList.remove(
            "modal-success",
            "modal-warning",
            "modal-error",
            "modal-info"
        );

        box.classList.add(
            `modal-${type}`
        );


        /* =================================================
           CONTENU
        ================================================= */

        titleElement.textContent =
            title;

        setSafeConfirmationMessage(messageElement, message);


        /* =================================================
           ICÔNE
        ================================================= */

        const oldIcon =
            document.getElementById(
                "confirmation-modal-icon"
            );

        if (oldIcon) {

            oldIcon.outerHTML = `
                <i
                    id="confirmation-modal-icon"
                    data-lucide="${config.icon}"
                    class="confirmation-modal-icon"
                ></i>
            `;
        }

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                header
            );
        }
        else if (
            typeof lucide !==
            "undefined"
        ) {

            lucide.createIcons();
        }


        /* =================================================
           BOUTONS
        ================================================= */

        cancelBtn.classList.add(
            "hidden"
        );

        confirmBtn.innerHTML = `
            <i data-lucide="check"></i>
            ${config.buttonText}
        `;

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                confirmBtn
            );
        }


        /* =================================================
           AFFICHER
        ================================================= */

        modal.classList.remove(
            "hidden"
        );


        /* =================================================
           FERMER
        ================================================= */

        function closeMessageModal() {

            modal.classList.add(
                "hidden"
            );

            document.removeEventListener(
                "keydown",
                handleKeydown
            );

            confirmBtn.removeEventListener(
                "click",
                handleConfirm
            );

            cancelBtn.classList.remove(
                "hidden"
            );

            resolve();
        }


        function handleConfirm() {

            closeMessageModal();
        }


        function handleKeydown(event) {

            if (
                event.key === "Enter" ||
                event.key === "Escape"
            ) {

                event.preventDefault();

                closeMessageModal();
            }
        }


        confirmBtn.addEventListener(
            "click",
            handleConfirm
        );

        document.addEventListener(
            "keydown",
            handleKeydown
        );

        confirmBtn.focus();

    });
}


/* =========================================================
   RACCOURCIS
========================================================= */

function showSuccessModal(
    title,
    message
) {

    return showMessageModal(
        "success",
        title,
        message
    );
}

/* =========================================================
   CLEAR ALL WARNING MODAL
========================================================= */

function showClearAllWarningModal(
    title,
    message
) {

    return new Promise((resolve) => {

        const modal =
            document.getElementById(
                "confirmation-modal"
            );

        const box =
            modal?.querySelector(
                ".confirmation-modal-box"
            );

        const header =
            modal?.querySelector(
                ".confirmation-modal-header"
            );

        const titleElement =
            document.getElementById(
                "confirmation-modal-title"
            );

        const messageElement =
            document.getElementById(
                "confirmation-modal-message"
            );

        const cancelBtn =
            document.getElementById(
                "confirmation-modal-cancel"
            );

        const downloadBtn =
            document.getElementById(
                "confirmation-modal-download-all"
            );

        const confirmBtn =
            document.getElementById(
                "confirmation-modal-confirm"
            );


        if (
            !modal ||
            !box ||
            !header ||
            !titleElement ||
            !messageElement ||
            !cancelBtn ||
            !downloadBtn ||
            !confirmBtn
        ) {

            console.warn(
                "[CLEAR ALL WARNING MODAL] Elements unavailable"
            );

            resolve(
                "cancel"
            );

            return;
        }


        /* =========================
           VISUAL TYPE
        ========================= */

        box.classList.remove(
            "modal-success",
            "modal-error",
            "modal-info"
        );

        box.classList.add(
            "modal-warning"
        );


        /* =========================
           CONTENT
        ========================= */

        titleElement.textContent =
            title;

        setSafeConfirmationMessage(messageElement, message);


        /* =========================
           ICON
        ========================= */

        const oldIcon =
            document.getElementById(
                "confirmation-modal-icon"
            );

        if (oldIcon) {

            oldIcon.outerHTML = `
                <i
                    id="confirmation-modal-icon"
                    data-lucide="triangle-alert"
                    class="confirmation-modal-icon"
                ></i>
            `;
        }


        /* =========================
           BUTTONS
        ========================= */

        cancelBtn.classList.remove(
            "hidden"
        );

        downloadBtn.classList.remove(
            "hidden"
        );


        cancelBtn.innerHTML = `
            <i data-lucide="x"></i>
            Cancel
        `;


        downloadBtn.innerHTML = `
            <i data-lucide="download"></i>
            Download All
        `;


        confirmBtn.innerHTML = `
            <i data-lucide="trash-2"></i>
            Clear All
        `;


        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                header
            );

            createLocalIcons(
                cancelBtn
            );

            createLocalIcons(
                downloadBtn
            );

            createLocalIcons(
                confirmBtn
            );
        }
        else if (
            typeof lucide !==
            "undefined"
        ) {

            lucide.createIcons();
        }


        /* =========================
           SHOW
        ========================= */

        modal.classList.remove(
            "hidden"
        );


        /* =========================
           KEYBOARD SELECTION
        ========================= */

        let selectedAction =
            "cancel";


        function updateSelection() {

            cancelBtn.classList.toggle(
                "active-focus",
                selectedAction === "cancel"
            );

            downloadBtn.classList.toggle(
                "active-focus",
                selectedAction === "download"
            );

            confirmBtn.classList.toggle(
                "active-focus",
                selectedAction === "clear"
            );
        }


        updateSelection();


        /* =========================
           CLOSE
        ========================= */

        function closeModal(
            action
        ) {

            modal.classList.add(
                "hidden"
            );

            downloadBtn.classList.add(
                "hidden"
            );

            cancelBtn.classList.remove(
                "active-focus"
            );

            downloadBtn.classList.remove(
                "active-focus"
            );

            confirmBtn.classList.remove(
                "active-focus"
            );


            document.removeEventListener(
                "keydown",
                handleKeydown
            );

            cancelBtn.removeEventListener(
                "click",
                handleCancel
            );

            downloadBtn.removeEventListener(
                "click",
                handleDownload
            );

            confirmBtn.removeEventListener(
                "click",
                handleClear
            );


            resolve(
                action
            );
        }


        /* =========================
           ACTIONS
        ========================= */

        function handleCancel() {

            closeModal(
                "cancel"
            );
        }


        function handleDownload() {

            closeModal(
                "download"
            );
        }


        function handleClear() {

            closeModal(
                "clear"
            );
        }


        /* =========================
           KEYBOARD
        ========================= */

        function handleKeydown(event) {

            if (
                event.key === "Escape"
            ) {

                event.preventDefault();

                closeModal(
                    "cancel"
                );

                return;
            }


            if (
                event.key === "ArrowLeft"
            ) {

                event.preventDefault();


                if (
                    selectedAction === "clear"
                ) {

                    selectedAction =
                        "download";
                }
                else {

                    selectedAction =
                        "cancel";
                }


                updateSelection();

                return;
            }


            if (
                event.key === "ArrowRight"
            ) {

                event.preventDefault();


                if (
                    selectedAction === "cancel"
                ) {

                    selectedAction =
                        "download";
                }
                else {

                    selectedAction =
                        "clear";
                }


                updateSelection();

                return;
            }


            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                closeModal(
                    selectedAction
                );
            }
        }


        /* =========================
           EVENTS
        ========================= */

        cancelBtn.addEventListener(
            "click",
            handleCancel
        );

        downloadBtn.addEventListener(
            "click",
            handleDownload
        );

        confirmBtn.addEventListener(
            "click",
            handleClear
        );

        document.addEventListener(
            "keydown",
            handleKeydown
        );


        cancelBtn.focus();

    });
}

/* =========================================================
   NAVIGATION WARNING MODAL
========================================================= */

function showNavigationWarningModal(
    title,
    message
) {

    return new Promise((resolve) => {

        const modal =
            document.getElementById(
                "confirmation-modal"
            );

        const box =
            modal?.querySelector(
                ".confirmation-modal-box"
            );

        const header =
            modal?.querySelector(
                ".confirmation-modal-header"
            );

        const titleElement =
            document.getElementById(
                "confirmation-modal-title"
            );

        const messageElement =
            document.getElementById(
                "confirmation-modal-message"
            );

        const cancelBtn =
            document.getElementById(
                "confirmation-modal-cancel"
            );

        const downloadBtn =
            document.getElementById(
                "confirmation-modal-download-all"
            );

        const confirmBtn =
            document.getElementById(
                "confirmation-modal-confirm"
            );


        if (
            !modal ||
            !box ||
            !header ||
            !titleElement ||
            !messageElement ||
            !cancelBtn ||
            !downloadBtn ||
            !confirmBtn
        ) {

            console.warn(
                "[NAVIGATION WARNING MODAL] Elements unavailable"
            );

            resolve(
                "stay"
            );

            return;
        }


        /* =========================
           VISUAL TYPE
        ========================= */

        box.classList.remove(
            "modal-success",
            "modal-error",
            "modal-info",
            "modal-navigation"
        );

        box.classList.add(
            "modal-warning",
            "modal-navigation"
        );


        /* =========================
           CONTENT
        ========================= */

        titleElement.textContent =
            title;

        setSafeConfirmationMessage(messageElement, message);


        /* =========================
           ICON
        ========================= */

        const oldIcon =
            document.getElementById(
                "confirmation-modal-icon"
            );

        if (oldIcon) {

            oldIcon.outerHTML = `
                <i
                    id="confirmation-modal-icon"
                    data-lucide="triangle-alert"
                    class="confirmation-modal-icon"
                ></i>
            `;
        }


        /* =========================
           BUTTONS
        ========================= */

        cancelBtn.classList.remove(
            "hidden"
        );

        downloadBtn.classList.remove(
            "hidden"
        );

        cancelBtn.innerHTML = `
            <i data-lucide="pause"></i>
            Stay on this page
        `;

        downloadBtn.innerHTML = `
            <i data-lucide="download"></i>
            Download All
        `;

        confirmBtn.innerHTML = `
            <i data-lucide="x"></i>
            Leave without downloading
        `;

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                header
            );

            createLocalIcons(
                cancelBtn
            );

            createLocalIcons(
                downloadBtn
            );

            createLocalIcons(
                confirmBtn
            );
        }
        else if (
            typeof lucide !==
            "undefined"
        ) {

            lucide.createIcons();
        }


        /* =========================
           SHOW
        ========================= */

        modal.classList.remove(
            "hidden"
        );


        /* =========================
           KEYBOARD SELECTION
        ========================= */

        let selectedAction =
            "stay";


        function updateSelection() {

            cancelBtn.classList.toggle(
                "active-focus",
                selectedAction === "stay"
            );

            downloadBtn.classList.toggle(
                "active-focus",
                selectedAction === "download"
            );

            confirmBtn.classList.toggle(
                "active-focus",
                selectedAction === "leave"
            );
        }


        updateSelection();


        /* =========================
           CLOSE
        ========================= */

        function closeModal(
            action
        ) {

            modal.classList.add(
                "hidden"
            );

            downloadBtn.classList.add(
                "hidden"
            );

            cancelBtn.classList.remove(
                "active-focus"
            );

            downloadBtn.classList.remove(
                "active-focus"
            );

            confirmBtn.classList.remove(
                "active-focus"
            );


            document.removeEventListener(
                "keydown",
                handleKeydown
            );

            cancelBtn.removeEventListener(
                "click",
                handleStay
            );

            downloadBtn.removeEventListener(
                "click",
                handleDownload
            );

            confirmBtn.removeEventListener(
                "click",
                handleLeave
            );

            box.classList.remove(
                "modal-navigation"
            );

            resolve(
                action
            );
        }


        /* =========================
           ACTIONS
        ========================= */

        function handleStay() {

            closeModal(
                "stay"
            );
        }


        function handleDownload() {

            closeModal(
                "download"
            );
        }


        function handleLeave() {

            closeModal(
                "leave"
            );
        }


        /* =========================
           KEYBOARD
        ========================= */

        function handleKeydown(event) {

            if (
                event.key === "Escape"
            ) {

                event.preventDefault();

                closeModal(
                    "stay"
                );

                return;
            }


            if (
                event.key === "ArrowLeft"
            ) {

                event.preventDefault();

                if (
                    selectedAction === "leave"
                ) {

                    selectedAction =
                        "download";
                }
                else {

                    selectedAction =
                        "stay";
                }

                updateSelection();

                return;
            }


            if (
                event.key === "ArrowRight"
            ) {

                event.preventDefault();

                if (
                    selectedAction === "stay"
                ) {

                    selectedAction =
                        "download";
                }
                else {

                    selectedAction =
                        "leave";
                }

                updateSelection();

                return;
            }


            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                closeModal(
                    selectedAction
                );
            }
        }


        /* =========================
           EVENTS
        ========================= */

        cancelBtn.addEventListener(
            "click",
            handleStay
        );

        downloadBtn.addEventListener(
            "click",
            handleDownload
        );

        confirmBtn.addEventListener(
            "click",
            handleLeave
        );

        document.addEventListener(
            "keydown",
            handleKeydown
        );


        cancelBtn.focus();

    });
}

/* =========================================================
   NOTIFICATION TOAST GÉNÉRIQUE
========================================================= */

let notificationToastTimer =
    null;


function showToast(
    type,
    title,
    message,
    duration = 2000
) {

    const toast =
        document.getElementById(
            "notification-toast"
        );

    const titleElement =
        document.getElementById(
            "notification-toast-title"
        );

    const messageElement =
        document.getElementById(
            "notification-toast-message"
        );

    if (
        !toast ||
        !titleElement ||
        !messageElement
    ) {

        console.warn(
            "[NOTIFICATION TOAST] Elements unavailable"
        );

        return;
    }


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const toastTypes = {

        success: {
            icon: "circle-check"
        },

        info: {
            icon: "info"
        },

        warning: {
            icon: "triangle-alert"
        },

        error: {
            icon: "circle-x"
        }

    };


    const config =
        toastTypes[type] ||
        toastTypes.info;


    /* =====================================================
       ANNULER UN ANCIEN TIMER
    ===================================================== */

    if (notificationToastTimer) {

        clearTimeout(
            notificationToastTimer
        );

        notificationToastTimer =
            null;
    }


    /* =====================================================
       TYPE VISUEL
    ===================================================== */

    toast.classList.remove(
        "toast-success",
        "toast-info",
        "toast-warning",
        "toast-error"
    );

    toast.classList.add(
        `toast-${type}`
    );


    /* =====================================================
       CONTENU
    ===================================================== */

    titleElement.textContent =
        title;

    messageElement.textContent =
        message;


    /* =====================================================
       ICÔNE
    ===================================================== */

    const oldIcon =
        document.getElementById(
            "notification-toast-icon"
        );

    if (oldIcon) {

        oldIcon.outerHTML = `
            <i
                id="notification-toast-icon"
                data-lucide="${config.icon}"
                class="notification-toast-icon"
            ></i>
        `;
    }


    if (
        typeof createLocalIcons ===
        "function"
    ) {

        createLocalIcons(
            toast
        );
    }
    else if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();
    }


    /* =====================================================
       AFFICHAGE
    ===================================================== */

    toast.classList.remove(
        "hidden"
    );


    /* =====================================================
       DISPARITION AUTOMATIQUE
    ===================================================== */

    notificationToastTimer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

                notificationToastTimer =
                    null;

            },
            duration
        );
}


/* =========================================================
   RACCOURCIS
========================================================= */

function showSuccessToast(
    title,
    message,
    duration = 2000
) {

    showToast(
        "success",
        title,
        message,
        duration
    );
}