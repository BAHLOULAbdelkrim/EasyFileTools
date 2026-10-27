console.log(
    "[COMPRESS PDF UI] compress-pdf-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "compressPdfSettings"
        );


    if (!root) {
        return;
    }


    const buttons =
        Array.from(
            root.querySelectorAll(
                "[data-pdf-compression]"
            )
        );


    const strong =
        document.getElementById(
            "compressPdfStrongSettings"
        );


    const quality =
        document.getElementById(
            "compressPdfQuality"
        );


    const qualityValue =
        document.getElementById(
            "compressPdfQualityValue"
        );


    const scale =
        document.getElementById(
            "compressPdfScale"
        );


    const keepSmaller =
        document.getElementById(
            "compressPdfKeepSmaller"
        );


    const validation =
        document.getElementById(
            "compressPdfValidation"
        );


    const state = {

        files: [],

        mode:
            "safe"

    };


    function getSettings() {

        if (
            state.files.length === 0 || !state.mode
        ) {

            return null;
        }


        return {

            mode:
                state.mode,

            quality:
                Number(
                    quality.value
                ) /
                100,

            scale:
                Number(
                    scale.value
                ),

            keepSmaller:
                keepSmaller.checked

        };

    }


    function render() {

        buttons.forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .pdfCompression ===
                        state.mode
                );

            }
        );


        strong.style.display =
            state.mode ===
            "strong"
                ? ""
                : "none";


        qualityValue.textContent =
            `${quality.value}%`;


        validation.textContent =
            state.files.length && state.mode
                ? `Ready to compress ${state.files.length} ${
                    state.files.length === 1
                        ? "PDF"
                        : "PDFs"
                }.`
                : state.files.length ? "Choose a compression preset." : "Load one or more PDF files.";


        validation.classList.toggle(
            "valid",
            Boolean(getSettings())
        );

    }


    function dispatch() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:compress-pdf-settings-changed",
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


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.mode =
                        button.dataset
                            .pdfCompression;


                    dispatch();

                    render();

                }
            );

        }
    );


    [
        quality,
        scale,
        keepSmaller
    ].forEach(
        element => {

            element.addEventListener(
                "input",
                () => {

                    dispatch();

                    render();

                }
            );

        }
    );


    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "compress-pdf") return;
        state.mode = null;
    });

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation ===
                "compress-pdf"
            ) {

                state.files =
                    event.detail.files ||
                    [];


                render();

                dispatch();

            }

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


    window.CompressPdfUI = {

        getSettings

    };


    sync();

})();