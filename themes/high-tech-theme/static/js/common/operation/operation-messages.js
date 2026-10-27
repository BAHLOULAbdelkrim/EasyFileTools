console.log(
    "[OPERATION MESSAGES] operation-messages.js loaded"
);


/* =========================================
   OPERATION MESSAGES
========================================= */

(() => {

    async function success(
        title =
            "Operation completed",
        message =
            "All files were processed successfully."
    ) {

        if (
            typeof showSuccessModal ===
            "function"
        ) {

            await showSuccessModal(
                title,
                message
            );

            return true;
        }


        console.log(
            `[SUCCESS] ${title}: ${message}`
        );

        return false;
    }


    function info(
        title,
        message
    ) {

        if (
            typeof showSuccessToast ===
            "function"
        ) {

            showSuccessToast(
                title,
                message,
                2500
            );

            return true;
        }


        console.log(
            `[INFO] ${title}: ${message}`
        );

        return false;
    }


    async function confirm(
        title,
        message
    ) {

        if (
            typeof showConfirmationModal ===
            "function"
        ) {

            return Boolean(
                await showConfirmationModal(
                    title,
                    message
                )
            );
        }


        return window.confirm(
            `${title}\n\n${message}`
        );
    }


    async function confirmReplaceResult(
        count = 1
    ) {

        const message =
            count === 1
                ? `
                    • Previous result not downloaded
                    • A new run will replace it
                    • Cancel to download it first.
                `
                : `
                    • ${count} previous results not downloaded
                    • A new run will replace them
                    • Cancel to download them first.
                `;


        return await confirm(
            "Replace previous result?",
            message
        );
    }


    async function noFiles() {

        return await confirm(
            "No file loaded",
            "Please add at least one file before starting the operation."
        );
    }


    async function invalidSettings() {

        return await confirm(
            "Invalid settings",
            "Please check the operation settings before starting."
        );
    }


    function operationError(
        error = null
    ) {

        const message =
            error?.message ||
            "The operation could not be completed.";


        console.error(
            "[OPERATION MESSAGES]",
            error
        );


        if (
            typeof showSuccessToast ===
            "function"
        ) {

            showSuccessToast(
                "Operation failed",
                message,
                3000
            );

            return true;
        }


        return false;
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.EasyFileOperationMessages =
        Object.freeze({

            success,

            info,

            confirm,

            confirmReplaceResult,

            noFiles,

            invalidSettings,

            operationError

        });

})();