console.log(
    "[MERGE PDF UI] merge-pdf-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "mergePdfSettings"
        );


    if (!root) {
        return;
    }


    const filename =
        document.getElementById(
            "mergePdfFilename"
        );


    const validation =
        document.getElementById(
            "mergePdfValidation"
        );


    const result =
        document.getElementById(
            "mergePdfResult"
        );


    const resultName =
        document.getElementById(
            "mergePdfResultName"
        );


    const resultMeta =
        document.getElementById(
            "mergePdfResultMeta"
        );


    const state = {

        files: []

    };


    function normalizeName(
        value
    ) {

        let name =
            String(
                value || ""
            )
                .trim()
                .replace(
                    /[\\/:*?"<>|]+/g,
                    "_"
                );


        if (!name) {

            name =
                "merged.pdf";

        }


        if (
            !name
                .toLowerCase()
                .endsWith(
                    ".pdf"
                )
        ) {

            name +=
                ".pdf";

        }


        return name;

    }


    function getSettings() {

        if (
            state.files.length <
            2
        ) {

            return null;
        }


        return {

            filename:
                normalizeName(
                    filename.value
                )

        };

    }


    function render() {

        const settings =
            getSettings();


        validation.textContent =
            settings
                ? `Ready to merge ${state.files.length} PDF files.`
                : "Load at least two PDF files.";


        validation.classList.toggle(
            "valid",
            Boolean(settings)
        );

    }


    function dispatch() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:merge-pdf-settings-changed",
                {
                    detail: {

                        valid:
                            Boolean(settings),

                        settings

                    }
                }
            )
        );

    }


    filename.addEventListener(
        "input",
        () => {

            dispatch();

            render();

        }
    );


    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "merge-pdf"
            ) {

                return;
            }


            state.files =
                event.detail.files || [];


            render();

            dispatch();

        }

    );


    async function sync() {

        const data =
            await loadSelectedFiles();


        state.files =
            data?.files || [];


        render();

        dispatch();

    }


    window.MergePdfUI = {

        getSettings,


        showResult(
            data
        ) {

            resultName.textContent =
                data.outputName;


            resultMeta.textContent =
                `${data.pageCount} pages • ${formatFileSize(data.outputSize)}`;


            result.classList.remove(
                "hidden"
            );

        },


        clearResult() {

            result.classList.add(
                "hidden"
            );

        }

    };


    render();

    sync();

})();