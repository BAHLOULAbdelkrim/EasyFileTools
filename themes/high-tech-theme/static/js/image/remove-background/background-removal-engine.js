console.log(
    "[BACKGROUND ENGINE] background-removal-engine.js loaded"
);


(() => {

    "use strict";


    const MAX_COMPOSITE_PIXELS =
        50_000_000;


    const state = {

        running:
            false,

        paused:
            false,

        cancelled:
            false,

        currentIndex:
            -1,

        resumeResolver:
            null

    };


    let worker =
        null;


    let requestCounter =
        0;


    let executionProfilePromise =
        null;


    async function resolveExecutionProfile() {

        /*
         * Reliability first: IS-Net runs locally on WASM using its q8
         * Transformers.js build. The worker owns model selection; these
         * fields are retained for compatibility with the existing request
         * contract.
         */
        if (!executionProfilePromise) {
            executionProfilePromise = Promise.resolve({
                preferredDevice: "wasm",
                preferredDtype: "q8"
            });
        }

        return executionProfilePromise;
    }


    const pending =
        new Map();


    /* =========================================
       HELPERS
    ========================================= */

    function extractFile(
        item
    ) {

        return item instanceof File
            ? item
            : item?.file || null;

    }


    function baseName(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        return dot > 0
            ? filename.slice(
                0,
                dot
            )
            : filename;

    }


    function emit(
        name,
        detail = {}
    ) {

        document.dispatchEvent(
            new CustomEvent(
                name,
                {
                    detail
                }
            )
        );

    }


    /* =========================================
       WORKER
    ========================================= */

    function terminateWorker() {

        if (
            worker
        ) {

            worker.terminate();

            worker =
                null;

        }


        pending.forEach(
            request => {

                request.reject(
                    new Error(
                        "BACKGROUND_WORKER_TERMINATED"
                    )
                );

            }
        );


        pending.clear();

    }


    function getWorker() {

        if (
            worker
        ) {

            return worker;

        }


        worker =
            new Worker(

                `/js/image/remove-background/background-removal-worker.js?v=${
                    Date.now()
                }`,

                {
                    type:
                        "module"
                }

            );


        worker.addEventListener(
            "message",
            event => {

                const message =
                    event.data;


                if (message?.type === "model-progress") {
                    const progress = Math.max(0, Math.min(100, Number(message.progress) || 0));
                    emit("easyfiletools:background-ai-status", {
                        status: "loading",
                        label: message.label || `Downloading AI model • ${Math.round(progress)}%`
                    });
                    if (state.currentIndex >= 0) {
                        emit("easyfiletools:background-file-progress", {
                            index: state.currentIndex,
                            percentage: 5 + progress * 0.5,
                            label: message.label || "Loading AI model"
                        });
                    }
                    return;
                }

                if (
                    message?.type ===
                    "status"
                ) {

                    emit(
                        "easyfiletools:background-ai-status",
                        {
                            status:
                                message.status,

                            label:
                                message.label
                        }
                    );


                    return;
                }


                const request =
                    pending.get(
                        message.id
                    );


                if (
                    !request
                ) {

                    return;
                }


                if (
                    message.type ===
                    "result"
                ) {

                    pending.delete(
                        message.id
                    );


                    request.resolve(
                        message
                    );


                    return;
                }


                if (
                    message.type ===
                    "error"
                ) {

                    pending.delete(
                        message.id
                    );


                    request.reject(
                        new Error(
                            message.message
                        )
                    );

                }

            }
        );


        worker.addEventListener(
            "error",
            error => {

                console.error(
                    "[BACKGROUND ENGINE] Worker:",
                    error
                );

                const workerError =
                    new Error(
                        error?.message ||
                        "AI worker failed"
                    );

                pending.forEach(
                    request => request.reject(workerError)
                );
                pending.clear();

                worker?.terminate();
                worker = null;

                emit(
                    "easyfiletools:background-ai-status",
                    {
                        status:
                            "error",

                        label:
                            workerError.message
                    }
                );

            }
        );


        return worker;

    }


    async function requestMask(
        file
    ) {

        const currentWorker =
            getWorker();


        const id =
            ++requestCounter;


        const buffer =
            await file.arrayBuffer();


        const {
            preferredDevice,
            preferredDtype
        } =
            await resolveExecutionProfile();


        return new Promise(
            (
                resolve,
                reject
            ) => {

                pending.set(
                    id,
                    {
                        resolve,
                        reject
                    }
                );


                currentWorker.postMessage(
                    {
                        type:
                            "process",

                        id,

                        mime:
                            file.type,

                        preferredDevice,

                        preferredDtype,

                        buffer
                    },

                    [
                        buffer
                    ]
                );

            }
        );

    }


    /* =========================================
       PAUSE CHECKPOINT
    ========================================= */

    async function checkpoint() {

        if (
            state.cancelled
        ) {

            throw new Error(
                "BACKGROUND_REMOVAL_CANCELLED"
            );

        }


        if (
            state.paused
        ) {

            await new Promise(
                resolve => {

                    state.resumeResolver =
                        resolve;

                }
            );

        }


        if (
            state.cancelled
        ) {

            throw new Error(
                "BACKGROUND_REMOVAL_CANCELLED"
            );

        }

    }


    /* =========================================
       IMAGE DECODE
    ========================================= */

    async function decodeImage(
        file
    ) {

        if (
            typeof createImageBitmap ===
            "function"
        ) {

            try {

                const bitmap =
                    await createImageBitmap(
                        file,
                        {
                            imageOrientation:
                                "from-image"
                        }
                    );


                return {

                    source:
                        bitmap,

                    width:
                        bitmap.width,

                    height:
                        bitmap.height,

                    close() {

                        bitmap.close?.();

                    }

                };

            }
            catch (_) {
                // fallback below
            }

        }


        return new Promise(
            (
                resolve,
                reject
            ) => {

                const url =
                    URL.createObjectURL(
                        file
                    );


                const image =
                    new Image();


                image.onload =
                    () => {

                        resolve({

                            source:
                                image,

                            width:
                                image.naturalWidth,

                            height:
                                image.naturalHeight,

                            close() {

                                URL.revokeObjectURL(
                                    url
                                );

                            }

                        });

                    };


                image.onerror =
                    () => {

                        URL.revokeObjectURL(
                            url
                        );


                        reject(
                            new Error(
                                `Unable to decode ${file.name}.`
                            )
                        );

                    };


                image.src =
                    url;

            }
        );

    }


    /* =========================================
       BACKGROUND IMAGE
    ========================================= */

    async function drawBackgroundImage(
        context,
        canvas,
        file
    ) {

        const decoded =
            await decodeImage(
                file
            );


        try {

            const imageRatio =
                decoded.width /
                decoded.height;


            const canvasRatio =
                canvas.width /
                canvas.height;


            let width;
            let height;
            let x;
            let y;


            if (
                imageRatio >
                canvasRatio
            ) {

                height =
                    canvas.height;


                width =
                    height *
                    imageRatio;


                x =
                    (
                        canvas.width -
                        width
                    ) /
                    2;


                y =
                    0;

            }
            else {

                width =
                    canvas.width;


                height =
                    width /
                    imageRatio;


                x =
                    0;


                y =
                    (
                        canvas.height -
                        height
                    ) /
                    2;

            }


            context.drawImage(
                decoded.source,
                x,
                y,
                width,
                height
            );

        }
        finally {

            decoded.close?.();

        }

    }


    /* =========================================
       MASK CANVAS
    ========================================= */

    function createMaskCanvas(
        maskResult,
        softness,
        targetWidth,
        targetHeight
    ) {

        const {
            width,
            height,
            maskBuffer
        } =
            maskResult;


        const sourceMask =
            new Uint8Array(
                maskBuffer
            );


        const sourceCanvas =
            document.createElement(
                "canvas"
            );


        sourceCanvas.width =
            width;


        sourceCanvas.height =
            height;


        const sourceContext =
            sourceCanvas.getContext(
                "2d"
            );


        if (!sourceContext) {
            throw new Error(
                "Canvas 2D is unavailable."
            );
        }


        const data =
            sourceContext.createImageData(
                width,
                height
            );


        for (
            let i = 0;
            i < sourceMask.length;
            i++
        ) {

            const value =
                sourceMask[i];


            const offset =
                i *
                4;


            data.data[
                offset
            ] =
                value;


            data.data[
                offset + 1
            ] =
                value;


            data.data[
                offset + 2
            ] =
                value;


            data.data[
                offset + 3
            ] =
                value;

        }


        sourceContext.putImageData(
            data,
            0,
            0
        );


        const outputWidth =
            Math.max(
                1,
                Number(targetWidth) || width
            );


        const outputHeight =
            Math.max(
                1,
                Number(targetHeight) || height
            );


        const rawCanvas =
            document.createElement(
                "canvas"
            );


        rawCanvas.width =
            outputWidth;


        rawCanvas.height =
            outputHeight;


        const rawContext =
            rawCanvas.getContext(
                "2d"
            );


        if (!rawContext) {
            throw new Error(
                "Canvas 2D is unavailable."
            );
        }


        rawContext.imageSmoothingEnabled =
            true;


        rawContext.imageSmoothingQuality =
            "high";


        rawContext.drawImage(
            sourceCanvas,
            0,
            0,
            outputWidth,
            outputHeight
        );


        sourceCanvas.width = 1;
        sourceCanvas.height = 1;

        if (
            softness <= 0
        ) {

            return rawCanvas;

        }


        const softened =
            document.createElement(
                "canvas"
            );


        softened.width =
            rawCanvas.width;


        softened.height =
            rawCanvas.height;


        const context =
            softened.getContext(
                "2d"
            );


        context.filter =
            `blur(${softness}px)`;


        context.drawImage(
            rawCanvas,
            0,
            0
        );


        context.filter =
            "none";


        return softened;

    }


    /* =========================================
       EXPORT
    ========================================= */

    function canvasToBlob(
        canvas,
        format,
        quality
    ) {

        const mimeMap = {

            png:
                "image/png",

            webp:
                "image/webp",

            jpg:
                "image/jpeg"

        };


        const mime =
            mimeMap[
                format
            ];


        return new Promise(
            (
                resolve,
                reject
            ) => {

                canvas.toBlob(

                    blob => {

                        if (
                            !blob
                        ) {

                            reject(
                                new Error(
                                    "Unable to encode the result."
                                )
                            );


                            return;
                        }


                        if (
                            blob.type !==
                            mime
                        ) {

                            reject(
                                new Error(
                                    `Browser returned ${blob.type} instead of ${mime}.`
                                )
                            );


                            return;
                        }


                        resolve(
                            blob
                        );

                    },

                    mime,

                    quality

                );

            }
        );

    }


    /* =========================================
       COMPOSITE
    ========================================= */

    async function composite(
        file,
        maskResult,
        settings
    ) {

        const decoded =
            await decodeImage(
                file
            );


        try {

            const width =
                decoded.width;


            const height =
                decoded.height;


            if (
                width <= 0 ||
                height <= 0 ||
                width * height >
                    MAX_COMPOSITE_PIXELS
            ) {

                throw new Error(
                    `The image is too large to composite safely in the browser (${width} × ${height}).`
                );

            }


            /*
             * Foreground layer
             */

            const foreground =
                document.createElement(
                    "canvas"
                );


            foreground.width =
                width;


            foreground.height =
                height;


            const foregroundContext =
                foreground.getContext(
                    "2d"
                );


            if (!foregroundContext) {
                throw new Error(
                    "Canvas 2D is unavailable."
                );
            }


            foregroundContext.drawImage(
                decoded.source,
                0,
                0,
                width,
                height
            );


            const maskCanvas =
                createMaskCanvas(
                    maskResult,
                    settings.edgeSoftness,
                    width,
                    height
                );


            foregroundContext
                .globalCompositeOperation =
                    "destination-in";


            foregroundContext.drawImage(
                maskCanvas,
                0,
                0,
                width,
                height
            );


            foregroundContext
                .globalCompositeOperation =
                    "source-over";


            /*
             * Final result
             */

            const output =
                document.createElement(
                    "canvas"
                );


            output.width =
                width;


            output.height =
                height;


            const context =
                output.getContext(
                    "2d"
                );


            if (!context) {
                throw new Error(
                    "Canvas 2D is unavailable."
                );
            }


            if (
                settings.backgroundMode ===
                "color"
            ) {

                context.fillStyle =
                    settings.backgroundColor;


                context.fillRect(
                    0,
                    0,
                    width,
                    height
                );

            }


            if (
                settings.backgroundMode ===
                    "image"
            ) {

                await drawBackgroundImage(
                    context,
                    output,
                    settings.backgroundFile
                );

            }


            /*
             * JPG can never remain transparent.
             */

            if (
                settings.outputFormat ===
                    "jpg" &&
                settings.backgroundMode ===
                    "transparent"
            ) {

                context.fillStyle =
                    "#ffffff";


                context.fillRect(
                    0,
                    0,
                    width,
                    height
                );

            }


            context.drawImage(
                foreground,
                0,
                0
            );


            const blob =
                await canvasToBlob(
                    output,
                    settings.outputFormat,
                    settings.quality
                );


            const outputName =
                `${
                    baseName(
                        file.name
                    )
                }-no-background.${
                    settings.outputFormat
                }`;


            /*
             * The three canvases can otherwise retain very
             * large backing stores until the next GC cycle.
             */
            foreground.width = 1;
            foreground.height = 1;
            maskCanvas.width = 1;
            maskCanvas.height = 1;
            output.width = 1;
            output.height = 1;


            return {

                blob,

                outputUrl:
                    URL.createObjectURL(
                        blob
                    ),

                outputName,

                outputFormat:
                    settings.outputFormat,

                outputSize:
                    blob.size,

                width,

                height

            };

        }
        finally {

            decoded.close?.();

        }

    }


    /* =========================================
       PROCESS ONE
    ========================================= */

    async function processOne(
        file,
        settings,
        index
    ) {

        emit(
            "easyfiletools:background-file-progress",
            {
                index,
                percentage:
                    5
            }
        );


        await checkpoint();


        /*
         * First call may load the AI model.
         */

        const mask =
            await requestMask(
                file
            );


        emit(
            "easyfiletools:background-file-progress",
            {
                index,
                percentage:
                    70
            }
        );


        await checkpoint();


        const result =
            await composite(
                file,
                mask,
                settings
            );


        emit(
            "easyfiletools:background-file-progress",
            {
                index,
                percentage:
                    100
            }
        );


        return result;

    }


    /* =========================================
       BATCH
    ========================================= */

    async function processFiles(
        items,
        settings
    ) {

        if (
            state.running
        ) {

            return;
        }


        const files =
            items
                .map(
                    extractFile
                )
                .filter(Boolean);


        if (
            files.length === 0
        ) {

            return;
        }


        state.running =
            true;

        state.paused =
            false;

        state.cancelled =
            false;


        emit(
            "easyfiletools:background-removal-started",
            {
                total:
                    files.length
            }
        );


        let operationError =
            null;

        let firstFileError =
            null;

        let successCount =
            0;

        let failedCount =
            0;


        try {

            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                state.currentIndex =
                    index;


                await checkpoint();


                try {

                    const result =
                        await processOne(
                            files[index],
                            settings,
                            index
                        );


                    successCount +=
                        1;


                    emit(
                        "easyfiletools:background-file-complete",
                        {
                            index,

                            file:
                                files[index],

                            result
                        }
                    );

                }
                catch (error) {

                    if (
                        error.message ===
                            "BACKGROUND_REMOVAL_CANCELLED" ||
                        error.message ===
                            "BACKGROUND_WORKER_TERMINATED"
                    ) {
                        throw error;
                    }


                    failedCount +=
                        1;

                    firstFileError ||=
                        error;


                    console.error(
                        `[BACKGROUND ENGINE] File ${index + 1}/${files.length}:`,
                        error
                    );


                    emit(
                        "easyfiletools:background-file-error",
                        {
                            index,

                            file:
                                files[index],

                            error
                        }
                    );

                    /* Continue with the remaining files. */
                }

            }


            /*
             * Keep every successful output, but report the operation as
             * partially failed after all files have been attempted.
             */
            if (
                failedCount > 0
            ) {
                const noun =
                    files.length === 1
                        ? "image"
                        : "images";

                const firstMessage =
                    firstFileError?.message
                        ? ` First error: ${firstFileError.message}`
                        : "";

                operationError =
                    new Error(
                        `${failedCount} of ${files.length} ${noun} failed.${firstMessage}`
                    );
            }

        }
        catch (error) {

            if (
                error.message !==
                    "BACKGROUND_REMOVAL_CANCELLED" &&
                error.message !==
                    "BACKGROUND_WORKER_TERMINATED"
            ) {
                operationError =
                    error;
            }

        }
        finally {

            const cancelled =
                state.cancelled;


            state.running =
                false;

            state.paused =
                false;

            state.currentIndex =
                -1;

            state.resumeResolver =
                null;


            emit(
                "easyfiletools:background-removal-ended",
                {
                    cancelled,

                    error:
                        operationError,

                    successCount,

                    failedCount,

                    total:
                        files.length
                }
            );

        }

    }


    /* =========================================
       CONTROLS
    ========================================= */

    function pause() {

        if (
            !state.running ||
            state.paused
        ) {

            return;
        }


        state.paused =
            true;


        emit(
            "easyfiletools:background-removal-paused"
        );

    }


    function resume() {

        if (
            !state.running ||
            !state.paused
        ) {

            return;
        }


        state.paused =
            false;


        const resolver =
            state.resumeResolver;


        state.resumeResolver =
            null;


        resolver?.();


        emit(
            "easyfiletools:background-removal-resumed"
        );

    }


    function cancel() {

        if (
            !state.running
        ) {

            return;
        }


        state.cancelled =
            true;

        state.paused =
            false;


        const resolver =
            state.resumeResolver;


        state.resumeResolver =
            null;


        resolver?.();


        /*
         * Terminate active inference immediately.
         */

        terminateWorker();


        emit(
            "easyfiletools:background-ai-status",
            {
                status:
                    "idle",

                label:
                    "AI stopped"
            }
        );

    }


    window.BackgroundRemovalEngine = {

        processFiles,

        pause,

        resume,

        cancel,

        getState() {

            return {
                ...state
            };

        }

    };

})();