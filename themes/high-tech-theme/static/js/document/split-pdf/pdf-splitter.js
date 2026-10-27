console.log(
    "[PDF SPLITTER] pdf-splitter.js loaded"
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


    async function createPdf(
        source,
        indexes,
        name
    ) {

        const output =
            await PDFLib
                .PDFDocument
                .create();


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


        const bytes =
            await output.save({
                useObjectStreams:
                    true,

                addDefaultPage:
                    false
            });


        const blob =
            new Blob(
                [bytes],
                {
                    type:
                        "application/pdf"
                }
            );


        return {

            blob,

            outputUrl:
                URL.createObjectURL(
                    blob
                ),

            outputName:
                name,

            outputSize:
                blob.size,

            pageCount:
                indexes.length

        };

    }


    async function split(
        file,
        settings,
        progressCallback,
        control = null
    ) {

        const source =
            await PDFLib
                .PDFDocument
                .load(
                    await file.arrayBuffer(),
                    {
                        updateMetadata:
                            false
                    }
                );


        const count =
            source.getPageCount();


        const base =
            baseName(
                file.name
            );


        const results =
            [];


        if (
            settings.mode ===
            "extract"
        ) {

            await control?.checkpoint?.();

            results.push(
                await createPdf(
                    source,
                    settings.indexes,
                    `${base}-extracted.pdf`
                )
            );


            progressCallback?.(
                100
            );


            return results;

        }


        if (
            settings.mode ===
            "pages"
        ) {

            for (
                let i = 0;
                i < count;
                i++
            ) {

                await control?.checkpoint?.();

                results.push(
                    await createPdf(
                        source,
                        [i],
                        `${base}-page-${String(
                            i + 1
                        ).padStart(
                            3,
                            "0"
                        )}.pdf`
                    )
                );


                progressCallback?.(
                    Math.round(
                        (
                            (i + 1) /
                            count
                        ) *
                        100
                    )
                );

            }


            return results;

        }


        const chunk =
            settings.chunkSize;


        for (
            let start = 0;
            start < count;
            start += chunk
        ) {

            await control?.checkpoint?.();

            const end =
                Math.min(
                    start +
                    chunk,
                    count
                );


            const indexes = [];


            for (
                let page =
                    start;
                page < end;
                page++
            ) {

                indexes.push(
                    page
                );

            }


            results.push(
                await createPdf(
                    source,
                    indexes,
                    `${base}-pages-${
                        String(
                            start + 1
                        ).padStart(3, "0")
                    }-${
                        String(
                            end
                        ).padStart(3, "0")
                    }.pdf`
                )
            );


            progressCallback?.(
                Math.round(
                    (
                        end /
                        count
                    ) *
                    100
                )
            );

        }


        return results;

    }


    window.PdfSplitter = {

        split

    };

})();