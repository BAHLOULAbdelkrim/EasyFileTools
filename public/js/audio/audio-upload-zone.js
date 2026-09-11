console.log("audio-upload-zone.js loaded");

/* =========================================================
   ÉLÉMENTS
========================================================= */

let audioFileList = null;
let audioFileCounter = null;

/* =========================================================
   FICHIERS AUDIO DE CETTE PAGE
========================================================= */

let audioSelectedFiles = [];


/* =========================================================
   NOMBRE DE FICHIERS ACTUELS
   Utilisé par la zone de chargement générique
========================================================= */

window.getCurrentUploadFileCount = () => {

    return audioSelectedFiles.length;

};

/* =========================================================
   RÉCEPTION DES FICHIERS DEPUIS
   LA ZONE DE CHARGEMENT GÉNÉRIQUE
========================================================= */

document.addEventListener(
    "easyfiletools:files-selected",
    async (event) => {

        const files =
            event.detail.files;

        const category =
            event.detail.category;


        if (category !== "Audio") {

            return;

        }


        await handleAudioFiles(files);

    }
);  

/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const audioListContainer =
            document.querySelector(
                '.file-list-container[data-category="Audio"]'
            );

        if (audioListContainer) {

            audioFileList =
                audioListContainer.querySelector("#file-list");

            audioFileCounter =
                audioListContainer.querySelector("#fileCounter");

        }

        await loadAudioFilesFromStorage();

        updateAudioCounter();

    }
);


/* =========================================================
   STOCKAGE MIS À JOUR
========================================================= */

document.addEventListener(
    "easyfiletools:storage-updated",
    async () => {

        await loadAudioFilesFromStorage();

        updateAudioCounter();

    }
);

/* =========================================================
   FICHIER CONVERTI
   SYNCHRONISER L'ÉTAT AUDIO
========================================================= */

document.addEventListener(

    "easyfiletools:file-converted",

    (event) => {

        const detail =
            event.detail || {};

        const convertedFileData =
            detail.fileData;

        const sourceFile =
            detail.sourceFile;

        if (
            !convertedFileData ||
            !sourceFile
        ) {

            return;
        }


        /* =============================================
           RETROUVER LE FICHIER AUDIO CORRESPONDANT
        ============================================= */

        const audioFileData =
            audioSelectedFiles.find(

                fileData =>

                    fileData.file.name ===
                        sourceFile.name &&

                    fileData.file.size ===
                        sourceFile.size &&

                    fileData.file.lastModified ===
                        sourceFile.lastModified &&

                    fileData.file.type ===
                        sourceFile.type

            );


        if (!audioFileData) {

            console.warn(
                "[AUDIO ZONE] Converted file not found:",
                sourceFile.name
            );

            return;
        }


        /* =============================================
           COPIER LE RÉSULTAT DE CONVERSION
        ============================================= */

        audioFileData.convertedUrl =
            detail.url ||
            convertedFileData.convertedUrl ||
            null;

        audioFileData.convertedName =
            detail.outputName ||
            convertedFileData.convertedName ||
            null;

        audioFileData.convertedBlob =
            detail.blob ||
            convertedFileData.convertedBlob ||
            null;

        audioFileData.convertedSize =
            detail.size ||
            convertedFileData.convertedSize ||
            0;

        audioFileData.convertedFormat =
            detail.outputFormat ||
            convertedFileData.convertedFormat ||
            null;


        console.log(
            "[AUDIO ZONE] Conversion state synchronized:",
            audioFileData.convertedName
        );

    }

);

/* =========================================================
   FICHIERS SUPPRIMÉS
========================================================= */

document.addEventListener(
    "easyfiletools:files-cleared",
    () => {

        audioSelectedFiles = [];

        refreshAudioFileList();

        updateAudioCounter();

        console.log(
            "[AUDIO ZONE] All files cleared"
        );

    }
);


/* =========================================================
   HANDLE AUDIO FILES
========================================================= */

async function handleAudioFiles(files) {

    const incomingFiles =
        Array.from(files);


    for (const file of incomingFiles) {

        /* =================================================
           VÉRIFICATION AUDIO
        ================================================= */

        const category =
            getFileCategory(file.name);


        if (
            category !== "Audio"
        ) {

            alert(
                `${file.name} is not an audio file.`
            );

            continue;

        }


        /* =================================================
           CRÉATION DES DONNÉES DU FICHIER
        ================================================= */

        const fileData = {

            file: file,

            convertedUrl: null,

            element: null,

            meta: {},

            previewUrl: null,

            previewType: "icon"

        };

        /* =================================================
        AJOUT IMMÉDIAT DU FICHIER
        ================================================= */

        audioSelectedFiles.push(
            fileData
        );

        refreshAudioFileList();

        const currentIndex =
            audioSelectedFiles.indexOf(
                fileData
            );

        const currentItem =
            audioFileList?.querySelector(
                `.file-item[data-file-index="${currentIndex}"]`
            );


        /* =================================================
        ÉTAT : LOADING
        ================================================= */

        if (currentItem) {

            setFileItemStatus(
                currentItem,
                "Loading...",
                "loading",
                false
            );

            setFileItemLoading(
                currentItem,
                true
            );
        }

        /* =================================================
        DURÉE AUDIO
        ================================================= */

        const duration =
            await getAudioDuration(file);


        fileData.meta.duration =
            duration;

        /* =================================================
        ÉTAT : READY
        ================================================= */

        if (currentItem) {

            setFileItemLoading(
                currentItem,
                false
            );

            setFileItemProgress(
                currentItem,
                0
            );

            setFileItemStatus(
                currentItem,
                "Ready",
                "ready",
                true
            );
        }        

    }


    /* =====================================================
       ACTUALISATION
    ===================================================== */

    refreshAudioFileList();

    updateAudioCounter();

    await saveAudioFilesToStorage();

}


