console.log("common/operation-zone.js loaded");

/* =========================
   OPERATION ZONE
========================= */

document.addEventListener("DOMContentLoaded", async () => {

    const operationZone =
        document.getElementById("operation-zone");

    if (!operationZone) return;

    /* =========================
       FICHIERS DE L'OPÉRATION
    ========================= */

    let operationFiles = [];

    let selectedConversionFormat =
        null;

    let operationIsConverting =
        false;

    let operationIsPaused =
        false;

    let operationIsDownloading =
        false;

    let downloadAllCompleted =
        false;

    let operationFileProgress =
        [];

    /* =========================
       LUCIDE ICONS
    ========================= */

    if (typeof createLocalIcons === "function") {

        createLocalIcons(operationZone);

    }
    else if (typeof lucide !== "undefined") {

        lucide.createIcons({
            attrs: {
                "stroke-width": 2
            }
        });

    }

    /* =========================
       GO TO TOP
    ========================= */

    const goToTopBtn =
        document.getElementById("goToTopBtn");

    if (goToTopBtn) {

        goToTopBtn.addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }



const operationClearAllBtn =
    document.getElementById(
        "operationClearAllBtn"
    );

const downloadAllBtn =
    document.getElementById(
        "downloadAllBtn"
    );

const downloadAllFormats =
    document.getElementById(
        "downloadAllFormats"
    );

const convertBtn =
    document.getElementById(
        "convertBtn"
    );

const chooseFormatLabel =
    document.getElementById(
        "chooseFormatLabel"
    );

const cancelOperationBtn =
    document.getElementById(
        "cancelOperationBtn"
    );

const pauseOperationBtn =
    document.getElementById(
        "pauseOperationBtn"
    );

const conversionFormats =
    document.getElementById(
        "conversionFormats"
    );


/* =========================
   CLEAR ALL
========================= */

function updateOperationClearAll() {

    if (!operationClearAllBtn) {
        return;
    }

    const hasFiles =
        operationFiles.length > 0;

    operationClearAllBtn.disabled =
        !hasFiles;

    if (hasFiles) {

        operationClearAllBtn.classList.add(
            "active"
        );
    }
    else {

        operationClearAllBtn.classList.remove(
            "active"
        );
    }
}

/* =========================
   DOWNLOAD ALL FORMATS
========================= */

function renderDownloadAllFormats() {

    if (!downloadAllFormats) {
        return;
    }

    downloadAllFormats.innerHTML = `
        <button
            type="button"
            class="download-format-btn"
            data-download-format="zip"
        >
            ZIP
        </button>

        <button
            type="button"
            class="download-format-btn"
            data-download-format="tar.gz"
        >
            TAR.GZ
        </button>

        <button
            type="button"
            class="download-format-btn"
            data-download-format="tar"
        >
            TAR
        </button>
    `;
}

/* =========================
   DOWNLOAD ALL
========================= */

function updateDownloadAll() {

    if (!downloadAllBtn) {
        return;
    }

    const allFilesConverted =
        operationFiles.length > 0 &&
        operationFiles.every(
            fileData =>
                fileData.convertedUrl
        );

    const canDownload =
        allFilesConverted &&
        !operationIsDownloading;

    downloadAllBtn.disabled =
        !canDownload;

    if (canDownload) {

        downloadAllBtn.classList.add(
            "active"
        );
    }
    else {

        downloadAllBtn.classList.remove(
            "active"
        );
    }
}

/* =========================
   CREATE DOWNLOAD ALL ZIP
========================= */

async function downloadAllAsZip() {

    if (operationIsDownloading) {
        return;
    }

    if (
        typeof JSZip === "undefined"
    ) {

        console.error(
            "[OPERATION ZONE] JSZip unavailable"
        );

        return;
    }


    const convertedFiles =
        operationFiles.filter(
            fileData =>
                fileData.convertedUrl
        );


    if (
        convertedFiles.length === 0 ||
        convertedFiles.length !==
            operationFiles.length
    ) {

        console.warn(
            "[OPERATION ZONE] Not all files are converted"
        );

        return;
    }


    operationIsDownloading =
        true;

    updateDownloadAll();


    try {

        updateGlobalProgress(
            0,
            "Preparing ZIP..."
        );


        const zip =
            new JSZip();


        for (
            let index = 0;
            index < convertedFiles.length;
            index++
        ) {

            const fileData =
                convertedFiles[index];


            let convertedBlob =
                fileData.convertedBlob;


            /*
             * Fallback :
             * si le Blob n'est pas directement disponible,
             * on le récupère depuis convertedUrl.
             */

            if (!convertedBlob) {

                const response =
                    await fetch(
                        fileData.convertedUrl
                    );

                convertedBlob =
                    await response.blob();
            }


            const fileName =
                fileData.convertedName ||
                `converted-file-${index + 1}`;


            zip.file(
                fileName,
                convertedBlob
            );
        }


        const zipBlob =
            await zip.generateAsync(
                {
                    type: "blob"
                },
                metadata => {

                    updateGlobalProgress(
                        metadata.percent,
                        "Preparing ZIP..."
                    );
                }
            );


        updateGlobalProgress(
            100,
            "ZIP ready"
        );


        /* =========================
           ZIP NAME
        ========================= */

        const category =
            (
                operationZone.dataset.category ||
                "files"
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );


        const zipName =
            `EasyFileTools-converted-${category || "files"}.zip`;


        /* =========================
           START DOWNLOAD
        ========================= */

        const downloadUrl =
            URL.createObjectURL(
                zipBlob
            );


        const link =
            document.createElement(
                "a"
            );

        link.href =
            downloadUrl;

        link.download =
            zipName;

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        downloadAllCompleted =
            true;


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    downloadUrl
                );
            },
            1000
        );


        console.log(
            "[OPERATION ZONE] ZIP download started:",
            zipName
        );


        /* =========================
           SUCCESS MESSAGE
        ========================= */

        if (
            typeof showSuccessToast ===
            "function"
        ) {

            showSuccessToast(
                "Download started",
                "Your ZIP file is ready and the download has started.",
                2000
            );
        }

    }
    catch (error) {

        console.error(
            "[OPERATION ZONE] Download All failed:",
            error
        );
    }
    finally {

        operationIsDownloading =
            false;

        updateDownloadAll();


        /*
         * La conversion reste terminée,
         * donc on remet son état normal.
         */

        updateGlobalProgress(
            100,
            "Conversion progress"
        );
    }
}

