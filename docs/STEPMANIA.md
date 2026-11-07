# StepMania / Etterna modchart preview

Open a song folder or ZIP containing its `.sm` / `.ssc` chart, audio and Lua files. When using **Open files**, select the companion Lua files too.

## Scroll controls

- **XMod (BPM / chart scroll)** positions arrows by beat distance. BPM changes alter movement, stops freeze the field, and the existing negative-BPM timing conversion produces beat jumps. One beat at 1× occupies one note width, scaled with the viewer's noteskin.
- **XMod multiplier** controls beat spacing. **Chart speed scripts** lets a supported chart preset override this multiplier while its actor is active.
- **Fixed px/sec** keeps time-based scrolling and ignores chart scroll ratios, speed transitions and Lua speed presets. This is useful for reading the underlying note timing.
- Upscroll/downscroll, playback rate and timeline seeking use the existing player. Seeking reconstructs scroll state directly from song time.

## Supported chart behavior

- BPM changes and stops, including the existing legacy negative-BPM timing conversion.
- `#SCROLLS:beat=ratio`: positive, zero and negative ratios. Future notes are selected by their displayed position, so a reversed scroll does not hide notes just because their hit time is far away.
- `#SPEEDS:beat=ratio=duration=unit`: immediate changes or linear transitions, with duration in beats (`0`) or seconds (`1`). Beat-duration endpoints are converted through the chart's timing map, including BPM changes and stops.
- Holds are split at scroll changes. Drawing is clipped to the viewport, including extremely long holds.
- Song-level or difficulty-level SSC visual timing.
- The two reviewed **Speedist** helpers (`speed.lua` and its obfuscated `speedo.lua` variant): force XMod 1× during the referenced actor's lifetime. Their source is identified by normalized SHA-256 fingerprints, not by filename. No Lua code is bundled or executed. Edited or different scripts are reported as unsupported.

## Limits and diagnostics

This is not a general StepMania Lua runtime. ActorFrames, tween commands, camera effects, arbitrary PlayerOptions calls and mod frameworks are not emulated. `#ATTACKS`, explicit SSC `#WARPS`, `#DELAYS` and `#FAKES` are also not implemented. The Scroll panel reports those tags, missing/unknown Lua scripts, malformed visual timing and unsupported foreground/background events instead of silently claiming full compatibility. These charts can still be inspected, but their playback may differ.

## Validation

`node --test tests/*.test.cjs` covers BPM-dependent movement, stop freezes, reversal/zero-scroll visibility, hold turns, speed transitions, difficulty overrides, script lifetime, deterministic seeking and unsupported-script diagnostics.

Optional local integration check:

```text
node tests/stepmania-browser.cjs "path/to/local/test-songs"
```

Set `PLAYWRIGHT_MODULE` and `BROWSER_EXE` as for `tests/browser-smoke.cjs`. This checks the supplied Dum Surfer and Remilias Hell charts plus both Speedist files, playback and render timings. The songs and scripts remain outside the repository. Chromium was tested; this is not a full engine-to-engine visual comparison or a Firefox performance guarantee.

The independent implementation uses StepMania's [ArrowEffects](https://github.com/stepmania/stepmania/blob/5_1-new/src/ArrowEffects.cpp) and [TimingData](https://github.com/stepmania/stepmania/blob/5_1-new/src/TimingData.cpp) as behavioral references. No reference source was copied into the viewer.
