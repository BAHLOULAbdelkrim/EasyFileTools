import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
function listMd(dir, result = []) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, d.name);
        if (d.isDirectory()) listMd(f, result);
        else if (f.endsWith('.md')) result.push(f);
    }
    return result;
}
const pages = listMd(path.join(root, 'content'));

test('Coming soon content no longer displays placeholder metadata or French question/exclamation spacing', () => {
    let found = 0;
    for (const file of pages) {
        const t = fs.readFileSync(file,'utf8');
        assert.doesNotMatch(t, /Coming soon !|description:\s*["']\.{3,}|-\s+blabla/i, file);
        if (t.includes('🚧 Coming soon.')) {
            found++;
            assert.match(t, /not available yet/);
        }
    }
    assert.equal(found, 75);
});

test('FAQ questions use English punctuation and JSON is valid', () => {
    const t = read('data/seo/tools.json');
    const data = JSON.parse(t);
    const questions = Object.values(data).flatMap(tool => tool.faq || []);
    assert.ok(questions.length > 20);
    for (const item of questions) {
        assert.doesNotMatch(item.question, /\s+[?!]$/);
        assert.match(item.question, /\?$/);
    }
});

test('Internal links in available content and format guides resolve to real non-draft routes', () => {
    const result = execFileSync(process.execPath,['scripts/audit-v1-links.mjs'],{ cwd:root,encoding:'utf8' });
    assert.match(result,/0 broken\/unpublished targets/);
});

test('The previously inert drag-and-drop button opens the file picker on click', () => {
    const html = read('themes/high-tech-theme/layouts/partials/common/zone-chargement.html');
    const js = read('themes/high-tech-theme/static/js/common/zone-chargement.js');
    assert.match(html,/id="dragBtn"/);
    assert.match(js,/dragBtn\.addEventListener\("click",/);
    assert.match(js,/fileInput\.click\(\)/);
    assert.match(js,/dropZone\.addEventListener\(\s*"drop"/);
});

test('URL import dialog has real HTML label, accessible dialog and warning', () => {
    const html = read('themes/high-tech-theme/layouts/partials/common/zone-chargement.html');
    assert.match(html,/role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="urlModalTitle"/);
    assert.match(html,/<label for="urlInput"/);
    assert.match(html,/aria-describedby="urlImportWarning"/);
    assert.match(html,/cross-origin downloads \(CORS\)/);
    assert.match(html,/id="urlModal"[\s\S]*class="url-modal hidden"/);
});

test('Unused hidden image preview placeholder is no longer emitted on every page', () => {
    const html = read('layouts/_default/baseof.html');
    assert.doesNotMatch(html,/id="imageModal"|id="closeModal"|id="modalImage"/);
    assert.match(html, /<main class="site-main" id="main-content"/);
    assert.match(html,/partial "common\/confirmation-modal.html"/);
});

test('Privacy, legal and contact drafts are not falsely presented as public links', () => {
    for (const name of ['privacy','legal','contact']) {
        assert.match(read(`content/${name}/_index.md`), /^draft: true$/m);
    }
    assert.match(read('layouts/partials/footer.html'),/Site\.GetPage "\/privacy\/"/);
    assert.match(read('layouts/partials/footer.html'),/Site\.GetPage "\/legal\/"/);
    assert.match(read('layouts/partials/footer.html'),/Site\.GetPage "\/contact\/"/);
});

test('V4.2 critical stylesheet stays a blocking single bundle in production', () => {
    const head = read('layouts/partials/head.html');
    assert.match(head, /href="{{ partial "seo\/common-css-v4.html" \./);
    assert.doesNotMatch(head, /seo\/common-css-v43/);
});