/* =========================
   TAR HELPERS
========================= */

function writeTarString(
    buffer,
    offset,
    length,
    value
) {

    const encoder =
        new TextEncoder();

    const bytes =
        encoder.encode(
            String(value)
        );

    const maxLength =
        Math.min(
            bytes.length,
            length
        );

    buffer.set(
        bytes.slice(
            0,
            maxLength
        ),
        offset
    );
}


function writeTarOctal(
    buffer,
    offset,
    length,
    value
) {

    const octal =
        Math.floor(value)
            .toString(8)
            .padStart(
                length - 1,
                "0"
            );

    writeTarString(
        buffer,
        offset,
        length,
        `${octal}\0`
    );
}


function createTarHeader(
    fileName,
    fileSize
) {

    const header =
        new Uint8Array(512);


    /* FILE NAME */

    writeTarString(
        header,
        0,
        100,
        fileName
    );


    /* FILE MODE */

    writeTarString(
        header,
        100,
        8,
        "0000644\0"
    );


    /* USER ID */

    writeTarString(
        header,
        108,
        8,
        "0000000\0"
    );


    /* GROUP ID */

    writeTarString(
        header,
        116,
        8,
        "0000000\0"
    );


    /* FILE SIZE */

    writeTarOctal(
        header,
        124,
        12,
        fileSize
    );


    /* MODIFICATION TIME */

    writeTarOctal(
        header,
        136,
        12,
        Math.floor(
            Date.now() / 1000
        )
    );


    /* CHECKSUM PLACEHOLDER */

    for (
        let index = 148;
        index < 156;
        index++
    ) {

        header[index] =
            32;
    }


    /* FILE TYPE */

    writeTarString(
        header,
        156,
        1,
        "0"
    );


    /* USTAR SIGNATURE */

    writeTarString(
        header,
        257,
        6,
        "ustar"
    );

    writeTarString(
        header,
        263,
        2,
        "00"
    );


    /* CHECKSUM */

    let checksum =
        0;

    for (
        const byte of header
    ) {

        checksum +=
            byte;
    }


    const checksumString =
        checksum
            .toString(8)
            .padStart(
                6,
                "0"
            );


    writeTarString(
        header,
        148,
        8,
        `${checksumString}\0 `
    );


    return header;
}

