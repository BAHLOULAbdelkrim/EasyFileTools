console.log(
    "[FILE LIST] file-list.js loaded"
);


/* =========================================================
   OPERATION RESULT HELPERS
========================================================= */

function getStoredFileOperation(
    index
) {

    const results =
        window.EasyFileOperationResults;


    if (
        !results ||
        typeof results.getItem !==
            "function"
    ) {

        return null;
    }


    return (
        results.getItem(
            index
        ) ||
        null
    );
}


function getStoredFileResult(
    index
) {

    const entry =
        getStoredFileOperation(
            index
        );


    return (
        entry?.result ||
        null
    );
}

function getStoredFileOutputs(
    index
) {

    const entry =
        getStoredFileOperation(
            index
        );


    return Array.isArray(
        entry?.outputs
    )
        ? entry.outputs
        : [];

}


function hasStoredFileResult(
    entry
) {

    if (!entry) {

        return false;

    }


    if (entry.result) {

        return true;

    }


    return (
        Array.isArray(
            entry.outputs
        ) &&
        entry.outputs.length > 0
    );

}

function buildMultiOutputLabel(
    outputs = [],
    fallback =
        "Generated"
) {

    const count =
        Array.isArray(
            outputs
        )
            ? outputs.length
            : 0;


    return `${fallback} • ${count} ${
        count === 1
            ? "output"
            : "outputs"
    }`;

}

function getResultUrl(
    result
) {

    return (
        result?.outputUrl ||
        result?.url ||
        null
    );
}


function getResultName(
    result,
    fallback =
        "processed-file"
) {

    return (
        result?.outputName ||
        result?.name ||
        fallback
    );
}


function buildResultLabel(
    result = {}
) {

    const label =
        result.completedLabel ||
        "Processed";


    const format =
        result.outputFormat
            ? String(
                result.outputFormat
            ).toUpperCase()
            : "";


    const size =
        Number(
            result.outputSize
        ) > 0
            ? formatFileSize(
                result.outputSize
            )
            : "";

    const durationValue =
        Number(
            result.outputDuration
        );


    const duration =
        Number.isFinite(
            durationValue
        ) &&
        durationValue > 0

            ? formatDuration(
                durationValue
            )

            : "";            

    let text =
        label;


    if (
        format
    ) {

        text +=
            ` → ${format}`;
    }


    if (
        size
    ) {

        text +=
            ` • ${size}`;
    }

    if (
        duration
    ) {

        text +=
            ` • ${duration}`;
    }    

    return text;
}


function eventMatchesCurrentOperation(
    detail = {}
) {

    const operationZone =
        document.getElementById(
            "operation-zone"
        );


    const currentOperation =
        operationZone?.dataset
            ?.operation ||
        "";


    const eventOperation =
        detail.operation ||
        detail.operationId ||
        "";


    if (
        !currentOperation ||
        !eventOperation
    ) {

        return true;
    }


    return (
        currentOperation ===
        eventOperation
    );
}


/* =========================================================
   GET FILE ITEM
========================================================= */

function getOperationFileItem(
    index
) {

    return document.querySelector(
        `#file-list .file-item[data-file-index="${index}"]`
    );
}


/* =========================================================
   FILE STATUS
========================================================= */

function getFileItemElement(
    target
) {

    if (!target) {
        return null;
    }


    if (
        target instanceof
        HTMLElement
    ) {

        return target;
    }


    if (
        target.element instanceof
        HTMLElement
    ) {

        return target.element;
    }


    return null;
}


function setFileItemStatus(
    target,
    text,
    state = "",
    showCheck = false
) {

    const item =
        getFileItemElement(
            target
        );


    if (!item) {

        console.warn(
            "[FILE LIST] File element unavailable:",
            target?.file?.name ||
            target
        );

        return;
    }


    const statusElement =
        item.querySelector(
            ".file-state"
        );


    if (!statusElement) {
        return;
    }


    statusElement.className =
        "file-state" +
        (
            state
                ? ` ${state}`
                : ""
        );


    if (
        showCheck
    ) {

        statusElement.innerHTML = `

            <i data-lucide="check"></i>

            <span>
                ${easyFileEscapeHtml(text)}
            </span>

        `;


        createLocalIcons(
            statusElement
        );
    }
    else {

        statusElement.innerHTML = `

            <span>
                ${easyFileEscapeHtml(text)}
            </span>

        `;
    }
}


/* =========================================================
   FILE PROGRESS
========================================================= */

function setFileItemProgress(
    target,
    percentage
) {

    const item =
        getFileItemElement(
            target
        );


    if (!item) {

        console.warn(
            "[FILE LIST] File element unavailable:",
            target?.file?.name ||
            target
        );

        return;
    }


    const progressBar =
        item.querySelector(
            ".file-progress-bar"
        );


    if (!progressBar) {
        return;
    }


    const value =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    percentage
                ) || 0
            )
        );


    progressBar.style.width =
        `${value}%`;
}


