console.log("file-utils.js loaded");


/* =========================================================
   IMAGE
========================================================= */

function getImageDimensions(file) {

    return new Promise((resolve) => {

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            img.src = "";
            URL.revokeObjectURL(objectUrl);
        };

        img.onload = function () {

            const result = {
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height
            };

            cleanup();
            resolve(result);

        };

        img.onerror = function () {

            cleanup();
            resolve(null);

        };

        img.src = objectUrl;

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
        const objectUrl = URL.createObjectURL(file);

        audio.preload = "metadata";

        const cleanup = () => {
            audio.onloadedmetadata = null;
            audio.onerror = null;
            audio.removeAttribute("src");
            audio.load();
            URL.revokeObjectURL(objectUrl);
        };

        audio.onloadedmetadata = () => {

            const duration = audio.duration;
            cleanup();
            resolve(duration);

        };

        audio.onerror = () => {

            cleanup();
            resolve(null);

        };

        audio.src = objectUrl;

    });

}


function getVideoDuration(file) {

    return new Promise((resolve) => {

        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);

        video.preload = "metadata";

        const cleanup = () => {
            video.onloadedmetadata = null;
            video.onerror = null;
            video.removeAttribute("src");
            video.load();
            URL.revokeObjectURL(objectUrl);
        };

        video.onloadedmetadata = () => {

            const duration = video.duration;
            cleanup();
            resolve(duration);

        };

        video.onerror = () => {

            cleanup();
            resolve(null);

        };

        video.src = objectUrl;

    });

}


/* =========================================================
   PDF
========================================================= */

async function getPdfPageCount(file) {
    let pdf = null;
    try {
        await window.EasyFileDependencies.ensurePdfJs();
        const bytes = await file.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        return pdf.numPages;
    } catch (error) {
        console.warn("[FILE UTILS] Unable to read PDF page count:", error);
        return null;
    } finally {
        try { await pdf?.destroy?.(); } catch (_) { /* Ignore cleanup errors. */ }
    }
}


async function getPdfThumbnail(file, onPageCount = null) {

    let pdf =
        null;


    try {
        await window.EasyFileDependencies.ensurePdfJs();

        const arrayBuffer =
            await file.arrayBuffer();



        pdf =
            await pdfjsLib.getDocument({
                data:
                    new Uint8Array(
                        arrayBuffer
                    )
            }).promise;

        // Reuse the already opened PDF.
        if (
            typeof onPageCount === "function" &&
            Number.isInteger(pdf.numPages) &&
            pdf.numPages > 0
        ) {
            onPageCount(pdf.numPages);
        }

        const page =
            await pdf.getPage(1);



        const viewport =
            page.getViewport({
                scale: 0.42
            });


        const canvas =
            document.createElement("canvas");


        const ctx =
            canvas.getContext("2d");


        canvas.width =
            Math.max(1, Math.ceil(viewport.width));

        canvas.height =
            Math.max(1, Math.ceil(viewport.height));


        ctx.fillStyle =
            "#ffffff";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        await page.render({
            canvasContext: ctx,
            viewport
        }).promise;


        page.cleanup?.();


        return canvas.toDataURL(
            "image/jpeg",
            0.82
        );

    }
    catch (error) {

        console.warn(
            "[FILE UTILS] Unable to render PDF thumbnail:",
            file?.name,
            error
        );


        return null;

    }
    finally {

        await pdf?.destroy?.();

    }

}



/* =========================================================
   VIDÉO
========================================================= */

function getVideoThumbnail(file) {

    return new Promise((resolve) => {

        const video =
            document.createElement("video");

        const objectUrl =
            URL.createObjectURL(file);

        let settled =
            false;

        let seekRequested =
            false;

        const cleanup = () => {

            video.onloadedmetadata = null;
            video.onloadeddata = null;
            video.onseeked = null;
            video.onerror = null;

            video.removeAttribute("src");
            video.load();

            URL.revokeObjectURL(
                objectUrl
            );

        };

        const finish = (value) => {

            if (settled) {
                return;
            }

            settled = true;

            cleanup();

            resolve(value);

        };

        const captureFrame = () => {

            if (
                !video.videoWidth ||
                !video.videoHeight
            ) {
                return;
            }

            const maxWidth =
                320;

            const scale =
                Math.min(
                    1,
                    maxWidth /
                        video.videoWidth
                );

            const canvas =
                document.createElement("canvas");

            canvas.width =
                Math.max(
                    1,
                    Math.round(
                        video.videoWidth *
                        scale
                    )
                );

            canvas.height =
                Math.max(
                    1,
                    Math.round(
                        video.videoHeight *
                        scale
                    )
                );

            const ctx =
                canvas.getContext("2d");

            if (!ctx) {
                finish(null);
                return;
            }

            ctx.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            finish(
                canvas.toDataURL(
                    "image/jpeg",
                    0.82
                )
            );

        };

        video.preload =
            "metadata";

        video.muted =
            true;

        video.playsInline =
            true;

        video.onloadedmetadata = () => {

            const duration =
                Number(video.duration);

            if (
                Number.isFinite(duration) &&
                duration > 0.15
            ) {

                seekRequested =
                    true;

                video.currentTime =
                    Math.min(
                        1,
                        Math.max(
                            0,
                            duration * 0.1
                        )
                    );

            }

        };

        video.onseeked = () => {

            captureFrame();

        };

        video.onloadeddata = () => {

            if (!seekRequested) {
                captureFrame();
            }

        };

        video.onerror = () => {

            finish(null);

        };

        video.src =
            objectUrl;

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


