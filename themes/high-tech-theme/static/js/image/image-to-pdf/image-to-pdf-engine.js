console.log(
    "[IMAGE TO PDF ENGINE] image-to-pdf-engine.js loaded"
);


(() => {

    "use strict";


    const PT_PER_MM =
        72 /
        25.4;


    const PAGE_SIZES = {

        a4: [
            595.28,
            841.89
        ],

        a3: [
            841.89,
            1190.55
        ],

        letter: [
            612,
            792
        ],

        legal: [
            612,
            1008
        ]

    };


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


    function extractFile(
        item
    ) {

        return item instanceof File
            ? item
            : item?.file || null;

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
                "IMAGE_PDF_CANCELLED"
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
                "IMAGE_PDF_CANCELLED"
            );

        }

    }


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


    function resolvePageDimensions(
        settings,
        imageWidth,
        imageHeight
    ) {

        if (
            settings.pageSize ===
            "auto"
        ) {

            /*
             * Browser pixels approximated at 96 DPI.
             * 1 px ≈ 0.75 PDF points.
             */

            return [
                Math.max(
                    72,
                    imageWidth *
                    0.75
                ),

                Math.max(
                    72,
                    imageHeight *
                    0.75
                )
            ];

        }


        let [
            width,
            height
        ] =
            PAGE_SIZES[
                settings.pageSize
            ];


        let orientation =
            settings.orientation;


        if (
            orientation ===
            "auto"
        ) {

            orientation =
                imageWidth >
                imageHeight
                    ? "landscape"
                    : "portrait";

        }


        if (
            orientation ===
            "landscape" &&
            width < height
        ) {

            [
                width,
                height
            ] = [
                height,
                width
            ];

        }


        if (
            orientation ===
            "portrait" &&
            width > height
        ) {

            [
                width,
                height
            ] = [
                height,
                width
            ];

        }


        return [
            width,
            height
        ];

    }


    function canvasToJpeg(
        canvas,
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
                            !blob ||
                            blob.type !==
                            "image/jpeg"
                        ) {

                            reject(
                                new Error(
                                    "Unable to encode image for PDF."
                                )
                            );


                            return;
                        }


                        resolve(
                            blob
                        );

                    },

                    "image/jpeg",

                    quality
                );

            }
        );

    }


    function canvasToPng(
        canvas
    ) {

        return new Promise(
            (resolve, reject) => {

                canvas.toBlob(
                    blob => {

                        if (
                            !blob ||
                            blob.type !==
                                "image/png"
                        ) {

                            reject(
                                new Error(
                                    "Unable to encode lossless image for PDF."
                                )
                            );

                            return;
                        }

                        resolve(blob);

                    },
                    "image/png"
                );

            }
        );

    }


    async function rasterize(
        decoded,
        settings,
        targetAspect
    ) {

        let sourceX =
            0;

        let sourceY =
            0;

        let sourceWidth =
            decoded.width;

        let sourceHeight =
            decoded.height;


        if (
            settings.fit ===
            "fill" &&
            targetAspect >
            0
        ) {

            const sourceAspect =
                sourceWidth /
                sourceHeight;


            if (
                sourceAspect >
                targetAspect
            ) {

                const croppedWidth =
                    sourceHeight *
                    targetAspect;


                sourceX =
                    (
                        sourceWidth -
                        croppedWidth
                    ) /
                    2;


                sourceWidth =
                    croppedWidth;

            }
            else if (
                sourceAspect <
                targetAspect
            ) {

                const croppedHeight =
                    sourceWidth /
                    targetAspect;


                sourceY =
                    (
                        sourceHeight -
                        croppedHeight
                    ) /
                    2;


                sourceHeight =
                    croppedHeight;

            }

        }


        let scale =
            1;


        if (
            settings.maxResolution >
            0
        ) {

            scale =
                Math.min(
                    1,
                    settings.maxResolution /
                    Math.max(
                        sourceWidth,
                        sourceHeight
                    )
                );

        }


        const outputWidth =
            Math.max(
                1,
                Math.round(
                    sourceWidth *
                    scale
                )
            );


        const outputHeight =
            Math.max(
                1,
                Math.round(
                    sourceHeight *
                    scale
                )
            );


        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            outputWidth;


        canvas.height =
            outputHeight;


        const context =
            canvas.getContext(
                "2d"
            );


        if (!context) {

            canvas.width = 1;
            canvas.height = 1;

            throw new Error(
                "Canvas 2D is unavailable."
            );

        }


        context.fillStyle =
            settings.background;


        context.fillRect(
            0,
            0,
            outputWidth,
            outputHeight
        );


        context.drawImage(
            decoded.source,

            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,

            0,
            0,
            outputWidth,
            outputHeight
        );


        let imageBlob;


        try {

            imageBlob =
                settings.lossless
                    ? await canvasToPng(
                        canvas
                    )
                    : await canvasToJpeg(
                        canvas,
                        settings.quality
                    );

        }
        finally {

            canvas.width = 1;
            canvas.height = 1;

        }


        return imageBlob;

    }


    async function createPdf(
        items,
        settings
    ) {

        if (
            state.running
        ) {

            return null;
        }


        if (
            !window.PDFLib?.PDFDocument
        ) {

            throw new Error(
                "PDFLib is not loaded."
            );

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
            0
        ) {

            return null;
        }


        state.running =
            true;

        state.paused =
            false;

        state.cancelled =
            false;


        emit(
            "easyfiletools:image-pdf-started",
            {
                total:
                    files.length
            }
        );


        let errorOccurred =
            null;


        try {

            const {
                PDFDocument
            } =
                window.PDFLib;


            const pdf =
                await PDFDocument.create();


            pdf.setCreator(
                "FileMorning"
            );


            pdf.setProducer(
                "FileMorning"
            );


            pdf.setTitle(
                settings.filename
                    .replace(
                        /\.pdf$/i,
                        ""
                    )
            );


            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                state.currentIndex =
                    index;


                await checkpoint();


                const file =
                    files[index];


                emit(
                    "easyfiletools:image-pdf-file-progress",
                    {
                        index,
                        percentage:
                            10
                    }
                );


                const decoded =
                    await decodeImage(
                        file
                    );


                try {

                    const [
                        pageWidth,
                        pageHeight
                    ] =
                        resolvePageDimensions(
                            settings,
                            decoded.width,
                            decoded.height
                        );


                    const margin =
                        settings.margin *
                        PT_PER_MM;


                    const availableWidth =
                        Math.max(
                            1,
                            pageWidth -
                            margin *
                            2
                        );


                    const availableHeight =
                        Math.max(
                            1,
                            pageHeight -
                            margin *
                            2
                        );


                    const targetAspect =
                        availableWidth /
                        availableHeight;


                    await checkpoint();


                    emit(
                        "easyfiletools:image-pdf-file-progress",
                        {
                            index,
                            percentage:
                                35
                        }
                    );


                    const imageBlob =
                        await rasterize(
                            decoded,
                            settings,
                            targetAspect
                        );


                    await checkpoint();


                    emit(
                        "easyfiletools:image-pdf-file-progress",
                        {
                            index,
                            percentage:
                                65
                        }
                    );


                    const bytes =
                        await imageBlob
                            .arrayBuffer();


                    const pdfImage =
                        settings.lossless
                            ? await pdf.embedPng(
                                bytes
                            )
                            : await pdf.embedJpg(
                                bytes
                            );


                    const page =
                        pdf.addPage(
                            [
                                pageWidth,
                                pageHeight
                            ]
                        );


                    let drawWidth;
                    let drawHeight;


                    if (
                        settings.fit ===
                        "fill"
                    ) {

                        drawWidth =
                            availableWidth;

                        drawHeight =
                            availableHeight;

                    }
                    else {

                        const scale =
                            Math.min(
                                availableWidth /
                                pdfImage.width,

                                availableHeight /
                                pdfImage.height
                            );


                        drawWidth =
                            pdfImage.width *
                            scale;


                        drawHeight =
                            pdfImage.height *
                            scale;

                    }


                    const x =
                        (
                            pageWidth -
                            drawWidth
                        ) /
                        2;


                    const y =
                        (
                            pageHeight -
                            drawHeight
                        ) /
                        2;


                    page.drawImage(
                        pdfImage,
                        {
                            x,
                            y,

                            width:
                                drawWidth,

                            height:
                                drawHeight
                        }
                    );


                    emit(
                        "easyfiletools:image-pdf-file-progress",
                        {
                            index,
                            percentage:
                                100
                        }
                    );


                    emit(
                        "easyfiletools:image-pdf-source-complete",
                        {
                            index,
                            file
                        }
                    );

                }
                finally {

                    decoded.close?.();

                }

            }


            await checkpoint();


            const pdfBytes =
                await pdf.save();


            const blob =
                new Blob(
                    [
                        pdfBytes
                    ],
                    {
                        type:
                            "application/pdf"
                    }
                );


            const result = {

                blob,

                outputName:
                    settings.filename,

                outputSize:
                    blob.size,

                pageCount:
                    files.length

            };


            emit(
                "easyfiletools:image-pdf-complete",
                {
                    result
                }
            );


            return result;

        }
        catch (error) {

            if (
                error.message !==
                "IMAGE_PDF_CANCELLED"
            ) {

                errorOccurred =
                    error;


                console.error(
                    "[IMAGE TO PDF ENGINE]",
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
                "easyfiletools:image-pdf-ended",
                {
                    cancelled,

                    error:
                        errorOccurred
                }
            );

        }

    }


    function pause() {

        if (
            state.running &&
            !state.paused
        ) {

            state.paused =
                true;


            emit(
                "easyfiletools:image-pdf-paused"
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
            "easyfiletools:image-pdf-resumed"
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


    window.ImageToPdfEngine = {

        createPdf,

        pause,

        resume,

        cancel

    };

})();