/* =========================
   CREATE TAR
========================= */

async function createTarBlob(
    convertedFiles,
    progressCallback = null
) {

    const tarParts =
        [];


    for (
        let index = 0;
        index < convertedFiles.length;
        index++
    ) {

        const fileData =
            convertedFiles[index];


        let convertedBlob =
            fileData.convertedBlob;


        if (!convertedBlob) {

            const response =
                await fetch(
                    fileData.convertedUrl
                );

            convertedBlob =
                await response.blob();
        }


        const fileName =
            fileData.convertedName ||
            `converted-file-${index + 1}`;


        const fileBuffer =
            new Uint8Array(
                await convertedBlob.arrayBuffer()
            );


        const header =
            createTarHeader(
                fileName,
                fileBuffer.length
            );


        tarParts.push(
            header
        );

        tarParts.push(
            fileBuffer
        );


        /* =========================
           TAR PADDING
        ========================= */

        const paddingSize =
            (
                512 -
                (
                    fileBuffer.length %
                    512
                )
            ) % 512;


        if (paddingSize > 0) {

            tarParts.push(
                new Uint8Array(
                    paddingSize
                )
            );
        }


        if (progressCallback) {

            progressCallback(
                (
                    (index + 1) /
                    convertedFiles.length
                ) * 100
            );
        }
    }


    /*
     * TAR se termine par
     * deux blocs vides de 512 octets.
     */

    tarParts.push(
        new Uint8Array(
            1024
        )
    );


    return new Blob(
        tarParts,
        {
            type:
                "application/x-tar"
        }
    );
}

/* =========================
   DOWNLOAD BLOB
========================= */

function downloadBlob(
    blob,
    fileName
) {

    const downloadUrl =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );

    link.href =
        downloadUrl;

    link.download =
        fileName;


    document.body.appendChild(
        link
    );

    link.click();

    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                downloadUrl
            );

        },
        1000
    );
}

/* =========================
   DOWNLOAD ALL AS TAR
========================= */

async function downloadAllAsTar() {

    if (operationIsDownloading) {
        return;
    }


    const convertedFiles =
        operationFiles.filter(
            fileData =>
                fileData.convertedUrl
        );


    if (
        convertedFiles.length === 0 ||
        convertedFiles.length !==
            operationFiles.length
    ) {

        console.warn(
            "[OPERATION ZONE] Not all files are converted"
        );

        return;
    }


    operationIsDownloading =
        true;

    updateDownloadAll();


    try {

        updateGlobalProgress(
            0,
            "Preparing TAR..."
        );


        const tarBlob =
            await createTarBlob(
                convertedFiles,
                percentage => {

                    updateGlobalProgress(
                        percentage,
                        "Preparing TAR..."
                    );
                }
            );


        updateGlobalProgress(
            100,
            "TAR ready"
        );


        const category =
            (
                operationZone.dataset.category ||
                "files"
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );


        const tarName =
            `EasyFileTools-converted-${category || "files"}.tar`;


        downloadBlob(
            tarBlob,
            tarName
        );

        downloadAllCompleted =
            true;

        console.log(
            "[OPERATION ZONE] TAR download started:",
            tarName
        );


        if (
            typeof showSuccessToast ===
            "function"
        ) {

            showSuccessToast(
                "Download started",
                "Your TAR file is ready and the download has started.",
                2000
            );
        }

    }
    catch (error) {

        console.error(
            "[OPERATION ZONE] TAR creation failed:",
            error
        );
    }
    finally {

        operationIsDownloading =
            false;

        updateDownloadAll();

        updateGlobalProgress(
            100,
            "Conversion progress"
        );
    }
}

