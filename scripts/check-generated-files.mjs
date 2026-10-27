#!/usr/bin/env node
/**
 * EasyFile Tools V1: independent QA of outputs saved from the browser.
 * Usage: node scripts/check-generated-files.mjs <directory>
 * Byte signatures do not prove that codecs decode, PDFs open, or output quality.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const utf8 = bytes => Buffer.from(bytes).toString('latin1');
const bytesEqual = (buf, prefix, offset = 0) =>
    buf.length >= offset + prefix.length && prefix.every((byte, i) => buf[offset + i] === byte);
const strAt = (buf, text, offset = 0) =>
    buf.length >= offset + text.length && utf8(buf.subarray(offset, offset + text.length)) === text;
const hasPdfHeader = buf => utf8(buf.subarray(0, 1024)).includes('%PDF-');
const hasJpeg = buf => bytesEqual(buf, [0xff, 0xd8, 0xff]);
const isIsoFtyp = buf => strAt(buf, 'ftyp', 4);
const isAvif = buf => isIsoFtyp(buf) && /(?:avif|avis)/.test(utf8(buf.subarray(8, 40)));
const ebml = buf => bytesEqual(buf, [0x1a, 0x45, 0xdf, 0xa3]);
const riffType = (buf, type) => strAt(buf, 'RIFF', 0) && strAt(buf, type, 8);
const isMp3 = buf => strAt(buf, 'ID3') ||
    (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
const signatures = {
    pdf: ['PDF', hasPdfHeader],
    png: ['PNG', b => bytesEqual(b, [0x89,80,78,71,13,10,26,10])],
    jpg: ['JPEG', hasJpeg], jpeg: ['JPEG', hasJpeg],
    webp: ['WebP', b => riffType(b, 'WEBP')],
    bmp: ['BMP', b => strAt(b, 'BM')],
    gif: ['GIF', b => strAt(b, 'GIF87a') || strAt(b, 'GIF89a')],
    avif: ['AVIF', isAvif],
    wav: ['WAV', b => (strAt(b, 'RIFF') || strAt(b, 'RF64')) && strAt(b, 'WAVE', 8)],
    wave: ['WAV', b => (strAt(b, 'RIFF') || strAt(b, 'RF64')) && strAt(b, 'WAVE', 8)],
    flac: ['FLAC', b => strAt(b, 'fLaC')],
    ogg: ['Ogg', b => strAt(b, 'OggS')], oga: ['Ogg', b => strAt(b, 'OggS')],
    opus: ['Ogg/Opus', b => strAt(b, 'OggS')],
    mp3: ['MP3', isMp3],
    mp4: ['MP4/ISO BMFF', isIsoFtyp], m4v: ['MP4/ISO BMFF', isIsoFtyp],
    m4a: ['MP4 audio', isIsoFtyp], m4b: ['MP4 audio', isIsoFtyp],
    mov: ['MOV/QuickTime', b => isIsoFtyp(b) || strAt(b, 'moov', 4) || strAt(b, 'wide', 4)],
    webm: ['EBML WebM', b => ebml(b) && utf8(b).includes('webm')],
    mkv: ['EBML Matroska', b => ebml(b) && utf8(b).includes('matroska')],
    avi: ['AVI', b => riffType(b, 'AVI ')],
    aiff: ['AIFF', b => strAt(b, 'FORM') && (strAt(b, 'AIFF', 8) || strAt(b, 'AIFC', 8))],
    aif: ['AIFF', b => strAt(b, 'FORM') && (strAt(b, 'AIFF', 8) || strAt(b, 'AIFC', 8))],
    aifc: ['AIFF', b => strAt(b, 'FORM') && (strAt(b, 'AIFF', 8) || strAt(b, 'AIFC', 8))],
    au: ['AU', b => strAt(b, '.snd')], snd: ['AU', b => strAt(b, '.snd')],
    ac3: ['AC-3', b => bytesEqual(b, [0x0b, 0x77])],
    zip: ['ZIP', b => strAt(b, 'PK\x03\x04') || strAt(b, 'PK\x05\x06') || strAt(b, 'PK\x07\x08')],
    gz: ['gzip', b => bytesEqual(b, [0x1f, 0x8b])], tgz: ['gzip', b => bytesEqual(b, [0x1f, 0x8b])]
};
export function inspectGeneratedFile(name, bytes, size = bytes.length) {
    const extension = String(name).toLowerCase().split('.').pop();
    const type = name.toLowerCase().endsWith('.tar.gz') ? 'gz' : extension;
    if (!Number.isFinite(size) || size === 0) return {status:'FAIL', detail:'Empty output file'};
    if (type === 'tar') {
        return {status:'CHECK', detail:'TAR has no reliable universal magic header; extract and inspect its entries'};
    }
    if (['aac', 'wma', 'wmv', 'mpeg', 'mpg', 'ts', 'mts', 'm2ts', '3gp', '3g2', 'ogv', 'flv'].includes(type)) {
        return {status:'CHECK', detail:`.${type}: codec/container validation requires an actual media decoder`};
    }
    if (!signatures[type]) return {status:'SKIP', detail:`No conservative signature rule for .${type}`};
    const [description, predicate] = signatures[type];
    return predicate(bytes) ? {status:'PASS', detail:`${description} signature matches .${type}`}
        : {status:'FAIL', detail:`Content does not have the expected ${description} signature for .${type}`};
}

async function collect(directory) {
    const all = [];
    for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) all.push(...await collect(full));
        else if (entry.isFile()) all.push(full);
    }
    return all;
}
async function main(directory) {
    if (!directory) {
        console.error('Usage: node scripts/check-generated-files.mjs <directory-with-downloaded-results>');
        process.exitCode = 2;
        return;
    }
    const root = path.resolve(directory);
    const files = await collect(root);
    let failed = 0, passed = 0, checked = 0, skipped = 0;
    for (const file of files) {
        const handle = await fs.open(file, 'r');
        let size, bytes;
        try {
            size = (await handle.stat()).size;
            const buffer = Buffer.alloc(Math.min(4096, size));
            const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
            bytes = buffer.subarray(0, bytesRead);
        } finally { await handle.close(); }
        const result = inspectGeneratedFile(file, bytes, size);
        if (result.status === 'FAIL') failed++;
        else if (result.status === 'PASS') passed++;
        else if (result.status === 'CHECK') checked++;
        else skipped++;
        console.log(`${result.status.padEnd(5)} ${path.relative(root, file)} — ${result.detail}`);
    }
    console.log(`Generated-file QA: ${files.length} files; ${passed} signatures OK; ${failed} mismatches; ${checked} require playback/opening; ${skipped} not covered.`);
    if (failed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main(process.argv[2]).catch(error => {console.error(error.message);process.exitCode = 2;});
}
