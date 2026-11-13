# maimai / Simai

Open a song folder, ZIP file, or `maidata.txt` to load a chart. You can choose any available difficulty. If you're loading a single chart file, make sure to include its audio and background files too.

The viewer looks for files such as `track.mp3`, `track.ogg`, `bg.png`, `bg.jpg`, and videos named `bg`, `pv`, or `mv`. If the chart specifies filenames, those are used first. The song jacket or video appears behind the notes, and **BGA backdrop** can extend it outside the playfield. Songs with multiple difficulties reuse the same media.

## Machine mode

**Machine mode** adds a 3D maimai DX cabinet with two synchronized screens, working top displays, and light-up buttons. Both screens play the selected chart. Enable it from the start page or maimai settings.

The cabinet has a slightly translucent plastic body, glossy buttons, and separate dark trim. The canopy and side speakers have soft lighting, including a cyan speaker ring. The canopy slowly changes brightness unless reduced motion is enabled.

Button lights react to notes and menu inputs. TAP and HOLD light up the full button, while TOUCH, TOUCH HOLD, and slides light the surrounding plastic. Multiple lights can work at once. A/B touches light the matching direction, D/E touches light between buttons, and center touches don't light the outer ring. During autoplay, lights stay on for 0.5 seconds after release and fade out over the next 0.25 seconds.

**Controls:**

- **Drag:** Rotate the cabinet.
- **Right-drag / Shift-drag:** Move the cabinet.
- **Scroll:** Zoom in or out.
- **Reset view:** Return to the default angle.
- **Buttons 6 / 3** or **Left / Right:** Change selection.
- **Button 5** or **Escape:** Go back.
- **Button 4** or **Enter:** Confirm.
- **Keys 1–8:** Press the corresponding cabinet buttons, numbered clockwise from the upper right.

Touch controls also support dragging and pinch zoom. Pick a difficulty, then press **Start track**. After the results, press **4** to select another difficulty. You can also press **Escape** during autoplay to return to selection.

The 3D cabinet is adapted from 藍玉CiAN’s model and uses the **CC BY-NC-SA 4.0** license. See the [asset license](../assets/maimai-cabinet/LICENSE.md). Machine mode requires WebGL 2. If 3D doesn't work, the flat view is still available. MP4 export also supports five cabinet camera presets.

## AstroDX support

You can open `.adx` and `.adx.zip` files through **Open files**, or load an extracted `levels` folder with **Open folder**. If a song includes both `maidata.txt` and `maidata_dx.txt`, both are available. Older DX charts are labeled **legacy DX**.