function setFileItemLoading(
    target,
    isLoading
) {

    const item =
        getFileItemElement(
            target
        );


    if (!item) {
        return;
    }


    const progressBar =
        item.querySelector(
            ".file-progress-bar"
        );


    if (!progressBar) {
        return;
    }


    if (
        isLoading
    ) {

        progressBar.classList.add(
            "is-loading"
        );

        progressBar.style.width =
            "35%";
    }
    else {

        progressBar.classList.remove(
            "is-loading"
        );

        progressBar.style.width =
            "0%";

        progressBar.style.transform =
            "";
    }
}


/* =========================================================
   NOTIFY PROCESSED FILE DOWNLOAD
========================================================= */

function notifyProcessedFileDownloaded(
    index
) {

    if (
        !Number.isInteger(
            index
        ) ||
        index < 0
    ) {

        return;
    }


    document.dispatchEvent(
        new CustomEvent(
            "easyfiletools:processed-file-downloaded",
            {
                detail: {
                    index
                }
            }
        )
    );
}


/* =========================================================
   DOWNLOAD BUTTON
========================================================= */

function configureDownloadButton(
    item,
    index,
    result,
    fileData = null,
    options = {}
) {

    const downloadBtn =
        item.querySelector(
            ".download-btn"
        );


    if (!downloadBtn) {
        return;
    }


    downloadBtn.onclick =
        null;


    const entry =
        getStoredFileOperation(
            index
        );


    const outputs =
        Array.isArray(
            entry?.outputs
        ) &&
        entry.outputs.length > 0
            ? entry.outputs
            : (
                Array.isArray(
                    result?.outputs
                )
                    ? result.outputs
                    : []
            );


    const hasMultiOutputs =
        outputs.length > 0 &&
        entry?.stale !== true;


    /*
     * MULTI_OUTPUT
     *
     * The source-level Download button
     * downloads all outputs generated
     * from this source file.
     */

    if (
        hasMultiOutputs
    ) {

        downloadBtn.disabled =
            false;

        const singleOutput =
            outputs.length === 1;

        downloadBtn.title =
            singleOutput
                ? "Download output"
                : "Download all outputs";


        downloadBtn.onclick =
            async () => {

                const downloads =
                    window
                        .EasyFileOperationDownloads;

                const action =
                    singleOutput
                        ? downloads?.downloadMultiOutput
                        : downloads?.downloadMultiOutputGroup;

                if (!action) {

                    console.error(
                        "[FILE LIST] Multi-output download unavailable."
                    );

                    return;
                }


                downloadBtn.disabled =
                    true;


                try {

                    if (singleOutput) {
                        await downloads
                            .downloadMultiOutput(
                                index,
                                0
                            );
                    }
                    else {
                        await downloads
                            .downloadMultiOutputGroup(
                                index,
                                "zip"
                            );
                    }

                }
                catch (error) {

                    console.error(
                        "[FILE LIST] Multi-output download failed:",
                        error
                    );
                    if (typeof showNotification === "function") {
                        showNotification(
                            downloads.archiveErrorMessage?.(error) ||
                                "The download failed. Please try fewer files or download them individually.",
                            "warning",
                            9000
                        );
                    }

                }
                finally {

                    downloadBtn.disabled =
                        false;

                }

            };


        return;
    }


    /*
     * PER_FILE
     */

    const outputUrl =
        getResultUrl(
            result
        );


    if (!outputUrl) {

        downloadBtn.disabled =
            true;

        downloadBtn.title =
            "";

        return;
    }


    downloadBtn.disabled =
        false;

    downloadBtn.title =
        "Download";


    downloadBtn.onclick =
        async () => {

            if (
                typeof options.onDownload ===
                "function"
            ) {

                await options.onDownload(
                    fileData,
                    item,
                    result
                );

                return;
            }


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                outputUrl;


            link.download =
                getResultName(
                    result,
                    fileData?.file?.name ||
                    "processed-file"
                );


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            notifyProcessedFileDownloaded(
                index
            );

        };

}


function attachDownloadEvent(
    item,
    fileData,
    index,
    options
) {

    const result =
        getStoredFileResult(
            index
        );


    configureDownloadButton(
        item,
        index,
        result,
        fileData,
        options
    );
}

/* =========================================================
   MULTI OUTPUT RESULTS
========================================================= */

