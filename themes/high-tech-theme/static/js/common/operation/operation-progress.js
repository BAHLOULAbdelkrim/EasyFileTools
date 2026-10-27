console.log(
    "[OPERATION PROGRESS] operation-progress.js loaded"
);


/* =========================================
   OPERATION PROGRESS
========================================= */

(() => {

    let globalProgress =
        null;

    let globalProgressPercentage =
        null;

    let globalProgressLabel =
        null;

    let defaultLabel =
        "Progress";


    let state = {

        items:
            [],

        percentage:
            0,

        label:
            null

    };


    /* =========================================
       RENDER
    ========================================= */

    function render() {

        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        state.percentage
                    ) || 0
                )
            );


        if (globalProgress) {

            globalProgress.style.width =
                `${percentage}%`;

            globalProgress.classList.remove(
                "progress-shine"
            );

            void globalProgress.offsetWidth;

            globalProgress.classList.add(
                "progress-shine"
            );

            globalProgress.style.background =
                `linear-gradient(
                    to right,
                    var(--green-text),
                    var(--violet)
                )`;
        }


        if (globalProgressPercentage) {

            globalProgressPercentage.textContent =
                `${Math.round(
                    percentage
                )}%`;
        }


        if (globalProgressLabel) {

            globalProgressLabel.textContent =
                state.label ||
                defaultLabel;
        }
    }


    /* =========================================
       CALCULATE GLOBAL PROGRESS
    ========================================= */

    function calculateGlobalProgress() {

        if (
            state.items.length ===
            0
        ) {

            state.percentage =
                0;

            render();

            return;
        }


        const total =
            state.items.reduce(
                (sum, value) =>
                    sum + value,
                0
            );


        state.percentage =
            total /
            state.items.length;


        render();
    }


    /* =========================================
       SET ITEMS
    ========================================= */

    function setItems(
        count,
        initialValue = 0
    ) {

        const safeCount =
            Math.max(
                0,
                Number(count) || 0
            );


        const safeValue =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        initialValue
                    ) || 0
                )
            );


        state.items =
            Array.from(
                {
                    length:
                        safeCount
                },
                () =>
                    safeValue
            );


        calculateGlobalProgress();
    }


    /* =========================================
       SET ITEM PROGRESS
    ========================================= */

    function setItemProgress(
        index,
        percentage
    ) {

        if (
            !Number.isInteger(
                index
            ) ||
            index < 0 ||
            index >=
                state.items.length
        ) {

            return false;
        }


        state.items[index] =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        percentage
                    ) || 0
                )
            );


        calculateGlobalProgress();


        return true;
    }


    /* =========================================
       DIRECT GLOBAL PROGRESS
    ========================================= */

    function setProgress(
        percentage,
        label = null
    ) {

        state.percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        percentage
                    ) || 0
                )
            );


        if (
            label !== null
        ) {

            state.label =
                label;
        }


        render();
    }


    /* =========================================
       LABEL
    ========================================= */

    function setLabel(
        label
    ) {

        state.label =
            label || null;

        render();
    }


    /* =========================================
       COMPLETE
    ========================================= */

    function complete(
        label = null
    ) {

        state.items =
            state.items.map(
                () => 100
            );

        state.percentage =
            100;


        if (
            label !== null
        ) {

            state.label =
                label;
        }


        render();
    }


    /* =========================================
       RESET
    ========================================= */

    function reset() {

        state = {

            items:
                [],

            percentage:
                0,

            label:
                null

        };


        render();
    }


    /* =========================================
       GET STATE
    ========================================= */

    function getState() {

        return {

            items:
                [
                    ...state.items
                ],

            percentage:
                state.percentage,

            label:
                state.label

        };
    }


    /* =========================================
       INITIALIZE
    ========================================= */

    function initialize() {

        globalProgress =
            document.getElementById(
                "globalProgress"
            );

        globalProgressPercentage =
            document.getElementById(
                "globalProgressPercentage"
            );

        globalProgressLabel =
            document.getElementById(
                "globalProgressLabel"
            );


        defaultLabel =
            globalProgressLabel
                ?.textContent
                ?.trim() ||
            "Progress";


        console.log(
            "[OPERATION PROGRESS] Initialized"
        );


        return Boolean(
            globalProgress
        );
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.EasyFileOperationProgress =
        Object.freeze({

            initialize,

            setItems,

            setItemProgress,

            setProgress,

            setLabel,

            complete,

            reset,

            getState

        });


    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

})();