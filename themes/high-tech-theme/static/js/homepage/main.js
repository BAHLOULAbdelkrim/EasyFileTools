console.log("main.js loaded");

window.MAX_FILES = APP_CONFIG.maxFiles;

window.MAX_SIZE = APP_CONFIG.maxFileSizeMB * 1024 * 1024;

let selectedFiles = [];

window.getCurrentUploadFileCount = () => {

    return selectedFiles.length;

};

let draggedIndex = null;

let currentCategory = null;


const compatibleOpBtn = document.getElementById("compatibleOpBtn");


const clearAllModal = document.getElementById("clearAllModal");

const clearAllCancel = document.getElementById("clearAllCancel");

const clearAllConfirm = document.getElementById("clearAllConfirm");


const dropZone = document.getElementById("drop-zone");

const fileInput = document.getElementById("fileInput");


const uploadInfo = document.getElementById("upload-info");


const fileList = document.getElementById("file-list");

const fileCounter = document.getElementById("fileCounter");

const downloadAllBtn = document.getElementById("downloadAllBtn");

const clearAllBtn = document.getElementById("clearAllBtn");

const archiveFormat = document.getElementById("archiveFormat");

/* =========================
   From URL
========================= */

const urlBtn = document.getElementById("urlBtn");

const urlModal = document.getElementById("urlModal");

const urlInput = document.getElementById("urlInput");

const urlAdd = document.getElementById("urlAdd");

const urlCancel = document.getElementById("urlCancel");   
    
function initializeUploadSettings() {

    /* =========================
       ACCEPT FILE TYPES
    ========================= */

    const acceptedExtensions = Object.values(FILE_CATEGORIES)
        .flat()
        .map(extension => "." + extension);

    fileInput.accept = [
        "image/*",
        "video/*",
        "audio/*",
        ...acceptedExtensions
    ].join(",");


    /* =========================
       UPLOAD INFORMATION
    ========================= */

    uploadInfo.textContent =
        `Maximum : ${APP_CONFIG.maxFiles} files — ${APP_CONFIG.maxFileSizeMB} MB/file`;
}

initializeUploadSettings();


/* =========================================================
   FILES RECEIVED FROM GENERIC UPLOAD ZONE
========================================================= */

window.handleUploadedFiles = async function(files) {

    const incoming = Array.from(files);

    for (const file of incoming) {

        const category =
            getFileCategory(file.name);

        if (category === "Unknown") {

            alert(
                "This file type is not supported."
            );

            continue;
        }

        if (selectedFiles.length === 0) {

            currentCategory = category;

        }
        else if (category !== currentCategory) {

            alert(
                `This file belongs to the "${category}" category, while the uploaded files are "${currentCategory}".`
            );

            continue;
        }

        if (selectedFiles.length >= MAX_FILES) {

            alert(
                `Maximum ${MAX_FILES} files allowed.`
            );

            break;
        }

        const fileData = {

            file: file,

            convertedUrl: null,

            element: null,

            meta: {},

            previewUrl: null,

            previewType: null

        };

        selectedFiles.push(fileData);


        if (category === "Image") {

            const dims =
                await getImageDimensions(file);

            fileData.meta.dimensions = dims;
        }


        if (category === "Video") {

            const duration =
                await getVideoDuration(file);

            fileData.meta.duration = duration;
        }


        if (category === "Audio") {

            const duration =
                await getAudioDuration(file);

            fileData.meta.duration = duration;
        }


        if (
            category === "Document" &&
            file.name.toLowerCase().endsWith(".pdf")
        ) {

            const pages =
                await getPdfPageCount(file);

            fileData.meta.pages = pages;
        }


        if (
            category === "Image" ||
            category === "Vector"
        ) {

            fileData.previewUrl =
                URL.createObjectURL(file);

            fileData.previewType =
                "image";

        }
        else if (category === "Video") {

            fileData.previewUrl =
                await getVideoThumbnail(file);

            fileData.previewType =
                "video";

        }
        else if (
            file.name.toLowerCase().endsWith(".pdf")
        ) {

            fileData.previewUrl =
                await getPdfThumbnail(file);

            fileData.previewType =
                "pdf";

        }
        else {

            fileData.previewUrl = null;

            fileData.previewType = "icon";
        }
    }


    refreshFileList();

    updateCounter();

    updateClearAllButton();

    await saveSelectedFiles(
        selectedFiles,
        currentCategory
    );

};



/* =========================================================
   CLEAR ALL
========================================================= */

let clearAllSelected = "cancel";

function updateClearAllUI() {

    clearAllCancel.classList.toggle(
        "active-focus",
        clearAllSelected === "cancel"
    );

    clearAllConfirm.classList.toggle(
        "active-focus",
        clearAllSelected === "confirm"
    );
}


document.addEventListener("keydown", (e) => {

    if (clearAllModal.classList.contains("hidden")) {
        return;
    }

    if (e.key === "Escape") {

        clearAllModal.classList.add("hidden");

        return;
    }

    if (e.key === "ArrowLeft") {

        clearAllSelected = "cancel";

        updateClearAllUI();
    }

    if (e.key === "ArrowRight") {

        clearAllSelected = "confirm";

        updateClearAllUI();
    }

    if (e.key === "Enter") {

        e.preventDefault();

        if (clearAllSelected === "cancel") {

            clearAllModal.classList.add("hidden");
        }

        if (clearAllSelected === "confirm") {

            selectedFiles = [];

            currentCategory = null;

            fileList.innerHTML = "";

            clearStoredFiles();

            updateCounter();

            updateClearAllButton();

            clearAllModal.classList.add("hidden");
        }
    }
});

clearAllBtn.addEventListener("click", () => {

    clearAllSelected = "cancel";

    updateClearAllUI();

    clearAllModal.classList.remove("hidden");

    clearAllCancel.focus();
});


clearAllCancel.addEventListener("click", () => {

    clearAllModal.classList.add("hidden");
});


clearAllConfirm.addEventListener("click", () => {

    selectedFiles = [];

    currentCategory = null;

    fileList.innerHTML = "";

    clearStoredFiles();

    updateCounter();

    updateClearAllButton();

    clearAllModal.classList.add("hidden");
});


clearAllModal.addEventListener("click", (e) => {

    if (e.target === clearAllModal) {

        clearAllModal.classList.add("hidden");
    }
});


function updateClearAllButton() {

    if (selectedFiles.length === 0) {

        clearAllBtn.disabled = true;

        clearAllBtn.classList.remove("active");

    } else {

        clearAllBtn.disabled = false;

        clearAllBtn.classList.add("active");
    }
}