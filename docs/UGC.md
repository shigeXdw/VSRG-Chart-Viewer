# UGC and SUS playback

The UGC playback screen has its own perspective renderer, note artwork, animations and settings. The surrounding viewer and other formats keep their existing interface. Graphics are original Canvas artwork; game scripts, textures, characters, music and charts are not bundled.

## SUS import

Open a UTF-8 `.sus` file, a song folder, or a ZIP via the Open menu. A chart can reference audio, a jacket, a background image and a movie relative to its folder. The player and measure inspector share the same parsed chart.

The reader supports Ched tap, EX, flick, damage, hold, slide, directional AIR and AIR-action channels. It resolves BPM references and channel-linked paths across measures, including Bézier controls and invisible steps. Numeric scroll timelines, tick resolution, measure lengths, measure bases and audio/video offsets are supported. Standard SUS AIR actions use the default AIR height. Extended visibility and inheritance commands in scroll timelines and custom note attributes produce line-numbered diagnostics. [SUS 2.7 specification](https://gist.github.com/kb10uy/c171c175ba913dc40a73c6ce69da9859) · [Ched exporter](https://github.com/paralleltree/Ched/blob/master/Ched/Components/Exporter/SusExporter.cs)

## Settings

| Setting | Behavior |
| --- | --- |
| Note speed | 1–20 in 0.25 increments; 20 is Sonic. Independent of song playback rate. |
| Mirror | Reflects the field, notes, AIR direction and effects; also reflects inspector geometry. |
| Field divisions | Off, 2, 4, 8 or 16. Notes always retain the chart's 16-unit coordinates. |
| Line color | Chart `FLDCOL`, or an explicit color. |
| Field scale | 50–100%; adapts projection to the available playback canvas. |
| Visual delay | −300 to +300 ms. Positive values draw notes and effects later relative to audio; song timing stays unchanged. |

These controls replace the generic lane width, note thickness and IIDX scroll controls while a UGC chart is selected. Settings persist under `vsrg-ugc-settings-v1` in local storage. Lane darkness, hit-effect visibility and the existing media controls remain available.

## Timing and rendering

- `TICKS`, meter changes and BPM changes determine authored tick-to-second timing. AIR heights follow the `HIPRECISION` flag, including in V8 charts.
- `SOFFSET` and `CLICK` defaults and command ordering control the first-measure count-in. The viewer shifts chart and music times together to its nonnegative transport clock. Negative music offsets skip into the audio source.
- Explicit `TIL` streams integrate speed over seconds, including stops and reverse motion. Missing streams remain independent. `SPDMOD` follows the observed final-segment rule and is inactive on undeclared timelines.
- Scroll duration is `7 / speed` through speed 10, then `7 / ((speed - 10)^2 + 10)`. The field uses the observed 45-degree camera basis, 64-unit lanes and AIR height mapping, adapted to the canvas dimensions.
- Ground SLIDE controls form Bezier curves in lane and time. Ordinary nodes split curves; AIR geometry interpolates linearly through authored points. Active ribbons clip at judgment time using elapsed seconds between prepared points.
- Note artwork is mapped onto projected floor quads with perspective-correct texture coordinates. AIR uses a vertical mesh with directional shear, a shared rimmed chevron and a fading striped trail. The up direction mirrors the artwork vertically, and the chart selects its green or purple palette. AIR geometry moves back by 0.3125 world units per unit of elevation. Straight arrows span heights 0–233, and diagonals span 16–249. The elevated judge guide appears during active AIR holds and slides at the current height of each active AIR path. Its painted glow is original viewer artwork. The field texture, judgment strip, hit rings and particle positions also use world-space projection.
- Note sprites are drawn from original viewer artwork and cached by note type, width, direction, palette and animation frame. When WebGL is available, the viewer maps the sprites and smooth ribbon textures onto GPU quads with camera-depth interpolation. The viewer times transfers from WebGL to the main canvas. Sustained slow transfers, a lost context or unavailable WebGL select Canvas projection. That path draws notes in perspective bands and uses cached tapered gradients for ribbons. A solid dark plum fills the area around the lane by default. The road has a separate device-resolution cache. Constant timelines avoid repeated timing searches.
- AIR-CRUSH positive intervals create plates and judgments in authored tick space, including an aligned endpoint. `$` produces the head alone; zero produces a decorative path without judgments. Visible AIR-CRUSH paths use narrow center traces and retain a short elapsed-time tail after crossing the judgment line. AIR-action nodes use raised rectangular plates.
- Each hit palette has a cached sprite sheet for rings, flashes, sparks and EX streaks. Arrow flashes and particles start on the lane beneath the arrow. AIR action and crush hits use their authored height. Raised plates, holds, slides and crush traces cast footprints across the lane and any ground notes beneath them. Flick chevrons, AIR-action streaks, rotating fragments, beams and sustain glows use world geometry. Hit and sustain animations use chart time. Pausing freezes the frame; seeking backward reproduces it. AIR-CRUSH expires after 0.25 seconds, ordinary hits after 0.5 seconds, and flick/AIR-action traces within one second.
- Audio scheduling discards stale asynchronous work after seeking, accounts for elapsed sample time, avoids duplicate resumed BGM, and rebuilds sources immediately when playback speed changes. Pause positions use the audio clock.

The playback header shows the jacket with track information. The side panel displays an image when the chart specifies a separate background. Narrow canvases move the progress card below the other two.

The AIR judge line fades in over the half-second before an AIR hold or AIR slide. Paths up to half a second apart share one continuous line, which disappears on the final release. The guide and its contact glow follow interpolated AIR height during playback and seeking. In VALLIS-NERIA MASTER the first such passage starts at 40.216 seconds. Simultaneous paths at different heights each get a guide. Standalone arrows trigger their hit effect on the lane.

## Chart inspector

The note key shows the same marks as the measure grid. Point to or tap a head to read its type, direction and occupied lanes. Stacked judgments appear together. Point along a ribbon to identify its body and read the height of an AIR path at that beat.

The measure grid uses authored beats, samples curved slides and includes AIR actions and generated crush judgments. Arrows show direction above their base notes. The AIR count, density overlay and radar use judged events. Lane coverage counts a wide hit once in each lane it touches, with Mirror applied to the displayed distribution.

## Compatibility limits

This is an autoplay viewer, not a playable game or a pixel-perfect recreation. Procedural textures, palette shades, particles, HUD and stage artwork approximate the presentation. The HUD counts represented judgment events; it does not emulate native score, gauge or sustain-combo scoring.

Extended `SPDDEF` / `SPDFLD` speed profiles and external `BGSCENE` / `FLDSCENE` 3D scenes are not implemented. The parser records warnings for those commands. Count-in timing is supported, but native guide-click audio and judgment sound assets are not synthesized. Browser codec restrictions still apply; pitch-preserving speed changes use a basic overlap-add algorithm and can introduce artifacts.

Pathological curves have bounded sampling work. A chart-wide limit of 250,000 generated AIR-CRUSH ticks prevents unbounded expansion and produces a parser warning when exceeded.

## Investigation

Behavior was checked against the local reference player (v2.01) on 2026-10-29 using REA 6.5 / Ghidra 12.1.4 for launcher analysis and focused static analysis, plus passive inspection of scripts already loaded by the application. REA's runtime tool did not accept the application's virtual Windows URL; full-script analysis exceeded its heap limit, so only focused analysis is considered successful. A local gameplay recording supplied visual reference. These observations do not establish exhaustive parity across all chart features.

Public format references: [UGC specification](https://gist.github.com/inonote/5c01e73781cab17765a1d93641d52298) and [official overtaking-note documentation](https://umgr.inonote.jp/margrete/advanced/oikoshi/).

## Validation

Run the dependency-free timing, parser, curve, renderer and audio regression tests with a recent Node.js:

```sh
node --test tests/*.test.cjs
```

For browser validation, serve the repository over HTTP, install or provide `playwright-core`, and run:

```sh
node tests/browser-smoke.cjs http://127.0.0.1:4175/
```

Optional environment variables are `PLAYWRIGHT_MODULE` (module path), `BROWSER_EXE` (Chromium executable) and `SCREENSHOT_DIR`. The browser check imports a synthetic chart and generated tone, changes settings, plays, seeks, changes rate, pauses, switches to BMS and verifies persisted settings and the absence of JavaScript page errors.

`tests/fixtures/ugc-visual-showcase.ugc` is an original, media-free chart for visually checking glossy note heads, curved slides, AIR directions, holds and AIR-CRUSH intervals. It can be opened through the ordinary viewer's Open menu.

For a local chart performance comparison:

```sh
node tests/ugc-performance.cjs "path/to/chart-folder" http://127.0.0.1:4175/
```

This selects the Master chart when present, loads adjacent audio/images, plays at note speed 5.5, seeks to 55%, warms up for 60 frames, then measures six seconds. It reports animation-frame intervals separately from CPU rendering submission time, since submission time does not include all GPU work. `FORCE_CANVAS=1` compares the fallback; `SEEK_PERCENT` selects another passage and `BENCHMARK_OUTPUT` saves the JSON report. To test YOUNITHM Ultima, pass the specific Ultima UGC file and use seeks of 8% for the opening slide crossings and 54% for the reverse-scroll passage. Browser/module environment variables are the same as the smoke test. Results depend on the machine, display refresh rate, browser and passage; they are not a guaranteed frame rate.
