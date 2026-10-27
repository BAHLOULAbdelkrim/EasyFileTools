/* Legacy initializer retained for any embedded upload widget.
 * It delegates validation and URL streaming to the V1 shared services.
 */
function initFileUpload(options) {
    const { zone, input, info, category = null, onFiles } = options;
    if (!zone || !input || typeof onFiles !== "function") return;
    const operation = options.operation || null;
    const profile = EasyFilePolicy.resolve({ category, operation });
    if (info) info.textContent = profile
        ? `Up to ${profile.maxFiles} files • ${profile.maxFileMB} MB/file • ${profile.maxTotalMB} MB total`
        : "Supported file types and limits depend on the operation.";
    input.accept = buildFileInputAccept(profile?.extensions || EasyFilePolicy.allExtensions());
    const countCurrent = () => Number(options.getCurrentCount?.() || 0);
    const bytesCurrent = () => (options.getCurrentFiles?.() || []).reduce((sum, item) => sum + (item?.file || item).size, 0);
    async function acceptFiles(files) {
        let count = countCurrent();
        let totalBytes = bytesCurrent();
        const valid = [];
        for (const file of files) {
            const result = EasyFilePolicy.validate(file, { category: category || getFileCategory(file.name), operation, count, totalBytes });
            if (!result.ok) { alert(`${file.name}: ${result.reason}`); continue; }
            valid.push(file);
            count++;
            totalBytes += file.size;
        }
        if (valid.length) await onFiles(valid);
    }
    input.addEventListener("change", async () => {
        try { await acceptFiles([...input.files]); }
        finally { input.value = ""; }
    });
    zone.addEventListener("dragover", event => event.preventDefault());
    zone.addEventListener("drop", async event => { event.preventDefault(); await acceptFiles([...event.dataTransfer.files]); });
    if (options.urlButton && options.urlModal && options.urlInput && options.urlAdd && options.urlCancel) {
        let controller = null;
        let busy = false;
        options.urlButton.addEventListener("click", () => options.urlModal.classList.remove("hidden"));
        options.urlCancel.addEventListener("click", () => {
            controller?.abort();
            if (!busy) options.urlModal.classList.add("hidden");
        });
        options.urlAdd.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            controller = new AbortController();
            options.urlAdd.disabled = true;
            try {
                const settings = EasyFilePolicy.resolve({ category, operation });
                if (!settings) throw new Error("Unsupported category.");
                const remaining = settings.maxTotalMB * EasyFilePolicy.MB - bytesCurrent();
                if (countCurrent() >= settings.maxFiles || remaining <= 0) throw new Error("Selection limit reached.");
                const file = await EasyFileUrlImport.download(options.urlInput.value.trim(), {
                    limitBytes: Math.min(settings.maxFileMB * EasyFilePolicy.MB, remaining), signal: controller.signal });
                await acceptFiles([file]);
                options.urlInput.value = "";
                options.urlModal.classList.add("hidden");
            } catch (error) { alert(error.message || "Unable to download this URL."); }
            finally { busy = false; options.urlAdd.disabled = false; controller = null; }
        });
    }
}
