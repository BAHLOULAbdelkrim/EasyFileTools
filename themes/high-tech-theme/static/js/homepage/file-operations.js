
/* =========================================
   Opérations compatibles par catégorie
========================================= */

const FILE_OPERATIONS = {

    /* =========================
       AUDIO
    ========================= */

    Audio: [

        {
            id: "convert-audio",
            category: "Audio",
            name: "Convert Audio",
            icon: "repeat-2",
            description: "Convert audio files between popular formats.",
            extensions: "category",
            url: "/audio/convert-audio/",
            minFiles: 1
        },

        {
            id: "speech-to-text",
            category: "Audio",
            name: "Speech → Text",
            icon: "mic",
            description: "Convert spoken audio into editable text.",
            extensions: "category",
            url: "/audio/speech-to-text/",
            minFiles: 1
        },

        {
            id: "auto-split",
            category: "Audio",
            name: "Auto Split",
            icon: "scissors",
            description: "Automatically split audio files into separate segments.",
            extensions: "category",
            url: "/audio/auto-split/",
            minFiles: 1
        },

        {
            id: "cut",
            category: "Audio",
            name: "Cut Audio",
            icon: "slice",
            description: "Cut, join and rearrange audio segments.",
            extensions: "category",
            url: "/audio/cut-audio/",
            minFiles: 1
        },

        {
            id: "merge",
            category: "Audio",
            name: "Merge Audio",
            icon: "merge",
            description: "Cut, join and rearrange audio segments.",
            extensions: "category",
            url: "/audio/merge-audio/",
            minFiles: 2
        },

        {
            id: "normalize-volume",
            category: "Audio",
            name: "Normalize Volume",
            icon: "volume-2",
            description: "Balance audio volume for a more consistent listening level.",
            extensions: "category",
            url: "/audio/normalize-volume/",
            minFiles: 1
        },

        {
            id: "compress-audio",
            category: "Audio",
            name: "Compress Audio",
            icon: "archive",
            description: "Reduce audio file size while preserving sound quality.",
            extensions: "category",
            url: "/audio/compress-audio/",
            minFiles: 1
        },

        {
            id: "change-bitrate",
            category: "Audio",
            name: "Change Bitrate",
            icon: "gauge",
            description: "Change the bitrate of audio files.",
            extensions: "category",
            url: "/audio/change-bitrate/",
            minFiles: 1
        },

        {
            id: "change-sample-rate",
            category: "Audio",
            name: "Change Sample Rate",
            icon: "waves",
            description: "Change the audio sample rate to suit different uses.",
            extensions: "category",
            url: "/audio/change-sample-rate/",
            minFiles: 1
        },

        {
            id: "edit-metadata",
            category: "Audio",
            name: "Edit Metadata",
            icon: "tags",
            description: "View and edit audio metadata such as title, artist and album.",
            extensions: "category",
            url: "/audio/edit-metadata/",
            minFiles: 1
        },

        {
            id: "rename-files",
            category: "Audio",
            name: "Rename Files",
            icon: "file-pen",
            description: "Rename multiple audio files quickly and consistently.",
            extensions: "category",
            url: "/audio/rename-files/",
            minFiles: 1
        }

    ]

};


/* =========================================
   Récupérer les opérations d'une catégorie
========================================= */

function getCompatibleOperations(category, fileCount) {

    const operations = FILE_OPERATIONS[category] || [];

    return operations.filter(operation => {

        const minFiles = operation.minFiles || 1;

        return fileCount >= minFiles;

    });

}

/* =========================================
   Afficher les opérations compatibles
========================================= */

function renderCompatibleOperations() {

    const operationsList = document.getElementById("operations-list");

    if (!operationsList) return;

    operationsList.innerHTML = "";

    const operations = getCompatibleOperations(
        currentCategory,
        selectedFiles.length
    );



/*
    operations.forEach(operation => {

        const button = document.createElement("a");

        button.className = "operation-btn";
        button.href = operation.url;

        button.innerHTML = `
            <i data-lucide="${operation.icon}"></i>
            <span>${operation.name}</span>
        `;

        operationsList.appendChild(button);
    });
*/

    operations.forEach(operation => {

        const button = document.createElement("a");

        button.className = "operation-btn";

        button.href = operation.url;

        button.innerHTML = `
            <i data-lucide="${operation.icon}"></i>
            <span>${operation.name}</span>
        `;

        /* =====================================================
        SAUVEGARDER LES FICHIERS AVANT DE NAVIGUER
        ===================================================== */

        button.addEventListener("click", (e) => {

            e.preventDefault();

            console.log(
                "[FILE STORAGE] Navigation to:",
                operation.url
            );

            window.location.href =
                operation.url;

        });

        operationsList.appendChild(button);
    });

    createLocalIcons(operationsList);
}