/* =========================
   GZIP BLOB
========================= */

async function gzipBlob(
    blob
) {

    if (
        typeof CompressionStream ===
        "undefined"
    ) {

        throw new Error(
            "CompressionStream unavailable"
        );
    }


    const compressionStream =
        new CompressionStream(
            "gzip"
        );


    const compressedStream =
        blob
            .stream()
            .pipeThrough(
                compressionStream
            );


    return await new Response(
        compressedStream
    ).blob();
}

/* =========================
   DOWNLOAD ALL AS TAR.GZ
========================= */

async function downloadAllAsTarGz() {

    if (operationIsDownloading) {
        return;
    }


    const convertedFiles =
        operationFiles.filter(
            fileData =>
                fileData.convertedUrl
        );


    if (
        convertedFiles.length === 0 ||
        convertedFiles.length !==
            operationFiles.length
    ) {

        console.warn(
            "[OPERATION ZONE] Not all files are converted"
        );

        return;
    }


    operationIsDownloading =
        true;

    updateDownloadAll();


    try {

        /*
         * 0 → 75 %
         * création du TAR
         */

        updateGlobalProgress(
            0,
            "Preparing TAR..."
        );


        const tarBlob =
            await createTarBlob(
                convertedFiles,
                percentage => {

                    updateGlobalProgress(
                        percentage * 0.75,
                        "Preparing TAR..."
                    );
                }
            );


        /*
         * Compression gzip.
         *
         * CompressionStream ne fournit pas
         * directement un pourcentage réel.
         */

        updateGlobalProgress(
            80,
            "Compressing TAR.GZ..."
        );


        const tarGzBlob =
            await gzipBlob(
                tarBlob
            );


        updateGlobalProgress(
            100,
            "TAR.GZ ready"
        );


        const category =
            (
                operationZone.dataset.category ||
                "files"
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );


        const tarGzName =
            `EasyFileTools-converted-${category || "files"}.tar.gz`;


        downloadBlob(
            tarGzBlob,
            tarGzName
        );

        downloadAllCompleted =
            true;

        console.log(
            "[OPERATION ZONE] TAR.GZ download started:",
            tarGzName
        );


        if (
            typeof showSuccessToast ===
            "function"
        ) {

            showSuccessToast(
                "Download started",
                "Your TAR.GZ file is ready and the download has started.",
                2000
            );
        }

    }
    catch (error) {

        console.error(
            "[OPERATION ZONE] TAR.GZ creation failed:",
            error
        );


        if (
            error.message ===
            "CompressionStream unavailable"
        ) {

            console.warn(
                "[OPERATION ZONE] This browser does not support native gzip compression."
            );
        }
    }
    finally {

        operationIsDownloading =
            false;

        updateDownloadAll();

        updateGlobalProgress(
            100,
            "Conversion progress"
        );
    }
}

/* =========================
   DOWNLOAD ALL
========================= */

if (downloadAllBtn) {

    downloadAllBtn.addEventListener(
        "click",
        () => {

            if (
                downloadAllBtn.disabled ||
                operationIsDownloading
            ) {
                return;
            }

            if (!downloadAllFormats) {
                return;
            }

            renderDownloadAllFormats();

            downloadAllFormats.classList.toggle(
                "hidden"
            );
        }
    );
}

