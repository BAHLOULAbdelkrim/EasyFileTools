/* Browser-only optional dependencies. A single shared promise prevents duplicate requests. */
(() => {
  "use strict";
  const libs = {
    pdf: {
      url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
      test: () => !!window.pdfjsLib?.getDocument
    },
    zip: {
      url: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
      test: () => typeof window.JSZip === "function"
    }
  };
  const pending = new Map();
  function loadScript(name) {
    const config = libs[name];
    if (!config) return Promise.reject(new Error("Unknown optional library"));
    if (config.test()) {
      if (name === "pdf") window.pdfjsLib.GlobalWorkerOptions.workerSrc = config.worker;
      return Promise.resolve();
    }
    if (pending.has(name)) return pending.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = config.url;
      script.async = true;
      script.crossOrigin = "anonymous";
      let done = false;
      const finish = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); return; }
        if (!config.test()) { script.remove(); reject(new Error(`Unable to initialize ${name.toUpperCase()}.`)); return; }
        if (name === "pdf") window.pdfjsLib.GlobalWorkerOptions.workerSrc = config.worker;
        resolve();
      };
      const timer = setTimeout(() => finish(new Error(`Timed out while loading ${name.toUpperCase()}. Check your network connection.`)), 20000);
      script.onload = () => finish();
      script.onerror = () => finish(new Error(`Unable to load ${name.toUpperCase()}. Check network access or browser restrictions.`));
      (document.head || document.documentElement).appendChild(script);
    });
    pending.set(name, promise);
    promise.catch(() => { if (pending.get(name) === promise) pending.delete(name); });
    return promise;
  }
  window.EasyFileDependencies = Object.freeze({
    ensurePdfJs: () => loadScript("pdf"),
    ensureJsZip: () => loadScript("zip")
  });
})();