function renderMultiOutputResults(
    item,
    index,
    entry = null,
    options = {}
) {

    if (!item) {

        return;

    }


    const existing =
        item.querySelector(
            ".file-multi-outputs"
        );


    existing?.remove();


    const resultEntry =
        entry ||
        getStoredFileOperation(
            index
        );


    const outputs =
        Array.isArray(
            resultEntry?.outputs
        )
            ? resultEntry.outputs
            : [];


    if (
        outputs.length === 0
    ) {

        return;

    }


    const fileInfo =
        item.querySelector(
            ".file-info"
        );


    if (!fileInfo) {

        return;

    }


    const container =
        document.createElement(
            "div"
        );


    container.className =
        "file-multi-outputs";


    if (
        resultEntry?.stale ===
        true
    ) {

        container.classList.add(
            "stale"
        );

    }


    /*
     * Keep MULTI_OUTPUT pages compact. Up to eight outputs are
     * useful inline; above that threshold, a single group download
     * avoids dozens of DOM rows while the source-level Download
     * button continues to provide the same ZIP action.
     */
    const inlineOutputLimit =
        8;


    /*
     * Exactly one generated file uses the source-level Download
     * button only. Rendering the same output again underneath would
     * create two buttons for one identical download.
     */
    if (outputs.length === 1) {
        return;
    }


    if (
        outputs.length >
        inlineOutputLimit
    ) {

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "file-multi-output file-multi-output-summary";


        const info =
            document.createElement(
                "div"
            );


        info.className =
            "file-multi-output-info";


        const name =
            document.createElement(
                "span"
            );


        name.className =
            "file-multi-output-name";


        name.textContent =
            `${outputs.length} outputs generated`;


        const meta =
            document.createElement(
                "span"
            );


        meta.className =
            "file-multi-output-meta";


        meta.textContent =
            `Individual outputs are hidden above ${inlineOutputLimit} to keep the page responsive.`;


        info.appendChild(
            name
        );


        info.appendChild(
            meta
        );


        /*
         * The source-level Download button on the right is the
         * single group-download action. Do not render a second ZIP
         * button inside the compact summary.
         */

        row.appendChild(
            info
        );


        container.appendChild(
            row
        );


        fileInfo.appendChild(
            container
        );


        if (
            typeof createLocalIcons ===
                "function"
        ) {

            createLocalIcons(
                container
            );

        }


        return;

    }


    outputs.forEach(
        (
            output,
            outputIndex
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "file-multi-output";


            const info =
                document.createElement("div");

            info.className =
                "file-multi-output-info";


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "file-multi-output-name";


            const outputName =
                getResultName(
                    output,
                    `Output ${outputIndex + 1}`
                );


            name.textContent =
                outputName;


            /*
            * Full output name on hover.
            *
            * The Download button has its own
            * title, therefore hovering the
            * button keeps "Download output".
            */

            row.title =
                outputName;


            const meta =
                document.createElement("span");

            meta.className =
                "file-multi-output-meta";


            const metaParts =
                [];


            const outputSize =
                Number(
                    output.outputSize ??
                    output.size
                );


            if (
                Number.isFinite(outputSize) &&
                outputSize > 0
            ) {

                metaParts.push(
                    formatFileSize(
                        outputSize
                    )
                );

            }


            const duration =
                Number(
                    output.duration
                );


            if (
                Number.isFinite(duration) &&
                duration >= 0
            ) {

                metaParts.push(
                    formatDuration(
                        duration
                    )
                );

            }


            meta.textContent =
                metaParts.join(" • ");


            info.appendChild(name);


            if (
                metaParts.length > 0
            ) {

                info.appendChild(meta);

            }


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "file-multi-output-download";


            button.innerHTML = `
                <i data-lucide="download"></i>
            `;

            button.title =
                "Download output";

            button.setAttribute(
                "aria-label",
                "Download output"
            );


            button.addEventListener(
                "click",
                async () => {

                    const downloads =
                        window
                            .EasyFileOperationDownloads;


                    if (
                        !downloads
                            ?.downloadMultiOutput
                    ) {

                        console.error(
                            "[FILE LIST] Multi-output download manager unavailable."
                        );

                        return;

                    }


                    button.disabled =
                        true;


                    try {

                        await downloads
                            .downloadMultiOutput(
                                index,
                                outputIndex
                            );

                    }
                    catch (error) {

                        console.error(
                            "[FILE LIST] Multi-output download failed:",
                            error
                        );

                    }
                    finally {

                        button.disabled =
                            false;

                    }

                }
            );


            row.appendChild(info);
            row.appendChild(button);


            container.appendChild(
                row
            );

        }
    );


    fileInfo.appendChild(
        container
    );


    if (
        typeof createLocalIcons ===
        "function"
    ) {

        createLocalIcons(
            container
        );

    }

}

/* =========================================================
   REMOVE BUTTON
========================================================= */

function attachRemoveEvent(
    item,
    fileData,
    index,
    options
) {

    const removeBtn =
        item.querySelector(
            ".remove-btn"
        );


    if (!removeBtn) {
        return;
    }


    removeBtn.addEventListener(
        "click",
        async () => {

            if (
                typeof options.onRemove ===
                "function"
            ) {

                await options.onRemove(
                    fileData,
                    index,
                    item
                );
            }
        }
    );
}


/* =========================================================
   RENDER FILE ITEM
========================================================= */