if (downloadAllFormats) {

    downloadAllFormats.addEventListener(
        "click",
        async (event) => {

            const button =
                event.target.closest(
                    "[data-download-format]"
                );

            if (!button) {
                return;
            }

            const format =
                button.dataset.downloadFormat;


            console.log(
                "[OPERATION ZONE] Download format selected:",
                format
            );


            if (format === "zip") {

                downloadAllFormats.classList.add(
                    "hidden"
                );

                await downloadAllAsZip();

                return;
            }

            if (format === "tar.gz") {

                downloadAllFormats.classList.add(
                    "hidden"
                );

                await downloadAllAsTarGz();

                return;
            }


            if (format === "tar") {

                downloadAllFormats.classList.add(
                    "hidden"
                );

                await downloadAllAsTar();

                return;
            }

        }
    );
}

/* =========================
   CANCEL
========================= */

function updateCancelButton() {

    if (!cancelOperationBtn) {
        return;
    }

    cancelOperationBtn.disabled =
        !operationIsConverting;

    if (operationIsConverting) {

        cancelOperationBtn.classList.add(
            "active"
        );
    }
    else {

        cancelOperationBtn.classList.remove(
            "active"
        );
    }
}

/* =========================
   PAUSE / RESUME
========================= */

function updatePauseButton() {

    if (!pauseOperationBtn) {
        return;
    }

    pauseOperationBtn.disabled =
        !operationIsConverting;

    if (!operationIsConverting) {

        pauseOperationBtn.classList.remove(
            "active"
        );

        pauseOperationBtn.innerHTML = `

            <i data-lucide="pause"></i>

            Pause

        `;

        createLocalIcons(
            pauseOperationBtn
        );

        return;
    }

    pauseOperationBtn.classList.add(
        "active"
    );

    if (operationIsPaused) {

        pauseOperationBtn.innerHTML = `

            <i data-lucide="play"></i>

            Resume

        `;
    }
    else {

        pauseOperationBtn.innerHTML = `

            <i data-lucide="pause"></i>

            Pause

        `;
    }

    createLocalIcons(
        pauseOperationBtn
    );
}

/* =========================
   CONVERT
========================= */

function updateConvertButton() {

    if (!convertBtn) {
        return;
    }

    const canConvert =
        operationFiles.length > 0 &&
        selectedConversionFormat !== null &&
        !operationIsConverting;

    convertBtn.disabled =
        !canConvert;

    if (canConvert) {

        convertBtn.classList.add(
            "active"
        );
    }
    else {

        convertBtn.classList.remove(
            "active"
        );
    }
}

function updateChooseFormatLabel() {

    if (!chooseFormatLabel) {
        return;
    }

    const hasFiles =
        operationFiles.length > 0;

    if (hasFiles) {

        chooseFormatLabel.classList.add(
            "active"
        );
    }
    else {

        chooseFormatLabel.classList.remove(
            "active"
        );
    }
}

/* =========================
   PROGRESSION
========================= */

const globalProgress =
    document.getElementById(
        "globalProgress"
    );

const globalProgressPercentage =
    document.getElementById(
        "globalProgressPercentage"
    );

const globalProgressLabel =
    document.getElementById(
        "globalProgressLabel"
    );

function updateGlobalProgress(
    percentage,
    label = null
) {

    const value =
        Math.max(
            0,
            Math.min(
                100,
                Number(percentage) || 0
            )
        );

    if (globalProgress) {

        globalProgress.style.width =
            `${value}%`;

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
            `${Math.round(value)}%`;
    }

    if (
        label !== null &&
        globalProgressLabel
    ) {

        globalProgressLabel.textContent =
            label;
    }
}

function resetOperationProgress() {

    updateGlobalProgress(
        0,
        "Conversion progress"
    );

}

/* =========================
   GLOBAL PROGRESS STATE
========================= */

function updateGlobalProgressState() {

    const progressBlock =
        globalProgress?.closest(
            ".progress-block"
        );

    if (!progressBlock) {
        return;
    }

    const hasFiles =
        operationFiles.length > 0;

    progressBlock.classList.toggle(
        "active",
        hasFiles
    );
}

/* =========================
   DEMANDER LA CONVERSION
========================= */

