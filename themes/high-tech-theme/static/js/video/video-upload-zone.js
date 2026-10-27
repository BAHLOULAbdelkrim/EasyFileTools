console.log(
    "[VIDEO ZONE] video-upload-zone.js loaded"
);


(() => {

    "use strict";


    let videoFileList =
        null;

    let videoFileCounter =
        null;

    let videoSelectedFiles =
        [];


    const VIDEO_INPUT_FORMATS =
        new Set([
            "mp4",
            "webm",
            "mkv",
            "mov",
            "avi",
            "m4v",
            "mpeg",
            "mpg",
            "ogv",
            "3gp",
            "3g2",
            "ts",
            "mts",
            "m2ts",
            "wmv",
            "flv"
        ]);


    function extensionOf(name) {

        const dot =
            name.lastIndexOf(".");


        return dot >= 0
            ? name
                .slice(dot + 1)
                .toLowerCase()
            : "";

    }


    function keyOf(file) {

        return [
            file.name,
            file.size,
            file.lastModified || 0
        ].join("::");

    }


    function revokeUrls(item) {

        [
            "previewUrl",
            "convertedUrl"
        ].forEach(
            property => {

                if (
                    item?.[property]
                ) {

                    try {

                        URL.revokeObjectURL(
                            item[property]
                        );

                    }
                    catch (_) {}

                }

            }
        );

    }


    function waitForEvent(target, eventName, timeoutMs = 3500) {

        return new Promise(resolve => {

            let settled = false;

            const finish = value => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                target.removeEventListener(eventName, onEvent);
                target.removeEventListener("error", onError);
                resolve(value);
            };

            const onEvent = () => finish(true);
            const onError = () => finish(false);
            const timer = setTimeout(() => finish(false), timeoutMs);

            target.addEventListener(eventName, onEvent, { once: true });
            target.addEventListener("error", onError, { once: true });
        });
    }


    async function createVideoThumbnail(video) {

        if (!video?.videoWidth || !video?.videoHeight) {
            return null;
        }

        const maxWidth = 320;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return null;

        context.fillStyle = "#000000";
        context.fillRect(0, 0, width, height);
        context.drawImage(video, 0, 0, width, height);

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, "image/jpeg", 0.82);
        });

        return blob ? URL.createObjectURL(blob) : null;
    }


    async function readMetadata(file) {

        const url = URL.createObjectURL(file);
        const video = document.createElement("video");

        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.src = url;

        try {

            const metadataReady = await waitForEvent(video, "loadedmetadata", 5000);
            if (!metadataReady) return {};

            const duration = Number.isFinite(video.duration)
                ? video.duration
                : null;

            const dimensions = video.videoWidth && video.videoHeight
                ? { width: video.videoWidth, height: video.videoHeight }
                : null;

            /*
             * Seek slightly into the clip so files whose first encoded frame is
             * black still get a useful thumbnail. This happens asynchronously
             * after the file item is already visible, so upload remains fast.
             */
            let frameReady = false;
            const targetTime = duration && duration > 0
                ? Math.min(Math.max(duration * 0.08, 0.05), 1)
                : 0;

            if (targetTime > 0) {
                try {
                    video.currentTime = targetTime;
                    frameReady = await waitForEvent(video, "seeked", 3500);
                }
                catch (_) {}
            }

            if (!frameReady) {
                await waitForEvent(video, "loadeddata", 2000);
            }

            let previewUrl = null;
            try {
                previewUrl = await createVideoThumbnail(video);
            }
            catch (_) {}

            return {
                duration,
                dimensions,
                previewUrl
            };
        }
        finally {
            video.removeAttribute("src");
            try { video.load(); } catch (_) {}
            URL.revokeObjectURL(url);
        }
    }


    window.getCurrentUploadFileCount =
        () =>
            videoSelectedFiles.length;


    document.addEventListener(

        "easyfiletools:files-selected",

        async event => {

            if (
                event.detail?.category !==
                "Video"
            ) {

                return;
            }


            await handleVideoFiles(
                event.detail.files || []
            );

        }

    );


    document.addEventListener(

        "DOMContentLoaded",

        async () => {

            const container =
                document.querySelector(
                    '.file-list-container[data-category="Video"]'
                );


            if (container) {

                videoFileList =
                    container.querySelector(
                        "#file-list"
                    );


                videoFileCounter =
                    container.querySelector(
                        "#fileCounter"
                    );

            }


            await loadFromStorage();

            updateCounter();

        }

    );


    async function handleVideoFiles(files) {

        const addedItems = [];

        for (const file of Array.from(files)) {

            if (getFileCategory(file.name) !== "Video") {
                continue;
            }

            const ext = extensionOf(file.name);

            if (!VIDEO_INPUT_FORMATS.has(ext)) {
                alert(`${file.name}: unsupported video format.`);
                continue;
            }

            if (
                videoSelectedFiles.some(
                    item => keyOf(item.file) === keyOf(file)
                )
            ) {
                continue;
            }

            const safety = EasyFilePolicy.validate(file, { category: "Video", operation: document.getElementById("operation-zone")?.dataset?.operation,
                count: videoSelectedFiles.length,
                totalBytes: videoSelectedFiles.reduce((sum, item) => sum + item.file.size, 0) });
            if (!safety.ok) { console.warn("[VIDEO] File rejected:", safety.reason); continue; }

            /*
             * Match Audio/Image perceived upload speed: add the source
             * immediately. Metadata probing is useful decoration, not a
             * prerequisite for owning/rendering the file.
             */
            const item = {
                file,
                element: null,
                previewType: null,
                previewUrl: null,
                convertedUrl: null,
                convertedBlob: null,
                convertedName: null,
                convertedFormat: null,
                meta: {}
            };

            videoSelectedFiles.push(item);
            addedItems.push(item);
        }

        render();
        updateCounter();
        await save();

        // Probe metadata after the first paint, with small concurrency.
        void hydrateVideoMetadata(addedItems);
    }


    async function hydrateVideoMetadata(items) {

        const pending = Array.from(items || []).filter(Boolean);
        let cursor = 0;

        const worker = async () => {
            while (cursor < pending.length) {
                const item = pending[cursor++];

                if (!videoSelectedFiles.includes(item)) {
                    continue;
                }

                const meta = await readMetadata(item.file);

                if (!videoSelectedFiles.includes(item)) {
                    continue;
                }

                if (meta?.previewUrl) {
                    if (item.previewUrl) {
                        try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
                    }
                    item.previewUrl = meta.previewUrl;
                    item.previewType = "image";
                }

                item.meta = {
                    duration: meta?.duration || null,
                    dimensions: meta?.dimensions || null
                };

                render();
            }
        };

        await Promise.all([worker(), worker()]);
    }

    function render() {

        if (
            !videoFileList ||
            typeof renderFileList !==
                "function"
        ) {

            return;
        }


        renderFileList(

            videoSelectedFiles,

            videoFileList,

            {
                category:
                    "Video",

                maxSize:
                    EasyFilePolicy.resolve({ category: "Video", operation: document.getElementById("operation-zone")?.dataset?.operation }).maxFileMB * EasyFilePolicy.MB,

                enableReorder:
                    true,


                onReorder(
                    fromIndex,
                    targetIndex
                ) {

                    const [item] =
                        videoSelectedFiles
                            .splice(
                                fromIndex,
                                1
                            );


                    videoSelectedFiles
                        .splice(
                            targetIndex,
                            0,
                            item
                        );


                    render();

                    save();

                },


                async onRemove(item) {

                    revokeUrls(item);


                    videoSelectedFiles =
                        videoSelectedFiles
                            .filter(
                                candidate =>
                                    candidate !==
                                    item
                            );


                    render();

                    updateCounter();

                    await save();

                }

            }

        );

    }


    function updateCounter() {

        if (
            !videoFileCounter
        ) {

            return;
        }


        const count =
            videoSelectedFiles.length;


        if (
            count === 0
        ) {

            videoFileCounter.textContent =
                "0 file";

            return;
        }


        const totalSize =
            videoSelectedFiles.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.file.size,
                0
            );


        videoFileCounter.innerHTML = `
            <div class="file-counter-main">
                ${count}
                ${count === 1
                    ? "file"
                    : "files"}
                • Video
                • ${formatFileSize(totalSize)}
            </div>
        `;

    }


    async function save() {

        if (
            videoSelectedFiles.length ===
            0
        ) {

            await clearStoredFiles({ category: "Video" });

            return;
        }


        await saveSelectedFiles(
            videoSelectedFiles,
            "Video"
        );

    }


    async function loadFromStorage() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            return;
        }


        const data =
            await loadSelectedFiles();


        if (
            !data ||
            data.category !== "Video" ||
            !Array.isArray(data.files)
        ) {

            return;
        }


        videoSelectedFiles = [];


        for (
            const stored of data.files
        ) {

            const file =
                stored.file ||
                stored;


            if (
                !(file instanceof File)
            ) {

                continue;
            }


            const safety = EasyFilePolicy.validate(file, { category: "Video", operation: document.getElementById("operation-zone")?.dataset?.operation,
                count: videoSelectedFiles.length, totalBytes: videoSelectedFiles.reduce((sum, entry) => sum + entry.file.size, 0) });
            if (!safety.ok) continue;
            videoSelectedFiles.push({

                file,
                element: null,
                previewType: null,
                previewUrl: null,
                convertedUrl: null,
                convertedBlob: null,
                convertedName: null,
                convertedFormat: null,
                meta: {}

            });

        }


        render();

        updateCounter();

        void hydrateVideoMetadata(
            videoSelectedFiles.filter(item => !item.meta?.duration && !item.meta?.dimensions)
        );

    }


    document.addEventListener(

        "easyfiletools:file-operation-completed",

        event => {

            const detail =
                event.detail || {};


            const index =
                Number(
                    detail.index
                );


            if (
                !Number.isInteger(index) ||
                !videoSelectedFiles[index]
            ) {

                return;
            }


            const item =
                videoSelectedFiles[index];


            item.convertedUrl =
                detail.outputUrl ||
                null;

            item.convertedBlob =
                detail.outputBlob ||
                null;

            item.convertedName =
                detail.outputName ||
                null;

            item.convertedFormat =
                detail.outputFormat ||
                null;

        }

    );


    document.addEventListener(

        "easyfiletools:operation-results-discarded",

        () => {
            render();
        }

    );


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            videoSelectedFiles
                .forEach(
                    revokeUrls
                );


            videoSelectedFiles = [];


            render();

            updateCounter();

        }

    );


    window.VideoUploadZone = {

        getFiles() {
            return videoSelectedFiles;
        },

        refresh:
            render

    };

})();