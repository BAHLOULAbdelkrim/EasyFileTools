console.log("liste-files.js loaded");


/* =========================================================
   ACTUALISER LA LISTE HOMEPAGE
========================================================= */

function refreshFileList() {

    if (!fileList) {
        return;
    }

    renderFileList(
        selectedFiles,
        fileList,
        {
            category: currentCategory,
            maxSize: (EasyFilePolicy.resolve({ category: currentCategory })?.maxFileMB || 40) * EasyFilePolicy.MB,
            enableReorder: true,

            onReorder: async (fromIndex, targetIndex) => {

                const draggedItem =
                    selectedFiles[fromIndex];

                selectedFiles.splice(
                    fromIndex,
                    1
                );

                selectedFiles.splice(
                    targetIndex,
                    0,
                    draggedItem
                );

                refreshFileList();

                await saveSelectedFiles(
                    selectedFiles,
                    currentCategory
                );

            },

            onRemove: async (
                fileData,
                index,
                item
            ) => {

                console.log(
                    "[REMOVE FILE]",
                    fileData.file.name
                );

                selectedFiles =
                    selectedFiles.filter(
                        file =>
                            file.file !==
                            fileData.file
                    );

                if (selectedFiles.length === 0) {

                    currentCategory = null;

                }

                await saveSelectedFiles(
                    selectedFiles,
                    currentCategory
                );

                refreshFileList();

                updateCounter();

                updateClearAllButton();


                /* CHECK DOWNLOAD ALL */

                const hasConvertedFiles =
                    selectedFiles.some(
                        fileData =>
                            fileData.convertedUrl
                    );

                if (
                    !hasConvertedFiles &&
                    downloadAllBtn
                ) {

                    downloadAllBtn.disabled =
                        true;

                    downloadAllBtn.classList.remove(
                        "active"
                    );

                }

            }
        }
    );

    updateCounter();
}


/* =========================================================
   COMPTEUR HOMEPAGE
========================================================= */

function updateCounter() {

    const count =
        selectedFiles.length;


    if (count === 0) {

        fileCounter.textContent =
            "0 file";

        clearAllBtn.disabled = true;

        clearAllBtn.classList.remove(
            "active"
        );

        compatibleOpBtn.disabled = true;

        compatibleOpBtn.classList.remove(
            "active"
        );

        const operationsList =
            document.getElementById(
                "operations-list"
            );

        if (operationsList) {

            operationsList.innerHTML = "";

        }

        return;
    }


    const totalSize =
        selectedFiles.reduce(
            (sum, item) =>
                sum + item.file.size,
            0
        );


    const mainText =
        `${count} ${
            count > 1
                ? "files"
                : "file"
        } • ${
            currentCategory
        } • ${
            formatFileSize(totalSize)
        }`;


    let hintText = "";


    if (count >= 2) {

        hintText = `

            <div class="drag-hint">

                <i data-lucide="move-vertical"></i>

                Drag & drop to reorder

            </div>

        `;

    }


    fileCounter.innerHTML = `

        <div class="file-counter-main">

            ${mainText}

        </div>

        ${hintText}

    `;


    createLocalIcons(fileCounter);


    /* CLEAR ALL */

    clearAllBtn.disabled = false;

    clearAllBtn.classList.add(
        "active"
    );


    /* COMPATIBLE OPERATIONS */

    compatibleOpBtn.disabled = false;

    compatibleOpBtn.classList.add(
        "active"
    );

    renderCompatibleOperations();

}


