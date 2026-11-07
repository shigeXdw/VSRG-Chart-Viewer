# VSRG Chart Viewer

Preview rhythm game charts with autoplay, hear their music and keysounds, and inspect the notes one measure at a time. The viewer runs in your browser as a static site. You can open a local song folder, a chart file or a supported archive.

**[Open the live viewer](https://shigexdw.github.io/VSRG-Chart-Viewer/)**

## Try it

1. Choose **Open folder** and select a song folder to include its chart, music and background. With **Open files**, select the chart and its companion files together, or select a pack.
2. Pick a difficulty and press **Play**. Use the timeline to revisit a passage or change the song speed to study it more slowly.
3. Open **Chart Inspector** for the measure grid, note density, BPM changes and lane distribution.

To try a chart without a song collection, download the [two-difficulty Simai demo](tests/fixtures/maimai/maidata.txt) or the [16-lane UGC demo](tests/fixtures/ugc-visual-showcase.ugc) and open it with **Open files**. For local use, open `index.html` directly or serve the repository with `python -m http.server 8000` and visit [localhost:8000](http://localhost:8000).

## maimai · Simai and AstroDX

Open `maidata.txt`, a Majdata song folder, or an AstroDX `.adx` or `.adx.zip` pack. The circular field shows eight buttons, touch sensors, holds, slide paths and chains. The song card introduces the selected difficulty. The result shows the autoplay rate and note totals.

![Orbit Study playing in the current circular viewer, with slide stars, touch notes and holds](docs/images/maimai.gif)

**Mai Notes** opens a live song browser. Browse by level, select a difficulty, or paste a public player link. The viewer imports the selected chart for the session. Local chart files stay on your device. The Mai Notes button loads its logo from the external site. [Mai Notes](https://mai-notes.com/)

**Export MP4 · 1080p60** renders the entire selected difficulty with stereo audio, from the intro through the result. It uses the current playfield and audio settings, requests hardware video encoding where supported, and shows progress in a movable panel. [Simai controls, export and format limits](docs/MAIMAI.md)

## Vertical and perspective modes

| BMS / BME / BMSON | osu!mania |
| --- | --- |
| ![Seven key lanes and a scratch lane during BMS autoplay](docs/images/bms.gif) | ![Four-key mania playback with taps and holds](docs/images/osu-mania.gif) |
| Open `.bms`, `.bme` or BMSON 1.0 charts. BMS supports base 36 and 62, keysounds and image-sequence or video BGA. The player includes Hi-Speed, green number, fixed scrolling, lane mods and SUDDEN+. | Open a mania `.osu` file with its audio, an `.osz` pack or a ZIP. Choose the difficulty to preview its key layout and long notes. |

| StepMania / Etterna | UGC / SUS |
| --- | --- |
| ![StepMania arrows approaching four receptors](docs/images/stepmania.gif) | ![Air notes, holds and slides moving down the perspective field](docs/images/ugc.gif) |
| Open dance-single or dance-double `.sm` and `.ssc` charts. XMod follows BPM changes, stops and supported scroll and speed segments. A fixed-speed view is also available. The viewer recognizes the reviewed Speedist presets and reports unsupported Lua. [StepMania modchart support](docs/STEPMANIA.md) | Open V4/V8 `.ugc` charts or supported Ched-style `.sus` charts. The 16-lane field shows curved slides, raised AIR paths and the AIR judge guide. In the inspector, select a note to identify its type, direction and lanes. [UGC and SUS format guide](docs/UGC.md) |

## Media and development

Audio and video decoding depend on the browser and installed codecs. Include companion media when opening local charts. For supported charts the inspector and visual preview also work without a recording. This is an autoplay viewer.

The app needs no build step. Run the regression suite with a recent Node.js:

```sh
node --test tests/*.test.cjs
```

For browser checks, serve the repository locally and run `node tests/browser-smoke.cjs http://127.0.0.1:8000/`. The test uses Playwright and Chromium. You can set `PLAYWRIGHT_MODULE` and `BROWSER_EXE` to existing installations. The optional `node tests/maimai-export.cjs` check also uses FFmpeg and ffprobe to verify a downloaded MP4.

## Credits and licenses

Viewer code is published under the [MIT License](LICENSE). Bundled libraries and DDR Night assets carry their own licenses. The maimai and UGC/SUS note artwork is drawn by the viewer. The animated previews use demo charts. See [third-party sources, credits and licenses](THIRD_PARTY_NOTICES.md).
