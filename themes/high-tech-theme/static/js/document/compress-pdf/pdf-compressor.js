console.log(
    "[PDF COMPRESSOR] pdf-compressor.js loaded"
);


(() => {

    "use strict";


    function baseName(
        filename
    ) {

        return filename
            .replace(
                /\.pdf$/i,
                ""
            );

    }


    async function safeCompress(
        file
    ) {

        const doc =
            await PDFLib
                .PDFDocument
                .load(
                    await file.arrayBuffer(),
                    {
                        updateMetadata:
                            false
                    }
                );


        const bytes =
            await doc.save({

                useObjectStreams:
                    true,

                addDefaultPage:
                    false,

                updateFieldAppearances:
                    false

            });


        return new Blob(
            [bytes],
            {
                type:
                    "application/pdf"
            }
        );

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

                        if (!blob) {

                            reject(
                                new Error(
                                    "Unable to encode PDF page."
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


    async function strongCompress(
        file,
        settings,
        progress,
        control = null
    ) {

        await window.EasyFileDependencies.ensurePdfJs();


        const bytes =
            new Uint8Array(
                await file.arrayBuffer()
            );


        const source =
            await pdfjsLib
                .getDocument({
                    data:
                        bytes
                })
                .promise;


        const output =
            await PDFLib
                .PDFDocument
                .create();


        for (
            let pageNumber = 1;
            pageNumber <=
                source.numPages;
            pageNumber++
        ) {

            await control?.checkpoint?.();

            const sourcePage =
                await source.getPage(
                    pageNumber
                );


            /*
             * scale 1 gives the page dimensions
             * used for the resulting PDF page.
             */

            const pageViewport =
                sourcePage.getViewport({
                    scale:
                        1
                });


            const renderViewport =
                sourcePage.getViewport({
                    scale:
                        settings.scale
                });


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                Math.ceil(
                    renderViewport.width
                );


            canvas.height =
                Math.ceil(
                    renderViewport.height
                );


            const context =
                canvas.getContext(
                    "2d"
                );


            context.fillStyle =
                "#ffffff";


            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );


            await sourcePage.render({

                canvasContext:
                    context,

                viewport:
                    renderViewport

            }).promise;


            const jpegBlob =
                await canvasToJpeg(
                    canvas,
                    settings.quality
                );


            const embedded =
                await output.embedJpg(
                    await jpegBlob
                        .arrayBuffer()
                );


            const page =
                output.addPage(
                    [
                        pageViewport.width,
                        pageViewport.height
                    ]
                );


            page.drawImage(
                embedded,
                {
                    x:
                        0,

                    y:
                        0,

                    width:
                        pageViewport.width,

                    height:
                        pageViewport.height
                }
            );


            sourcePage.cleanup?.();


            progress?.(

                Math.round(
                    (
                        pageNumber /
                        source.numPages
                    ) *
                    100
                )

            );

        }


        await source.destroy?.();


        const outputBytes =
            await output.save({
                useObjectStreams:
                    true,

                addDefaultPage:
                    false
            });


        return new Blob(
            [outputBytes],
            {
                type:
                    "application/pdf"
            }
        );

    }


    async function compress(
        file,
        settings,
        progress,
        control = null
    ) {

        let candidate;


        if (
            settings.mode ===
            "strong"
        ) {

            candidate =
                await strongCompress(
                    file,
                    settings,
                    progress,
                    control
                );

        }
        else {

            candidate =
                await safeCompress(
                    file
                );


            progress?.(
                100
            );

        }


        await control?.checkpoint?.();

        const useOriginal =
            settings.keepSmaller &&
            candidate.size >=
                file.size;


        const blob =
            useOriginal
                ? file
                : candidate;


        return {

            blob,

            outputUrl:
                URL.createObjectURL(
                    blob
                ),

            outputName:
                `${
                    baseName(
                        file.name
                    )
                }-compressed.pdf`,

            outputFormat:
                "pdf",

            outputSize:
                blob.size,

            originalSize:
                file.size,

            savedBytes:
                Math.max(
                    0,
                    file.size -
                    blob.size
                ),

            usedOriginal:
                useOriginal

        };

    }


    window.PdfCompressor = {

        compress

    };

})();