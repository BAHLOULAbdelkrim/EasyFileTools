import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root,relative),'utf8');

test('file list does not emit img with an empty preview URL; alt is escaped', () => {
    const js = read('themes/high-tech-theme/static/js/common/file-list.js');
    assert.match(js, /typeof fileData\.previewUrl === "string"/);
    assert.match(js, /fileData\.previewUrl\.trim\(\) !== ""/);
    assert.match(js, /alt="Preview of \${easyFileEscapeHtml\(file\.name\)}"/);
    assert.doesNotMatch(js, /src="\${easyFileEscapeHtml\(fileData\.previewUrl \|\| ""\)}"/);
    assert.match(js, /<div class="file-placeholder \${category}">/);
});

test('warnings are scoped to operations and describe actual loss risks', () => {
    const html = read('themes/high-tech-theme/layouts/partials/common/operation-zone.html');
    const css = read('themes/high-tech-theme/static/css/common/operation-ui-components.css');
    assert.match(html, /index \$eftConversionNotes \(\.operation \| default ""\)/);
    assert.match(html, /role="note"/);
    for (const op of ['convert-image','convert-audio','convert-video','compress-image','compress-video','compress-pdf','pdf-to-image','image-to-pdf']) {
        assert.ok(html.includes(`"${op}"`), op);
    }
    for (const text of ['EXIF','transparency','animated','metadata','selectable text','quality']) {
        assert.ok(html.includes(text), text);
    }
    assert.match(css,/\.eft-conversion-loss-note/);
    assert.doesNotMatch(read('layouts/partials/head.html'), /common-css-v43/);
});

test('Documents menu explicitly distinguishes PDF from editable documents', () => {
    const list = read('layouts/_default/list.html');
    assert.match(list,/if eq \.Section "documents"/);
    assert.match(list,/PDF tools available now/);
    assert.match(list,/DOC, DOCX, ODT/);
    const content = read('content/documents/_index.md');
    assert.match(content,/PDF tools available now/);
    assert.doesNotMatch(content,/All the essential tools for your documents/);
});
