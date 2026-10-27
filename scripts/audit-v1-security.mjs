#!/usr/bin/env node
// EasyFile Tools — check safe Cloudflare Pages headers and inventory external runtime dependencies.
// Usage: node scripts/audit-v1-security.mjs [public]
// The local preview server does NOT apply Cloudflare Pages _headers. Test on a deployed preview.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HEADER_REQUIREMENTS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()'],
  'content-security-policy': ["base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'"]
});

export function readHeaderBlocks(source) {
  const blocks = [];
  let current = null;
  for (const original of source.split(/\r?\n/)) {
    const line = original.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(original)) {
      current = {pattern: line.trim(), headers: new Map()};
      blocks.push(current);
      continue;
    }
    if (!current) throw new Error(`Orphan header definition: ${line}`);
    const match = line.trim().match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.+)$/);
    if (!match) throw new Error(`Invalid header line: ${line}`);
    const key = match[1].toLowerCase();
    if (current.headers.has(key)) throw new Error(`Duplicate header within ${current.pattern}: ${key}`);
    current.headers.set(key, match[2].trim());
  }
  return blocks;
}

export function verifyHeaderPolicy(source) {
  const errors = [];
  let blocks;
  try { blocks = readHeaderBlocks(source); }
  catch (error) { return [error.message]; }
  const global = blocks.filter(block => block.pattern === '/*');
  if (global.length !== 1) return ['Expected exactly one /* rule for static content'];
  const headers = global[0].headers;
  for (const [key, required] of Object.entries(HEADER_REQUIREMENTS)) {
    const actual = headers.get(key);
    if (!actual) { errors.push(`Missing ${key}`); continue; }
    if (typeof required === 'string' && actual !== required) errors.push(`${key} is not ${required}`);
    if (Array.isArray(required) && required.some(fragment => !actual.includes(fragment))) {
      errors.push(`${key} is missing an expected restriction`);
    }
  }
  const csp = headers.get('content-security-policy') || '';
  if (/\b(?:script-src|default-src)\b/i.test(csp)) errors.push('CSP unexpectedly restricts scripts: must undergo runtime testing before enforcing');
  if (/\b(?:unsafe-inline|unsafe-eval)\b/i.test(csp)) errors.push('Unexpected permissive CSP marker in baseline');
  return errors;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function auditProject(root, buildDir) {
  const errors = [];
  const notices = [];
  const sourceFile = path.join(root, 'static', '_headers');
  if (!fs.existsSync(sourceFile)) errors.push('Missing static/_headers');
  else errors.push(...verifyHeaderPolicy(fs.readFileSync(sourceFile, 'utf8')));

  if (buildDir) {
    const outputFile = path.join(buildDir, '_headers');
    if (!fs.existsSync(outputFile)) errors.push('Hugo build did not include public/_headers');
    else if (fs.existsSync(sourceFile) && fs.readFileSync(outputFile, 'utf8') !== fs.readFileSync(sourceFile, 'utf8')) {
      errors.push('Output _headers differs from static/_headers');
    }
  }
  const optional = path.join(root, 'themes/high-tech-theme/static/js/common/optional-dependencies.js');
  const aiWorker = path.join(root, 'themes/high-tech-theme/static/js/image/remove-background/background-removal-worker.js');
  const wasm = path.join(root, 'themes/high-tech-theme/static/js/audio/convert-audio/lib/ffmpeg-core.wasm');
  const pdfLib = path.join(root, 'themes/high-tech-theme/static/js/vendor/pdf-lib/pdf-lib.min.js');
  for (const [label, filename] of [['optional dependencies', optional], ['AI worker', aiWorker], ['pdf-lib', pdfLib]]) {
    if (!fs.existsSync(filename)) errors.push(`Required resource missing: ${label}`);
  }
  if (fs.existsSync(optional)) {
    const text = fs.readFileSync(optional, 'utf8');
    if (!text.includes('/pdf.js/3.11.174/') || !text.includes('/jszip/3.10.1/')) {
      notices.push('Third-party PDF.js/JSZip URL versions changed; review licensing and CSP before deploy');
    }
  }
  if (fs.existsSync(aiWorker)) {
    const text = fs.readFileSync(aiWorker, 'utf8');
    if (!text.includes('ORT_VERSION = "1.30.0"')) notices.push('ONNX Runtime version changed; review external origins');
    if (/huggingface\.co\/[^"']+\/resolve\/main\//.test(text)) notices.push('AI model URL uses mutable /main/: pin a model revision after functional validation');
  }
  if (fs.existsSync(wasm)) {
    notices.push(`Local ffmpeg-core.wasm SHA-256: ${sha256(wasm)}`);
  } else {
    // Source-only R2 deployment: the remote URL must be provided at Hugo build time.
    const headTemplate = path.join(root, 'layouts/partials/head.html');
    const config = path.join(root, 'config.toml');
    const loaderPath = path.join(root, 'themes/high-tech-theme/static/js/audio/convert-audio/ffmpeg-loader.js');
    const configured = [
      [headTemplate, /easyfile-ffmpeg-wasm-url/],
      [config, /ffmpegWasmURL\s*=/],
      [loaderPath, /remoteWasmURL/]
    ].every(([filename,pattern])=> fs.existsSync(filename) && pattern.test(fs.readFileSync(filename,'utf8')));
    if (!configured) errors.push('Required resource missing: FFmpeg WASM (no working R2 configuration path)');
    else notices.push('External FFmpeg WASM via Hugo R2 URL: verify object SHA-256 and HTTPS/CORS before public deployment');
  }
  if (fs.existsSync(pdfLib)) notices.push(`Local pdf-lib.min.js SHA-256: ${sha256(pdfLib)}`);
  notices.push('CSP only protects frame/base/object/form: script-src, worker-src and connect-src are NOT enforced. Live preview tests required.');
  notices.push('Licenses/attribution: verify GPL obligations for @ffmpeg/core BEFORE publication; see docs/V1_LOT5_DEPENDANCES_ET_LICENCES.md.');
  return {errors, notices};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const buildDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const result = auditProject(projectRoot, buildDir);
  for (const item of result.notices) console.log('INFO ', item);
  for (const item of result.errors) console.error('ERROR', item);
  console.log(`Prepublication security audit: ${result.errors.length} errors; ${result.notices.length} informational notices`);
  if (result.errors.length) process.exitCode = 1;
}
