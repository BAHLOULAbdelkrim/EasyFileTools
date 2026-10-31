---
title: "Open Source Licenses"
description: "Open-source software notices and source code information for the FFmpeg WebAssembly engine used by FileMorning."
layout: "policy"
seoIndex: false
---

## FFmpeg WebAssembly engine

FileMorning uses the unmodified **`@ffmpeg/core` 0.12.10 WebAssembly engine** for certain browser-based file operations. Our distributed `ffmpeg-core.wasm` was also found byte-identical to the WASM packaged with `@ffmpeg/core` 0.12.9.

- **Distributed binary:** `ffmpeg-core.9f57947a5bd5.wasm`
- **Binary SHA-256:** `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`
- **FFmpeg source version:** `n5.1.4`
- **ffmpeg.wasm build project:** [ffmpegwasm/ffmpeg.wasm, release tag `v12.15`](https://github.com/ffmpegwasm/ffmpeg.wasm/releases/tag/v12.15) (commit `71aa99d37c02a7b4c435275ca9ef50e612f6efa1`)
- **Core licensing:** GNU General Public License, version 2 or later (GPL-2.0-or-later), because this engine was built with `--enable-gpl` and libraries including libx264 and libx265.

The GPL and other third-party licenses apply to their respective components. FileMorning does not claim copyright ownership of FFmpeg or those libraries.

## Sources and build materials

**[Download FFmpeg source collection and build materials (ZIP, approximately 130 MB)](https://licenses.easyfiletools.app/ffmpeg/FFmpeg-EasyFileTools-Sources-COMPLETEES-A-VERIFIER.zip)**

Source archive SHA-256: `09b92189e04250adcd69851b76ad97487a48720d834de65361b8a3b4f5a85546`.

The archive contains source snapshots for FFmpeg and 15 additional libraries, the corresponding ffmpeg.wasm build-project files, plus collected SDL2 2.24.2 and Emscripten 3.1.40 materials. The revisions are documented in the archive. **The exact historical revisions of some build inputs have not been independently verified against the original official build**; this compilation is provided as a traceable source collection, not as a certification of exact reproducibility or legal compliance.

## License texts

- [GNU General Public License, version 2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)
- [FFmpeg licensing guidance](https://ffmpeg.org/legal.html)
- [ffmpeg.wasm project](https://github.com/ffmpegwasm/ffmpeg.wasm)

The source archives include the license and copyright notices supplied by the upstream projects, including those for x264, x265, libvpx, LAME, Opus, Ogg, Theora, Vorbis, zlib, libwebp, FreeType, FriBidi, HarfBuzz, libass, zimg, SDL2 and Emscripten.

Questions about these notices can be directed to [filemorning.com@gmail.com](mailto:filemorning.com@gmail.com).