/* =========================================================
   RENDER FILES
========================================================= */

function refreshAudioFileList() {

    renderFileList(

        audioSelectedFiles,

        audioFileList,

        {

            category: "Audio",

            maxSize: APP_CONFIG.maxFileSizeMB * 1024 * 1024,

            enableReorder: true,


            /* =============================================
               RÉORGANISATION
            ============================================= */

            onReorder: (
                fromIndex,
                targetIndex
            ) => {

                const draggedItem =
                    audioSelectedFiles[
                        fromIndex
                    ];


                audioSelectedFiles.splice(
                    fromIndex,
                    1
                );


                audioSelectedFiles.splice(
                    targetIndex,
                    0,
                    draggedItem
                );


                refreshAudioFileList();

                updateAudioCounter();

                saveAudioFilesToStorage();

            },


            /* =============================================
               SUPPRESSION
            ============================================= */

            onRemove: async (
                fileData
            ) => {

                audioSelectedFiles =
                    audioSelectedFiles.filter(
                        file =>
                            file.file !==
                            fileData.file
                    );

                refreshAudioFileList();
                updateAudioCounter();

                await saveAudioFilesToStorage();

            }

        }

    );

}


/* =========================================================
   COUNTER
========================================================= */

function updateAudioCounter() {

    const count =
        audioSelectedFiles.length;


    if (count === 0) {

        audioFileCounter.textContent =
            "0 file";

        return;
    }


    const totalSize =
        audioSelectedFiles.reduce(
            (sum, item) =>
                sum + item.file.size,
            0
        );


    const mainText =
        `${count} ${
            count > 1
                ? "files"
                : "file"
        } • Audio • ${formatFileSize(totalSize)}`;


    const hintText =
        count >= 2
            ? `
                <div class="drag-hint">
                    <i data-lucide="move-vertical"></i>
                    Drag & drop to reorder
                </div>
              `
            : "";


    audioFileCounter.innerHTML = `
        <div class="file-counter-main">
            ${mainText}
        </div>
        ${hintText}
    `;


    createLocalIcons(
        audioFileCounter
    );

}


/* =========================================================
   INDEXEDDB
========================================================= */

async function loadAudioFilesFromStorage() {

    const data =
        await loadSelectedFiles();


    if (
        !data ||
        !data.files ||
        data.files.length === 0
    ) {

        audioSelectedFiles = [];

        refreshAudioFileList();

        return;

    }


    /* =============================================
       UNIQUEMENT LES FICHIERS AUDIO
    ============================================= */

    const audioFiles =
        data.files.filter(
            item =>
                item.category === "Audio"
        );


    /*
    =============================================
    PRÉSERVER L'ÉTAT ACTUEL
    =============================================
    */

    const previousFiles =
        audioSelectedFiles;


    /*
    =============================================
    RECONSTRUIRE LA LISTE
    =============================================
    */

    const restoredFiles =
        [];


    for (
        const item of audioFiles
    ) {

        /*
        * Un File relu depuis IndexedDB
        * n'est pas forcément le même objet JS.
        *
        * On l'identifie donc avec ses propriétés
        * stables.
        */

        const previousFileData =
            previousFiles.find(
                fileData =>
                    fileData.file.name ===
                        item.file.name &&

                    fileData.file.size ===
                        item.file.size &&

                    fileData.file.lastModified ===
                        item.file.lastModified &&

                    fileData.file.type ===
                        item.file.type
            );


        const fileData = {

            file:
                item.file,

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
                null,

            element:
                null,

            meta:
                previousFileData?.meta
                    ? {
                        ...previousFileData.meta
                    }
                    : {},

            previewUrl:
                previousFileData?.previewUrl ||
                null,

            previewType:
                previousFileData?.previewType ||
                "icon"

        };


        /*
        * Si la durée existe déjà,
        * inutile de la recalculer.
        */

        if (
            !fileData.meta.duration
        ) {

            fileData.meta.duration =
                await getAudioDuration(
                    fileData.file
                );
        }


        restoredFiles.push(
            fileData
        );
    }


    audioSelectedFiles =
        restoredFiles;


    console.log(
        "[AUDIO ZONE] Files injected:",
        audioSelectedFiles.length
    );


    refreshAudioFileList();

}


/* =========================================================
   SAUVEGARDE
========================================================= */

async function saveAudioFilesToStorage() {

    if (
        audioSelectedFiles.length === 0
    ) {

        await clearStoredFiles();

        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:storage-updated",
                {
                    detail: {
                        files: [],
                        category: "Audio"
                    }
                }
            )
        );

        return;
    }

    await saveSelectedFiles(
        audioSelectedFiles,
        "Audio"
    );
}