function renderFileItem(
    fileData,
    index,
    container,
    options = {}
) {

    const file =
        fileData.file;


    const category =
        options.category ||
        getFileCategory(
            file.name
        );


    const maxSize =
        options.maxSize ??
        Infinity;


    const showStatus =
        options.showStatus ??
        true;


    const showProgress =
        options.showProgress ??
        true;


    const enableReorder =
        options.enableReorder ??
        false;


    const dragState =
        options.dragState ||
        {
            index: null
        };


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "file-item";


    item.dataset.fileIndex =
        index;


    /*
     * Keep the rendering context
     * available when a generic
     * operation result arrives.
     */

    item._easyFileData =
        fileData;

    item._easyFileOptions =
        options;


    /* =====================================================
       DRAG & DROP
    ===================================================== */

    if (
        enableReorder
    ) {

        item.setAttribute(
            "draggable",
            "true"
        );


        item.addEventListener(
            "dragstart",
            () => {

                dragState.index =
                    index;


                item.classList.add(
                    "dragging"
                );
            }
        );


        item.addEventListener(
            "dragend",
            () => {

                item.classList.remove(
                    "dragging"
                );


                document
                    .querySelectorAll(
                        ".drop-target"
                    )
                    .forEach(
                        element => {

                            element.classList.remove(
                                "drop-target"
                            );
                        }
                    );
            }
        );


        item.addEventListener(
            "dragover",
            event => {

                event.preventDefault();


                item.classList.add(
                    "drop-target"
                );
            }
        );


        item.addEventListener(
            "dragleave",
            () => {

                item.classList.remove(
                    "drop-target"
                );
            }
        );


        item.addEventListener(
            "drop",
            event => {

                event.preventDefault();


                item.classList.remove(
                    "drop-target"
                );


                const targetIndex =
                    index;


                const fromIndex =
                    dragState.index;


                if (
                    fromIndex ===
                        null ||
                    fromIndex ===
                        targetIndex
                ) {

                    return;
                }


                if (
                    typeof options.onReorder ===
                    "function"
                ) {

                    options.onReorder(
                        fromIndex,
                        targetIndex
                    );
                }


                dragState.index =
                    null;
            }
        );
    }


    /* =====================================================
       FILE TOO LARGE
    ===================================================== */

    if (
        file.size >
        maxSize
    ) {

        item.innerHTML = `

            <div class="file-left">

                <div class="status-icon error">

                    <i data-lucide="circle-x"></i>

                </div>

                <div class="file-info">

                    <div class="file-name file-error">

                        ${index + 1}. ${easyFileEscapeHtml(file.name)}

                    </div>

                    <div class="file-extension">

                        File too large

                    </div>

                </div>

            </div>

            <div class="file-right">

                <button
                    type="button"
                    class="download-btn"
                    disabled
                >

                    <i data-lucide="download"></i>

                </button>

                <button
                    type="button"
                    class="remove-btn"
                >

                    <i data-lucide="trash-2"></i>

                </button>

            </div>

        `;


        createLocalIcons(
            item
        );


        attachRemoveEvent(
            item,
            fileData,
            index,
            options
        );


        return item;
    }


    /* =====================================================
       PREVIEW
    ===================================================== */

    let previewHTML =
        "";


    if (
        (
            fileData.previewType === "image" ||
            fileData.previewType === "video" ||
            fileData.previewType === "pdf"
        ) &&
        typeof fileData.previewUrl === "string" &&
        fileData.previewUrl.trim() !== ""
    ) {

        previewHTML = `

            <img
                src="${easyFileEscapeHtml(fileData.previewUrl)}"
                alt="Preview of ${easyFileEscapeHtml(file.name)}"
                class="image-preview"
            >

        `;
    }
    else {

        previewHTML = `

            <div class="file-placeholder ${category}">

                <i data-lucide="${getFileIcon(category)}"></i>

            </div>

        `;
    }


    /* =====================================================
       STORED OPERATION RESULT
    ===================================================== */

    const operationEntry =
        getStoredFileOperation(
            index
        );


    const operationResult =
        operationEntry?.result ||
        null;


    const operationOutputs =
        Array.isArray(
            operationEntry?.outputs
        )
            ? operationEntry.outputs
            : [];


    const operationHasResult =
        Boolean(
            operationResult
        ) ||
        operationOutputs.length > 0;


    const resultIsStale =
        operationEntry?.stale ===
        true;


    /* =====================================================
       FILE STATE
    ===================================================== */

    let fileStateHTML =
        "";


    if (
        showStatus
    ) {

        if (
            operationHasResult &&
            resultIsStale
        ) {

            fileStateHTML = `

                <div class="file-state stale">

                    <i data-lucide="triangle-alert"></i>

                    <span>
                        Previous result • settings changed
                    </span>

                </div>

            `;
        }
        else if (
            operationResult
        ) {

            fileStateHTML = `

                <div class="file-state converted">

                    <i data-lucide="check"></i>

                    <span>
                        ${easyFileEscapeHtml(buildResultLabel(operationResult))}
                    </span>

                </div>

            `;

        }
        else if (
            operationOutputs.length > 0
        ) {

            fileStateHTML = `

                <div class="file-state converted">

                    <i data-lucide="check"></i>

                    <span>
                        ${easyFileEscapeHtml(buildMultiOutputLabel(operationOutputs))}
                    </span>

                </div>

            `;

        }
        else {

            fileStateHTML = `

                <div class="file-state ready">

                    <i data-lucide="check"></i>

                    <span>
                        Ready
                    </span>

                </div>

            `;
        }
    }

    const operationZone =
        document.getElementById(
            "operation-zone"
        );


    const operationConfig =
        window
            .EasyFileOperationConfig
            ?.get?.(
                operationZone
                    ?.dataset
                    ?.operation ||
                ""
            );


    const resultMode =
        operationConfig?.resultMode ||
        "per-file";


    const showFileDownload =
        resultMode !==
        "batch";    

    /* =====================================================
       PROGRESS
    ===================================================== */

    const progressValue =
        operationHasResult &&
        !resultIsStale
            ? 100
            : 0;


    const progressHTML =
        showProgress &&
        resultMode !== "batch"
            ? `
                <div class="file-progress-block">

                    <div class="file-progress-container">

                        <div
                            class="file-progress-bar"
                            style="width: ${progressValue}%;"
                        ></div>

                    </div>

                </div>
            `
            : "";


    /* =====================================================
       FILE INFORMATION
    ===================================================== */

    const dimensions =
        fileData.meta?.dimensions
            ? ` • ${Number(fileData.meta.dimensions.width) || 0} × ${Number(fileData.meta.dimensions.height) || 0}`
            : "";


    const duration =
        fileData.meta?.duration
            ? ` • ${formatDuration(
                fileData.meta.duration
            )}`
            : "";


    const pages =
        fileData.meta?.pages
            ? ` • ${Number(fileData.meta.pages) || 0} ${
                fileData.meta.pages > 1
                    ? "pages"
                    : "page"
              }`
            : "";

    /* =====================================================
       HTML
    ===================================================== */

    item.innerHTML = `

        <div class="file-main">

            <div class="file-left">

                ${previewHTML}

                <div class="file-info">

                    <div class="file-name">

                        ${index + 1}. ${easyFileEscapeHtml(file.name)}

                    </div>

                    <div class="file-extension">

                        ${easyFileEscapeHtml(category)}
                        •
                        ${formatFileSize(
                            file.size
                        )}

                        ${dimensions}
                        ${duration}
                        ${pages}

                    </div>

                    ${fileStateHTML}

                </div>

            </div>

            ${progressHTML}

        </div>

        <div class="file-right">

            ${
                showFileDownload
                    ? `
                        <button
                            type="button"
                            class="download-btn"
                            ${
                                getResultUrl(
                                    operationResult
                                )
                                    ? ""
                                    : "disabled"
                            }
                        >
                            <i data-lucide="download"></i>
                        </button>
                    `
                    : ""
            }

            <button
                type="button"
                class="remove-btn shiny-btn"
            >

                <i data-lucide="trash-2"></i>

            </button>

        </div>

    `;


    container.appendChild(
        item
    );


    createLocalIcons(
        item
    );


    fileData.element =
        item;


    attachRemoveEvent(
        item,
        fileData,
        index,
        options
    );


    attachDownloadEvent(
        item,
        fileData,
        index,
        options
    );


    renderMultiOutputResults(
        item,
        index,
        operationEntry,
        options
    );


    return item;
}


