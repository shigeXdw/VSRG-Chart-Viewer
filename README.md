# VSRG Chart Viewer

Browser-based chart viewer for vertical scrolling rhythm game charts. It is built as a static web app and can run from GitHub Pages, a local web server, or directly from `index.html` for most workflows.

## Live Viewer

[Open VSRG Chart Viewer](https://shigexdw.github.io/VSRG-Chart-Viewer/)

## Supported Formats

- BMS / BME, including `#BASE 36` and `#BASE 62`
- BMSON 1.0
- osu!mania `.osu`, `.osz`, and regular `.zip` packs
- StepMania / Etterna `.sm` and `.ssc`
- UMIGURI `.ugc` V4 and V8 charts

## Features

- Autoplay chart preview with keysounds and song audio
- BGA playback for browser-supported video formats and classic BMS image-sequence BGA
- ZIP / OSZ loading for packed charts
- IIDX-style Hi-Speed with green number, fixed px/sec mode, SUDDEN+, and song speed controls
- Lane mods for BMS-style charts: Normal, Mirror, Random, R-Random, and S-Random
- StepMania / Etterna upscroll and downscroll preview
- KPS, peak KPS, notes radar, note progress, and BPM / green-number readouts
- Textage-style chart inspector with note density, scratch density, BPM changes, and lane distribution

## Usage

Use the open menu to choose individual chart files, ZIP / OSZ packs, or a chart folder.

Some media formats depend on browser codec support. WMA, WMV, and ASF are detected as unsupported by most browsers and may not play unless the browser provides codecs for them.

## Notes

This is a viewer and autoplay preview tool, not a playable rhythm game client. Timing, chart parsing, media support, and visual skins are implemented for inspection and preview.

## Licenses

Project code is licensed under the MIT License. Third-party libraries and bundled noteskin assets keep their original licenses; see `THIRD_PARTY_NOTICES.md` and the license files in `vendor/` and `assets/noteskins/ddr-night/`.
