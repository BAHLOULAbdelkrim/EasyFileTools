console.log(
    "[IMAGE CONVERTER] image-converter.js loaded"
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


    /* =====================================================
       HELPERS
    ===================================================== */

    function extractFile(
        item
    ) {

        if (
            item instanceof File
        ) {

            return item;
        }


        return item?.file || null;

    }


    function getBaseName(
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


    function normalizeExtension(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        if (dot < 0) {
            return "";
        }


        const extension =
            filename
                .slice(dot + 1)
                .toLowerCase();


        return extension === "jpeg"
            ? "jpg"
            : extension;

    }


    function getOutputExtension(
        format
    ) {

        return format ===
            "jpg"
                ? "jpg"
                : format;

    }


    function getOutputMime(
        format
    ) {

        const map = {

            png:
                "image/png",

            jpg:
                "image/jpeg",

            webp:
                "image/webp",

            avif:
                "image/avif",

            bmp:
                "image/bmp"

        };


        return map[
            format
        ] || "";

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


    /* =====================================================
       PAUSE
    ===================================================== */

    function waitIfPaused() {

        if (
            !state.paused
        ) {

            return Promise.resolve();

        }


        return new Promise(
            resolve => {

                state.resumeResolver =
                    resolve;

            }
        );

    }


    async function checkpoint() {

        if (
            state.cancelled
        ) {

            throw new Error(
                "IMAGE_CONVERSION_CANCELLED"
            );

        }


        await waitIfPaused();


        if (
            state.cancelled
        ) {

            throw new Error(
                "IMAGE_CONVERSION_CANCELLED"
            );

        }

    }


    /* =====================================================
       DECODE
    ===================================================== */

    async function decodeWithImageBitmap(
        file
    ) {

        if (
            typeof createImageBitmap !==
            "function"
        ) {

            return null;
        }


        try {

            let bitmap;


            try {

                bitmap =
                    await createImageBitmap(
                        file,
                        {
                            imageOrientation:
                                "from-image"
                        }
                    );

            }
            catch (_) {

                bitmap =
                    await createImageBitmap(
                        file
                    );

            }


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

            return null;

        }

    }


    function decodeWithImageElement(
        file
    ) {

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


    async function decodeImage(
        file
    ) {

        const bitmap =
            await decodeWithImageBitmap(
                file
            );


        if (
            bitmap
        ) {

            return bitmap;
        }


        return decodeWithImageElement(
            file
        );

    }


    /* =====================================================
       CANVAS → BLOB
    ===================================================== */

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

                        if (
                            !blob
                        ) {

                            reject(
                                new Error(
                                    "The browser could not encode this image."
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
                                    `The browser returned ${blob.type || "an unknown format"} instead of ${mime}.`
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


    /* =====================================================
       BMP ENCODER
    ===================================================== */

    function encodeBmp(
        canvas
    ) {

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );


        const width =
            canvas.width;


        const height =
            canvas.height;


        const imageData =
            context.getImageData(
                0,
                0,
                width,
                height
            );


        const pixels =
            imageData.data;


        const rowSize =
            Math.floor(
                (
                    24 *
                    width +
                    31
                ) /
                32
            ) *
            4;


        const pixelArraySize =
            rowSize *
            height;


        const fileSize =
            54 +
            pixelArraySize;


        const buffer =
            new ArrayBuffer(
                fileSize
            );


        const view =
            new DataView(
                buffer
            );


        /*
         * BITMAP FILE HEADER
         */

        view.setUint8(
            0,
            0x42
        );

        view.setUint8(
            1,
            0x4D
        );


        view.setUint32(
            2,
            fileSize,
            true
        );


        view.setUint32(
            10,
            54,
            true
        );


        /*
         * DIB HEADER
         */

        view.setUint32(
            14,
            40,
            true
        );


        view.setInt32(
            18,
            width,
            true
        );


        view.setInt32(
            22,
            height,
            true
        );


        view.setUint16(
            26,
            1,
            true
        );


        view.setUint16(
            28,
            24,
            true
        );


        view.setUint32(
            34,
            pixelArraySize,
            true
        );


        let offset =
            54;


        for (
            let y =
                height - 1;

            y >= 0;

            y--
        ) {

            const rowStart =
                offset;


            for (
                let x = 0;

                x < width;

                x++
            ) {

                const source =
                    (
                        y *
                        width +
                        x
                    ) *
                    4;


                /*
                 * BMP = BGR
                 */

                view.setUint8(
                    offset++,
                    pixels[
                        source + 2
                    ]
                );


                view.setUint8(
                    offset++,
                    pixels[
                        source + 1
                    ]
                );


                view.setUint8(
                    offset++,
                    pixels[
                        source
                    ]
                );

            }


            while (
                offset -
                rowStart <
                rowSize
            ) {

                view.setUint8(
                    offset++,
                    0
                );

            }

        }


        return new Blob(
            [
                buffer
            ],
            {
                type:
                    "image/bmp"
            }
        );

    }


    /* =====================================================
       ONE IMAGE
    ===================================================== */

    async function convertOne(
        file,
        settings,
        index
    ) {

        /*
         * Mixed batches can contain files that are
         * already in the requested output format.
         * Do not decode/re-encode those files: this is
         * faster and, more importantly, preserves their
         * original pixels/quality byte-for-byte.
         */
        const sourceFormat =
            normalizeExtension(
                file.name
            );


        if (
            sourceFormat &&
            sourceFormat === settings.format
        ) {

            await checkpoint();


            const outputUrl =
                URL.createObjectURL(
                    file
                );


            emit(
                "easyfiletools:image-file-progress",
                {
                    index,
                    percentage: 100
                }
            );


            console.log(
                "[IMAGE CONVERTER] Same-format passthrough:",
                file.name
            );


            return {
                blob: file,
                outputUrl,
                outputName: file.name,
                outputFormat: sourceFormat,
                outputSize: file.size,
                passthrough: true
            };

        }


        emit(
            "easyfiletools:image-file-progress",
            {
                index,
                percentage:
                    5
            }
        );


        await checkpoint();


        const decoded =
            await decodeImage(
                file
            );


        try {

            emit(
                "easyfiletools:image-file-progress",
                {
                    index,
                    percentage:
                        30
                }
            );


            const {
                width,
                height
            } =
                decoded;


            if (
                width <= 0 ||
                height <= 0
            ) {

                throw new Error(
                    "Invalid image dimensions."
                );

            }


            if (
                width *
                height >
                MAX_CANVAS_PIXELS
            ) {

                throw new Error(
                    `The image is too large to process safely in the browser (${width} × ${height}).`
                );

            }


            await checkpoint();


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                width;


            canvas.height =
                height;


            const context =
                canvas.getContext(
                    "2d"
                );


            if (
                !context
            ) {

                throw new Error(
                    "Canvas 2D is unavailable."
                );

            }


            /*
             * JPG / BMP have no useful alpha channel.
             */

            if (
                settings.format ===
                    "jpg" ||
                settings.format ===
                    "bmp"
            ) {

                context.fillStyle =
                    settings.backgroundColor ||
                    "#ffffff";


                context.fillRect(
                    0,
                    0,
                    width,
                    height
                );

            }
            else {

                context.clearRect(
                    0,
                    0,
                    width,
                    height
                );

            }


            context.drawImage(
                decoded.source,
                0,
                0,
                width,
                height
            );


            emit(
                "easyfiletools:image-file-progress",
                {
                    index,
                    percentage:
                        65
                }
            );


            await checkpoint();


            let blob;


            try {

                if (
                    settings.format ===
                    "bmp"
                ) {

                    blob =
                        encodeBmp(
                            canvas
                        );

                }
                else {

                    const mime =
                        getOutputMime(
                            settings.format
                        );


                    blob =
                        await canvasToBlobExact(
                            canvas,
                            mime,
                            settings.quality
                        );

                }

            }
            finally {

                /*
                 * Release the potentially large backing store
                 * even when encoding fails.
                 */
                canvas.width = 1;
                canvas.height = 1;

            }


            emit(
                "easyfiletools:image-file-progress",
                {
                    index,
                    percentage:
                        90
                }
            );


            await checkpoint();


            const extension =
                getOutputExtension(
                    settings.format
                );


            const outputName =
                `${
                    getBaseName(
                        file.name
                    )
                }.${extension}`;


            const outputUrl =
                URL.createObjectURL(
                    blob
                );


            emit(
                "easyfiletools:image-file-progress",
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
                    extension,

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


    /* =====================================================
       BATCH
    ===================================================== */

    async function convertFiles(
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
            files.length ===
            0 ||
            !settings?.format
        ) {

            return;
        }


        state.running =
            true;

        state.paused =
            false;

        state.cancelled =
            false;

        state.currentIndex =
            -1;


        emit(
            "easyfiletools:image-conversion-started",
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

                index <
                files.length;

                index++
            ) {

                state.currentIndex =
                    index;


                await checkpoint();


                const file =
                    files[
                        index
                    ];


                console.log(
                    "[IMAGE CONVERTER]",
                    `${index + 1}/${files.length}:`,
                    file.name,
                    "→",
                    settings.format
                );


                try {

                    const result =
                        await convertOne(
                            file,
                            settings,
                            index
                        );


                    emit(
                        "easyfiletools:image-file-complete",
                        {
                            index,

                            total:
                                files.length,

                            file,

                            result
                        }
                    );

                }
                catch (error) {

                    if (
                        error.message ===
                        "IMAGE_CONVERSION_CANCELLED"
                    ) {

                        throw error;
                    }


                    errorOccurred =
                        error;


                    emit(
                        "easyfiletools:image-file-error",
                        {
                            index,

                            file,

                            error
                        }
                    );


                    throw error;

                }

            }

        }
        catch (error) {

            if (
                error.message !==
                "IMAGE_CONVERSION_CANCELLED"
            ) {

                console.error(
                    "[IMAGE CONVERTER]",
                    error
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
                "easyfiletools:image-conversion-ended",
                {
                    cancelled,

                    error:
                        errorOccurred
                }
            );

        }

    }


    /* =====================================================
       PAUSE / RESUME / CANCEL
    ===================================================== */

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
            "easyfiletools:image-conversion-paused",
            {
                index:
                    state.currentIndex
            }
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
            "easyfiletools:image-conversion-resumed",
            {
                index:
                    state.currentIndex
            }
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

    }


    /* =====================================================
       PUBLIC
    ===================================================== */

    window.ImageConverter = {

        convertFiles,

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