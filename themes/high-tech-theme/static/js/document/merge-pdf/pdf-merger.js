console.log(
    "[PDF MERGER] pdf-merger.js loaded"
);


(() => {

    "use strict";


    function fileOf(
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


    async function merge(
        items,
        settings,
        control = null
    ) {

        if (
            !window.PDFLib
                ?.PDFDocument
        ) {

            throw new Error(
                "PDFLib is not loaded."
            );

        }


        const files =
            items
                .map(fileOf)
                .filter(Boolean);


        if (
            files.length <
            2
        ) {

            throw new Error(
                "At least two PDFs are required."
            );

        }


        const {
            PDFDocument
        } =
            window.PDFLib;


        emit(
            "easyfiletools:merge-pdf-started",
            {
                total:
                    files.length
            }
        );


        try {

            const output =
                await PDFDocument.create();


            let pageCount =
                0;


            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                await control?.checkpoint?.();

                const bytes =
                    await files[
                        index
                    ].arrayBuffer();


                const source =
                    await PDFDocument.load(
                        bytes,
                        {
                            updateMetadata:
                                false
                        }
                    );


                const indexes =
                    source.getPageIndices();


                const pages =
                    await output.copyPages(
                        source,
                        indexes
                    );


                pages.forEach(
                    page =>
                        output.addPage(
                            page
                        )
                );


                pageCount +=
                    pages.length;


                emit(
                    "easyfiletools:merge-pdf-source-complete",
                    {
                        index,

                        percentage:
                            100
                    }
                );


                await control?.checkpoint?.();

                emit(
                    "easyfiletools:merge-pdf-progress",
                    {
                        percentage:
                            Math.round(
                                (
                                    (index + 1) /
                                    files.length
                                ) *
                                100
                            )
                    }
                );

            }


            await control?.checkpoint?.();

            const bytes =
                await output.save({
                    useObjectStreams:
                        true,

                    addDefaultPage:
                        false
                });


            const blob =
                new Blob(
                    [
                        bytes
                    ],
                    {
                        type:
                            "application/pdf"
                    }
                );


            const result = {

                blob,

                outputUrl:
                    URL.createObjectURL(
                        blob
                    ),

                outputName:
                    settings.filename,

                outputSize:
                    blob.size,

                pageCount

            };


            emit(
                "easyfiletools:merge-pdf-complete",
                {
                    result
                }
            );


            return result;

        }
        catch (error) {

            emit(
                "easyfiletools:merge-pdf-ended",
                {
                    error
                }
            );


            throw error;

        }

    }


    window.PdfMerger = {

        merge

    };

})();