# SOUND VOLTEX charts

Open a K-Shoot MANIA or Unnamed SDVX Clone (USC) song folder with **Open folder**, or select its ZIP with **Open files**. Each `.ksh` is a difficulty in the chart selector. Include the referenced audio, images, video and samples when opening individual files. For a short demo, open [Relay Circuit](../tests/fixtures/relay-circuit.ksh).

## Playback and inspection

Standalone uses a graphite highway with four BT receptors, two FX indicators and blue and pink laser cursors. The cursors move into position ahead of the next laser.

### Local USC skins

Under **SOUND VOLTEX**, choose **Load skin folder** and select one skin, for example `skins/Default` or `skins/ExperimentalGear-0.3.0-rc3`. You can also select its `textures` folder. The viewer uses recognized PNG artwork for the track, chips, holds, lasers, hit effects and available HUD and controller pieces. Missing parts use the standalone drawings. The skinned HUD estimates autoplay score, chain and the normal gauge from timed judgments.

The browser remembers the selected textures locally when storage is available. **Use standalone** removes the selection and the saved textures. These are native browser layouts for USC image skins. Arbitrary Lua layout scripts, GLSL materials and native KSM skin packages are unsupported.

Four white BT lanes share the center of the highway with two orange FX lanes. Blue and pink ribbons follow the two analog knobs, including extended-range paths and instantaneous slams. The player follows BPM, meter, offsets, chart stops and scroll-speed ramps through reversals. Camera movement includes lane zoom, center splits, tilt, spins and lateral swings. **Scroll speed** changes how far ahead you see. **Camera effects** stabilizes the view when switched off. Seeking reconstructs active holds, laser positions and camera pose from chart time.

The inspector draws holds and lasers across measure boundaries. Its laser count includes individual segments and slams. The note totals describe chart objects rather than the judgment ticks used for an arcade score.

## Audio

**Audio effects** previews FX holds and laser filters against the song. The viewer supports common gates, retriggers, echo, bitcrushing, pitch shifts, phasing, flanging and filter sweeps. A supplied second audio track or a referenced SwitchAudio file can be used. With **Keysounds** enabled, chart samples and synthesized slam cues follow the shared playback clock. The first Play prepares a seekable effects buffer for the song.

## Compatibility

The importer accepts UTF-8 and falls back to Shift JIS for older charts. Chart diagnostics identify unrecognized body commands, unavailable alternate tracks and approximate custom effects. Complex DSP parameters, USC skin scripts, engine-specific background layers and nonlinear camera and laser interpolation are outside the current preview. KSON remains on the roadmap.

The mode uses standalone Canvas artwork and synthesized preset sounds. Its format and playback references are the [KSH specification](https://kson.dev/docs/format-spec/ksh_format/), [USC chart loader](https://github.com/Drewol/unnamed-sdvx-clone/blob/6c3a33f9c66460f13934df034dca7ae3f9a130f9/Beatmap/src/BeatmapFromKSH.cpp) and [USC track geometry](https://github.com/Drewol/unnamed-sdvx-clone/blob/6c3a33f9c66460f13934df034dca7ae3f9a130f9/Main/src/Track.cpp).