if (convertBtn) {

    convertBtn.addEventListener(
        "click",
        () => {
            
            console.log("[OPERATION ZONE TEST] Convert clicked");

            if (
                convertBtn.disabled
            ) {
                return;
            }

            if (
                !selectedConversionFormat
            ) {
                return;
            }

            console.log(
                "[OPERATION ZONE] Conversion requested:",
                {
                    files:
                        operationFiles.length,
                    format:
                        selectedConversionFormat
                }
            );

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:conversion-requested",
                    {
                        detail: {
                            files:
                                operationFiles,

                            category:
                                operationZone.dataset.category || "",

                            format:
                                selectedConversionFormat
                        }
                    }
                )
            );
        }
    );
}

/* =========================
   ANNULER LA CONVERSION
========================= */

if (cancelOperationBtn) {

    cancelOperationBtn.addEventListener(
        "click",
        () => {

            if (
                cancelOperationBtn.disabled ||
                !operationIsConverting
            ) {
                return;
            }

            console.log(
                "[OPERATION ZONE] Cancel requested"
            );

            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:conversion-cancel-requested",
                    {
                        detail: {
                            category:
                                operationZone.dataset.category || ""
                        }
                    }
                )
            );
        }
    );
}

/* =========================
   PAUSE / RESUME CONVERSION
========================= */

if (pauseOperationBtn) {

    pauseOperationBtn.addEventListener(
        "click",
        () => {

            if (
                pauseOperationBtn.disabled ||
                !operationIsConverting
            ) {
                return;
            }

            if (!operationIsPaused) {

                console.log(
                    "[OPERATION ZONE] Pause requested"
                );

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-pause-requested",
                        {
                            detail: {
                                category:
                                    operationZone.dataset.category || ""
                            }
                        }
                    )
                );
            }
            else {

                console.log(
                    "[OPERATION ZONE] Resume requested"
                );

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-resume-requested",
                        {
                            detail: {
                                category:
                                    operationZone.dataset.category || ""
                            }
                        }
                    )
                );
            }
        }
    );
}

/* =========================
   CLEAR ALL
========================= */