/* =========================================================
   RENDER COMPLETE FILE LIST
========================================================= */

function renderFileList(
    files,
    container,
    options = {}
) {

    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    /*
     * Generic long-list compaction.
     *
     * renderFileList() is shared by the homepage, category/menu
     * pages and operation pages. From the fourth file onward,
     * switch to a reorder-friendly viewport sized around four
     * complete rows. This avoids the old visual jump where five
     * rows were fully expanded and the sixth suddenly reduced the
     * viewport to roughly three rows.
     */
    const maxVisibleFileRows = 4;

    const fileListContainer =
        container.closest(
            ".file-list-container"
        );

    const shouldLimitFileList =
        files.length >= maxVisibleFileRows;

    fileListContainer
        ?.classList
        .toggle(
            "is-scroll-limited",
            shouldLimitFileList
        );


    const dragState = {
        index: null
    };


    files.forEach(
        (
            fileData,
            index
        ) => {

            renderFileItem(
                fileData,
                index,
                container,
                {
                    ...options,
                    dragState
                }
            );
        }
    );


    /*
     * Size the scroll viewport from the real rendered rows instead
     * of relying only on a fixed pixel value. Audio-only rows and
     * preview-heavy image rows can have different heights; measuring
     * the first four keeps four complete items practical for reorder.
     */
    if (
        shouldLimitFileList
    ) {

        const visibleItems =
            Array.from(
                container.querySelectorAll(
                    ":scope > .file-item"
                )
            )
                .slice(
                    0,
                    maxVisibleFileRows
                );

        const targetHeight =
            visibleItems.reduce(
                (
                    total,
                    item
                ) => {

                    const style =
                        window.getComputedStyle(
                            item
                        );

                    const marginTop =
                        Number.parseFloat(
                            style.marginTop
                        ) || 0;

                    const marginBottom =
                        Number.parseFloat(
                            style.marginBottom
                        ) || 0;

                    return total +
                        item.getBoundingClientRect().height +
                        marginTop +
                        marginBottom;
                },
                0
            );

        if (
            targetHeight > 0
        ) {

            container.style.setProperty(
                "--file-list-scroll-height",
                `${Math.ceil(targetHeight)}px`
            );
        }

    } else {

        container.style.removeProperty(
            "--file-list-scroll-height"
        );
    }

    /* V4.2: release only after actual rows are present. Empty restores are
       released by file-storage.js after IndexedDB confirms zero files. */
    if (fileListContainer?.dataset.restorePending === "true" && files.length > 0) {
        fileListContainer.removeAttribute("data-restore-pending");
        fileListContainer.style.removeProperty("--easyfile-expected-rows");
        container.removeAttribute("aria-busy");
    }
}


