console.log(
    "[IMAGE COMPRESSOR] image-compressor.js loaded"
);


(() => {

    "use strict";


    const MAX_CANVAS_PIXELS =
        60_000_000;


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


    function extensionOf(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        return dot >= 0
            ? filename
                .slice(
                    dot + 1
                )
                .toLowerCase()
            : "";

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


    function mimeFor(
        extension
    ) {

        const map = {

            jpg:
                "image/jpeg",

            jpeg:
                "image/jpeg",

            png:
                "image/png",

            webp:
                "image/webp",

            avif:
                "image/avif"

        };


        return map[
            extension
        ] || "";

    }


    function outputExtension(
        extension
    ) {

        return extension ===
            "jpeg"
                ? "jpg"
                : extension;

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


    async function checkpoint() {

        if (
            state.cancelled
        ) {

            throw new Error(
                "IMAGE_COMPRESSION_CANCELLED"
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
                "IMAGE_COMPRESSION_CANCELLED"
            );

        }

    }


    /* =========================================
       DECODE
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


    function canvasToBlobExact(
        canvas,
        mime,
        quality
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                canvas.toBlob(

                    blob => {

                        if (!blob) {

                            reject(
                                new Error(
                                    "Unable to encode the image."
                                )
                            );


                            return;
                        }


                        if (
                            blob.type !== mime
                        ) {

                            reject(
                                new Error(
                                    `Expected ${mime}, received ${blob.type}.`
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
       SVG
    ========================================= */

    async function compressSvg(
        file
    ) {

        const text =
            await file.text();


        /*
         * Conservative optimisation:
         * - remove XML comments
         * - remove whitespace between tags
         * - trim outer whitespace
         *
         * No risky attribute rewriting.
         */

        const optimized =
            text
                .replace(
                    /<!--[\s\S]*?-->/g,
                    ""
                )
                .replace(
                    />\s+</g,
                    "><"
                )
                .trim();


        return new Blob(
            [
                optimized
            ],
            {
                type:
                    "image/svg+xml"
            }
        );

    }


    /* =========================================
       RASTER
    ========================================= */

    async function compressRaster(
        file,
        extension,
        quality
    ) {

        const decoded =
            await decodeImage(
                file
            );


        try {

            if (
                decoded.width <= 0 ||
                decoded.height <= 0 ||
                decoded.width * decoded.height >
                    MAX_CANVAS_PIXELS
            ) {

                throw new Error(
                    `The image is too large to compress safely in the browser (${decoded.width} × ${decoded.height}).`
                );

            }


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                decoded.width;


            canvas.height =
                decoded.height;


            const context =
                canvas.getContext(
                    "2d"
                );


            if (!context) {
                throw new Error(
                    "Canvas 2D is unavailable."
                );
            }


            if (
                extension === "jpg" ||
                extension === "jpeg"
            ) {

                context.fillStyle =
                    "#ffffff";


                context.fillRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

            }


            context.drawImage(
                decoded.source,
                0,
                0,
                canvas.width,
                canvas.height
            );


            const mime =
                mimeFor(
                    extension
                );


            const encodeQuality =
                extension === "png"
                    ? undefined
                    : quality;


            try {

                return await canvasToBlobExact(
                    canvas,
                    mime,
                    encodeQuality
                );

            }
            finally {

                canvas.width = 1;
                canvas.height = 1;

            }

        }
        finally {

            decoded.close?.();

        }

    }


    /* =========================================
       ONE FILE
    ========================================= */

    async function compressOne(
        file,
        settings,
        index
    ) {

        const extension =
            extensionOf(
                file.name
            );


        emit(
            "easyfiletools:image-compress-progress",
            {
                index,
                percentage:
                    10
            }
        );


        await checkpoint();


        let candidate;


        if (
            extension ===
            "svg"
        ) {

            candidate =
                await compressSvg(
                    file
                );

        }
        else {

            candidate =
                await compressRaster(
                    file,
                    extension,
                    settings.quality
                );

        }


        emit(
            "easyfiletools:image-compress-progress",
            {
                index,
                percentage:
                    80
            }
        );


        await checkpoint();


        const useOriginal =
            settings.keepSmaller &&
            candidate.size >=
                file.size;


        const blob =
            useOriginal
                ? file
                : candidate;


        const extensionOut =
            outputExtension(
                extension
            );


        const outputName =
            `${
                baseName(
                    file.name
                )
            }-compressed.${extensionOut}`;


        const outputUrl =
            URL.createObjectURL(
                blob
            );


        const savedBytes =
            Math.max(
                0,
                file.size -
                blob.size
            );


        const savedPercent =
            file.size > 0
                ? (
                    savedBytes /
                    file.size
                ) *
                100
                : 0;


        emit(
            "easyfiletools:image-compress-progress",
            {
                index,
                percentage:
                    100
            }
        );


        return {

            blob,

            outputUrl,

            outputName,

            outputFormat:
                extensionOut,

            outputSize:
                blob.size,

            originalSize:
                file.size,

            savedBytes,

            savedPercent,

            usedOriginal:
                useOriginal

        };

    }


    /* =========================================
       BATCH
    ========================================= */

    async function compressFiles(
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
                .filter(
                    Boolean
                );


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
            "easyfiletools:image-compression-started",
            {
                total:
                    files.length
            }
        );


        let errorOccurred =
            null;


        try {

            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                state.currentIndex =
                    index;


                await checkpoint();


                const result =
                    await compressOne(
                        files[index],
                        settings,
                        index
                    );


                emit(
                    "easyfiletools:image-compress-complete",
                    {
                        index,

                        file:
                            files[index],

                        result
                    }
                );

            }

        }
        catch (error) {

            if (
                error.message !==
                "IMAGE_COMPRESSION_CANCELLED"
            ) {

                errorOccurred =
                    error;


                console.error(
                    "[IMAGE COMPRESSOR]",
                    error
                );


                emit(
                    "easyfiletools:image-compress-error",
                    {
                        index:
                            state.currentIndex,

                        error
                    }
                );

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
                "easyfiletools:image-compression-ended",
                {
                    cancelled,

                    error:
                        errorOccurred
                }
            );

        }

    }


    /* =========================================
       CONTROLS
    ========================================= */

    function pause() {

        if (
            state.running &&
            !state.paused
        ) {

            state.paused =
                true;


            emit(
                "easyfiletools:image-compression-paused"
            );

        }

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
            "easyfiletools:image-compression-resumed"
        );

    }


    function cancel() {

        state.cancelled =
            true;

        state.paused =
            false;


        const resolver =
            state.resumeResolver;


        state.resumeResolver =
            null;


        resolver?.();

    }


    window.ImageCompressor = {

        compressFiles,

        pause,

        resume,

        cancel

    };

})();