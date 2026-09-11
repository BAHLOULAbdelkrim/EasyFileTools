console.log("file-list.js loaded");


/* =========================================================
   RENDRE UN ÉLÉMENT DE FICHIER
========================================================= */

function renderFileItem(
    fileData,
    index,
    container,
    options = {}
) {

    const file = fileData.file;

    const category =
        options.category ||
        getFileCategory(file.name);

    const maxSize =
        options.maxSize ?? Infinity;

    const showStatus =
        options.showStatus ?? true;

    const showProgress =
        options.showProgress ?? true;

    const enableReorder =
        options.enableReorder ?? false;

    const dragState =
        options.dragState || { index: null };

    const item =
        document.createElement("div");

    item.className = "file-item";

    item.dataset.fileIndex =
        index;


    /* =====================================================
       DRAG & DROP
    ===================================================== */

    if (enableReorder) {

        item.setAttribute("draggable", "true");


        item.addEventListener("dragstart", () => {

            dragState.index = index;

            item.classList.add("dragging");

        });


        item.addEventListener("dragend", () => {

            item.classList.remove("dragging");

            document
                .querySelectorAll(".drop-target")
                .forEach(el => {

                    el.classList.remove("drop-target");

                });

        });


        item.addEventListener("dragover", (event) => {

            event.preventDefault();

            item.classList.add("drop-target");

        });


        item.addEventListener("dragleave", () => {

            item.classList.remove("drop-target");

        });


        item.addEventListener("drop", (event) => {

            event.preventDefault();

            item.classList.remove("drop-target");

            const targetIndex = index;

            const fromIndex =
                dragState.index;

            if (
                fromIndex === null ||
                fromIndex === targetIndex
            ) {

                return;

            }

            if (
                typeof options.onReorder === "function"
            ) {

                options.onReorder(
                    fromIndex,
                    targetIndex
                );

            }

            dragState.index = null;

        });

    }


    /* =====================================================
       FICHIER TROP VOLUMINEUX
    ===================================================== */

    if (file.size > maxSize) {

        item.innerHTML = `

            <div class="file-left">

                <div class="status-icon error">

                    <i data-lucide="circle-x"></i>

                </div>

                <div class="file-info">

                    <div class="file-name file-error">

                        ${index + 1}. ${file.name}

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

        createLocalIcons(item);

        attachRemoveEvent(
            item,
            fileData,
            index,
            options
        );

        return item;
    }


    /* =====================================================
       APERÇU
    ===================================================== */

    let previewHTML = "";

    if (
        fileData.previewType === "image" ||
        fileData.previewType === "video" ||
        fileData.previewType === "pdf"
    ) {

        previewHTML = `

            <img
                src="${fileData.previewUrl}"
                class="image-preview"
            >

        `;

    } else {

        previewHTML = `

            <div class="file-placeholder ${category}">

                <i data-lucide="${getFileIcon(category)}"></i>

            </div>

        `;

    }

    /* =====================================================

        ÉTAT DU FICHIER

    ===================================================== */

    let fileStateHTML = "";

    if (showStatus) {

        if (fileData.convertedUrl) {

            const convertedFormat =
                (
                    fileData.convertedFormat ||
                    ""
                ).toUpperCase();

            const convertedSize =
                fileData.convertedSize
                    ? ` • ${formatFileSize(
                        fileData.convertedSize
                    )}`
                    : "";

            fileStateHTML = `

                <div class="file-state converted">

                    <i data-lucide="check"></i>

                    <span>

                        Converted → ${convertedFormat}${convertedSize}

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

    /* =====================================================
    PROGRESSION
    ===================================================== */

    const progressValue =
        fileData.convertedUrl
            ? 100
            : 0;

    const progressHTML = showProgress

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
       INFORMATIONS
    ===================================================== */

    const dimensions =
        fileData.meta?.dimensions
            ? ` • ${fileData.meta.dimensions.width} × ${fileData.meta.dimensions.height}`
            : "";

    const duration =
        fileData.meta?.duration
            ? ` • ${formatDuration(fileData.meta.duration)}`
            : "";

    const pages =
        fileData.meta?.pages
            ? ` • ${fileData.meta.pages} ${
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

                        ${index + 1}. ${file.name}

                    </div>

                    <div class="file-extension">

                        ${category}
                        •
                        ${formatFileSize(file.size)}

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

            <button
                type="button"
                class="download-btn"
                ${fileData.convertedUrl ? "" : "disabled"}
            >

                <i data-lucide="download"></i>

            </button>

            <button
                type="button"
                class="remove-btn shiny-btn"
            >

                <i data-lucide="trash-2"></i>

            </button>

        </div>

    `;


    container.appendChild(item);

    createLocalIcons(item);

    fileData.element = item;


    /* =====================================================
       SUPPRESSION
    ===================================================== */

    attachRemoveEvent(
        item,
        fileData,
        index,
        options
    );

    attachDownloadEvent(
        item,
        fileData,
        options
    );

    return item;
}


/* =========================================================
   BARRE LOCALE + ÉTAT TEXTE
========================================================= */

function getFileItemElement(target) {

    if (!target) {
        return null;
    }

    if (target instanceof HTMLElement) {
        return target;
    }

    if (target.element instanceof HTMLElement) {
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
        getFileItemElement(target);

    if (!item) {

        console.warn(
            "[FILE LIST] File element unavailable:",
            target?.file?.name || target
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
        (state ? ` ${state}` : "");

    if (showCheck) {

        statusElement.innerHTML = `

            <i data-lucide="check"></i>

            <span>
                ${text}
            </span>

        `;

        createLocalIcons(
            statusElement
        );
    }
    else {

        statusElement.innerHTML = `

            <span>
                ${text}
            </span>

        `;
    }
}


function setFileItemProgress(
    target,
    percentage
) {

    const item =
        getFileItemElement(target);

    if (!item) {

        console.warn(
            "[FILE LIST] File element unavailable:",
            target?.file?.name || target
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
                Number(percentage) || 0
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
        getFileItemElement(target);

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

    if (isLoading) {

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
   ÉVÉNEMENT TÉLÉCHARGEMENT
========================================================= */

function attachDownloadEvent(
    item,
    fileData,
    options
) {

    const downloadBtn =
        item.querySelector(".download-btn");

    if (!downloadBtn) {
        return;
    }

    if (!fileData.convertedUrl) {
        return;
    }

    downloadBtn.addEventListener(
        "click",
        async () => {

            if (
                typeof options.onDownload === "function"
            ) {

                await options.onDownload(
                    fileData,
                    item
                );

                return;
            }

            const link =
                document.createElement("a");

            link.href =
                fileData.convertedUrl;

            link.download =
                fileData.convertedName ||
                fileData.file.name;

            document.body.appendChild(link);

            link.click();

            link.remove();

        }
    );
}


/* =========================================================
   ÉVÉNEMENT SUPPRESSION
========================================================= */

function attachRemoveEvent(
    item,
    fileData,
    index,
    options
) {

    const removeBtn =
        item.querySelector(".remove-btn");

    if (!removeBtn) {
        return;
    }


    removeBtn.addEventListener(
        "click",
        async () => {

            if (
                typeof options.onRemove === "function"
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
   RENDRE UNE LISTE COMPLÈTE
========================================================= */

function renderFileList(
    files,
    container,
    options = {}
) {

    if (!container) {
        return;
    }


    container.innerHTML = "";


    const dragState = {
        index: null
    };


    files.forEach((fileData, index) => {

        renderFileItem(
            fileData,
            index,
            container,
            {
                ...options,
                dragState
            }
        );

    });

}


/* =========================================================
   COMPTEUR GÉNÉRIQUE
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


    if (count === 0) {

        counterElement.textContent =
            "0 file";

        return;
    }


    const totalSize =
        files.reduce(
            (sum, item) =>
                sum + item.file.size,
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
            formatFileSize(totalSize)
        }`;

}


/* =========================================================
   PROGRESSION DE CONVERSION D'UN FICHIER
========================================================= */

document.addEventListener(
    "easyfiletools:file-conversion-progress",
    (event) => {

        const detail =
            event.detail || {};

        const index =
            detail.index;

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

        const item =
            document.querySelector(
                `#file-list .file-item[data-file-index="${index}"]`
            );

        if (!item) {
            return;
        }

        setFileItemStatus(
            item,
            `Converting... ${Math.round(percentage)}%`,
            "converting",
            false
        );

        setFileItemProgress(
            item,
            percentage
        );
    }
);


/* =========================================================
   CONVERSION PAUSED
========================================================= */

document.addEventListener(
    "easyfiletools:conversion-paused",
    (event) => {

        const detail =
            event.detail || {};

        const index =
            detail.index;

        if (
            index === undefined ||
            index === null ||
            index < 0
        ) {
            return;
        }

        const item =
            document.querySelector(
                `#file-list .file-item[data-file-index="${index}"]`
            );

        if (!item) {
            return;
        }

        setFileItemStatus(
            item,
            "Paused",
            "paused",
            false
        );
    }
);


/* =========================================================
   CONVERSION CANCELLED
========================================================= */

document.addEventListener(
    "easyfiletools:conversion-cancelled",
    (event) => {

        const detail =
            event.detail || {};

        const index =
            detail.index;

        if (
            index === undefined ||
            index === null ||
            index < 0
        ) {
            return;
        }

        const item =
            document.querySelector(
                `#file-list .file-item[data-file-index="${index}"]`
            );

        if (!item) {
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


/* =========================================================
   FICHIER CONVERTI
========================================================= */

document.addEventListener(
    "easyfiletools:file-converted",
    (event) => {

        const detail =
            event.detail || {};

        const fileData =
            detail.fileData;

        if (!fileData) {

            console.warn(
                "[FILE LIST] Converted fileData unavailable"
            );

            return;
        }


        /* =================================================
           ENREGISTRER LE RÉSULTAT
        ================================================= */

        fileData.convertedUrl =
            detail.url || null;

        fileData.convertedName =
            detail.outputName || null;

        fileData.convertedBlob =
            detail.blob || null;

        fileData.convertedSize =
            detail.size || 0;

        fileData.convertedFormat =
            detail.outputFormat || null;


        /* =================================================
           RÉCUPÉRER LA LIGNE
        ================================================= */

        const item =
            document.querySelector(
                `#file-list .file-item[data-file-index="${detail.index}"]`
            );

        if (!item) {

            console.warn(
                "[FILE LIST] File element unavailable:",
                detail.sourceName
            );

            return;
        }

        /* =================================================
        ÉTAT CONVERTI
        ================================================= */

        const fileState =
            item.querySelector(
                ".file-state"
            );

        if (fileState) {

            const outputFormat =
                (
                    fileData.convertedFormat ||
                    ""
                ).toUpperCase();

            fileState.className =
                "file-state converted";

            fileState.innerHTML = `

                <i data-lucide="check"></i>

                <span>
                    Converted → ${outputFormat} • ${
                        formatFileSize(
                            fileData.convertedSize
                        )
                    }
                </span>

            `;

            createLocalIcons(
                fileState
            );
        }

        setFileItemProgress(
            item,
            100
        );

        /* =================================================
        ACTIVER DOWNLOAD
        ================================================= */

        const downloadBtn =
            item.querySelector(
                ".download-btn"
            );

        if (!downloadBtn) {
            return;
        }

        downloadBtn.disabled =
            false;

        /* =================================================
           TÉLÉCHARGEMENT
        ================================================= */

        downloadBtn.onclick =
            () => {

                if (
                    !fileData.convertedUrl
                ) {
                    return;
                }

                const link =
                    document.createElement(
                        "a"
                    );

                link.href =
                    fileData.convertedUrl;

                link.download =
                    fileData.convertedName ||
                    fileData.file.name;

                document.body.appendChild(
                    link
                );

                link.click();

                link.remove();
            };


        console.log(
            "[FILE LIST] Converted file ready:",
            fileData.convertedName
        );
    }
);


