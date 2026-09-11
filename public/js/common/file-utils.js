console.log("file-utils.js loaded");


/* =========================================================
   IMAGE
========================================================= */

function getImageDimensions(file) {

    return new Promise((resolve) => {

        const img = new Image();

        img.onload = function () {

            resolve({
                width: img.width,
                height: img.height
            });

        };

        img.onerror = function () {

            resolve(null);

        };

        img.src = URL.createObjectURL(file);

    });

}


/* =========================================================
   DURÉE AUDIO / VIDÉO
========================================================= */

function formatDuration(seconds) {

    if (!seconds || isNaN(seconds)) {
        return null;
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}h ${m}m ${s}s`;
    }

    return `${m}m ${s}s`;

}


function getAudioDuration(file) {

    return new Promise((resolve) => {

        const audio = new Audio();

        audio.preload = "metadata";

        audio.onloadedmetadata = () => {

            resolve(audio.duration);

        };

        audio.onerror = () => resolve(null);

        audio.src = URL.createObjectURL(file);

    });

}


function getVideoDuration(file) {

    return new Promise((resolve) => {

        const video = document.createElement("video");

        video.preload = "metadata";

        video.onloadedmetadata = () => {

            resolve(video.duration);

        };

        video.onerror = () => resolve(null);

        video.src = URL.createObjectURL(file);

    });

}


/* =========================================================
   PDF
========================================================= */

async function getPdfPageCount(file) {

    try {

        const arrayBuffer =
            await file.arrayBuffer();

        const pdf =
            await pdfjsLib.getDocument({
                data: arrayBuffer
            }).promise;

        return pdf.numPages;

    } catch (error) {

        console.error(error);

        return null;

    }

}


async function getPdfThumbnail(file) {

    const arrayBuffer =
        await file.arrayBuffer();

    const pdf =
        await pdfjsLib.getDocument({
            data: arrayBuffer
        }).promise;

    const page =
        await pdf.getPage(1);

    const viewport =
        page.getViewport({
            scale: 0.5
        });

    const canvas =
        document.createElement("canvas");

    const ctx =
        canvas.getContext("2d");

    canvas.width =
        viewport.width;

    canvas.height =
        viewport.height;

    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;

    return canvas.toDataURL();

}


/* =========================================================
   VIDÉO
========================================================= */

function getVideoThumbnail(file) {

    return new Promise((resolve) => {

        const video =
            document.createElement("video");

        video.src =
            URL.createObjectURL(file);

        video.muted = true;

        video.currentTime = 1;

        video.addEventListener(
            "loadeddata",
            () => {

                const canvas =
                    document.createElement("canvas");

                canvas.width =
                    video.videoWidth;

                canvas.height =
                    video.videoHeight;

                const ctx =
                    canvas.getContext("2d");

                ctx.drawImage(
                    video,
                    0,
                    0
                );

                resolve(
                    canvas.toDataURL()
                );

            }
        );

    });

}


/* =========================================================
   ICÔNE FICHIER
========================================================= */

function getFileIcon(category) {

    switch (category) {

        case "Video":
            return "video";

        case "Audio":
            return "music";

        case "Document":
            return "file-text";

        case "Archive":
            return "archive";

        case "Code":
            return "code";

        default:
            return "file";

    }

}

/* =========================================================
   TAILLE DU FICHIER
========================================================= */

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}