/* =========================================================
   FILE COUNTER
========================================================= */

function updateFileListCounter(
    files,
    counterElement,
    options = {}
) {

    if (!counterElement) {
        return;
    }


    const count =
        files.length;


    if (
        count === 0
    ) {

        counterElement.textContent =
            "0 file";

        return;
    }


    const totalSize =
        files.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.file.size,
            0
        );


    const category =
        options.category
            ? ` • ${options.category}`
            : "";


    counterElement.textContent =
        `${count} ${
            count > 1
                ? "files"
                : "file"
        }${category} • ${
            formatFileSize(
                totalSize
            )
        }`;
}


/* =========================================================
   GENERIC FILE OPERATION PROGRESS
========================================================= */

// Immediately clear per-file progress when the shared controller cancels.
// Preserve this reset against progress callbacks emitted by a dying worker.
let easyFileIgnoreCancelledFileProgress = false;
document.addEventListener('easyfiletools:operation-cancel-requested', event => {
    if (!eventMatchesCurrentOperation(event.detail || {})) return;
    easyFileIgnoreCancelledFileProgress = true;
    document.querySelectorAll('#file-list .file-item').forEach(item => {
        setFileItemProgress(item, 0);
    });
});
document.addEventListener('easyfiletools:operation-started', () => {
    easyFileIgnoreCancelledFileProgress = false;
});

document.addEventListener(
    "easyfiletools:operation-file-progress",
    event => {
        if (easyFileIgnoreCancelledFileProgress) return;

        const detail =
            event.detail ||
            {};


        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {

            return;
        }


        const index =
            Number(
                detail.index
            );


        if (
            !Number.isInteger(
                index
            ) ||
            index < 0
        ) {

            return;
        }


        const item =
            getOperationFileItem(
                index
            );


        if (!item) {

            console.warn(
                "[FILE LIST] File item not found:",
                index
            );

            return;
        }


        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        detail.percentage
                    ) || 0
                )
            );


        setFileItemProgress(
            item,
            percentage
        );


        setFileItemStatus(
            item,
            `${
                detail.progressLabel ||
                "Processing"
            }... ${
                Math.round(
                    percentage
                )
            }%`,
            "converting",
            false
        );
    }
);


/* =========================================================
   GENERIC FILE OPERATION COMPLETED
========================================================= */

document.addEventListener(
    "easyfiletools:operation-file-completed",
    event => {
        if (easyFileIgnoreCancelledFileProgress) return;

        const detail =
            event.detail ||
            {};


        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {

            return;
        }


        const index =
            Number(
                detail.index
            );


        if (
            !Number.isInteger(
                index
            ) ||
            index < 0
        ) {

            return;
        }


        const item =
            getOperationFileItem(
                index
            );


        if (!item) {

            console.warn(
                "[FILE LIST] Completed item not found:",
                index
            );

            return;
        }


        /*
         * The result manager is the
         * canonical source.
         *
         * detail remains a safe
         * fallback for UI rendering.
         */

        const storedResult =
            getStoredFileResult(
                index
            );

        const storedEntry =
            getStoredFileOperation(
                index
            );

        const storedOutputs =
            Array.isArray(
                storedEntry?.outputs
            ) &&
            storedEntry.outputs.length > 0
                ? storedEntry.outputs
                : (
                    Array.isArray(
                        detail.outputs
                    )
                        ? detail.outputs
                        : []
                );


        if (
            storedOutputs.length > 0
        ) {

            const multiOutputEntry = {

                ...(
                    storedEntry ||
                    {}
                ),

                outputs:
                    storedOutputs

            };


            setFileItemProgress(
                item,
                100
            );


            setFileItemStatus(
                item,
                detail.completedLabel ||
                    buildMultiOutputLabel(
                        storedOutputs
                    ),
                "converted",
                true
            );


            /*
            * A source file with multiple outputs
            * does not have one main downloadable
            * result.
            */

            configureDownloadButton(
                item,
                index,
                multiOutputEntry,
                item._easyFileData ||
                    null,
                item._easyFileOptions ||
                    {}
            );


            renderMultiOutputResults(
                item,
                index,
                multiOutputEntry,
                item._easyFileOptions ||
                    {}
            );


            console.log(
                "[FILE LIST] Multi-output file completed:",
                {
                    index,

                    operation:
                        detail.operation,

                    outputCount:
                        storedOutputs.length
                }
            );


            return;

        }

        const result = {
            ...(
                storedResult ||
                {}
            ),
            ...detail
        };


        setFileItemProgress(
            item,
            100
        );


        setFileItemStatus(
            item,
            buildResultLabel(
                result
            ),
            "converted",
            true
        );


        configureDownloadButton(
            item,
            index,
            result,
            item._easyFileData ||
                null,
            item._easyFileOptions ||
                {}
        );


        console.log(
            "[FILE LIST] File operation completed:",
            {
                index,

                operation:
                    detail.operation,

                outputName:
                    result.outputName
            }
        );
    }
);