if (operationClearAllBtn) {

    operationClearAllBtn.addEventListener(
        "click",
        async () => {


            /* =========================
               CONVERTED FILES ?
            ========================= */

            const hasConvertedFiles =
                operationFiles.some(
                    fileData =>
                        fileData.convertedUrl
                );


            /* =========================
               CASE 1
               CONVERTED FILES NOT
               DOWNLOADED WITH
               DOWNLOAD ALL
            ========================= */

            if (
                hasConvertedFiles &&
                !downloadAllCompleted
            ) {

                const action =
                    await showClearAllWarningModal(
                        "Converted files not downloaded",
                        "Some converted files have not been downloaded with <strong>Download All</strong>.<br><br>Clearing all files will permanently discard them."
                    );


                /* CANCEL */

                if (
                    action === "cancel"
                ) {

                    return;
                }


                /* DOWNLOAD ALL */

                if (
                    action === "download"
                ) {

                    if (
                        downloadAllBtn &&
                        !downloadAllBtn.disabled &&
                        downloadAllFormats
                    ) {

                        renderDownloadAllFormats();

                        downloadAllFormats.classList.remove(
                            "hidden"
                        );

                        downloadAllFormats.classList.add(
                            "highlight"
                        );

                        downloadAllFormats.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });

                        setTimeout(
                            () => {

                                downloadAllFormats.classList.remove(
                                    "highlight"
                                );

                            },
                            1500
                        );
                    }

                    return;
                }


                /* CLEAR ALL */

                if (
                    action !== "clear"
                ) {

                    return;
                }
            }


            /* =========================
               CASE 2
               NORMAL CONFIRMATION
            ========================= */

            else {

                const confirmed =
                    await showConfirmationModal(
                        "Clear All files ?",
                        "Are you sure you want to remove <strong>all files</strong> ?"
                    );


                if (!confirmed) {

                    return;
                }
            }


            /* =========================
               DELETE
            ========================= */

            operationFiles =
                [];

            downloadAllCompleted =
                false;


            await clearStoredFiles();


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:files-cleared"
                )
            );


            updateOperationClearAll();

            updateDownloadAll();


            console.log(
                "[OPERATION ZONE] All files cleared"
            );

        }
    );
}


    /* =========================
       CHARGER LES FICHIERS
    ========================= */

    async function refreshOperationFiles() {

        console.log("[OPERATION ZONE DEBUG] refreshOperationFiles()");

        if (
            typeof loadSelectedFiles !== "function"
        ) {

            console.warn(
                "[OPERATION ZONE] loadSelectedFiles() unavailable"
            );

            return;

        }

        const data =
            await loadSelectedFiles();

            console.log("[OPERATION ZONE DEBUG] Storage data:",data);

            if (
                !data ||
                !data.files ||
                data.files.length === 0
            ) {

                operationFiles = [];

                selectedConversionFormat =
                    null;

                updateOperationClearAll();
                updateDownloadAll();
                updateChooseFormatLabel();
                updateConvertButton();
                updateGlobalProgressState();

                console.log(
                    "[OPERATION ZONE] No stored files"
                );

                return;
            }

        /*
        =========================
        PRESERVE CURRENT STATE
        ========================= */

        const previousOperationFiles =
            operationFiles;


        /*
        =========================
        SYNCHRONIZE FILES
        ========================= */

        operationFiles =
            data.files.map(
                storedFile => {

                    const previousFileData =
                        previousOperationFiles.find(
                            fileData =>
                                fileData.file.name ===
                                    storedFile.file.name &&

                                fileData.file.size ===
                                    storedFile.file.size &&

                                fileData.file.lastModified ===
                                    storedFile.file.lastModified &&

                                fileData.file.type ===
                                    storedFile.file.type
                        );


                    return {

                        file:
                            storedFile.file,

                        convertedUrl:
                            previousFileData?.convertedUrl ||
                            null,

                        convertedName:
                            previousFileData?.convertedName ||
                            null,

                        convertedBlob:
                            previousFileData?.convertedBlob ||
                            null,

                        convertedSize:
                            previousFileData?.convertedSize ||
                            0,

                        convertedFormat:
                            previousFileData?.convertedFormat ||
                            null

                    };

                }
            );

        console.log(
            "[OPERATION ZONE] Files synchronized:",
            operationFiles.length
        );

            updateOperationClearAll();
            updateDownloadAll();
            updateChooseFormatLabel();
            updateConvertButton();
            updateGlobalProgressState();

    }

    /* =========================
    INITIALISATION
    ========================= */

    resetOperationProgress();

    renderDownloadAllFormats();

    updateConvertButton();

    updateCancelButton();

    updatePauseButton();

    await refreshOperationFiles();

    /* =========================
       STOCKAGE MIS À JOUR
    ========================= */

    document.addEventListener(
        "easyfiletools:storage-updated",
        async () => {

            await refreshOperationFiles();

            updateOperationClearAll();
            updateDownloadAll();
            updateConvertButton();

        }
    );

    /* =========================
    GLOBAL CONVERSION PROGRESS
    ========================= */

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

            if (
                index === undefined ||
                index === null ||
                index < 0
            ) {
                return;
            }

            if (
                index >=
                operationFileProgress.length
            ) {
                return;
            }

            operationFileProgress[index] =
                percentage;

            const total =
                operationFileProgress.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );

            const globalPercentage =
                operationFileProgress.length > 0
                    ? total /
                        operationFileProgress.length
                    : 0;

            updateGlobalProgress(
                globalPercentage,
                "Conversion progress"
            );
        }
    );

    document.addEventListener(
        "easyfiletools:file-converted",
        (event) => {

            downloadAllCompleted =
                false;

            const detail =
                event.detail || {};

            const index =
                detail.index;

            if (
                index === undefined ||
                index === null ||
                index < 0 ||
                index >=
                    operationFileProgress.length
            ) {
                return;
            }

            operationFileProgress[index] =
                100;

            const total =
                operationFileProgress.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );

            const globalPercentage =
                operationFileProgress.length > 0
                    ? total /
                        operationFileProgress.length
                    : 0;

            updateGlobalProgress(
                globalPercentage,
                "Conversion progress"
            );

            updateDownloadAll(); 
        }
    );

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
                index < 0 ||
                index >=
                    operationFileProgress.length
            ) {
                return;
            }

            operationFileProgress[index] =
                0;

            const total =
                operationFileProgress.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );

            const globalPercentage =
                operationFileProgress.length > 0
                    ? total /
                        operationFileProgress.length
                    : 0;

            updateGlobalProgress(
                globalPercentage,
                "Conversion progress"
            );
        }
    );

    /* =========================
    ÉTAT DE CONVERSION
    ========================= */

    document.addEventListener(
        "easyfiletools:conversion-started",
        () => {

            operationIsConverting =
                true;

            operationIsPaused =
                false;

            operationFileProgress =
                operationFiles.map(
                    fileData => {

                        return fileData.convertedUrl
                            ? 100
                            : 0;
                    }
                );

            const initialTotal =
                operationFileProgress.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );

            const initialPercentage =
                operationFileProgress.length > 0
                    ? initialTotal /
                        operationFileProgress.length
                    : 0;

            updateGlobalProgress(
                initialPercentage,
                "Conversion progress"
            );

            updateCancelButton();

            updatePauseButton();

            updateConvertButton();

            console.log(
                "[OPERATION ZONE] Conversion started"
            );
        }
    );

    document.addEventListener(
        "easyfiletools:conversion-paused",
        () => {

            operationIsPaused =
                true;

            updatePauseButton();

            console.log(
                "[OPERATION ZONE] Conversion paused"
            );
        }
    );


    document.addEventListener(
        "easyfiletools:conversion-resumed",
        () => {

            operationIsPaused =
                false;

            updatePauseButton();

            console.log(
                "[OPERATION ZONE] Conversion resumed"
            );
        }
    );

    document.addEventListener(
        "easyfiletools:conversion-ended",
        async (event) => {

            const detail =
                event.detail || {};

            const wasCancelled =
                detail.cancelled === true;


            operationIsConverting =
                false;

            operationIsPaused =
                false;

            updateCancelButton();

            updatePauseButton();

            updateConvertButton();


            /* =========================
            CHECK COMPLETE SUCCESS
            ========================= */

            const allFilesConverted =
                operationFiles.length > 0 &&
                operationFiles.every(
                    fileData =>
                        fileData.convertedUrl
                );


            if (
                !wasCancelled &&
                allFilesConverted
            ) {

                updateGlobalProgress(
                    100,
                    "Conversion progress"
                );

                if (
                    typeof showSuccessModal ===
                    "function"
                ) {

                    await showSuccessModal(
                        "Conversion completed",
                        "All files were converted successfully."
                    );
                }
            }


            console.log(
                "[OPERATION ZONE] Conversion ended",
                {
                    cancelled:
                        wasCancelled,

                    allFilesConverted:
                        allFilesConverted
                }
            );

        }
    ); 

    document.addEventListener(
        "easyfiletools:conversion-format-selected",
        (event) => {

            selectedConversionFormat =
                event.detail?.format || null;

            console.log(
                "[OPERATION ZONE] Selected conversion format:",
                selectedConversionFormat
            );

            updateConvertButton();
        }
    );

    /* =========================
    FICHIERS SUPPRIMÉS
    ========================= */

    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            operationFiles = [];

            downloadAllCompleted =
                false;

            selectedConversionFormat =
                null;

            updateOperationClearAll();
            updateDownloadAll();
            updateChooseFormatLabel();
            updateConvertButton();
            updateGlobalProgressState();
            resetOperationProgress();

            if (conversionFormats) {

                conversionFormats.classList.add(
                    "hidden"
                );

                conversionFormats.innerHTML = "";

            }

            console.log(
                "[OPERATION ZONE] All files cleared"
            );
        }
    );

});