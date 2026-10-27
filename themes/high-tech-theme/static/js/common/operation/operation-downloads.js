console.log(
    "[OPERATION DOWNLOADS] operation-downloads.js loaded"
);


/* =========================================
   OPERATION DOWNLOADS
========================================= */

(() => {

    let downloading =
        false;


    /*
     * Archives are produced in browser RAM. A ZIP may occupy several times
     * the size of its inputs while JSZip assembles it. Limit *output* bytes,
     * not just the original files selected by the user.
     */
    const ARCHIVE_MAX_ENTRIES = 250;
    const ARCHIVE_MB = 1024 * 1024;

    function getArchiveLimitBytes() {
        const deviceMemory = typeof navigator === "object"
            ? Number(navigator.deviceMemory)
            : NaN;
        if (!Number.isFinite(deviceMemory) || deviceMemory <= 0) {
            return 64 * ARCHIVE_MB;
        }
        if (deviceMemory <= 2) return 24 * ARCHIVE_MB;
        if (deviceMemory <= 4) return 48 * ARCHIVE_MB;
        return 128 * ARCHIVE_MB;
    }

    function assertArchiveBudget(bytes, maxBytes) {
        if (!Number.isFinite(bytes) || bytes < 0 || bytes > maxBytes) {
            throw new Error(`ARCHIVE_TOO_LARGE:${Math.round(getArchiveLimitBytes() / ARCHIVE_MB)}`);
        }
    }

    /* All archive entries are flat basenames: no absolute paths, ../ or
     * names that would be unsafe on Windows when an archive is extracted. */
    function makeSafeArchiveNames(outputs) {
        const encoder = new TextEncoder();
        const used = new Set();
        const trimToBytes = (value, max) => {
            let result = "";
            for (const char of value) {
                if (encoder.encode(result + char).length > max) break;
                result += char;
            }
            return result;
        };
        return outputs.map((output, index) => {
            const leaf = String(output.name || `output-file-${index + 1}`)
                .split(/[\\/]/).pop()
                .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
                .replace(/[. ]+$/g, "").trim();
            const original = leaf && leaf !== "." && leaf !== ".."
                ? leaf : `output-file-${index + 1}`;
            const dot = original.lastIndexOf(".");
            const extension = dot > 0 ? original.slice(dot) : "";
            const stem = dot > 0 ? original.slice(0, dot) : original;
            let counter = 1;
            let name;
            do {
                const suffix = counter === 1 ? "" : ` (${counter})`;
                const ext = trimToBytes(extension, 24);
                name = trimToBytes(stem, Math.max(1, 96 - encoder.encode(ext + suffix).length))
                    + suffix + ext;
                counter++;
            } while (used.has(name.toLowerCase()));
            used.add(name.toLowerCase());
            return { ...output, name };
        });
    }

    function validateArchiveOutputs(outputs, maxBytes) {
        if (!outputs.length) throw new Error("NO_OUTPUTS");
        if (outputs.length > ARCHIVE_MAX_ENTRIES) {
            throw new Error(`ARCHIVE_TOO_MANY_FILES:${ARCHIVE_MAX_ENTRIES}`);
        }
        let knownSize = 0;
        for (const output of outputs) {
            if (!output.blob) continue; // URLs are checked while streaming.
            const size = Number(output.blob.size);
            assertArchiveBudget(size, maxBytes - knownSize);
            knownSize += size;
        }
    }


    /* =========================================
       OUTPUT NORMALIZATION
    ========================================= */


    function normalizeOutput(
        output,
        index
    ) {

        if (!output) {
            return null;
        }


        /*
        * A BATCH result may be returned either:
        *
        * 1. directly:
        *    { outputBlob, outputUrl, ... }
        *
        * 2. inside the generic batch container:
        *    { result: { outputBlob, outputUrl, ... } }
        *
        * Normalize both forms here so every
        * download function receives the same shape.
        */

        const source =
            output.result ||
            output;


        return {

            blob:
                source.outputBlob ||
                source.blob ||
                null,

            url:
                source.outputUrl ||
                source.url ||
                null,

            name:
                source.outputName ||
                source.name ||
                `output-file-${index + 1}`

        };
    }    


    function normalizeOutputs(
        outputs = []
    ) {

        return outputs
            .map(
                normalizeOutput
            )
            .filter(
                output =>
                    output &&
                    (
                        output.blob ||
                        output.url
                    )
            );
    }


    /* =========================================
       GET BLOB
    ========================================= */

    async function getOutputBlob(output, remainingBytes = Infinity) {
        if (output.blob) {
            assertArchiveBudget(Number(output.blob.size), remainingBytes);
            return output.blob;
        }

        if (!output.url) {
            throw new Error(`Missing output data: ${output.name}`);
        }

        const response = await fetch(output.url);
        if (!response.ok) {
            throw new Error(`Unable to load output: ${output.name}`);
        }

        const declaredSize = Number(response.headers?.get("content-length"));
        if (declaredSize > 0) assertArchiveBudget(declaredSize, remainingBytes);

        // response.blob() without a size check can allocate unbounded RAM.
        // All browsers supported for archive downloads expose a ReadableStream.
        if (!response.body?.getReader) {
            throw new Error("ARCHIVE_STREAM_UNAVAILABLE");
        }
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                received += value.byteLength;
                if (received > remainingBytes) {
                    await reader.cancel().catch(() => {});
                    assertArchiveBudget(received, remainingBytes);
                }
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }
        return new Blob(chunks, {
            type: response.headers?.get("content-type") || "application/octet-stream"
        });
    }


    /* =========================================
       ZIP
    ========================================= */

    async function createZip(
        outputs,
        onProgress = null,
        maxBytes = getArchiveLimitBytes()
    ) {

        await window.EasyFileDependencies.ensureJsZip();


        const zip =
            new JSZip();

        let totalBytes = 0;

        for (
            let index = 0;
            index < outputs.length;
            index++
        ) {

            const output =
                outputs[index];


            const blob =
                await getOutputBlob(
                    output,
                    maxBytes - totalBytes
                );

            totalBytes += blob.size;

            zip.file(
                output.name,
                blob
            );
        }


        return await zip.generateAsync(
            {
                type:
                    "blob"
            },
            metadata => {

                if (onProgress) {

                    onProgress(
                        metadata.percent
                    );
                }
            }
        );
    }


    /* =========================================
       TAR HELPERS
    ========================================= */

    function writeTarString(
        buffer,
        offset,
        length,
        value
    ) {

        const encoder =
            new TextEncoder();


        const bytes =
            encoder.encode(
                String(value)
            );


        buffer.set(
            bytes.slice(
                0,
                Math.min(
                    bytes.length,
                    length
                )
            ),
            offset
        );
    }


    function writeTarOctal(
        buffer,
        offset,
        length,
        value
    ) {

        const octal =
            Math.floor(
                value
            )
                .toString(8)
                .padStart(
                    length - 1,
                    "0"
                );


        writeTarString(
            buffer,
            offset,
            length,
            `${octal}\0`
        );
    }


    function createTarHeader(
        fileName,
        fileSize
    ) {

        const header =
            new Uint8Array(
                512
            );


        writeTarString(
            header,
            0,
            100,
            fileName
        );


        writeTarString(
            header,
            100,
            8,
            "0000644\0"
        );


        writeTarString(
            header,
            108,
            8,
            "0000000\0"
        );


        writeTarString(
            header,
            116,
            8,
            "0000000\0"
        );


        writeTarOctal(
            header,
            124,
            12,
            fileSize
        );


        writeTarOctal(
            header,
            136,
            12,
            Math.floor(
                Date.now() /
                1000
            )
        );


        for (
            let index = 148;
            index < 156;
            index++
        ) {

            header[index] =
                32;
        }


        writeTarString(
            header,
            156,
            1,
            "0"
        );


        writeTarString(
            header,
            257,
            6,
            "ustar"
        );


        writeTarString(
            header,
            263,
            2,
            "00"
        );


        let checksum =
            0;


        for (
            const byte of header
        ) {

            checksum +=
                byte;
        }


        const checksumString =
            checksum
                .toString(8)
                .padStart(
                    6,
                    "0"
                );


        writeTarString(
            header,
            148,
            8,
            `${checksumString}\0 `
        );


        return header;
    }


    /* =========================================
       TAR
    ========================================= */

    async function createTar(
        outputs,
        onProgress = null,
        maxBytes = getArchiveLimitBytes()
    ) {

        const parts =
            [];
        let totalBytes = 0;

        for (
            let index = 0;
            index < outputs.length;
            index++
        ) {

            const output =
                outputs[index];


            const blob =
                await getOutputBlob(
                    output,
                    maxBytes - totalBytes
                );

            totalBytes += blob.size;
            // Blob composition avoids a second full in-memory arrayBuffer copy.
            parts.push(createTarHeader(output.name, blob.size));
            parts.push(blob);

            const padding =
                (512 - (blob.size % 512)) % 512;


            if (padding > 0) {

                parts.push(
                    new Uint8Array(
                        padding
                    )
                );
            }


            if (onProgress) {

                onProgress(
                    (
                        (index + 1) /
                        outputs.length
                    ) *
                    100
                );
            }
        }


        parts.push(
            new Uint8Array(
                1024
            )
        );


        return new Blob(
            parts,
            {
                type:
                    "application/x-tar"
            }
        );
    }


    /* =========================================
       GZIP
    ========================================= */

    async function gzipBlob(
        blob
    ) {

        if (
            typeof CompressionStream ===
            "undefined"
        ) {

            throw new Error(
                "COMPRESSION_STREAM_UNAVAILABLE"
            );
        }


        const stream =
            blob
                .stream()
                .pipeThrough(
                    new CompressionStream(
                        "gzip"
                    )
                );


        return await new Response(
            stream
        ).blob();
    }


    /* =========================================
       CREATE ARCHIVE
    ========================================= */

    async function createArchive(
        rawOutputs,
        format,
        onProgress = null
    ) {

        const outputs = makeSafeArchiveNames(normalizeOutputs(rawOutputs));
        const maxBytes = getArchiveLimitBytes();
        validateArchiveOutputs(outputs, maxBytes);


        if (
            format ===
            "zip"
        ) {

            return await createZip(
                outputs,
                onProgress,
                maxBytes
            );
        }


        if (
            format ===
            "tar"
        ) {

            return await createTar(
                outputs,
                onProgress,
                maxBytes
            );
        }


        if (
            format ===
            "tar.gz"
        ) {

            const tar =
                await createTar(
                    outputs,
                    percentage => {

                        if (onProgress) {

                            onProgress(
                                percentage *
                                0.75
                            );
                        }
                    },
                    maxBytes
                );


            if (onProgress) {

                onProgress(
                    80
                );
            }


            const compressed =
                await gzipBlob(
                    tar
                );


            if (onProgress) {

                onProgress(
                    100
                );
            }


            return compressed;
        }


        throw new Error(
            `UNSUPPORTED_ARCHIVE_FORMAT:${format}`
        );
    }


    /* =========================================
       DOWNLOAD BLOB
    ========================================= */

    function downloadBlob(
        blob,
        fileName
    ) {

        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;

        link.download =
            fileName;


        document.body.appendChild(
            link
        );


        link.click();

        link.remove();


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    url
                );

            },
            1000
        );
    }


    /* =========================================
    DOWNLOAD SINGLE OUTPUT
    BATCH MODEL
    ========================================= */

    async function downloadOutput(
        rawOutput,
        tracking = {}
    ) {

        if (downloading) {

            return false;

        }


        const output =
            normalizeOutput(
                rawOutput,
                0
            );


        if (
            !output ||
            (
                !output.blob &&
                !output.url
            )
        ) {

            throw new Error(
                "NO_OUTPUT"
            );

        }


        const sourceIndex =
            Number.isInteger(
                tracking.sourceIndex
            )
                ? tracking.sourceIndex
                : null;


        const outputIndex =
            Number.isInteger(
                tracking.outputIndex
            )
                ? tracking.outputIndex
                : null;


        downloading =
            true;


        try {

            /*
            * Existing Object URL:
            * use it directly.
            */

            if (
                output.url
            ) {

                const link =
                    document.createElement(
                        "a"
                    );


                link.href =
                    output.url;


                link.download =
                    output.name;


                document.body.appendChild(
                    link
                );


                link.click();

                link.remove();

            }


            /*
            * Blob only:
            * create a temporary Object URL.
            */

            else {

                downloadBlob(
                    output.blob,
                    output.name
                );

            }


            const results =
                window
                    .EasyFileOperationResults;


            /*
            * MULTI_OUTPUT:
            * one precise generated output.
            */

            if (
                sourceIndex !== null &&
                outputIndex !== null
            ) {

                results
                    ?.markOutputDownloaded?.(
                        sourceIndex,
                        outputIndex
                    );

            }


            /*
            * One source result.
            *
            * PER_FILE:
            * marks this file result.
            *
            * MULTI_OUTPUT:
            * marks every output belonging
            * to this source file.
            */

            else if (
                sourceIndex !== null
            ) {

                results
                    ?.markDownloaded?.(
                        sourceIndex
                    );

            }


            /*
            * No tracking information.
            *
            * Keeps the existing behavior
            * used by BATCH and Download All.
            */

            else {

                results
                    ?.markDownloaded?.();

            }


            return true;

        }
        finally {

            downloading =
                false;

        }

    }

    /* =========================================
    DOWNLOAD MULTI OUTPUT
    ========================================= */

    async function downloadMultiOutput(
        sourceIndex,
        outputIndex
    ) {

        if (
            !Number.isInteger(
                sourceIndex
            ) ||
            sourceIndex < 0 ||
            !Number.isInteger(
                outputIndex
            ) ||
            outputIndex < 0
        ) {

            throw new Error(
                "INVALID_MULTI_OUTPUT_INDEX"
            );

        }


        const results =
            window
                .EasyFileOperationResults;


        if (!results) {

            throw new Error(
                "RESULTS_MANAGER_UNAVAILABLE"
            );

        }


        const item =
            results.getItem?.(
                sourceIndex
            );


        if (
            !item ||
            !Array.isArray(
                item.outputs
            ) ||
            outputIndex >=
                item.outputs.length
        ) {

            throw new Error(
                "NO_MULTI_OUTPUT"
            );

        }


        const output =
            item.outputs[
                outputIndex
            ];


        return await downloadOutput(
            output,
            {
                sourceIndex,
                outputIndex
            }
        );

    }

    /* =========================================
    DOWNLOAD CURRENT BATCH RESULT
    ========================================= */

    async function downloadBatchResult() {

        const lifecycle =
            window
                .EasyFileOperationLifecycle;


        let result =
            lifecycle
                ?.getBatchResult?.() ||
            null;


        /*
        * Direct fallback to Results.
        */

        if (
            !result
        ) {

            const batch =
                window
                    .EasyFileOperationResults
                    ?.getBatch?.();


            result =
                batch?.result ||
                null;
        }

        if (
            !result
        ) {

            throw new Error(
                "NO_BATCH_RESULT"
            );
        }


        return await downloadOutput(
            result
        );
    }    


    /* =========================================
       DOWNLOAD ARCHIVE
    ========================================= */

    async function downloadArchive(
        outputs,
        format,
        baseName =
            "EasyFileTools",
        markAllDownloaded =
            true
    ) {

        if (downloading) {

            return false;
        }


        downloading =
            true;


        try {

            const progress =
                window
                    .EasyFileOperationProgress;


            const archive =
                await createArchive(
                    outputs,
                    format,
                    percentage => {

                        progress?.setProgress?.(
                            percentage,
                            `Preparing ${format.toUpperCase()}...`
                        );
                    }
                );


            downloadBlob(
                archive,
                `${baseName}.${format}`
            );


            if (
                markAllDownloaded
            ) {

                window
                    .EasyFileOperationResults
                    ?.markDownloaded?.();

            }


            return true;

        }
        finally {

            downloading =
                false;
        }
    }

    /* =========================================
    DOWNLOAD MULTI OUTPUT GROUP
    ========================================= */

    async function downloadMultiOutputGroup(
        sourceIndex,
        format = "zip"
    ) {

        const results =
            window
                .EasyFileOperationResults;


        const item =
            results
                ?.getItem?.(
                    sourceIndex
                );


        if (
            !item ||
            item.stale === true ||
            !Array.isArray(
                item.outputs
            ) ||
            item.outputs.length === 0
        ) {

            console.warn(
                "[OPERATION DOWNLOADS] No current multi-output group available:",
                sourceIndex
            );

            return false;

        }


        const sourceFile =
            item.input?.file ||
            item.input ||
            null;


        const sourceName =
            sourceFile?.name ||
            `source-${sourceIndex + 1}`;


        const baseName =
            sourceName.replace(
                /\.[^.]+$/,
                ""
            );


        const success =
            await downloadArchive(
                item.outputs,
                format,
                `${baseName}-outputs`,
                false
            );


        if (!success) {
            return false;
        }


        results
            ?.markFileOutputsDownloaded?.(
                sourceIndex
            );


        console.log(
            "[OPERATION DOWNLOADS] Multi-output group downloaded:",
            {
                sourceIndex,
                outputs:
                    item.outputs.length,
                format
            }
        );


        return true;
    }    

    /* =========================================
       HUMAN-READABLE ARCHIVE ERRORS
    ========================================= */

    function archiveErrorMessage(error) {
        const code = String(error?.message || "");
        if (code.startsWith("ARCHIVE_TOO_LARGE:")) {
            const limit = code.split(":")[1];
            return `The files are too large to package safely on this device (combined output limit: ${limit} MB). Please download them individually or select fewer files.`;
        }
        if (code.startsWith("ARCHIVE_TOO_MANY_FILES:")) {
            return `Too many output files for one archive (maximum ${ARCHIVE_MAX_ENTRIES}). Please download fewer files at a time.`;
        }
        if (code === "ARCHIVE_STREAM_UNAVAILABLE") {
            return "This browser cannot safely read the archive inputs. Please download files individually.";
        }
        if (code === "COMPRESSION_STREAM_UNAVAILABLE") {
            return "TAR.GZ is not supported in this browser. Please choose ZIP or TAR instead.";
        }
        return "The archive could not be prepared. Please retry with fewer files or download the results individually.";
    }

    /* =========================================
       STATE
    ========================================= */

    function isDownloading() {

        return downloading;
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.EasyFileOperationDownloads =
        Object.freeze({

            createArchive,

            archiveErrorMessage,

            downloadArchive,

            downloadBlob,

            downloadOutput,

            downloadMultiOutput,

            downloadMultiOutputGroup,

            downloadBatchResult,

            isDownloading

        });
        
})();