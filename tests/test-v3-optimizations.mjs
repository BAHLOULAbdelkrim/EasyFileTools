import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const head = read("layouts/partials/head.html");
const assetHelper = read("layouts/partials/seo/asset-url.html");
const css = read("themes/high-tech-theme/static/css/main.css");

test("font stylesheet is not render-blocking and noscript fallback exists", () => {
  assert.match(head, /fonts\.googleapis\.com[^\n]*media="print" onload=/);
  assert.match(head, /<noscript><link[^\n]*fonts\.googleapis/);
});
test("homepage introduction no longer has fourfold line height", () => {
  const active = css.slice(css.lastIndexOf(".category-intro {"), css.indexOf("/* =========================================", css.lastIndexOf(".category-intro {")));
  assert.match(active, /line-height:\s*1\.5/);
  assert.doesNotMatch(active, /line-height:\s*4\.0/);
});
test("Hugo native minification is production only and cache-busted", () => {
  assert.match(assetHelper, /hugo\.IsProduction/);
  assert.match(assetHelper, /resources\.FromString/);
  assert.match(assetHelper, /resources\.Minify\s+\$asset/);
  assert.match(assetHelper, /resources\.Fingerprint\s+"sha256"\s+\$asset/);
  assert.match(assetHelper, /\$result\s*=\s*\$asset\.RelPermalink/);
  assert.match(assetHelper, /return\s+\$result/);
});
test("Hugo 0.158 partial uses one unconditional return after processing", () => {
  const returns = [...assetHelper.matchAll(/\{\{-?\s*return\s+[^}]+\}\}/g)];
  assert.equal(returns.length, 1, "Exactly one return statement is permitted");
  assert.match(assetHelper.trimEnd(), /\{\{-?\s*return\s+\$result\s*-?\}\}$/, "The return must be outside the conditional and at the end");
  assert.match(assetHelper, /\$result\s*:=/);
});

test("CSS @import and third-party JS are not minified", () => {
  assert.doesNotMatch(assetHelper, /^\s*"css\/homepage\/main\.css"/m);
  assert.doesNotMatch(assetHelper, /^\s*"js\/vendor\//m);
});
test("optimized CSS and JS files are present", () => {
  const re = /^\s*"((?:css|js)\/[^"]+\.(?:css|js))"\s*$/gm;
  for (const m of assetHelper.matchAll(re)) {
    const rel = m[1];
    assert.ok(existsSync(join(root, "static", rel)) || existsSync(join(root, "themes/high-tech-theme/static", rel)), rel);
  }
});
test("preserves homepage and operation scripts in head", () => {
  for (const filename of ["js/homepage/main.js", "js/common/file-list.js", "js/common/confirmation-modal.js", "js/audio/cut-audio/audio-cut-ui.js"]) {
    assert.ok(head.includes(filename), filename);
  }
});