The same Simai format support and limitations apply. See the [AstroDX archive guide](https://wiki.astrodx.com/en/install/android).

## Playfield

Buttons are numbered clockwise, starting with **1** just to the right of the top. Notes move toward the white judgment ring. Holds stay on the ring until they end, while slides follow their charted paths.

Gold notes are simultaneous hits, orange notes are BREAKs, and EX notes have an extra bright outline. Touch notes use a four-petal animation, and touch holds show a filling gauge. Slide stars move along the slide markers.

The center shows your combo, and the top arc shows autoplay achievement and rank. The border changes color as the rank increases, from violet at D to gold at SSS. **CLEAR** is marked at 80%. BREAK notes can add up to 1% bonus achievement. All notes are judged automatically.

Turn on **Extra info** to see FiNALE and DELUXE achievement, note counts, and chart time. BREAK notes are listed separately, and touch holds count as holds. This option is off by default and your choice is saved.

The **Playfield** settings let you change background darkness, blur, sensor visibility, and hit effects. Blur requires a background image or video. You can also adjust note approach speed separately from song speed.

Pausing and seeking work as usual. Seeking into a hold, slide, or waiting star places it at the correct point in the chart. The inspector shows buttons 1–8 as columns, with touch sensors and slide timing. The circular view shows the actual slide shapes.

## Hitsounds and effects

The viewer generates its own sounds for TAP, EX, BREAK, TOUCH, slides, holds, and fireworks. Holds play sounds when they start and end; touch holds have a continuous sound. Seeking into a touch hold resumes that sound.

Use **Hitsounds** to turn the sounds on or off, and **Hit effects** to toggle flashes and button lighting. Firework notes still show rainbow effects, including in exported videos. Seeking also updates the combo and effects to match the chart time.

## Supported Simai notation

- Song metadata, difficulty levels, chart designers, offsets, BPM changes, subdivisions, and rests.
- Taps, chords, simultaneous notes (`/`), and pseudo-EACH groups (backticks).
- HOLD, BREAK, EX, forced stars, A/B/C/D/E touch notes, touch holds, and fireworks.
- Straight, curved, V-shaped, zigzag, loop, and fan slides: `-`, `<`, `>`, `^`, `v`, `V`, `s`, `z`, `p`, `q`, `pp`, `qq`, and `w`.
- Shared slide heads (`*`) and slides without an approaching star (`?` and `!`). Fan slides use three stars.
- Mine markers, firework markers on touch holds, and negative subdivisions. Mines have their own color and don't play hit cues.
- Slide timings in subdivisions, BPM, seconds, or wait/duration pairs such as `[0.25##1.5]`. Connected slides can have separate timings or share one total duration based on path length. Slides normally wait one beat before moving.
- Positive `<HS*…>` multipliers, `&mv_wait`, and `&mv_seek`.

Unsupported notation is reported in the player settings with the chart line number.

## References and testing

The viewer uses its own Simai parser, slide paths, and note graphics. The artwork takes inspiration from the [FiNALE skin](https://github.com/TeamMajdata/MajdataPlay_Build/tree/e8c0cd301f52847e5d7436c0575984742c646933/Skins/FiNALE), while MajdataPlay was used to check how charts behave. The viewer doesn't bundle MajdataPlay's Unity code, parser, example songs, or artwork.

Useful references include [song storage](https://github.com/TeamMajdata/MajdataPlay/blob/33250cf75ba2d3256d48583797b31b45fcf9e987/Assets/Scripts/Misc/Base/SongStorage.cs), [game manager](https://github.com/TeamMajdata/MajdataPlay/blob/33250cf75ba2d3256d48583797b31b45fcf9e987/Assets/Scripts/Scenes/Game/GamePlayManager.cs), [note loader](https://github.com/TeamMajdata/MajdataPlay/blob/33250cf75ba2d3256d48583797b31b45fcf9e987/Assets/Scripts/Scenes/Game/NoteLoader.cs), [slide translator](https://github.com/TeamMajdata/MajdataPlay/blob/33250cf75ba2d3256d48583797b31b45fcf9e987/Assets/Scripts/Scenes/Game/Misc/Parsing/SimaiSlideTranslator.cs), and the [Simai notation guide](https://w.atwiki.jp/simai/pages/1003.html).

The parser was compared against MajSimai 3.0.1 using 14 included songs, 41 difficulties, and 22,158 notes. Note types and positions matched, with start times within 0.1 ms and hold/slide timings within 1 ms. This checks parsing and timing, not exact Unity visuals or special proprietary chart features.

Six slide shapes were also compared with the reference prefabs. Differences ranged from under 0.1% of the judgment radius for straight and outer-arc slides to around 3.7% for zigzags.

Run `node --test tests/*.test.cjs` for the main tests. The optional browser test at `tests/browser-smoke.cjs` checks ZIP imports, difficulty selection, seeking, the inspector, and format switching. A [demo chart](../tests/fixtures/maimai/maidata.txt) is included and works without media.

## Machine menus

Machine mode has an animated difficulty menu. Press **Next** to open the ready screen, where you can change **Speed & Sound** or **Viewer Options**. These are the same settings as the sidebar, and changes apply immediately.

Use **Left/Right** to select, **Up/Down** to change a value, **PageUp/PageDown** to switch settings categories, **Enter** to continue, and **Escape** to go back. The cabinet buttons work too.

The upper screen shows achievement during autoplay and a note breakdown afterward. The menus use original PNG graphics, not extracted arcade assets, and the text and values update live.

## Song intro

Before a chart starts, a song card shows its jacket, difficulty, level, and credits for three seconds, regardless of song speed. A circular transition then reveals the playfield.

You can pause or seek during the intro, or skip it by seeking to zero. **Replay** starts from the intro again.

![Song card and intro transition](images/mai-intro.gif)

## Clear screen and results

When the song ends and the last note effect finishes, **CLEAR** appears. A diagonal shutter closes, pauses for one chart second, then opens to the result screen.

The results show the song jacket, TAP/HOLD/SLIDE/TOUCH/BREAK counts and percentages, and the final DELUXE achievement. Seeking backward returns to the playfield, while **Replay** restarts the chart.

![Clear animation and results](images/mai-clear.gif)

## MP4 export

Select an **Export camera** in the maimai settings, then click **Export MP4**. With **Current mode · automatic**, machine mode uses the left-angle cabinet camera and normal mode uses the flat playfield.

Exports include the intro, chart, and results at **60 FPS**.

| Camera | Resolution |
| --- | --- |
| Playfield | 1920 × 1080 |
| Left angle (B), right angle, center station | 1080 × 1920 (portrait) |
| Both centered, both angled | 1920 × 1080 (landscape) |

The camera presets use fixed positions. The right-side camera doesn't mirror the chart, and both-screen views show the same chart on each side. The cabinet lights and top displays are included. Exporting doesn't change your current camera or playback position, and cabinet videos include the model attribution.

Video is targeted at **32 Mbps**, or roughly **240 MB per minute**, although actual file sizes vary. Exports use the song speed, pitch, volume, hitsounds, and playfield settings selected when rendering starts. The background outside the playfield is black. For local charts, include the audio, image, and video files. Mai Notes imports can use the built-in hitsounds.

Rendering runs in your browser. For 1080p60, it first tries hardware encoding with **H.264**, **VP9**, then **AV1**. If none is available, it falls back to browser defaults. The progress bar shows the codec being used. Audio is handled separately as AAC, Opus, or PCM.

Move the export progress window by dragging its header. When finished, click **Save MP4**, or use **Cancel** to stop an export.

For testing, run `node tests/maimai-export.cjs`. It checks the exported video's frames, resolution, audio, and borders. Use `EXPORT_CAMERA=left`, `right`, `center`, `both`, or `angled` to test cabinet views. For Firefox, set `BROWSER=firefox` and `BROWSER_EXE`. The test requires FFmpeg and ffprobe on PATH.
