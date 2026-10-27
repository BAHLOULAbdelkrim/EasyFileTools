console.log(
    "[PDF IMAGE CONVERTER] pdf-image-converter.js loaded"
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


    function mimeFor(
        format
    ) {

        return {

            png:
                "image/png",

            jpg:
                "image/jpeg",

            webp:
                "image/webp"

        }[format];

    }


    function canvasToBlob(
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
                                    "Unable to encode page image."
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


    async function convertPdf(
        file,
        settings,
        progressCallback,
        control = null
    ) {

        await window.EasyFileDependencies.ensurePdfJs();


        const bytes =
            new Uint8Array(
                await file
                    .arrayBuffer()
            );


        const loadingTask =
            pdfjsLib.getDocument({
                data:
                    bytes
            });


        const pdf =
            await loadingTask.promise;


        const output = [];


        for (
            let pageNumber = 1;
            pageNumber <=
                pdf.numPages;
            pageNumber++
        ) {

            await control?.checkpoint?.();

            const page =
                await pdf.getPage(
                    pageNumber
                );


            const viewport =
                page.getViewport({
                    scale:
                        settings.scale
                });


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                Math.ceil(
                    viewport.width
                );


            canvas.height =
                Math.ceil(
                    viewport.height
                );


            const context =
                canvas.getContext(
                    "2d"
                );


            /*
             * PDF pages visually have a white
             * background in normal viewers.
             */

            context.fillStyle =
                "#ffffff";


            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );


            await page.render({

                canvasContext:
                    context,

                viewport

            }).promise;


            const mime =
                mimeFor(
                    settings.format
                );


            const blob =
                await canvasToBlob(

                    canvas,

                    mime,

                    settings.format ===
                        "png"
                        ? undefined
                        : settings.quality

                );


            output.push({

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
                    }-page-${
                        String(
                            pageNumber
                        ).padStart(
                            3,
                            "0"
                        )
                    }.${settings.format}`,

                outputFormat:
                    settings.format,

                outputSize:
                    blob.size

            });


            page.cleanup?.();


            await control?.checkpoint?.();

            progressCallback?.(

                Math.round(
                    (
                        pageNumber /
                        pdf.numPages
                    ) *
                    100
                )

            );

        }


        await pdf.destroy?.();


        return output;

    }


    window.PdfImageConverter = {

        convertPdf

    };

})();