/* =========================================================
   GENERIC FILE OPERATION SKIPPED
========================================================= */

document.addEventListener(
    "easyfiletools:operation-file-skipped",
    event => {
        if (easyFileIgnoreCancelledFileProgress) return;

        const detail =
            event.detail || {};

        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {
            return;
        }

        const index =
            Number(detail.index);

        if (
            !Number.isInteger(index) ||
            index < 0
        ) {
            return;
        }

        const item =
            getOperationFileItem(index);

        if (!item) {
            return;
        }

        setFileItemProgress(
            item,
            100
        );

        setFileItemStatus(
            item,
            detail.message || "Skipped",
            "idle",
            false
        );

        console.info(
            "[FILE LIST] File skipped:",
            {
                index,
                operation: detail.operation,
                message: detail.message
            }
        );
    }
);


/* =========================================================
   GENERIC FILE OPERATION ERROR
========================================================= */

document.addEventListener(
    "easyfiletools:operation-file-error",
    event => {
        if (easyFileIgnoreCancelledFileProgress) return;

        const detail =
            event.detail || {};

        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {
            return;
        }

        const index =
            Number(detail.index);

        if (
            !Number.isInteger(index) ||
            index < 0
        ) {
            return;
        }

        const item =
            getOperationFileItem(index);

        if (!item) {
            return;
        }

        setFileItemProgress(
            item,
            100
        );

        setFileItemStatus(
            item,
            detail.message || "Processing failed",
            "failed",
            false
        );

        console.warn(
            "[FILE LIST] File operation failed:",
            {
                index,
                operation: detail.operation,
                message: detail.message
            }
        );
    }
);


/* =========================================================
   GENERIC FILE OPERATION CANCELLED
========================================================= */

document.addEventListener(
    "easyfiletools:operation-file-cancelled",
    event => {

        const detail =
            event.detail ||
            {};


        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {

            return;
        }


        const index =
            Number(
                detail.index
            );


        if (
            !Number.isInteger(
                index
            ) ||
            index < 0
        ) {

            return;
        }


        const item =
            getOperationFileItem(
                index
            );


        if (!item) {
            return;
        }


        const resultItem =
            getStoredFileOperation(
                index
            );


        /* =========================
           PREVIOUS STALE RESULT
        ========================= */

        if (
            resultItem?.result &&
            resultItem.stale === true
        ) {

            setFileItemProgress(
                item,
                0
            );


            const stateElement =
                item.querySelector(
                    ".file-state"
                );


            if (
                stateElement
            ) {

                stateElement.className =
                    "file-state stale";


                stateElement.innerHTML = `

                    <i data-lucide="triangle-alert"></i>

                    <span>
                        Previous result • settings changed
                    </span>

                `;


                createLocalIcons(
                    stateElement
                );
            }


            return;
        }


        /* =========================
           CURRENT RESULT EXISTS
        ========================= */

        if (
            resultItem?.result
        ) {

            setFileItemProgress(
                item,
                100
            );


            setFileItemStatus(
                item,
                buildResultLabel(
                    resultItem.result
                ),
                "converted",
                true
            );


            return;
        }


        /* =========================
           NO PREVIOUS RESULT
        ========================= */

        setFileItemProgress(
            item,
            0
        );


        setFileItemStatus(
            item,
            "Ready",
            "ready",
            true
        );
    }
);

/* =========================================================
   RESULT STALE / CURRENT
========================================================= */

document.addEventListener(
    "easyfiletools:file-operation-stale-changed",
    event => {

        const detail =
            event.detail ||
            {};


        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {

            return;
        }


        const index =
            Number(
                detail.index
            );


        if (
            !Number.isInteger(
                index
            ) ||
            index < 0
        ) {

            return;
        }


        const item =
            getOperationFileItem(
                index
            );


        if (!item) {
            return;
        }

        const storedEntry =
            getStoredFileOperation(
                index
            );


        const storedOutputs =
            Array.isArray(
                storedEntry?.outputs
            )
                ? storedEntry.outputs
                : [];        

        /* =========================
           STALE RESULT
        ========================= */

        if (
            detail.stale ===
            true
        ) {

            setFileItemStatus(
                item,
                "Previous result • settings changed",
                "stale",
                false
            );


            const stateElement =
                item.querySelector(
                    ".file-state"
                );


            if (
                stateElement
            ) {

                stateElement.innerHTML = `

                    <i data-lucide="triangle-alert"></i>

                    <span>
                        Previous result • settings changed
                    </span>

                `;


                createLocalIcons(
                    stateElement
                );
            }


            setFileItemProgress(
                item,
                0
            );

            renderMultiOutputResults(
                item,
                index,
                storedEntry,
                item._easyFileOptions ||
                    {}
            );            

            return;
        }


        /* =========================
           CURRENT RESULT
        ========================= */

        if (
            storedOutputs.length > 0
        ) {

            setFileItemStatus(
                item,
                buildMultiOutputLabel(
                    storedOutputs
                ),
                "converted",
                true
            );


            setFileItemProgress(
                item,
                100
            );


            renderMultiOutputResults(
                item,
                index,
                storedEntry,
                item._easyFileOptions ||
                    {}
            );


            return;

        }

        const storedResult =
            getStoredFileResult(
                index
            );


        const result = {
            ...(
                storedResult ||
                {}
            ),
            ...detail
        };


        setFileItemStatus(
            item,
            buildResultLabel(
                result
            ),
            "converted",
            true
        );


        setFileItemProgress(
            item,
            100
        );
    }
);


