/* =========================================================
   RESTAURER LA SÉLECTION DANS L'INTERFACE
   ========================================================= */

async function restoreSelectedFiles() {

    try {

        const data = await loadSelectedFiles();

        if (!data || !data.files || data.files.length === 0) {

            return false;
        }

        /* -----------------------------------------
           Restaurer la catégorie
        ----------------------------------------- */

        currentCategory = data.category || data.files[0].category || null;


        /* -----------------------------------------
           Reconstruire selectedFiles
        ----------------------------------------- */

        selectedFiles = [];


        for (const storedFile of data.files) {

            const file = storedFile.file;

            if (!file) {
                continue;
            }

            const category =
                storedFile.category ||
                getFileCategory(file.name);


            const safety = EasyFilePolicy.validate(file, { category, count: selectedFiles.length,
                totalBytes: selectedFiles.reduce((sum, entry) => sum + entry.file.size, 0) });
            if (!safety.ok) continue;

            const fileData = {

                file: file,

                convertedUrl: null,

                element: null,

                meta: {},

                previewUrl: null,

                previewType: null
            };


            /* -----------------------------------------
               MÉTADONNÉES
            ----------------------------------------- */

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


            /* -----------------------------------------
               PREVIEW
            ----------------------------------------- */

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

                fileData.previewType =
                    "icon";
            }


            /* -----------------------------------------
               AJOUTER AU TABLEAU
            ----------------------------------------- */

            selectedFiles.push(fileData);
        }


        /* -----------------------------------------
           RECONSTRUIRE L'AFFICHAGE
        ----------------------------------------- */

        refreshFileList();

        /* -----------------------------------------
           ACTUALISER L'INTERFACE
        ----------------------------------------- */

        updateCounter();


        console.log(
            "[FILE STORAGE] Selection restored:",
            selectedFiles.length,
            "file(s)"
        );


        return true;

    }
    catch (error) {

        console.error(
            "[FILE STORAGE] Restore failed:",
            error
        );

        return false;
    }
}

