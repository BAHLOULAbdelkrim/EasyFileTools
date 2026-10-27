console.log(
    "[KEYBOARD NAVIGATION] keyboard-navigation.js loaded"
);


document.addEventListener(
    "keydown",
    event => {

        /* An open mobile category menu closes with Escape (native details
           already handles Enter, Space, pointer and touch). Do not swallow
           Escape if a dialog is in front. */
        if (event.key === "Escape") {
            const menu = document.querySelector(".eft-mobile-navigation[open]");
            if (menu && !document.querySelector("dialog[open]")) {
                menu.open = false;
                menu.querySelector("summary")?.focus();
                event.preventDefault();
            }
            return;
        }

        /* =========================================
           BACKSPACE ONLY
        ========================================= */

        if (
            event.key !==
            "Backspace"
        ) {
            return;
        }


        /* =========================================
           MODIFIER KEYS
        ========================================= */

        if (
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return;
        }


        const active =
            document.activeElement;


        if (!active) {
            return;
        }


        const tag =
            active.tagName
                ?.toLowerCase();


        /* =========================================
           FORM FIELDS
        ========================================= */

        if (
            tag === "input" ||
            tag === "textarea" ||
            tag === "select"
        ) {
            return;
        }


        /* =========================================
           CONTENTEDITABLE
        ========================================= */

        if (
            active.isContentEditable ||
            active.closest?.(
                '[contenteditable="true"]'
            )
        ) {
            return;
        }


        /* =========================================
           OPEN MODAL / DIALOG
        ========================================= */

        const openDialog =
            Array.from(
                document.querySelectorAll(
                    'dialog[open], [role="dialog"]'
                )
            )
            .some(
                element =>
                    element.getClientRects()
                        .length > 0
            );


        if (openDialog) {
            return;
        }


        /* =========================================
           EASYFILE TOOLS GO BACK
        ========================================= */

        const goBackBtn =
            document.getElementById(
                "goBackBtn"
            );


        /*
         * No controlled EasyFile Tools
         * back navigation on this page.
         */
        if (
            !goBackBtn ||
            goBackBtn.disabled
        ) {
            return;
        }


        event.preventDefault();


        /*
         * Important:
         * reuse the existing navigation system.
         *
         * navigation-guard.js remains responsible
         * for unsaved / undownloaded results,
         * workspace preservation and history.back().
         */
        goBackBtn.click();

    }
);