/* =========================================================
   GENERIC CONTROLLER PAUSE / RESUME / CANCEL
========================================================= */

document.addEventListener(
    "easyfiletools:operation-state-changed",
    event => {

        const detail =
            event.detail ||
            {};


        if (
            !eventMatchesCurrentOperation(
                detail
            )
        ) {

            return;
        }


        const status =
            detail.status;


        const isBatch =
            detail.config
                ?.resultMode ===
            "batch";


        /* =================================================
           BATCH
        ================================================= */

        if (
            isBatch
        ) {

            /* =========================
               RUNNING
            ========================= */

            if (
                status ===
                "running"
            ) {

                document
                    .querySelectorAll(
                        "#file-list .file-item"
                    )
                    .forEach(
                        item => {

                            /*
                             * Individual progress has no
                             * meaning for a BATCH operation.
                             */

                            setFileItemProgress(
                                item,
                                0
                            );


                            setFileItemStatus(
                                item,
                                "Merging...",
                                "converting"
                            );
                        }
                    );


                return;
            }


            /* =========================
               PAUSED
            ========================= */

            if (
                status ===
                "paused"
            ) {

                document
                    .querySelectorAll(
                        "#file-list .file-item"
                    )
                    .forEach(
                        item => {

                            setFileItemProgress(
                                item,
                                0
                            );


                            setFileItemStatus(
                                item,
                                "Paused",
                                "paused"
                            );
                        }
                    );


                return;
            }


            /* =========================
            COMPLETED
            ========================= */

            if (
                status ===
                "completed"
            ) {

                const batchResult =
                    window
                        .EasyFileOperationResults
                        ?.getBatch?.()
                        ?.result;


                const completedLabel =
                    batchResult
                        ?.completedLabel ||
                    "Processed";


                document
                    .querySelectorAll(
                        "#file-list .file-item"
                    )
                    .forEach(
                        item => {

                            setFileItemProgress(
                                item,
                                0
                            );


                            setFileItemStatus(
                                item,
                                completedLabel,
                                "converted",
                                true
                            );

                        }
                    );


                return;

            }


            /* =========================
            CANCELLED / ERROR
            ========================= */

            if (
                status ===
                    "cancelled" ||
                status ===
                    "error"
            ) {

                document
                    .querySelectorAll(
                        "#file-list .file-item"
                    )
                    .forEach(
                        item => {

                            setFileItemProgress(
                                item,
                                0
                            );


                            setFileItemStatus(
                                item,
                                "Ready",
                                "ready",
                                true
                            );

                        }
                    );


                return;

            }


            return;
        }


        /* =================================================
           PER FILE
        ================================================= */


        /* =========================
           PAUSED
        ========================= */

        if (
            status ===
            "paused"
        ) {

            document
                .querySelectorAll(
                    "#file-list .file-state.converting"
                )
                .forEach(
                    stateElement => {

                        const text =
                            stateElement.querySelector(
                                "span"
                            );


                        if (
                            text
                        ) {

                            stateElement.dataset
                                .resumeText =
                                text.textContent ||
                                "Processing...";
                        }


                        stateElement.className =
                            "file-state paused";


                        if (
                            text
                        ) {

                            text.textContent =
                                "Paused";
                        }
                    }
                );


            return;
        }


        /* =========================
           RESUMED
        ========================= */

        if (
            status ===
            "running"
        ) {

            document
                .querySelectorAll(
                    "#file-list .file-state.paused"
                )
                .forEach(
                    stateElement => {

                        const text =
                            stateElement.querySelector(
                                "span"
                            );


                        stateElement.className =
                            "file-state converting";


                        if (
                            text
                        ) {

                            text.textContent =
                                stateElement.dataset
                                    .resumeText ||
                                "Processing...";
                        }


                        delete stateElement.dataset
                            .resumeText;
                    }
                );


            return;
        }


        /* =========================
           CANCELLED
        ========================= */

        if (
            status ===
            "cancelled"
        ) {

            document
                .querySelectorAll(
                    "#file-list .file-state.converting, #file-list .file-state.paused"
                )
                .forEach(
                    stateElement => {

                        const item =
                            stateElement.closest(
                                ".file-item"
                            );


                        if (
                            !item
                        ) {

                            return;
                        }


                        setFileItemProgress(
                            item,
                            0
                        );


                        setFileItemStatus(
                            item,
                            "Ready",
                            "ready",
                            true
                        );
                    }
                );
        }
    }
);


console.log(
    "[FILE LIST] GENERIC OPERATION VERSION LOADED"
);