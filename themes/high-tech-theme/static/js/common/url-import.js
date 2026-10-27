/* Download a single CORS-permitted HTTPS file with byte-based limits.
 * No proxy, cookies, hidden cross-origin bypass, or unbounded response.blob().
 */
(() => {
    "use strict";
    const timeoutMs = 45000;
    function fileNameFromUrl(url) {
        let name;
        try { name = decodeURIComponent(url.pathname.split("/").pop() || ""); }
        catch { name = url.pathname.split("/").pop() || ""; }
        name = name.replace(/[\\/\x00-\x1f\x7f]/g, "_").trim().slice(0, 180);
        return name && name !== "." && name !== ".." ? name : "download";
    }
    async function download(raw, { limitBytes, signal, onProgress } = {}) {
        let url;
        try { url = new URL(raw); }
        catch { throw new Error("Enter a valid HTTPS file URL."); }
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password)
            throw new Error("Only HTTPS URLs without embedded credentials are allowed.");
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        const octets = ipv4?.slice(1).map(Number);
        const privateIPv4 = octets && octets.every(n => n >= 0 && n <= 255) && (
            octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
            octets[0] === 192 && octets[1] === 168 ||
            octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 ||
            octets[0] === 169 && octets[1] === 254);
        if (privateIPv4 || host === "localhost" || host.endsWith(".localhost") ||
            host.endsWith(".local") || host === "::1" || host.startsWith("fe80:"))
            throw new Error("Local and private-network file URLs are not allowed.");
        if (!Number.isFinite(limitBytes) || limitBytes <= 0)
            throw new Error("Invalid download size limit.");
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) abort();
        signal?.addEventListener("abort", abort, { once: true });
        const timeout = setTimeout(abort, timeoutMs);
        let reader;
        try {
            const response = await fetch(url.href, { mode: "cors", credentials: "omit", redirect: "follow", signal: controller.signal, cache: "no-store" });
            if (!response.ok || response.type === "opaque") throw new Error(`Remote server returned HTTP ${response.status}.`);
            if (new URL(response.url).protocol !== "https:") throw new Error("Redirect to a non-HTTPS address refused.");
            const declared = Number(response.headers.get("content-length"));
            if (Number.isFinite(declared) && declared > limitBytes) throw new Error("This file exceeds the permitted download size.");
            if (!response.body?.getReader) throw new Error("Streaming download unavailable in this browser.");
            reader = response.body.getReader();
            let received = 0;
            const chunks = [];
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                received += value.byteLength;
                if (received > limitBytes) throw new Error("This file exceeds the permitted download size.");
                chunks.push(value);
                onProgress?.(received, Number.isFinite(declared) && declared > 0 ? declared : null);
            }
            if (received === 0) throw new Error("The URL returned an empty file.");
            const encoding = response.headers.get("content-encoding");
            // Browser Fetch may decompress encoded bodies: Content-Length then describes compressed bytes.
            if (!encoding && Number.isFinite(declared) && declared > 0 && received !== declared)
                throw new Error("Incomplete remote download.");
            const type = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
            return new File(chunks, fileNameFromUrl(new URL(response.url)), { type });
        } catch (error) {
            if (controller.signal.aborted) throw new Error(signal?.aborted ? "Download cancelled." : "Download timed out or was interrupted.");
            if (error instanceof TypeError) throw new Error("The remote website may block browser downloads (CORS), or the network is unavailable. Download the file manually and use Browse.");
            throw error;
        } finally {
            try { await reader?.cancel(); } catch {}
            clearTimeout(timeout);
            signal?.removeEventListener("abort", abort);
        }
    }
    window.EasyFileUrlImport = Object.freeze({ download, fileNameFromUrl });
})();
