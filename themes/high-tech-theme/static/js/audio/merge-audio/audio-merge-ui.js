console.log(
    "[MERGE AUDIO UI] audio-merge-ui.js loaded"
);


/* =========================================================
   MERGE AUDIO UI
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       ROOT
    ===================================================== */

    const root =
        document.getElementById(
            "mergeAudioEditor"
        );


    if (!root) {
        return;
    }


    /* =====================================================
       DOM
    ===================================================== */

    const elements = {

        counter:
            document.getElementById(
                "mergeAudioCounter"
            ),

        resetOrderBtn:
            document.getElementById(
                "mergeAudioResetOrderBtn"
            ),

        empty:
            document.getElementById(
                "mergeAudioEmpty"
            ),

        list:
            document.getElementById(
                "mergeAudioList"
            ),

        transitionButtons:
            Array.from(
                root.querySelectorAll(
                    "[data-merge-transition]"
                )
            ),

        crossfadeSettings:
            document.getElementById(
                "mergeAudioCrossfadeSettings"
            ),

        crossfadeDuration:
            document.getElementById(
                "mergeAudioCrossfadeDuration"
            ),

        silenceSettings:
            document.getElementById(
                "mergeAudioSilenceSettings"
            ),

        silenceDuration:
            document.getElementById(
                "mergeAudioSilenceDuration"
            ),

        fadeInEnabled:
            document.getElementById(
                "mergeAudioFadeInEnabled"
            ),

        fadeInDuration:
            document.getElementById(
                "mergeAudioFadeInDuration"
            ),

        fadeOutEnabled:
            document.getElementById(
                "mergeAudioFadeOutEnabled"
            ),

        fadeOutDuration:
            document.getElementById(
                "mergeAudioFadeOutDuration"
            ),

        outputFormat:
            document.getElementById(
                "mergeAudioOutputFormat"
            ),

        formatHelp:
            document.getElementById(
                "mergeAudioFormatHelp"
            ),

        estimatedDuration:
            document.getElementById(
                "mergeAudioEstimatedDuration"
            ),

        validation:
            document.getElementById(
                "mergeAudioValidation"
            ),

        result:
            document.getElementById(
                "mergeAudioResult"
            ),

        resultName:
            document.getElementById(
                "mergeAudioResultName"
            ),

        resultSize:
            document.getElementById(
                "mergeAudioResultSize"
            ),

        resultDownloadBtn:
            document.getElementById(
                "mergeAudioResultDownloadBtn"
            )

    };


    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        records:
            [],

        originalOrder:
            [],

        durationCache:
            new Map(),

        transition:
            "none",

        crossfadeDuration:
            1,

        silenceDuration:
            0.5,

        fadeInEnabled:
            false,

        fadeInDuration:
            1,

        fadeOutEnabled:
            false,

        fadeOutDuration:
            1,

        outputFormat:
            "same",

        /*
        * User preference is kept separately from the
        * currently applicable value. This lets Merge
        * default to Same as source when possible, fall
        * back to MP3 for mixed inputs, and automatically
        * return to the user's preferred choice when the
        * file set becomes compatible again.
        */
        outputFormatPreference:
            "same",

        locked:
            window
                .EasyFileOperationController
                ?.isSettingsLocked?.() ===
            true,

        dragKey:
            null,

        previewAudio:
            new Audio(),

        previewKey:
            null,

        previewUrl:
            null,

    };


    state.previewAudio.preload =
        "metadata";


    /* =====================================================
       FILE HELPERS
    ===================================================== */

    function extractFile(
        entry
    ) {

        if (!entry) {
            return null;
        }


        if (
            typeof File !==
                "undefined" &&
            entry instanceof File
        ) {

            return entry;
        }


        return (
            entry.file ||
            entry.originalFile ||
            entry.sourceFile ||
            entry.inputFile ||
            null
        );

    }


    function createFileKey(
        file
    ) {

        return [
            file.name,
            file.size,
            file.lastModified || 0
        ].join("::");

    }


    function getExtension(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        if (
            dot === -1 ||
            dot ===
                filename.length - 1
        ) {

            return "";
        }


        return filename
            .slice(dot + 1)
            .toLowerCase();

    }


    function getCommonExtension() {

        if (
            state.records.length === 0
        ) {
            return "";
        }


        const extensions =
            state.records.map(
                record =>
                    getExtension(
                        record.file.name
                    )
            );


        const first =
            extensions[0];


        if (!first) {
            return "";
        }


        return extensions.every(
            extension =>
                extension === first
        )
            ? first
            : "";

    }


    /* =====================================================
       FORMAT
    ===================================================== */

    function formatFileSize(
        bytes
    ) {

        const size =
            Number(bytes) || 0;


        if (
            size < 1024
        ) {
            return `${size} B`;
        }


        if (
            size <
            1024 * 1024
        ) {

            return `${
                (
                    size /
                    1024
                ).toFixed(1)
            } KB`;

        }


        return `${
            (
                size /
                (
                    1024 *
                    1024
                )
            ).toFixed(1)
        } MB`;

    }


    function formatDuration(
        seconds
    ) {

        if (
            !Number.isFinite(seconds) ||
            seconds < 0
        ) {

            return "—";
        }


        const rounded =
            Math.round(
                seconds
            );


        const hours =
            Math.floor(
                rounded / 3600
            );


        const minutes =
            Math.floor(
                (
                    rounded % 3600
                ) /
                60
            );


        const secs =
            rounded % 60;


        if (
            hours > 0
        ) {

            return (
                `${hours}:` +
                `${String(minutes).padStart(2, "0")}:` +
                `${String(secs).padStart(2, "0")}`
            );

        }


        return (
            `${minutes}:` +
            `${String(secs).padStart(2, "0")}`
        );

    }


    /* =====================================================
       LOCAL ICONS
    ===================================================== */

    function refreshIcons(
        container = root
    ) {

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                container
            );

            return;
        }


        if (
            window.lucide &&
            typeof window.lucide
                .createIcons ===
                "function"
        ) {

            window.lucide
                .createIcons();

        }

    }


    /* =====================================================
       STORAGE
    ===================================================== */

    async function readStoredFiles() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            return [];
        }


        try {

            const result =
                await loadSelectedFiles();


            if (
                result &&
                Array.isArray(
                    result.files
                )
            ) {

                return result.files;
            }


            if (
                Array.isArray(
                    result
                )
            ) {

                return result;
            }


            return [];

        }
        catch (error) {

            console.error(
                "[MERGE AUDIO UI] Unable to load files:",
                error
            );


            return [];
        }

    }


    /* =====================================================
       DURATION
    ===================================================== */

    function loadAudioDuration(
        file
    ) {

        return new Promise(
            resolve => {

                const url =
                    URL.createObjectURL(
                        file
                    );


                const audio =
                    new Audio();


                let finished =
                    false;


                const finish =
                    duration => {

                        if (
                            finished
                        ) {
                            return;
                        }


                        finished =
                            true;


                        URL.revokeObjectURL(
                            url
                        );


                        resolve(
                            Number.isFinite(
                                duration
                            )
                                ? duration
                                : 0
                        );

                    };


                const timeout =
                    setTimeout(
                        () => {

                            finish(
                                0
                            );

                        },
                        8000
                    );


                audio.addEventListener(
                    "loadedmetadata",
                    () => {

                        clearTimeout(
                            timeout
                        );


                        finish(
                            audio.duration
                        );

                    },
                    {
                        once: true
                    }
                );


                audio.addEventListener(
                    "error",
                    () => {

                        clearTimeout(
                            timeout
                        );


                        finish(
                            0
                        );

                    },
                    {
                        once: true
                    }
                );


                audio.preload =
                    "metadata";


                audio.src =
                    url;

            }
        );

    }


    async function ensureDuration(
        record
    ) {

        if (
            state.durationCache.has(
                record.key
            )
        ) {

            record.duration =
                state.durationCache.get(
                    record.key
                );


            return;
        }


        const duration =
            await loadAudioDuration(
                record.file
            );


        record.duration =
            duration;


        state.durationCache.set(
            record.key,
            duration
        );

    }


    /* =====================================================
       ESTIMATED OUTPUT DURATION
    ===================================================== */

    function getEstimatedDuration() {

        if (
            state.records.length === 0
        ) {
            return 0;
        }


        const durations =
            state.records.map(
                record =>
                    Number(
                        record.duration
                    ) || 0
            );


        if (
            durations.some(
                duration =>
                    duration <= 0
            )
        ) {

            return null;
        }


        const sourceTotal =
            durations.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            );


        const gaps =
            Math.max(
                0,
                state.records.length -
                1
            );


        if (
            state.transition ===
            "silence"
        ) {

            return (
                sourceTotal +
                (
                    state.silenceDuration *
                    gaps
                )
            );

        }


        if (
            state.transition ===
            "crossfade"
        ) {

            return Math.max(
                0,
                sourceTotal -
                (
                    state.crossfadeDuration *
                    gaps
                )
            );

        }


        return sourceTotal;

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validate() {

        if (
            state.records.length < 2
        ) {

            return {
                valid:
                    false,

                message:
                    "Load at least two audio files."
            };
        }


        if (
            state.transition ===
            "crossfade"
        ) {

            if (
                !Number.isFinite(
                    state.crossfadeDuration
                ) ||
                state.crossfadeDuration <
                    0.1 ||
                state.crossfadeDuration >
                    10
            ) {

                return {
                    valid:
                        false,

                    message:
                        "Crossfade duration must be between 0.1 and 10 seconds."
                };
            }


            const knownDurations =
                state.records
                    .map(
                        record =>
                            Number(
                                record.duration
                            ) || 0
                    )
                    .filter(
                        duration =>
                            duration > 0
                    );


            if (
                knownDurations.length ===
                state.records.length
            ) {

                const minimumDuration =
                    Math.min(
                        ...knownDurations
                    );


                if (
                    state.crossfadeDuration >=
                    minimumDuration
                ) {

                    return {
                        valid:
                            false,

                        message:
                            "Crossfade must be shorter than every source file."
                    };
                }
            }

        }


        if (
            state.transition ===
            "silence" &&
            (
                !Number.isFinite(
                    state.silenceDuration
                ) ||
                state.silenceDuration <
                    0.1 ||
                state.silenceDuration >
                    10
            )
        ) {

            return {
                valid:
                    false,

                message:
                    "Silence duration must be between 0.1 and 10 seconds."
            };

        }


        if (
            state.outputFormat ===
                "same" &&
            !getCommonExtension()
        ) {

            return {
                valid:
                    false,

                message:
                    "Same as source requires all files to use the same format."
            };

        }


        const outputDuration =
            getEstimatedDuration();


        if (
            state.fadeInEnabled &&
            (
                !Number.isFinite(
                    state.fadeInDuration
                ) ||
                state.fadeInDuration <
                    0.1 ||
                state.fadeInDuration >
                    10
            )
        ) {

            return {
                valid:
                    false,

                message:
                    "Fade In duration must be between 0.1 and 10 seconds."
            };

        }


        if (
            state.fadeOutEnabled &&
            (
                !Number.isFinite(
                    state.fadeOutDuration
                ) ||
                state.fadeOutDuration <
                    0.1 ||
                state.fadeOutDuration >
                    10
            )
        ) {

            return {
                valid:
                    false,

                message:
                    "Fade Out duration must be between 0.1 and 10 seconds."
            };

        }


        if (
            outputDuration &&
            state.fadeInEnabled &&
            state.fadeInDuration >
                outputDuration
        ) {

            return {
                valid:
                    false,

                message:
                    "Fade In cannot be longer than the merged audio."
            };

        }


        if (
            outputDuration &&
            state.fadeOutEnabled &&
            state.fadeOutDuration >
                outputDuration
        ) {

            return {
                valid:
                    false,

                message:
                    "Fade Out cannot be longer than the merged audio."
            };

        }


        return {
            valid:
                true,

            message:
                "Ready to merge."
        };

    }

    /* =====================================================
    LIFECYCLE SNAPSHOT
    ===================================================== */

    function getLifecycleSettings() {

        const settings = {

            transition:
                state.transition,

            fadeInEnabled:
                state.fadeInEnabled,

            fadeOutEnabled:
                state.fadeOutEnabled,

            outputFormat:
                state.outputFormat

        };


        /*
        * Only include settings that actually
        * affect the current output.
        */

        if (
            state.transition ===
            "crossfade"
        ) {

            settings.crossfadeDuration =
                state.crossfadeDuration;

        }


        if (
            state.transition ===
            "silence"
        ) {

            settings.silenceDuration =
                state.silenceDuration;

        }


        if (
            state.fadeInEnabled
        ) {

            settings.fadeInDuration =
                state.fadeInDuration;

        }


        if (
            state.fadeOutEnabled
        ) {

            settings.fadeOutDuration =
                state.fadeOutDuration;

        }


        return settings;

    }


    function getLifecycleSnapshot() {

        return {

            /*
            * Order is deliberately preserved.
            */

            inputs:
                state.records.map(
                    record =>
                        record.key
                ),

            settings:
                getLifecycleSettings()

        };

    }

    /* =====================================================
       SETTINGS CHANGED
    ===================================================== */

    function dispatchSettingsChanged() {

        const snapshot =
            getLifecycleSnapshot();


        window.dispatchEvent(
            new CustomEvent(
                "easyfiletools:merge-settings-changed",
                {
                    detail: {

                        valid:
                            validate().valid,

                        inputs:
                            snapshot.inputs,

                        settings:
                            snapshot.settings

                    }
                }
            )
        );

    }


    /* =====================================================
       PREVIEW
    ===================================================== */

    function stopPreview() {

        state.previewAudio.pause();


        try {

            state.previewAudio.currentTime =
                0;

        }
        catch (_) {
            // Ignore
        }


        if (
            state.previewUrl
        ) {

            URL.revokeObjectURL(
                state.previewUrl
            );


            state.previewUrl =
                null;
        }


        state.previewAudio.removeAttribute(
            "src"
        );


        state.previewKey =
            null;


        renderList();

    }


    async function previewRecord(
        record
    ) {

        if (
            state.locked
        ) {
            return;
        }


        if (
            state.previewKey ===
            record.key
        ) {

            stopPreview();

            return;
        }


        stopPreview();


        state.previewUrl =
            URL.createObjectURL(
                record.file
            );


        state.previewKey =
            record.key;


        state.previewAudio.src =
            state.previewUrl;


        renderList();


        try {

            await state.previewAudio
                .play();

        }
        catch (error) {

            console.warn(
                "[MERGE AUDIO UI] Preview failed:",
                error
            );


            stopPreview();
        }

    }


    state.previewAudio
        .addEventListener(
            "ended",
            stopPreview
        );

    /* =====================================================
    SAVE CURRENT ORDER
    ===================================================== */

    async function saveCurrentOrder() {

        if (
            typeof saveSelectedFiles !==
            "function"
        ) {

            return;
        }


        await saveSelectedFiles(
            state.records,
            "Audio"
        );

    }

    /* =====================================================
       ORDER
    ===================================================== */

    function moveRecord(
        fromIndex,
        toIndex
    ) {

        if (
            state.locked ||
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >=
                state.records.length ||
            toIndex >=
                state.records.length
        ) {

            return;
        }


        const [
            record
        ] =
            state.records.splice(
                fromIndex,
                1
            );


        state.records.splice(
            toIndex,
            0,
            record
        );

        saveCurrentOrder();

        stopPreview();

        renderAll();

        dispatchSettingsChanged();

    }


    function resetOrder() {

        if (
            state.locked
        ) {
            return;
        }


        const position =
            new Map();


        state.originalOrder.forEach(
            (
                key,
                index
            ) => {

                position.set(
                    key,
                    index
                );

            }
        );


        state.records.sort(
            (
                a,
                b
            ) => {

                return (
                    (
                        position.get(
                            a.key
                        ) ?? 9999
                    ) -
                    (
                        position.get(
                            b.key
                        ) ?? 9999
                    )
                );

            }
        );

        saveCurrentOrder();

        stopPreview();

        renderAll();

        dispatchSettingsChanged();

    }


    /* =====================================================
       RENDER FILE LIST
    ===================================================== */

    function renderList() {

        elements.list.innerHTML =
            "";


        elements.empty.classList.toggle(
            "hidden",
            state.records.length > 0
        );


        state.records.forEach(
            (
                record,
                index
            ) => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "merge-audio-item";


                if (
                    state.locked
                ) {

                    item.classList.add(
                        "locked"
                    );

                }


                item.draggable =
                    !state.locked;


                item.dataset.key =
                    record.key;


                const previewing =
                    state.previewKey ===
                    record.key;


                item.innerHTML = `

                    <div class="merge-drag-handle">
                        ⋮⋮
                    </div>


                    <div class="merge-file-info">

                        <div class="merge-file-name">
                            ${index + 1}. ${escapeHtml(record.file.name)}
                        </div>

                        <div class="merge-file-meta">

                            ${formatFileSize(record.file.size)}

                            •

                            ${
                                record.duration > 0
                                    ? formatDuration(record.duration)
                                    : "Duration unavailable"
                            }

                        </div>

                    </div>


                    <div class="merge-file-actions">

                        <button
                            type="button"
                            class="merge-file-action merge-preview-btn"
                            ${
                                state.locked
                                    ? "disabled"
                                    : ""
                            }
                            title="${
                                previewing
                                    ? "Stop preview"
                                    : "Preview"
                            }"
                        >

                            <i
                                data-lucide="${
                                    previewing
                                        ? "square"
                                        : "play"
                                }"
                            ></i>

                        </button>


                        <button
                            type="button"
                            class="merge-file-action merge-up-btn"
                            ${
                                state.locked ||
                                index === 0
                                    ? "disabled"
                                    : ""
                            }
                            title="Move up"
                        >
                            ↑
                        </button>


                        <button
                            type="button"
                            class="merge-file-action merge-down-btn"
                            ${
                                state.locked ||
                                index ===
                                    state.records.length - 1
                                    ? "disabled"
                                    : ""
                            }
                            title="Move down"
                        >
                            ↓
                        </button>

                    </div>

                `;


                const previewBtn =
                    item.querySelector(
                        ".merge-preview-btn"
                    );


                const upBtn =
                    item.querySelector(
                        ".merge-up-btn"
                    );


                const downBtn =
                    item.querySelector(
                        ".merge-down-btn"
                    );


                previewBtn.addEventListener(
                    "click",
                    () => {

                        previewRecord(
                            record
                        );

                    }
                );


                upBtn.addEventListener(
                    "click",
                    () => {

                        moveRecord(
                            index,
                            index - 1
                        );

                    }
                );


                downBtn.addEventListener(
                    "click",
                    () => {

                        moveRecord(
                            index,
                            index + 1
                        );

                    }
                );


                item.addEventListener(
                    "dragstart",
                    event => {

                        if (
                            state.locked
                        ) {

                            event.preventDefault();

                            return;
                        }


                        state.dragKey =
                            record.key;


                        item.classList.add(
                            "dragging"
                        );

                    }
                );


                item.addEventListener(
                    "dragover",
                    event => {

                        if (
                            state.locked
                        ) {
                            return;
                        }


                        event.preventDefault();


                        item.classList.add(
                            "drag-over"
                        );

                    }
                );


                item.addEventListener(
                    "dragleave",
                    () => {

                        item.classList.remove(
                            "drag-over"
                        );

                    }
                );


                item.addEventListener(
                    "drop",
                    event => {

                        event.preventDefault();


                        item.classList.remove(
                            "drag-over"
                        );


                        const fromIndex =
                            state.records
                                .findIndex(
                                    current =>
                                        current.key ===
                                        state.dragKey
                                );


                        moveRecord(
                            fromIndex,
                            index
                        );

                    }
                );


                item.addEventListener(
                    "dragend",
                    () => {

                        state.dragKey =
                            null;


                        item.classList.remove(
                            "dragging"
                        );


                        root
                            .querySelectorAll(
                                ".merge-audio-item"
                            )
                            .forEach(
                                row => {

                                    row.classList.remove(
                                        "drag-over"
                                    );

                                }
                            );

                    }
                );


                elements.list
                    .appendChild(
                        item
                    );

            }
        );


        refreshIcons(
            elements.list
        );

    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(
        value
    ) {

        const div =
            document.createElement(
                "div"
            );


        div.textContent =
            value;


        return div.innerHTML;

    }


    /* =====================================================
       RENDER SETTINGS
    ===================================================== */

    function renderSettings() {

        elements.transitionButtons
            .forEach(
                button => {

                    const selected =
                        button.dataset
                            .mergeTransition ===
                        state.transition;


                    button.classList.toggle(
                        "active",
                        selected
                    );


                    button.disabled =
                        state.locked;

                }
            );


        elements.crossfadeSettings
            .classList.toggle(
                "hidden",
                state.transition !==
                    "crossfade"
            );


        elements.silenceSettings
            .classList.toggle(
                "hidden",
                state.transition !==
                    "silence"
            );


        elements.crossfadeDuration.value =
            state.crossfadeDuration;


        elements.silenceDuration.value =
            state.silenceDuration;


        elements.fadeInEnabled.checked =
            state.fadeInEnabled;


        elements.fadeOutEnabled.checked =
            state.fadeOutEnabled;


        elements.fadeInDuration.value =
            state.fadeInDuration;


        elements.fadeOutDuration.value =
            state.fadeOutDuration;


        elements.fadeInDuration.disabled =
            state.locked ||
            !state.fadeInEnabled;


        elements.fadeOutDuration.disabled =
            state.locked ||
            !state.fadeOutEnabled;


        elements.fadeInEnabled.disabled =
            state.locked;


        elements.fadeOutEnabled.disabled =
            state.locked;


        elements.crossfadeDuration.disabled =
            state.locked;


        elements.silenceDuration.disabled =
            state.locked;


        const commonExtension =
            getCommonExtension();


        const hasFiles =
            state.records.length > 0;


        /*
        * Default policy:
        * - no files: keep Same as source selected;
        * - homogeneous inputs: honor the user's preference
        *   (Same as source by default);
        * - mixed inputs: Same as source is impossible, so
        *   use MP3 temporarily without overwriting the
        *   remembered preference.
        */
        state.outputFormat =
            hasFiles &&
            !commonExtension &&
            state.outputFormatPreference ===
                "same"
                ? "mp3"
                : state.outputFormatPreference;


        const sameOption =
            elements.outputFormat
                .querySelector(
                    'option[value="same"]'
                );


        if (
            sameOption
        ) {

            sameOption.disabled =
                hasFiles &&
                !commonExtension;

        }


        elements.outputFormat.value =
            state.outputFormat;


        elements.outputFormat.disabled =
            state.locked;


        elements.formatHelp.textContent =
            commonExtension
                ? `Same as source will create a .${commonExtension.toUpperCase()} file.`
                : "The source files use different formats, so choose one output format.";


        const estimatedDuration =
            getEstimatedDuration();


        elements.estimatedDuration
            .textContent =
                estimatedDuration ===
                null
                    ? "Unavailable"
                    : formatDuration(
                        estimatedDuration
                    );


        const validation =
            validate();


        const lifecycleState =
            window.EasyFileOperationController?.getState?.();


        if (
            lifecycleState &&
            !["idle", "ready"].includes(lifecycleState.status)
        ) {

            window.EasyFileUIControls
                ?.applyReadinessState
                ?.(lifecycleState);

        }
        else {

            elements.validation
                .textContent =
                    validation.message;


            elements.validation
                .classList.toggle(
                    "valid",
                    validation.valid
                );


            elements.validation
                .classList.toggle(
                    "error",
                    !validation.valid &&
                    state.records.length >= 2
                );

        }


        elements.counter.textContent =
            `${
                state.records.length
            } ${
                state.records.length === 1
                    ? "file"
                    : "files"
            } to merge`;


        elements.resetOrderBtn.disabled =
            state.locked ||
            state.records.length < 2;

    }


    function renderAll() {

        renderList();

        renderSettings();

    }


    /* =====================================================
    RESULT
    ===================================================== */

    function getStoredBatchResult() {

        const lifecycle =
            window
                .EasyFileOperationLifecycle;


        const lifecycleResult =
            lifecycle
                ?.getBatchResult?.();


        if (
            lifecycleResult
        ) {

            return lifecycleResult;
        }

        const batch =
            window
                .EasyFileOperationResults
                ?.getBatch?.();


        return (
            batch?.result ||
            null
        );

    }


    function clearResult() {

        elements.result
            .classList
            .add(
                "hidden"
            );


        elements.result
            .classList
            .remove(
                "stale"
            );


        elements.resultName
            .textContent =
                "";


        elements.resultSize
            .textContent =
                "";
    }


    function renderResultState(
        result,
        stale =
            false
    ) {

        if (
            !result
        ) {

            clearResult();

            return;
        }


        const size =
            formatFileSize(
                result.outputSize ||
                result.blob?.size ||
                0
            );


        elements.result
            .classList
            .toggle(
                "stale",
                stale
            );


        if (
            stale
        ) {

            elements.resultSize
                .innerHTML = `

                    <i
                        data-lucide="triangle-alert"
                        class="merge-result-warning-icon"
                    ></i>

                    <span>
                        Previous result • settings changed • ${size}
                    </span>

                `;

            elements.resultDownloadBtn
                .title =
                    "Download previous result";

        }
        else {

            elements.resultSize
                .textContent =
                    size;


            elements.resultDownloadBtn
                .title =
                    "Download merged audio";
        }
    }


    function showResult(
        result
    ) {

        if (
            !result
        ) {

            clearResult();

            return;
        }


        elements.resultName
            .textContent =
                result.outputName ||
                "merged_audio";


        elements.result
            .classList
            .remove(
                "hidden"
            );


        renderResultState(
            result,
            false
        );


        refreshIcons(
            elements.result
        );
    }


    function setResultStale(
        stale
    ) {

        const result =
            getStoredBatchResult();


        if (
            !result
        ) {

            clearResult();

            return;
        }


        elements.resultName
            .textContent =
                result.outputName ||
                "merged_audio";


        elements.result
            .classList
            .remove(
                "hidden"
            );


        renderResultState(
            result,
            Boolean(
                stale
            )
        );
    }


    /* =====================================================
       LOCK
    ===================================================== */

    function setLocked(
        locked
    ) {

        state.locked =
            Boolean(
                locked
            );


        if (
            state.locked
        ) {

            stopPreview();

        }


        renderAll();

    }


    /* =====================================================
       GET REQUEST
    ===================================================== */

    function getMergeRequest() {

        const validation =
            validate();


        if (
            !validation.valid
        ) {

            return null;
        }


        return {

            files:
                state.records.map(
                    record =>
                        record.file
                ),

            entries:
                state.records.map(
                    record =>
                        record.entry
                ),

            keys:
                state.records.map(
                    record =>
                        record.key
                ),

            durations:
                state.records.map(
                    record =>
                        record.duration
                ),

            settings: {

                transition:
                    state.transition,

                crossfadeDuration:
                    state.crossfadeDuration,

                silenceDuration:
                    state.silenceDuration,

                fadeInEnabled:
                    state.fadeInEnabled,

                fadeInDuration:
                    state.fadeInDuration,

                fadeOutEnabled:
                    state.fadeOutEnabled,

                fadeOutDuration:
                    state.fadeOutDuration,

                outputFormat:
                    state.outputFormat,

                estimatedOutputDuration:
                    getEstimatedDuration(),

                commonExtension:
                    getCommonExtension()

            }

        };

    }


    function isValid() {

        return validate().valid;

    }


    function getRecords() {

        return state.records.map(
            record => ({
                ...record
            })
        );

    }


    /* =====================================================
       REFRESH FILES
    ===================================================== */

    async function refreshFiles() {

        const entries =
            await readStoredFiles();

        const records =
            [];


        entries.forEach(
            (
                entry,
                sourceIndex
            ) => {

                const file =
                    extractFile(
                        entry
                    );


                if (!file) {
                    return;
                }


                const key =
                    createFileKey(
                        file
                    );


                records.push({

                    key,

                    file,

                    entry,

                    sourceIndex,

                    duration:
                        state.durationCache.get(
                            key
                        ) || 0

                });

            }
        );

        state.records =
            records;


        state.originalOrder =
            entries
                .map(
                    entry => {

                        const file =
                            extractFile(
                                entry
                            );


                        return file
                            ? createFileKey(
                                file
                            )
                            : null;

                    }
                )
                .filter(
                    Boolean
                );


        await Promise.all(
            state.records.map(
                ensureDuration
            )
        );


        stopPreview();

        renderAll();

        dispatchSettingsChanged();

    }


    /* =====================================================
       EVENTS
    ===================================================== */

        /* =====================================================
        CONTEXTUAL HELP
        ===================================================== */

        const helpButtons =
            Array.from(
                root.querySelectorAll(
                    "[data-merge-help-btn]"
                )
            );


        function closeMergeHelp(
            except = null
        ) {

            helpButtons.forEach(
                button => {

                    const wrap =
                        button.closest(
                            ".merge-help-wrap"
                        );


                    if (
                        !wrap ||
                        wrap === except
                    ) {

                        return;
                    }


                    wrap.classList.remove(
                        "open"
                    );


                    wrap.closest(
                        ".merge-section"
                    )
                        ?.classList.remove(
                            "help-open"
                        );


                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                }
            );
        }


        helpButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        const wrap =
                            button.closest(
                                ".merge-help-wrap"
                            );


                        if (!wrap) {

                            return;
                        }


                        const willOpen =
                            !wrap.classList.contains(
                                "open"
                            );


                        closeMergeHelp(
                            wrap
                        );


                        wrap.classList.toggle(
                            "open",
                            willOpen
                        );


                        wrap.closest(
                            ".merge-section"
                        )
                            ?.classList.toggle(
                                "help-open",
                                willOpen
                            );


                        button.setAttribute(
                            "aria-expanded",
                            willOpen
                                ? "true"
                                : "false"
                        );

                    }
                );

            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        ".merge-help-wrap"
                    )
                ) {

                    return;
                }


                closeMergeHelp();

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                        "Escape"
                ) {

                    return;
                }


                closeMergeHelp();

            }
        );

    elements.transitionButtons
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        if (
                            state.locked
                        ) {
                            return;
                        }


                        state.transition =
                            button.dataset
                                .mergeTransition;

                        renderSettings();

                        dispatchSettingsChanged();

                    }
                );

            }
        );


    elements.crossfadeDuration
        .addEventListener(
            "change",
            () => {

                state.crossfadeDuration =
                    Number(
                        elements
                            .crossfadeDuration
                            .value
                    );

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.silenceDuration
        .addEventListener(
            "change",
            () => {

                state.silenceDuration =
                    Number(
                        elements
                            .silenceDuration
                            .value
                    );

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.fadeInEnabled
        .addEventListener(
            "change",
            () => {

                state.fadeInEnabled =
                    elements
                        .fadeInEnabled
                        .checked;

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.fadeOutEnabled
        .addEventListener(
            "change",
            () => {

                state.fadeOutEnabled =
                    elements
                        .fadeOutEnabled
                        .checked;

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.fadeInDuration
        .addEventListener(
            "change",
            () => {

                state.fadeInDuration =
                    Number(
                        elements
                            .fadeInDuration
                            .value
                    );

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.fadeOutDuration
        .addEventListener(
            "change",
            () => {

                state.fadeOutDuration =
                    Number(
                        elements
                            .fadeOutDuration
                            .value
                    );

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.outputFormat
        .addEventListener(
            "change",
            () => {

                state.outputFormatPreference =
                    elements
                        .outputFormat
                        .value;

                state.outputFormat =
                    state.outputFormatPreference;

                renderSettings();

                dispatchSettingsChanged();

            }
        );


    elements.resetOrderBtn
        .addEventListener(
            "click",
            resetOrder
        );


    elements.resultDownloadBtn
        .addEventListener(
            "click",
            async () => {

                const result =
                    getStoredBatchResult();


                if (
                    !result
                ) {

                    return;
                }


                try {

                    await window
                        .EasyFileOperationDownloads
                        ?.downloadOutput?.(
                            result
                        );

                }
                catch (
                    error
                ) {

                    console.error(
                        "[MERGE AUDIO UI] Download failed:",
                        error
                    );


                    if (
                        typeof showNotification ===
                        "function"
                    ) {

                        showNotification(
                            "Unable to download the merged audio.",
                            "error"
                        );
                    }
                }
            }
        );


    document.addEventListener(
        "easyfiletools:storage-updated",
        refreshFiles
    );


    document.addEventListener(
        "easyfiletools:files-selected",
        () => {

            setTimeout(
                refreshFiles,
                0
            );

        }
    );


    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            state.records =
                [];


            state.originalOrder =
                [];


            stopPreview();

            clearResult();

            renderAll();

            dispatchSettingsChanged();

        }
    );

    /* =====================================================
    GENERIC OPERATION LOCK
    ===================================================== */

    document.addEventListener(
        "easyfiletools:operation-state-changed",
        event => {

            const detail =
                event.detail ||
                    {};


            if (
                detail.operationId !==
                    "merge-audio"
            ) {

                return;
            }


            setLocked(
                detail.settingsLocked ===
                    true
            );
        }
    );    

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.MergeAudioUI = {

        refreshFiles,

        getMergeRequest,

        getRecords,

        getLifecycleSnapshot,

        isValid,

        setLocked,

        showResult,

        setResultStale,

        clearResult,

        validate,

        getEstimatedDuration

    };

    /* =====================================================
       INIT
    ===================================================== */

    renderAll();

    refreshIcons();

    refreshFiles();

})();