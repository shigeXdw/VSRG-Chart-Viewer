(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEY_CHANNELS = ["1", "2", "3", "4", "5", "8", "9"];
  const LANE_ORDER = { "6": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "8": 6, "9": 7 };
  const AUDIO_EXTENSIONS = new Set([
    ".wav", ".wave", ".ogg", ".oga", ".opus", ".mp3", ".mp2",
    ".m4a", ".aac", ".flac", ".aif", ".aiff", ".weba", ".caf", ".wma"
  ]);
  const VIDEO_EXTENSIONS = new Set([
    ".mp4", ".m4v", ".webm", ".ogv", ".ogg", ".mov", ".mpeg",
    ".mpg", ".mpe", ".ts", ".m2ts", ".wmv", ".asf"
  ]);
  const BROWSER_UNSUPPORTED_MEDIA_EXTENSIONS = new Set([".wma", ".wmv", ".asf"]);
  const IMAGE_EXTENSIONS = new Set([".bmp", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  const DIFFICULTIES = {
    1: ["BEGINNER", "#45dc67"],
    2: ["NORMAL", "#54a8ff"],
    3: ["HYPER", "#ffd642"],
    4: ["ANOTHER", "#ff4d59"],
    5: ["LEGGENDARIA", "#c77dff"]
  };
  const IIDX_GREEN_NUMBER_BASE = 174000;
  const JUDGE_LINE_WIDTH = 3;
  const HIT_EFFECT_DURATION = 0.36;
  const HIT_LIGHT_HEIGHT = 164;
  const HIT_BOMB_SCALE = 2.35;

  const ui = {
    openButton: $("openButton"),
    openMenu: $("openMenu"),
    openMenuPanel: $("openMenuPanel"),
    openFilesOption: $("openFilesOption"),
    openFolderOption: $("openFolderOption"),
    files: $("fileInput"),
    folder: $("folderInput"),
    select: $("chartSelect"),
    play: $("playButton"),
    stop: $("stopButton"),
    canvas: $("playfield"),
    judgeText: $("judgeText"),
    seek: $("seekInput"),
    back: $("backButton"),
    forward: $("forwardButton"),
    video: $("bga"),
    layerVideo: $("bgaLayerVideo"),
    bgaCanvas: $("bgaCanvas"),
    bgaBackdropToggle: $("bgaBackdropToggle"),
    placeholder: $("moviePlaceholder"),
    title: $("title"),
    artist: $("artist"),
    genre: $("genre"),
    difficulty: $("difficulty"),
    bpm: $("bpm"),
    notes: $("notes"),
    time: $("time"),
    base: $("base"),
    scrollMode: $("scrollMode"),
    scrollModeValue: $("scrollModeValue"),
    ugcSettings: $("ugcSettings"),
    ugcSpeed: $("ugcSpeed"),
    ugcSpeedValue: $("ugcSpeedValue"),
    ugcMirror: $("ugcMirror"),
    ugcLines: $("ugcLines"),
    ugcColor: $("ugcColor"),
    ugcScale: $("ugcScale"),
    ugcScaleValue: $("ugcScaleValue"),
    ugcOffset: $("ugcOffset"),
    ugcOffsetValue: $("ugcOffsetValue"),
    speedLabel: $("speedLabel"),
    speed: $("speed"),
    speedValue: $("speedValue"),
    columnWidth: $("columnWidth"),
    columnWidthValue: $("columnWidthValue"),
    scratchWidth: $("scratchWidth"),
    scratchWidthValue: $("scratchWidthValue"),
    noteThickness: $("noteThickness"),
    noteThicknessValue: $("noteThicknessValue"),
    maiBlur: $("maiBlur"),
    maiDarkness: $("maiDarkness"),
    maiSensors: $("maiSensors"),
    maiComboOpacity: $("maiComboOpacity"),
    maiEffects: $("maiEffects"),
    bgaBlur: $("bgaBlur"),
    bgaBlurValue: $("bgaBlurValue"),
    bgaDarkness: $("bgaDarkness"),
    bgaDarknessValue: $("bgaDarknessValue"),
    laneDarkness: $("laneDarkness"),
    laneDarknessValue: $("laneDarknessValue"),
    stepmaniaScrollDirection: $("stepmaniaScrollDirection"),
    stepmaniaColumnSpacing: $("stepmaniaColumnSpacing"),
    stepmaniaColumnSpacingValue: $("stepmaniaColumnSpacingValue"),
    sidePanelToggle: $("sidePanelToggle"),
    playerNotesRadar: $("playerNotesRadar"),
    sudden: $("suddenButton"),
    suddenAmount: $("suddenAmount"),
    suddenAmountValue: $("suddenAmountValue"),
    laneArrangement1: $("laneArrangement1"),
    laneArrangement2: $("laneArrangement2"),
    laneArrangement2Label: $("laneArrangement2Label"),
    songSpeed: $("songSpeed"),
    songSpeedValue: $("songSpeedValue"),
    pitchWithSpeed: $("pitchWithSpeed"),
    volume: $("volume"),
    volumeValue: $("volumeValue"),
    keysounds: $("keysounds"),
    hitEffects: $("hitEffects"),
    currentKps: $("currentKps"),
    peakKps: $("peakKps"),
    status: $("status"),
    startView: $("startView"),
    startStatus: $("startStatus"),
    viewTabs: $("viewTabs"),
    chartControls: $("chartControls"),
    playerView: $("playerView"),
    inspectorView: $("inspectorView"),
    inspectorTitle: $("inspectorTitle"),
    inspectorSubtitle: $("inspectorSubtitle"),
    inspectorColumnSize: $("inspectorColumnSize"),
    inspectorCurrent: $("inspectorCurrentButton"),
    inspectorFollow: $("inspectorFollow"),
    inspectorScroller: $("inspectorScroller"),
    measureGrid: $("measureGrid"),
    laneDistribution: $("laneDistribution"),
    densityGraph: $("densityGraph"),
    notesRadar: $("notesRadar"),
    analysisNotes: $("analysisNotes"),
    analysisPeak: $("analysisPeak"),
    analysisChord: $("analysisChord"),
    analysisScratch: $("analysisScratch"),
    analysisLong: $("analysisLong"),
    analysisBpm: $("analysisBpm")
  };

  const ctx = ui.canvas.getContext("2d", { alpha: false, desynchronized: true });
  const bgaCtx = ui.bgaCanvas.getContext("2d", { alpha: false });
  const backdropCanvas = document.createElement("canvas");
  const backdropCtx = backdropCanvas.getContext("2d", { alpha: false });
  const backdropFrameCanvas = document.createElement("canvas");
  const backdropFrameCtx = backdropFrameCanvas.getContext("2d", { alpha: false });
  const modButtons = [...document.querySelectorAll(".mod-button")];
  const viewButtons = [...document.querySelectorAll(".view-tab")];

  const state = {
    files: new Map(),
    charts: [],
    chart: null,
    audio: null,
    gain: null,
    buffers: new Map(),
    stretchedBuffers: new Map(),
    sources: [],
    scheduled: new Set(),
    hitNotes: new Set(),
    effects: [],
    startAt: 0,
    pausedAt: 0,
    lastTime: 0,
    nextScheduleAt: 0,
    lastUiUpdate: 0,
    frame: 0,
    playing: false,
    starting: false,
    seeking: false,
    playGeneration: 0,
    videoUrl: "",
    currentBga: "",
    bgaFallbacks: [],
    bgaFallbackIndex: 0,
    bgaOffset: 0,
    bgaAssets: new Map(),
    playbackJacket: null,
    bgaBase: null,
    bgaLayer: null,
    bgaWantedBase: "",
    bgaWantedLayer: "",
    bgaPreloadPromise: null,
    bgaRenderToken: 0,
    failedAudio: new Set(),
    missingAudio: new Set(),
    peakKps: 0,
    laneMod: "normal",
    laneMappings: [],
    suddenEnabled: false,
    canvasWidth: 1,
    canvasHeight: 1,
    iidxHispeed: 2,
    fixedScrollSpeed: 720,
    playbackRate: 1,
    palette: {},
    view: "player",
    sidePanelCollapsed: false,
    bgaBackdrop: false,
    bgaBackdropLastUpdate: -Infinity,
    backdropBaseSource: null,
    backdropLayerSource: null,
    followedMeasure: -1
  };

  function refreshPalette() {
    const styles = getComputedStyle(document.documentElement);
    for (const name of [
      "--canvas-bg", "--lane-scratch", "--lane-white", "--lane-blue",
      "--lane-border", "--judge-line", "--note-scratch", "--note-white",
      "--note-blue", "--measure-line", "--cover-bg", "--cover-edge"
      , "--ln-body", "--ln-edge"
    ]) {
      state.palette[name] = styles.getPropertyValue(name).trim();
    }
  }

  function themeColor(name) {
    return state.palette[name];
  }

  function normalizePath(value) {
    return value.replaceAll("\\", "/").replace(/^\.?\//, "").toLowerCase();
  }

  function splitFilename(path) {
    const basename = path.split("/").pop();
    const dot = basename.lastIndexOf(".");
    return dot < 0
      ? { basename, stem: basename, extension: "" }
      : { basename, stem: basename.slice(0, dot), extension: basename.slice(dot) };
  }

  function mediaCandidates(path, mediaType) {
    const target = normalizePath(path);
    const exact = state.files.get(target);
    const { basename, stem } = splitFilename(target);
    const family = mediaType === "audio" ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
    const matches = [...state.files.entries()]
      .filter(([key]) => {
        const candidate = splitFilename(key);
        return candidate.stem === stem && family.has(candidate.extension);
      })
      .map(([, file]) => file);

    if (exact) return [exact, ...matches.filter((file) => file !== exact)];
    const basenameMatches = [...state.files.entries()]
      .filter(([key]) => key.endsWith("/" + basename) || key === basename)
      .map(([, file]) => file);
    return [...basenameMatches, ...matches.filter((file) => !basenameMatches.includes(file))];
  }

  function decodeText(file) {
    return file.arrayBuffer().then((data) => {
      try { return new TextDecoder("shift-jis", { fatal: true }).decode(data); }
      catch { return new TextDecoder("utf-8").decode(data).replace(/^\uFEFF/, ""); }
    });
  }

  function parseChart(text, name) {
    const lines = text.split(/\r?\n/);
    const header = {};
    const wav = new Map();
    const bmp = new Map();
    const bpmExt = new Map();
    const raw = [];
    let base = 36;

    for (const source of lines) {
      const line = source.trim();
      if (!line || line.startsWith("*")) continue;
      let match;
      if ((match = line.match(/^#BASE\s+(\d+)/i))) {
        base = Number(match[1]) === 62 ? 62 : 36;
      } else if ((match = line.match(/^#WAV([0-9A-Za-z]{2})\s+(.+)$/i))) {
        wav.set(match[1], match[2].trim());
      } else if ((match = line.match(/^#BMP([0-9A-Za-z]{2})\s+(.+)$/i))) {
        bmp.set(match[1], match[2].trim());
      } else if ((match = line.match(/^#BPM([0-9A-Za-z]{2})\s+([\d.]+)/i))) {
        bpmExt.set(match[1], Number(match[2]));
      } else if ((match = line.match(/^#(\d{3})([0-9A-Za-z]{2}):(.+)$/))) {
        raw.push({ measure: Number(match[1]), channel: match[2].toUpperCase(), data: match[3].trim() });
      } else if ((match = line.match(/^#([A-Z][A-Z0-9]*)\s*(.*)$/i))) {
        header[match[1].toUpperCase()] = match[2].trim();
      }
    }

    const measureRatios = new Map();
    for (const row of raw) if (row.channel === "02") measureRatios.set(row.measure, Number(row.data));
    const maxMeasure = Math.max(0, ...raw.map((row) => row.measure));
    const starts = [0];
    for (let measure = 0; measure <= maxMeasure + 1; measure++) {
      starts[measure + 1] = starts[measure] + 4 * (measureRatios.get(measure) || 1);
    }

    const events = [];
    for (const row of raw) {
      if (row.channel === "02") continue;
      const count = Math.floor(row.data.length / 2);
      for (let index = 0; index < count; index++) {
        const object = row.data.slice(index * 2, index * 2 + 2);
        if (object === "00") continue;
        events.push({
          beat: starts[row.measure] + 4 * (measureRatios.get(row.measure) || 1) * index / count,
          measure: row.measure, channel: row.channel, object
        });
      }
    }

    const initialBpm = Number(header.BPM) || 120;
    const bpmChanges = [{ beat: 0, bpm: initialBpm }];
    for (const event of events) {
      if (event.channel === "03") bpmChanges.push({ beat: event.beat, bpm: parseInt(event.object, 16) });
      if (event.channel === "08") bpmChanges.push({ beat: event.beat, bpm: bpmExt.get(event.object) || initialBpm });
    }
    bpmChanges.sort((a, b) => a.beat - b.beat);

    function beatToSeconds(beat) {
      let seconds = 0, cursor = 0, bpm = initialBpm;
      for (const change of bpmChanges) {
        if (change.beat <= cursor) { bpm = change.bpm; continue; }
        if (change.beat >= beat) break;
        seconds += (change.beat - cursor) * 60 / bpm;
        cursor = change.beat;
        bpm = change.bpm;
      }
      return seconds + (beat - cursor) * 60 / bpm;
    }

    for (const change of bpmChanges) change.time = beatToSeconds(change.beat);
    for (const event of events) event.time = beatToSeconds(event.beat);
    function secondsToBeat(seconds) {
      let elapsed = 0, beat = 0, bpm = initialBpm;
      for (const change of bpmChanges) {
        if (change.beat <= beat) { bpm = change.bpm; continue; }
        const segment = (change.beat - beat) * 60 / bpm;
        if (elapsed + segment >= seconds) return beat + (seconds - elapsed) * bpm / 60;
        elapsed += segment;
        beat = change.beat;
        bpm = change.bpm;
      }
      return beat + (seconds - elapsed) * bpm / 60;
    }
    events.sort((a, b) => a.time - b.time);
    const playable = events.filter((event) => /^[12][1-9]$/.test(event.channel));
    const longNotes = events.filter((event) => /^[56][1-9]$/.test(event.channel));
    const longNoteState = new Map();
    for (const event of longNotes) {
      const active = longNoteState.get(event.channel);
      event.longStart = !active;
      if (active) {
        event.longPair = active;
        active.longPair = event;
        longNoteState.delete(event.channel);
      } else {
        longNoteState.set(event.channel, event);
      }
    }
    const duration = Math.max(beatToSeconds(starts[maxMeasure + 1]), ...events.map((event) => event.time));
    const lanes = events.some((event) => /^2[1-9]$/.test(event.channel) || /^6[1-9]$/.test(event.channel)) ? 16 : 8;
    const hitNotes = [...playable, ...longNotes.filter((event) => event.longStart)].sort((a, b) => a.time - b.time);
    const displayNotes = [...playable, ...longNotes].sort((a, b) => a.time - b.time);
    const bgmEvents = events.filter((event) => event.channel === "01");
    const keyEvents = events.filter((event) =>
      /^[12][1-9]$/.test(event.channel) ||
      (/^[56][1-9]$/.test(event.channel) && event.longStart)
    );
    const bgaEvents = events.filter((event) => event.channel === "04");

    return {
      name, header, base, wav, bmp, events, playable, longNotes, bpmChanges,
      duration, lanes, beatToSeconds, secondsToBeat, measureStarts: starts,
      hitNotes, displayNotes, bgmEvents, keyEvents, bgaEvents,
      layerEvents: events.filter((event) => event.channel === "07"),
      poorEvents: events.filter((event) => event.channel === "06"),
      noteCount: Number(header.TOTALNOTES) || playable.length
    };
  }

  function parseBmson(text, name) {
    const data = JSON.parse(text.replace(/^\uFEFF/, ""));
    const info = data.info || {};
    const resolution = Number(info.resolution) || 240;
    const initialBpm = Number(info.init_bpm) || 120;
    const header = {
      TITLE: [info.title, info.subtitle].filter(Boolean).join(" "),
      ARTIST: info.artist || "",
      SUBARTIST: (info.subartists || []).join(", "),
      GENRE: info.genre || "BMSON",
      PLAYLEVEL: String(info.level ?? ""),
      BPM: String(initialBpm),
      DIFFICULTY: String(difficultyFromName(info.chart_name || name))
    };
    const mode = String(info.mode_hint || "beat-7k").toLowerCase();
    const lanes = mode.includes("14k") || mode.includes("10k") ? 16 : 8;
    const bpmRaw = [{ y: 0, bpm: initialBpm }, ...(data.bpm_events || [])]
      .map((event) => ({ y: Number(event.y) || 0, bpm: Number(event.bpm) || initialBpm }))
      .sort((a, b) => a.y - b.y);
    const stops = (data.stop_events || [])
      .map((event) => ({ y: Number(event.y) || 0, duration: Number(event.duration) || 0 }))
      .sort((a, b) => a.y - b.y);

    function pulseToSeconds(pulse) {
      let seconds = 0;
      let cursor = 0;
      let bpm = initialBpm;
      let bpmIndex = 0;
      let stopIndex = 0;
      while (cursor < pulse) {
        const nextBpm = bpmRaw[bpmIndex + 1]?.y ?? Infinity;
        const nextStop = stops[stopIndex]?.y ?? Infinity;
        const next = Math.min(pulse, nextBpm, nextStop);
        seconds += (next - cursor) / resolution * 60 / bpm;
        cursor = next;
        if (cursor === nextBpm) {
          bpmIndex++;
          bpm = bpmRaw[bpmIndex].bpm;
        }
        if (cursor === nextStop && cursor < pulse) {
          seconds += stops[stopIndex].duration / resolution * 60 / bpm;
          stopIndex++;
        } else if (cursor === nextStop) {
          break;
        }
      }
      return seconds;
    }

    function laneChannel(x, long = false) {
      const value = Number(x);
      const prefix = long ? "5" : "1";
      if (lanes === 8) {
        if (value === 8) return prefix + "6";
        return prefix + (KEY_CHANNELS[value - 1] || "1");
      }
      if (value === 8) return prefix + "6";
      if (value === 16) return (long ? "6" : "2") + "6";
      if (value >= 9) return (long ? "6" : "2") + (KEY_CHANNELS[value - 9] || "1");
      return prefix + (KEY_CHANNELS[value - 1] || "1");
    }

    const wav = new Map();
    const bmp = new Map();
    const events = [];
    const visualByPosition = new Map();
    (data.sound_channels || []).forEach((sound, soundIndex) => {
      const object = `bmson-${soundIndex}`;
      wav.set(object, sound.name || "");
      const notes = [...(sound.notes || [])].sort((a, b) => Number(a.y) - Number(b.y));
      const pulseGroups = new Map();
      for (const note of notes) {
        const pulse = Number(note.y) || 0;
        if (!pulseGroups.has(pulse)) pulseGroups.set(pulse, []);
        pulseGroups.get(pulse).push(note);
      }
      const pulses = [...pulseGroups.keys()].sort((a, b) => a - b);
      let restartPulse = 0;
      pulses.forEach((pulse, pulseIndex) => {
        const group = pulseGroups.get(pulse);
        if (group.some((note) => !note.c)) restartPulse = pulse;
        const nextPulse = pulses[pulseIndex + 1];
        const audioOffset = Math.max(0, pulseToSeconds(pulse) - pulseToSeconds(restartPulse));
        const audioDuration = nextPulse == null ? undefined : Math.max(0, pulseToSeconds(nextPulse) - pulseToSeconds(pulse));
        for (const note of group) {
          const x = Number(note.x) || 0;
          const length = Number(note.l) || 0;
          const baseEvent = {
            beat: pulse / resolution,
            pulse,
            measure: 0,
            channel: x === 0 ? "01" : laneChannel(x, length > 0),
            object,
            time: pulseToSeconds(pulse),
            audioOffset,
            audioDuration,
            bmson: true
          };
          events.push(baseEvent);
          if (x > 0) {
            const visualKey = `${x}:${pulse}`;
            if (!visualByPosition.has(visualKey)) visualByPosition.set(visualKey, baseEvent);
            if (length > 0) {
              baseEvent.longStart = true;
              const endEvent = {
                ...baseEvent,
                beat: (pulse + length) / resolution,
                pulse: pulse + length,
                time: pulseToSeconds(pulse + length),
                audioOffset: undefined,
                audioDuration: undefined,
                longStart: false,
                longPair: baseEvent
              };
              baseEvent.longPair = endEvent;
              events.push(endEvent);
            }
          }
        }
      });
    });

    const bga = data.bga || {};
    for (const image of bga.bga_header || []) bmp.set(String(image.id), image.name);
    for (const event of bga.bga_events || []) {
      events.push({ beat: Number(event.y) / resolution, pulse: Number(event.y), measure: 0, channel: "04", object: String(event.id), time: pulseToSeconds(Number(event.y)) });
    }
    for (const event of bga.layer_events || []) {
      events.push({ beat: Number(event.y) / resolution, pulse: Number(event.y), measure: 0, channel: "07", object: String(event.id), time: pulseToSeconds(Number(event.y)), bmsonLayer: true });
    }
    for (const event of bga.poor_events || []) {
      events.push({ beat: Number(event.y) / resolution, pulse: Number(event.y), measure: 0, channel: "06", object: String(event.id), time: pulseToSeconds(Number(event.y)) });
    }

    const maxPulse = Math.max(
      resolution * 4,
      ...events.map((event) => event.pulse || Math.round(event.beat * resolution)),
      ...(data.lines || []).map((line) => Number(line.y) || 0)
    );
    let linePulses = (data.lines || []).map((line) => Number(line.y) || 0).sort((a, b) => a - b);
    if (!linePulses.length) {
      linePulses = [];
      for (let pulse = 0; pulse <= maxPulse + resolution * 4; pulse += resolution * 4) linePulses.push(pulse);
    }
    if (linePulses[0] !== 0) linePulses.unshift(0);
    const measureStarts = linePulses.map((pulse) => pulse / resolution);
    for (const event of events) {
      event.measure = Math.max(0, upperBoundValue(measureStarts, event.beat) - 1);
    }
    events.sort((a, b) => a.time - b.time);
    const bpmChanges = bpmRaw.map((event) => ({ beat: event.y / resolution, bpm: event.bpm, time: pulseToSeconds(event.y) }));
    const playable = [...visualByPosition.values()].filter((event) => !event.longStart);
    const longNotes = events.filter((event) => /^[56]/.test(event.channel));
    const hitNotes = [...visualByPosition.values()].sort((a, b) => a.time - b.time);
    const displayNotes = [...playable, ...longNotes].sort((a, b) => a.time - b.time);
    const bgmEvents = events.filter((event) => event.channel === "01");
    const keyEvents = events.filter((event) => /^[12]/.test(event.channel) || (/^[56]/.test(event.channel) && event.longStart));
    const duration = pulseToSeconds(maxPulse + resolution * 4);

    function beatToSeconds(beat) { return pulseToSeconds(beat * resolution); }
    function secondsToBeat(seconds) {
      let low = 0, high = maxPulse + resolution * 8;
      for (let count = 0; count < 32; count++) {
        const middle = (low + high) / 2;
        if (pulseToSeconds(middle) < seconds) low = middle;
        else high = middle;
      }
      return (low + high) / 2 / resolution;
    }

    return {
      name, header, base: "BMSON", wav, bmp, events, playable, longNotes, bpmChanges,
      duration, lanes, beatToSeconds, secondsToBeat, measureStarts,
      hitNotes, displayNotes, bgmEvents, keyEvents,
      bgaEvents: events.filter((event) => event.channel === "04"),
      layerEvents: events.filter((event) => event.channel === "07"),
      poorEvents: events.filter((event) => event.channel === "06"),
      noteCount: hitNotes.length,
      format: "bmson"
    };
  }

  async function calculateOsuStars(bytes) {
    try {
      if (!globalThis.rosuPp) throw new Error("rosu-pp did not load");
      if (!globalThis.rosuPpReady) {
        const binary = atob(globalThis.ROSU_PP_WASM_BASE64);
        const wasm = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) wasm[index] = binary.charCodeAt(index);
        globalThis.rosuPp.initSync({ module: wasm });
        globalThis.rosuPpReady = true;
        delete globalThis.ROSU_PP_WASM_BASE64;
      }
      const map = new globalThis.rosuPp.Beatmap(bytes);
      const calculator = new globalThis.rosuPp.Difficulty({ lazer: true });
      try {
        if (map.isSuspicious()) return null;
        const attributes = calculator.calculate(map);
        try {
          return attributes.stars;
        } finally {
          attributes.free();
        }
      } finally {
        calculator.free();
        map.free();
      }
    } catch (error) {
      console.warn("Could not calculate osu! star rating", error);
      return null;
    }
  }

  function parseOsuSections(text) {
    const sections = new Map();
    let current = "";
    for (const source of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const line = source.trim();
      if (!line || line.startsWith("//")) continue;
      const section = line.match(/^\[(.+)]$/);
      if (section) {
        current = section[1];
        sections.set(current, []);
      } else if (current) {
        sections.get(current).push(line);
      }
    }
    return sections;
  }

  function osuPairs(lines = []) {
    const values = {};
    for (const line of lines) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return values;
  }

  function unquote(value) {
    return String(value || "").trim().replace(/^"(.*)"$/, "$1");
  }

  async function parseOsu(bytes, name) {
    const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
    const sections = parseOsuSections(text);
    const general = osuPairs(sections.get("General"));
    const metadata = osuPairs(sections.get("Metadata"));
    const difficulty = osuPairs(sections.get("Difficulty"));
    if (Number(general.Mode) !== 3) return null;

    const lanes = Math.max(1, Math.min(18, Math.round(Number(difficulty.CircleSize) || 4)));
    const timingPoints = (sections.get("TimingPoints") || [])
      .map((line) => line.split(","))
      .filter((parts) => Number(parts[1]) > 0 && Number(parts[6]) === 1)
      .map((parts) => ({
        time: Number(parts[0]) / 1000,
        beatLength: Number(parts[1]) / 1000,
        meter: Math.max(1, Number(parts[2]) || 4)
      }))
      .sort((a, b) => a.time - b.time);
    if (!timingPoints.length) timingPoints.push({ time: 0, beatLength: 0.5, meter: 4 });

    timingPoints[0].beat = timingPoints[0].time / timingPoints[0].beatLength;
    for (let index = 1; index < timingPoints.length; index++) {
      const previous = timingPoints[index - 1];
      const point = timingPoints[index];
      point.beat = previous.beat + (point.time - previous.time) / previous.beatLength;
    }

    function secondsToBeat(seconds) {
      let point = timingPoints[0];
      for (const candidate of timingPoints) {
        if (candidate.time > seconds) break;
        point = candidate;
      }
      return point.beat + (seconds - point.time) / point.beatLength;
    }

    function beatToSeconds(beat) {
      let point = timingPoints[0];
      for (const candidate of timingPoints) {
        if (candidate.beat > beat) break;
        point = candidate;
      }
      return point.time + (beat - point.beat) * point.beatLength;
    }

    const events = [];
    const playable = [];
    const longNotes = [];
    const wav = new Map();
    const keyEvents = [];
    const sampleObjects = new Map();
    function sampleObject(filename) {
      const path = unquote(filename);
      if (!path) return "osu-hit";
      const key = normalizePath(path);
      if (!sampleObjects.has(key)) {
        const object = `osu-sample-${sampleObjects.size}`;
        sampleObjects.set(key, object);
        wav.set(object, path);
      }
      return sampleObjects.get(key);
    }

    for (const line of sections.get("HitObjects") || []) {
      const parts = line.split(",");
      const x = Number(parts[0]);
      const time = Number(parts[2]) / 1000;
      const type = Number(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(time)) continue;
      const lane = Math.max(0, Math.min(lanes - 1, Math.floor(x * lanes / 512)));
      const beat = secondsToBeat(time);
      const hitSample = String(parts[5] || "").split(":");
      const customFilename = type & 128 ? hitSample.slice(5).join(":") : hitSample.slice(4).join(":");
      const object = sampleObject(customFilename);
      if (type & 128) {
        const endTime = Number(hitSample[0]) / 1000;
        const start = {
          time, beat, lane, measure: 0, channel: "51", object,
          longStart: true, osu: true
        };
        const end = {
          time: Math.max(time, endTime),
          beat: secondsToBeat(Math.max(time, endTime)),
          lane, measure: 0, channel: "51", object,
          longStart: false, longPair: start, osu: true
        };
        start.longPair = end;
        longNotes.push(start, end);
        events.push(start, end);
        if (customFilename) keyEvents.push(start);
      } else {
        const note = { time, beat, lane, measure: 0, channel: "11", object, osu: true };
        playable.push(note);
        events.push(note);
        if (customFilename) keyEvents.push(note);
      }
    }

    const hitNotes = [...playable, ...longNotes.filter((note) => note.longStart)]
      .sort((a, b) => a.time - b.time);
    const duration = Math.max(1, ...events.map((event) => event.time + 2));
    const maxBeat = Math.max(4, secondsToBeat(duration));
    const measureStarts = [];
    for (let beat = 0; beat <= maxBeat + 4; beat += 4) measureStarts.push(beat);
    for (const event of events) {
      event.measure = Math.max(0, upperBoundValue(measureStarts, event.beat) - 1);
    }

    const bgmEvents = [];
    if (general.AudioFilename && findFile(unquote(general.AudioFilename), "audio")) {
      wav.set("osu-audio", unquote(general.AudioFilename));
      const bgm = { time: 0, beat: 0, measure: 0, channel: "01", object: "osu-audio", osu: true };
      events.push(bgm);
      bgmEvents.push(bgm);
    }

    const bmp = new Map();
    const bgaEvents = [];
    for (const line of sections.get("Events") || []) {
      const parts = line.match(/(?:[^,"]+|"[^"]*")+/g) || [];
      if (parts[0] === "0" && parts[2]) {
        bmp.set("osu-bg", unquote(parts[2]));
        bgaEvents.push({ time: 0, beat: 0, measure: 0, channel: "04", object: "osu-bg", osu: true });
        break;
      }
    }

    const stars = await calculateOsuStars(bytes);
    const bpmChanges = timingPoints.map((point) => ({
      time: point.time,
      beat: point.beat,
      bpm: 60 / point.beatLength
    }));
    const version = metadata.Version || "osu!mania";
    return {
      name,
      header: {
        TITLE: metadata.TitleUnicode || metadata.Title || name,
        ARTIST: metadata.ArtistUnicode || metadata.Artist || "",
        SUBARTIST: metadata.Creator ? `mapped by ${metadata.Creator}` : "",
        GENRE: "osu!mania",
        PLAYLEVEL: Number.isFinite(stars) ? stars.toFixed(2) + "★" : "--",
        BPM: String(bpmChanges[0]?.bpm || 120),
        DIFFICULTY: "0",
        OSU_VERSION: version
      },
      base: "osu!",
      wav,
      bmp,
      events: events.sort((a, b) => a.time - b.time),
      playable,
      longNotes,
      bpmChanges,
      duration,
      lanes,
      hasScratch: false,
      beatToSeconds,
      secondsToBeat,
      measureStarts,
      hitNotes,
      displayNotes: [...playable, ...longNotes].sort((a, b) => a.time - b.time),
      bgmEvents,
      keyEvents: keyEvents.sort((a, b) => a.time - b.time),
      bgaEvents,
      layerEvents: [],
      poorEvents: [],
      noteCount: hitNotes.length,
      format: "osu",
      stars
    };
  }

  function lowerBoundTime(items, time) {
    let low = 0, high = items.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (items[middle].time < time) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function upperBoundTime(items, time) {
    let low = 0, high = items.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (items[middle].time <= time) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function noteSide(event) {
    return event.channel[0] === "2" || event.channel[0] === "6" ? 1 : 0;
  }

  function createFixedMapping(mod) {
    if (mod === "mirror") return [...KEY_CHANNELS].reverse();
    if (mod === "random") return shuffle(KEY_CHANNELS);
    if (mod === "rrandom") {
      const offset = 1 + Math.floor(Math.random() * (KEY_CHANNELS.length - 1));
      return KEY_CHANNELS.map((_, index) => KEY_CHANNELS[(index + offset) % KEY_CHANNELS.length]);
    }
    return [...KEY_CHANNELS];
  }

  function applyLaneMod() {
    const sideCount = state.chart?.lanes === 16 ? 2 : 1;
    state.laneMappings = Array.from({ length: sideCount }, () => createFixedMapping(state.laneMod));
    if (!state.chart) {
      updateLaneArrangement();
      return;
    }

    if (state.chart.modeId === "maimai" || state.chart.modeId === "stepmania") {
      // Native lanes come directly from the chart and ignore BMS lane mods.
      updateLaneArrangement();
      return;
    }
    for (const note of state.chart.displayNotes) note.modKey = note.channel[1];

    if (state.laneMod === "srandom") {
      for (let side = 0; side < sideCount; side++) applySRandom(side);
    } else {
      for (const note of state.chart.displayNotes) {
        if (note.channel[1] === "6") continue;
        const sourceIndex = KEY_CHANNELS.indexOf(note.channel[1]);
        note.modKey = state.laneMappings[noteSide(note)][sourceIndex] || note.channel[1];
      }
    }

    state.hitNotes.clear();
    state.effects = [];
    updateLaneArrangement();
    draw(state.pausedAt);
    if (state.view === "inspector") renderInspector();
  }

  function applySRandom(side) {
    const notes = state.chart.displayNotes.filter((note) =>
      noteSide(note) === side && note.channel[1] !== "6"
    );
    const activeLongNotes = new Map();
    let index = 0;

    while (index < notes.length) {
      const time = notes[index].time;
      const group = [];
      while (index < notes.length && Math.abs(notes[index].time - time) < 0.000001) {
        group.push(notes[index++]);
      }

      for (const note of group.filter((item) => item.longStart === false)) {
        note.modKey = activeLongNotes.get(note.channel) || note.channel[1];
        activeLongNotes.delete(note.channel);
      }

      const occupied = new Set(activeLongNotes.values());
      const available = shuffle(KEY_CHANNELS.filter((key) => !occupied.has(key)));
      const starts = group.filter((item) => item.longStart !== false);
      for (let noteIndex = 0; noteIndex < starts.length; noteIndex++) {
        const note = starts[noteIndex];
        const target = available[noteIndex] || shuffle(KEY_CHANNELS)[0];
        note.modKey = target;
        if (note.longStart) activeLongNotes.set(note.channel, target);
      }
    }
  }

  function arrangementText(mapping) {
    const inverse = KEY_CHANNELS.map((target) => {
      const sourceIndex = mapping.indexOf(target);
      return sourceIndex >= 0 ? String(sourceIndex + 1) : "-";
    });
    return inverse.join(" ");
  }

  function sRandomArrangement(side, time) {
    if (!state.chart) return "no chart";
    const notes = state.chart.hitNotes;
    let index = lowerBoundTime(notes, time);

    while (index < notes.length && (noteSide(notes[index]) !== side || notes[index].channel[1] === "6")) {
      index++;
    }
    if (index >= notes.length) return "end";

    const nextTime = notes[index].time;
    const assignments = [];
    while (index < notes.length && Math.abs(notes[index].time - nextTime) < 0.000001) {
      const note = notes[index++];
      if (noteSide(note) !== side || note.channel[1] === "6") continue;
      const source = KEY_CHANNELS.indexOf(note.channel[1]) + 1;
      const target = KEY_CHANNELS.indexOf(note.modKey) + 1;
      assignments.push(`${source}>${target}`);
    }
    return assignments.join(" ") || "scratch";
  }

  function updateLaneArrangement(time = state.pausedAt) {
    const first = state.laneMappings[0] || KEY_CHANNELS;
    ui.laneArrangement1.value = state.laneMod === "srandom"
      ? sRandomArrangement(0, time)
      : arrangementText(first);
    const doublePlay = state.chart?.lanes === 16;
    ui.laneArrangement2.hidden = !doublePlay;
    ui.laneArrangement2Label.hidden = !doublePlay;
    if (doublePlay) {
      ui.laneArrangement2.value = state.laneMod === "srandom"
        ? sRandomArrangement(1, time)
        : arrangementText(state.laneMappings[1] || KEY_CHANNELS);
    }
    modButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mod === state.laneMod);
    });
  }

  function findFile(path, mediaType = "") {
    const target = normalizePath(path);
    if (state.files.has(target)) return state.files.get(target);

    const { basename, stem, extension } = splitFilename(target);
    const candidates = [...state.files.entries()].filter(([key]) => key.endsWith("/" + basename) || key === basename);
    if (candidates.length === 1) return candidates[0][1];

    const family = mediaType === "audio"
      ? AUDIO_EXTENSIONS
      : mediaType === "video"
        ? VIDEO_EXTENSIONS
        : mediaType === "image"
          ? IMAGE_EXTENSIONS
        : AUDIO_EXTENSIONS.has(extension)
          ? AUDIO_EXTENSIONS
          : VIDEO_EXTENSIONS.has(extension)
            ? VIDEO_EXTENSIONS
            : IMAGE_EXTENSIONS.has(extension)
              ? IMAGE_EXTENSIONS
            : null;
    if (!family) return null;

    const alternatives = [...state.files.entries()].filter(([key]) => {
      const candidate = splitFilename(key);
      return candidate.stem === stem && family.has(candidate.extension);
    });
    return alternatives.length === 1 ? alternatives[0][1] : null;
  }

  function supportsHevc() {
    return [
      'video/mp4; codecs="hvc1"',
      'video/mp4; codecs="hev1"'
    ].some((type) => ui.video.canPlayType(type) !== "");
  }

  function resetLoadedContent() {
    state.chart = null;
    clearMeasureGrid();
    syncViewVisibility();
    ui.startStatus.textContent = "Opening chart…";
    state.playbackJacket = null;
    stop();
    ui.select.replaceChildren();
    for (const control of [ui.select, ui.stop, ui.seek, ui.back, ui.forward]) control.disabled = true;
    for (const assetPromise of state.bgaAssets.values()) {
      assetPromise.then((asset) => {
        if (asset?.kind === "video") URL.revokeObjectURL(asset.url);
        if (asset?.kind === "image") asset.source?.close?.();
      }, () => { /* Failed loads have no asset to release. */ });
    }
    state.bgaAssets.clear();
    state.bgaBase = null;
    state.bgaLayer = null;
    state.files = new Map();
    state.charts = [];
  }

  async function loadCollectedFiles(files) {
    let importError = "";
    for (const [chartPath, file] of files) {
      if (!PlayerModes.find(file)) continue;
      if (state.files !== files) return;
      try {
        const parsed = await PlayerModes.parse(file, {
          chartPath, files,
          decodeText,
          parseBms: parseChart,
          parseBmson,
          parseOsu
        });
        const charts = Array.isArray(parsed) ? parsed : [parsed];
        if (state.files !== files) return;
        for (const chart of charts) if (chart) state.charts.push(chart);
      } catch (error) {
        console.error(file.name, error);
        importError = file.name + " · " + error.message;
      }
    }
    if (state.files !== files) return;
    finishChartImport(importError);
  }

  function finishChartImport(importError = "") {
    state.charts.sort((a, b) => a.name.localeCompare(b.name));
    ui.select.innerHTML = "";
    for (let index = 0; index < state.charts.length; index++) {
      const chart = state.charts[index];
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = chartSelectLabel(chart);
      option.title = chart.name;
      ui.select.append(option);
    }
    ui.select.disabled = !state.charts.length;
    ui.play.disabled = !state.charts.length;
    ui.stop.disabled = !state.charts.length;
    ui.seek.disabled = !state.charts.length;
    ui.back.disabled = !state.charts.length;
    ui.forward.disabled = !state.charts.length;
    if (state.charts.length) selectChart(0);
    else ui.startStatus.textContent = importError || "No readable charts found. Choose another folder or file.";
    ui.status.textContent = `${state.charts.length} chart(s), ${state.files.size} files loaded.`;
  }

  function chartSelectLabel(chart) {
    if (chart.mode?.selectLabel) return chart.mode.selectLabel(chart);
    const title = chart.header.TITLE || chart.name.replace(/\.(bms|bme|bmson|osu|ugc|sm|ssc)$/i, "");
    if (chart.format === "osu") {
      const rating = Number.isFinite(chart.stars) ? chart.stars.toFixed(2) : "--";
      const version = chart.header.OSU_VERSION || chart.name;
      return `SR ${rating} | ${chart.lanes}K | ${title} [${version}]`;
    }
    const level = chart.header.PLAYLEVEL || "--";
    const difficulty = currentChartDifficultyLabel(chart);
    const playSide = chart.lanes === 16 ? "DP" : "SP";
    return `LV ${level} | ${playSide} | ${title}${difficulty ? ` [${difficulty}]` : ""}`;
  }

  function currentChartDifficultyLabel(chart) {
    const difficulty = Number(chart.header.DIFFICULTY) || difficultyFromName(chart.name);
    return (DIFFICULTIES[difficulty] || [chart.header.CHARTNAME || ""])[0];
  }

  function chartArtistLabel(chart) {
    const artist = chart.header.ARTIST || "Unknown artist";
    const subartist = chart.header.SUBARTIST;
    return subartist ? `${artist} · ${subartist}` : artist;
  }

  function addRegularFile(files, file) {
    const relative = file.webkitRelativePath || file.name;
    const parts = relative.split("/");
    if (parts.length > 1) parts.shift();
    files.set(normalizePath(parts.join("/")), file);
  }

  async function addZipArchive(files, file, prefix = "") {
    const archive = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
    for (const [path, bytes] of Object.entries(archive)) {
      if (path.endsWith("/")) continue;
      const name = path.split("/").pop();
      files.set(prefix + normalizePath(path), new File([bytes], name || path));
    }
  }

  async function loadFiles(fileList) {
    if (!fileList?.length) return;
    resetLoadedContent();
    const files = state.files;
    for (const [index, file] of Array.from(fileList).entries()) {
      if (state.files !== files) return;
      ui.status.textContent = `Opening ${file.name}...`;
      try {
        // Multiple ADX songs can all place maidata.txt and track.ogg at their archive root.
        if (/\.adx(?:\.zip)?$/i.test(file.name)) await addZipArchive(files, file, "adx:" + index + "/");
        else if (/\.(osz|zip)$/i.test(file.name)) await addZipArchive(files, file);
        else addRegularFile(files, file);
      } catch (error) {
        console.error(file.name, error);
        ui.status.textContent = `Could not open ${file.name}.`;
      }
    }
    if (state.files === files) await loadCollectedFiles(files);
  }

  function selectChart(index) {
    const previousSong = state.chart?.songMedia;
    stop();
    state.chart = state.charts[index];
    state.pausedAt = -(state.chart.mode?.introDuration || 0);
    syncViewVisibility();
    if (state.view === "player") syncCanvasSize();
    ui.play.disabled = !state.chart;
    if (!previousSong || previousSong !== state.chart?.songMedia) {
      state.buffers.clear();
      state.stretchedBuffers.clear();
    }
    state.failedAudio.clear();
    state.missingAudio.clear();
    state.hitNotes.clear();
    state.effects = [];
    state.lastTime = 0;
    state.peakKps = 0;
    state.followedMeasure = -1;
    const c = state.chart;
    ui.title.textContent = c.header.TITLE || c.name;
    ui.artist.textContent = chartArtistLabel(c);
    ui.genre.textContent = c.header.GENRE || "VSRG";
    ui.difficulty.textContent = c.header.PLAYLEVEL || "--";
    ui.difficulty.classList.remove("osu-pill", "expert-plus");
    ui.difficulty.style.removeProperty("--level-bg");
    ui.difficulty.style.removeProperty("--star-text-color");
    if (c.mode?.difficultyStyle) {
      const levelStyle = c.mode.difficultyStyle(c);
      ui.difficulty.dataset.label = levelStyle[0] || "";
      ui.difficulty.style.setProperty("--level-color", levelStyle[1] || "#d5ff36");
    } else if (c.format === "osu") {
      const expertPlus = Number(c.stars) >= 6.5;
      ui.difficulty.dataset.label = "";
      ui.difficulty.classList.add("osu-pill");
      ui.difficulty.style.setProperty("--level-bg", osuStarColor(c.stars));
      ui.difficulty.style.setProperty("--star-text-color", expertPlus ? "#ffe45c" : "#05080b");
      ui.difficulty.style.setProperty("--level-color", expertPlus ? "#ffe45c" : "#05080b");
      ui.difficulty.classList.toggle("expert-plus", expertPlus);
    } else {
      const difficulty = Number(c.header.DIFFICULTY) || difficultyFromName(c.name);
      const levelStyle = DIFFICULTIES[difficulty] || ["CHART", "#d5ff36"];
      ui.difficulty.dataset.label = levelStyle[0];
      ui.difficulty.style.setProperty("--level-color", levelStyle[1]);
    }
    ui.notes.textContent = String(c.noteCount);
    ui.base.textContent = String(c.base);
    updateTempoDisplay(0);
    ui.time.textContent = `${formatTime(state.pausedAt)} / ${formatTime(playbackEndTime(c))}`;
    ui.seek.min = state.pausedAt < 0 ? String(Math.floor(state.pausedAt / playbackEndTime(c) * 1000)) : "0";
    ui.seek.value = ui.seek.min;
    const customField = Boolean(c.mode?.drawPlayfield);
    const ugc = c.modeId === "ugc";
    const mai = c.modeId === "maimai";
    ui.playerView.classList.toggle("mai-mode", mai);
    $("maiSettings").hidden = !mai;
    $("maiPlayfield").hidden = !mai;
    ui.bgaBlur.closest(".setting-group").hidden = mai;
    ui.maiBlur.disabled = mai && !chartHasBga(c);
    ui.keysounds.closest("label").querySelector("span").textContent = mai ? "Hitsounds" : "Keysounds";
    const issues = c.diagnostics || [];
    const diagnostics = $(ugc ? "susDiagnostics" : c.modeId === "stepmania" ? "smDiagnostics" : "maiDiagnostics");
    $("smDiagnostics").hidden = true;
    if (ugc) $("ugcSettingsTitle").textContent = c.format.toUpperCase();
    diagnostics.hidden = !issues.length;
    diagnostics.querySelector("summary").textContent = "Chart diagnostics (" + issues.length + ")";
    diagnostics.querySelector("ul").replaceChildren(...issues.slice(0, 100).map(message => {
      const li = document.createElement("li"); li.textContent = message; return li;
    }));
    ui.playerView.classList.toggle("ugc-mode", ugc);
    ui.ugcSettings.hidden = !ugc;
    ui.scrollMode.closest(".setting-group").hidden = ugc || mai;
    for (const control of [ui.columnWidth, ui.scratchWidth, ui.sudden, ui.laneArrangement1, ui.noteThickness]) {
      const row = control.closest("label, .sudden-control, .lane-arrangement");
      if (row) row.hidden = ugc || mai;
    }
    document.querySelectorAll(".mod-control, .inspector-mod-control").forEach((row) => { row.hidden = ugc || mai; });
    modButtons.forEach((button) => {
      button.disabled = customField;
    });
    ui.scratchWidth.disabled = customField;
    ui.scratchWidthValue.disabled = customField;
    ui.sudden.disabled = customField;
    ui.suddenAmount.disabled = customField || !state.suddenEnabled;
    ui.suddenAmountValue.disabled = customField || !state.suddenEnabled;
    if (ui.stepmaniaScrollDirection) {
      const stepmania = c.modeId === "stepmania";
      $("stepmaniaSpeedScripts").closest("label").hidden = !stepmania;
      $("stepmaniaScriptStatus").textContent = c.speedScripts?.length ? "1× preset" : "None";
      ui.scrollMode.querySelector('[value="iidx"]').textContent = stepmania ? "XMod (BPM / chart scroll)" : "IIDX Floating Hi-Speed";
      ui.scrollModeValue.title = stepmania ? "Beat-based scroll; chart speed scripts may override the multiplier" : "Green number (note visibility in milliseconds)";
      ui.stepmaniaScrollDirection.disabled = !stepmania;
      ui.stepmaniaScrollDirection.closest("label").hidden = !stepmania;
      ui.stepmaniaColumnSpacing.disabled = !stepmania;
      ui.stepmaniaColumnSpacing.closest("label").hidden = !stepmania;
    }
    updateScrollControls(false);
    applyLaneMod();
    updateNoteCounter(state.pausedAt);
    updateLiveStats(state.pausedAt);
    renderPlayerRadar();
    if (state.view === "inspector") renderInspector();
    state.playbackJacket = null;
    const jacketPath = c.modeId === "maimai" ? c.songMedia.cover : c.modeId === "ugc" ? c.jacket : "";
    if (jacketPath) {
      loadBgaAsset(jacketPath, false, true).then(asset => {
        if (state.chart !== c || asset?.kind !== "image") return;
        state.playbackJacket = asset.source;
        if (!state.playing) draw(state.pausedAt);
      }).catch(() => { /* The playback header also supports charts without a readable jacket. */ });
    }
    state.bgaPreloadPromise = preloadBgaAssets(c);
    updateBgaBackdropAvailability(c);
    updateBga(state.pausedAt);
    draw(state.pausedAt);
  }

  function bpmAt(time) {
    let bpm = Number(state.chart?.header.BPM) || 120;
    for (const change of state.chart?.bpmChanges || []) {
      if (change.time <= time) {
        bpm = change.bpm;
      } else {
        break;
      }
    }
    return bpm;
  }

  function difficultyFromName(name) {
    const value = name.toLowerCase();
    if (value.includes("leggendaria")) return 5;
    if (value.includes("another")) return 4;
    if (value.includes("hyper")) return 3;
    if (value.includes("normal")) return 2;
    if (value.includes("beginner")) return 1;
    return 0;
  }

  function currentDifficultyStyle() {
    const chart = state.chart;
    if (chart?.mode?.difficultyStyle) return chart.mode.difficultyStyle(chart);
    if (chart?.format === "osu") return [chart.header.OSU_VERSION || "osu!mania", osuStarColor(chart.stars)];
    const difficulty = Number(chart?.header.DIFFICULTY) || difficultyFromName(chart?.name || "");
    return DIFFICULTIES[difficulty] || ["CHART", "#d5ff36"];
  }

  function osuStarColor(stars) {
    const value = Number.isFinite(stars) ? stars : 0;

    const anchors = [
      [0, "#4aa8ff"], [1.99, "#4fc0ff"],
      [2, "#4fffb0"], [2.69, "#a7ff4f"],
      [2.7, "#f3f05a"], [3.99, "#ffe15c"],
      [4, "#ff8370"], [5.29, "#ff627b"],
      [5.3, "#d24bb2"], [6.49, "#ae63dc"],
      [6.5, "#6764df"], [7.7, "#18158e"], [9, "#05050d"]
    ];
    let lower = anchors[0], upper = anchors[anchors.length - 1];
    for (let index = 1; index < anchors.length; index++) {
      if (value <= anchors[index][0]) {
        lower = anchors[index - 1];
        upper = anchors[index];
        break;
      }
    }
    const ratio = Math.max(0, Math.min(1, (value - lower[0]) / Math.max(0.001, upper[0] - lower[0])));
    const rgb = [1, 3, 5].map((offset) => Math.round(
      parseInt(lower[1].slice(offset, offset + 2), 16)
      + (parseInt(upper[1].slice(offset, offset + 2), 16) - parseInt(lower[1].slice(offset, offset + 2), 16)) * ratio
    ));
    return `rgb(${rgb.join(",")})`;
  }

  function playbackSpeed() {
    return state.playbackRate;
  }

  function chartTimeNow(rate = playbackSpeed()) {
    if (!state.chart) return 0;
    if (!state.playing || !state.audio) return state.pausedAt;
    const elapsed = state.audio.currentTime - state.startAt;
    // Before song zero the intro runs in real seconds regardless of song speed.
    return elapsed < 0 ? Math.max(-(state.chart.mode?.introDuration || 0), elapsed) : elapsed * rate;
  }

  function setPlaybackRate(percent) {
    if (!Number.isFinite(Number(percent))) return;
    const previousRate = playbackSpeed();
    const endTime = playbackEndTime();
    const liveTime = state.chart
      ? Math.max(-(state.chart.mode?.introDuration || 0), Math.min(endTime - 0.01, chartTimeNow(previousRate)))
      : chartTimeNow(previousRate);
    const clamped = clamp(Number(percent), 50, 200);
    state.playbackRate = clamped / 100;
    ui.songSpeed.value = String(clamped);
    ui.songSpeedValue.value = String(clamped);
    if (previousRate !== playbackSpeed() && (state.playing || state.starting)) {
      // Rebuild both the audio schedule and clock together, including while
      // dragging the slider. An old-rate source must never accompany a new clock.
      void seekTo(liveTime);
    }
    updateTempoDisplay(liveTime);
  }

  function playbackEndTime(chart = state.chart) {
    return Math.max(chart?.duration || 0, chart?.playbackEnd || 0, chart?.mode?.resultEnd?.(chart) || 0);
  }

  function hiSpeed() {
    return Number(ui.speed.value) / 100;
  }

  function visibleLaneFraction() {
    return state.suddenEnabled ? 1 - Number(ui.suddenAmount.value) / 100 : 1;
  }

  function greenNumber(time = state.pausedAt) {
    if (!state.chart) return 0;
    const effectiveBpm = bpmAt(time) * playbackSpeed();
    return IIDX_GREEN_NUMBER_BASE / (effectiveBpm * hiSpeed()) * visibleLaneFraction();
  }

  function updateTempoDisplay(time = state.pausedAt) {
    if (!state.chart) return;
    const effectiveBpm = bpmAt(time) * playbackSpeed();
    ui.bpm.textContent = formatBpm(effectiveBpm);
    if (state.chart.modeId !== "ugc" && ui.scrollMode.value === "iidx") {
      ui.scrollModeValue.value = state.chart.modeId === "stepmania" ? "× BPM" : String(Math.round(greenNumber(time)));
    }
  }

  function formatBpm(value) {
    const bpm = Number(value);
    if (!Number.isFinite(bpm)) return "--";
    if (Math.abs(bpm - Math.round(bpm)) < 0.01) return String(Math.round(bpm));
    return bpm.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function unsupportedMediaHint(files) {
    const blocked = [...files].filter((name) => BROWSER_UNSUPPORTED_MEDIA_EXTENSIONS.has(splitFilename(name.toLowerCase()).extension));
    if (!blocked.length) return "";
    return ` ${blocked.slice(0, 3).join(", ")} use Windows Media codecs, which this browser cannot decode directly. Convert them to WAV/OGG/MP3/WebM or add a transcoding step.`;
  }

  async function getAudioBuffer(object) {
    if (state.buffers.has(object)) return state.buffers.get(object);
    const generated = state.chart.mode?.synthesizeSound?.(state.audio, object);
    if (generated) {
      state.buffers.set(object, generated);
      return generated;
    }
    const path = state.chart.wav.get(object);
    const file = path ? findFile(path, "audio") : null;
    if (!file) {
      if (path) state.missingAudio.add(path);
      return null;
    }
    const promise = file.arrayBuffer()
      .then((data) => state.audio.decodeAudioData(data.slice(0)))
      .catch((error) => {
        state.failedAudio.add(file.name);
        console.warn(`Could not decode audio file: ${file.name}`, error);
        return null;
      });
    state.buffers.set(object, promise);
    return promise;
  }

  async function updatePlaybackEnd() {
    const chart = state.chart;
    if (!chart || !state.audio) return;
    const lastCue = new Map();
    const events = [...chart.bgmEvents];
    if (ui.keysounds.checked) {
      for (const event of chart.keyEvents) {
        if (!event.maiSound) events.push(event);
        else if (!event.loop) lastCue.set(event.object, event);
      }
    }
    events.push(...lastCue.values());
    let end = chart.duration;
    for (const event of events) {
      const buffer = await getAudioBuffer(event.object);
      if (state.chart !== chart) return;
      if (!buffer) continue;
      const offset = Math.max(0, Number(event.audioOffset) || 0);
      const remaining = Math.max(0, buffer.duration - offset);
      const duration = Number(event.audioDuration) > 0
        ? Math.min(Number(event.audioDuration), remaining)
        : remaining;
      end = Math.max(end, event.time + duration * (event.maiSound ? playbackSpeed() : 1));
    }
    chart.playbackEnd = end;
    if (chart.mode?.introDuration) ui.seek.min = String(Math.floor(-chart.mode.introDuration / playbackEndTime(chart) * 1000));
  }

  async function getPlaybackBuffer(object, fixedPitch = false) {
    const chart = state.chart;
    const speed = playbackSpeed();
    const changesPitch = ui.pitchWithSpeed.checked;
    const buffer = await getAudioBuffer(object);
    if (state.chart !== chart || speed !== playbackSpeed() || changesPitch !== ui.pitchWithSpeed.checked) return null;
    if (!buffer || fixedPitch || changesPitch || Math.abs(speed - 1) < 0.001) return buffer;

    const key = `${object}:${speed.toFixed(3)}`;
    if (state.stretchedBuffers.has(key)) return state.stretchedBuffers.get(key);
    const promise = Promise.resolve().then(() => stretchAudioBuffer(buffer, speed));
    state.stretchedBuffers.set(key, promise);
    return promise;
  }

  function stretchAudioBuffer(buffer, speed, audio = state.audio) {
    // Center overlap-add windows on the timeline. Boundary windows are partial
    // instead of being discarded, so short keysounds and the final tail survive.
    const windowSize = Math.min(2048, Math.max(2, buffer.length));
    const synthesisHop = Math.max(1, Math.floor(windowSize / 4));
    const halfWindow = Math.floor(windowSize / 2);
    const outputLength = Math.max(1, Math.ceil(buffer.length / speed));
    const output = audio.createBuffer(buffer.numberOfChannels, outputLength, buffer.sampleRate);
    const weights = new Float32Array(outputLength);
    const window = new Float32Array(windowSize);

    for (let index = 0; index < windowSize; index++) {
      window[index] = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (windowSize - 1));
    }

    for (let outputCenter = 0; outputCenter < outputLength + halfWindow; outputCenter += synthesisHop) {
      const inputStart = Math.round(outputCenter * speed) - halfWindow;
      const outputStart = outputCenter - halfWindow;
      const first = Math.max(0, -inputStart, -outputStart);
      const last = Math.min(windowSize, buffer.length - inputStart, outputLength - outputStart);
      for (let sample = first; sample < last; sample++) {
        weights[outputStart + sample] += window[sample];
      }
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const input = buffer.getChannelData(channel);
        const target = output.getChannelData(channel);
        for (let sample = first; sample < last; sample++) {
          target[outputStart + sample] += input[inputStart + sample] * window[sample];
        }
      }
    }

    for (let channel = 0; channel < output.numberOfChannels; channel++) {
      const target = output.getChannelData(channel);
      for (let sample = 0; sample < target.length; sample++) {
        if (weights[sample] > 1e-8) {
          target[sample] /= weights[sample];
        } else {
          // A one/two-sample clip (or an uncovered rounded boundary) has no
          // usable Hann overlap. Retain its sample rather than insert silence.
          target[sample] = buffer.getChannelData(channel)[Math.min(buffer.length - 1, Math.floor(sample * speed))];
        }
      }
    }
    return output;
  }

  async function preloadAudio(generation) {
    const bySound = new Map();
    for (const event of state.chart.events) {
      if (event.channel === "01" || /^[12][1-9]$/.test(event.channel) ||
          (/^[56][1-9]$/.test(event.channel) && event.longStart)) {
        bySound.set(event.object, event);
      }
    }
    const needed = Array.from(bySound.values());
    const batchSize = 24;
    ui.play.disabled = true;
    ui.play.textContent = "…";

    for (let start = 0; start < needed.length; start += batchSize) {
      if (generation !== state.playGeneration) return false;
      const batch = needed.slice(start, start + batchSize);
      await Promise.all(batch.map(event => getPlaybackBuffer(event.object, event.maiSound)));
      if (generation !== state.playGeneration) return false;
      const loaded = Math.min(start + batch.length, needed.length);
      ui.status.textContent = `Loading audio: ${loaded} / ${needed.length}`;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (generation !== state.playGeneration) return false;
    if (state.missingAudio.size) {
      ui.status.textContent = `Missing audio: ${[...state.missingAudio].join(", ")}. Open the chart together with its media files or select its folder.`;
    } else if (state.failedAudio.size) {
      ui.status.textContent = `${state.failedAudio.size} audio file(s) could not be decoded by this browser.${unsupportedMediaHint(state.failedAudio)}`;
    } else {
      ui.status.textContent = `${needed.length} audio files loaded. Starting playback.`;
    }
    await updatePlaybackEnd();
    return generation === state.playGeneration;
  }

  function startAudioEvent(event, buffer, generation, speed, changesPitch) {
    if (!buffer || generation !== state.playGeneration || !state.playing) return;
    const sourceRate = changesPitch && !event.maiSound ? speed : 1;
    const divisor = changesPitch || event.maiSound ? 1 : speed;
    const scheduledTime = state.startAt + event.time / speed;
    const when = Math.max(state.audio.currentTime, scheduledTime);
    const elapsed = Math.max(0, when - scheduledTime) * sourceRate;
    const sourceOffset = Math.max(0, Number(event.audioOffset) || 0) / divisor;
    const offset = event.loop ? elapsed % buffer.duration : sourceOffset + elapsed;
    const duration = Number(event.audioDuration) / divisor;
    const remaining = event.loop ? event.audioDuration / speed - elapsed
      : Math.min(buffer.duration - offset, duration > 0 ? duration - elapsed : Infinity);
    // A late decode/seek skips elapsed audio instead of replaying it out of sync.
    if (offset < 0 || remaining <= 0) return;
    const source = state.audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = sourceRate;
    source.loop = Boolean(event.loop);
    if (event.maiSound && !state.maiFxGain) {
      state.maiFxGain = state.audio.createGain();
      state.maiFxGain.gain.value = 0.75;
      state.maiFxGain.connect(state.gain);
    }
    source.connect(event.maiSound ? state.maiFxGain : state.gain);
    source.onended = () => {
      source.disconnect();
      const index = state.sources.indexOf(source);
      if (index >= 0) state.sources.splice(index, 1);
    };
    source.start(when, offset, remaining);
    state.sources.push(source);
  }

  function scheduleAudioWindow(from, until) {
    const generation = state.playGeneration;
    const speed = playbackSpeed();
    const changesPitch = ui.pitchWithSpeed.checked;
    const groups = ui.keysounds.checked
      ? [state.chart.bgmEvents, state.chart.keyEvents]
      : [state.chart.bgmEvents];
    for (const events of groups) {
      const start = lowerBoundTime(events, from - 0.1);
      const end = upperBoundTime(events, until);
      for (let index = start; index < end; index++) {
        const event = events[index];
        if (state.scheduled.has(event) || (event.maiSound && event.time < state.audioStartChartTime)) continue;
        state.scheduled.add(event);
        getPlaybackBuffer(event.object, event.maiSound).then((buffer) => {
          startAudioEvent(event, buffer, generation, speed, changesPitch);
        });
      }
    }
  }

  async function resumeActiveBgm(atTime, generation) {
    const speed = playbackSpeed();
    const changesPitch = ui.pitchWithSpeed.checked;
    const pastBgm = state.chart.bgmEvents.slice(0, lowerBoundTime(state.chart.bgmEvents, atTime)).reverse();

    // Reserve the whole group before the first await; the normal scheduling
    // window overlaps the seek point and must not start the same BGM twice.
    if (ui.keysounds.checked && state.chart.sustainEvents) {
      for (const event of state.chart.sustainEvents) {
        if (event.time < atTime && atTime < event.time + event.audioDuration) pastBgm.unshift(event);
      }
    }
    const pending = pastBgm.filter((event) => !state.scheduled.has(event));
    for (const event of pending) state.scheduled.add(event);
    for (const event of pending) {
      const buffer = await getPlaybackBuffer(event.object, event.maiSound);
      if (generation !== state.playGeneration || !state.playing) return;
      startAudioEvent(event, buffer, generation, speed, changesPitch);
    }
  }

  function stopAudioSources() {
    for (const source of state.sources) {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    }
    state.sources = [];
    state.scheduled.clear();
  }

  async function play() {
    if (!state.chart || state.playing || state.starting) return;
    if (state.chart.mode?.resultEnd?.(state.chart) && state.pausedAt >= playbackEndTime()) stop();
    const generation = ++state.playGeneration;
    state.starting = true;
    try {
      state.audio ||= new AudioContext();
      if (!state.gain) {
        state.gain = state.audio.createGain();
        state.gain.connect(state.audio.destination);
      }
      state.gain.gain.value = Number(ui.volume.value);
      await state.audio.resume();
      if (generation !== state.playGeneration) return;
      const ready = await preloadAudio(generation);
      if (!ready || generation !== state.playGeneration) return;
      ui.time.textContent = `${formatTime(state.pausedAt)} / ${formatTime(playbackEndTime())}`;
      state.sources = [];
      state.scheduled.clear();
      state.hitNotes.clear();
      state.effects = [];
      state.lastTime = state.pausedAt;
      state.startAt = state.audio.currentTime - state.pausedAt / (state.pausedAt < 0 ? 1 : playbackSpeed());
      const offset = state.pausedAt;
      state.audioStartChartTime = offset;
      state.nextScheduleAt = offset;
      state.lastUiUpdate = 0;
      state.playing = true;
      state.starting = false;
      state.bgaBase = null;
      state.bgaLayer = null;
      ui.play.disabled = false;
      ui.play.textContent = "■";
      ui.play.title = "Pause";
      if (offset > 0) resumeActiveBgm(offset, generation);
      scheduleAudioWindow(offset, offset + 8);
      ui.status.textContent = state.missingAudio.size
        ? `Playback running with missing audio: ${[...state.missingAudio].join(", ")}.`
        : state.failedAudio.size
          ? `Playback running with ${state.failedAudio.size} unsupported audio file(s).${unsupportedMediaHint(state.failedAudio)}`
        : "Playback running.";
      tick();
    } catch (error) {
      if (generation === state.playGeneration) {
        state.playing = false;
        stopAudioSources();
        ui.status.textContent = `Playback could not start: ${error.message || error}`;
      }
    } finally {
      if (generation === state.playGeneration) {
        state.starting = false;
        ui.play.disabled = !state.chart;
        if (!state.playing) ui.play.textContent = "▶";
      }
    }
  }

  function pause(at = chartTimeNow()) {
    if (!state.playing && !state.starting) return;
    state.pausedAt = at;
    state.playGeneration += 1;
    stopAudioSources();
    state.playing = false;
    state.starting = false;
    cancelAnimationFrame(state.frame);
    ui.video.pause();
    ui.layerVideo.pause();
    ui.play.textContent = "▶";
    ui.play.disabled = !state.chart;
    ui.play.title = "Resume";
    ui.status.textContent = `Paused at ${formatTime(state.pausedAt)}.`;
    draw(state.pausedAt);
  }

  function stop() {
    state.playGeneration += 1;
    stopAudioSources();
    state.hitNotes.clear();
    state.effects = [];
    state.lastTime = 0;
    state.peakKps = 0;
    state.playing = false;
    state.starting = false;
    state.pausedAt = -(state.chart?.mode?.introDuration || 0);
    cancelAnimationFrame(state.frame);
    ui.play.textContent = "▶";
    ui.play.title = "Play";
    ui.play.disabled = !state.chart;
    updateNoteCounter(state.pausedAt);
    updateLiveStats(state.pausedAt);
    ui.seek.value = ui.seek.min || "0";
    ui.time.textContent = `${formatTime(state.pausedAt)} / ${formatTime(playbackEndTime())}`;
    updateTempoDisplay(0);
    ui.video.pause();
    ui.video.currentTime = 0;
    ui.layerVideo.pause();
    ui.layerVideo.currentTime = 0;
    state.bgaBase = null;
    state.bgaLayer = null;
    renderBgaFrame();
    draw(state.pausedAt);
    updateInspectorCurrent();
  }

  function tick(frameTime = 0) {
    if (!state.playing) return;
    const time = chartTimeNow();
    const endTime = playbackEndTime();
    if (time >= endTime) {
      if (state.chart.mode?.resultEnd?.(state.chart)) {
        pause(endTime);
        ui.play.title = "Replay";
        ui.seek.value = "1000";
        ui.time.textContent = formatTime(endTime) + " / " + formatTime(endTime);
        ui.status.textContent = "Autoplay complete.";
        updateNoteCounter(endTime);
        updateLiveStats(endTime);
        updateInspectorCurrent();
      } else stop();
      return;
    }
    state.pausedAt = time;
    if (time >= state.nextScheduleAt) {
      scheduleAudioWindow(time, time + 4);
      state.nextScheduleAt = time + 0.25 * playbackSpeed();
    }
    registerHits(state.lastTime, time);
    state.lastTime = time;
    updateBga(time);
    draw(time, frameTime);
    if (frameTime - state.lastUiUpdate >= 100) {
      updateNoteCounter(time);
      updateLiveStats(time);
      updateLaneArrangement(time);
      updateTempoDisplay(time);
      updateInspectorCurrent();
      ui.time.textContent = `${formatTime(time)} / ${formatTime(endTime)}`;
      if (!state.seeking) ui.seek.value = String(Math.round(time / endTime * 1000));
      state.lastUiUpdate = frameTime;
    }
    state.frame = requestAnimationFrame(tick);
  }

  function handleVisibilityChange() {
    if (!state.playing || !state.chart) return;

    const time = chartTimeNow();
    if (document.hidden) {
      // Background tabs throttle animation frames, so queue the remaining
      // keysounds while the page still has an active AudioContext.
      scheduleAudioWindow(time, state.chart.duration);
      return;
    }

    state.pausedAt = time;
    state.lastTime = time;
    updateBga(time);
    draw(time);
  }

  function updateBga(time) {
    updateBgaSlot("base", state.chart.bgaEvents, time);
    updateBgaSlot("layer", state.chart.layerEvents || [], time);
    renderBgaFrame();
  }

  function chartHasBga(chart) {
    return Boolean(chart && [...(chart.bgaEvents || []), ...(chart.layerEvents || [])].some((event) => chart.bmp.get(event.object)));
  }

  function updateBgaBackdropAvailability(chart = state.chart) {
    const available = chartHasBga(chart);
    ui.bgaCanvas.closest(".movie-stage").hidden = chart?.modeId === "ugc" && !available;
    ui.bgaBackdropToggle.hidden = !available;
    ui.bgaBackdropToggle.disabled = !available;
    if (!available && state.bgaBackdrop) setBgaBackdrop(false);
  }

  function updateBgaSlot(slotName, events, time) {
    const eventIndex = upperBoundTime(events, time) - 1;
    const event = eventIndex >= 0 ? events[eventIndex] : null;
    const path = event ? state.chart.bmp.get(event.object) : "";
    const current = slotName === "base" ? state.bgaBase : state.bgaLayer;
    if (!path) {
      current?.media?.pause();
      if (slotName === "base") {
        state.bgaBase = null;
        state.bgaWantedBase = "";
      } else {
        state.bgaLayer = null;
        state.bgaWantedLayer = "";
      }
      return;
    }
    if (current?.path === path) {
      if (current.kind === "video") syncBgaVideo(current, time);
      return;
    }
    if (slotName === "base") state.bgaWantedBase = path;
    else state.bgaWantedLayer = path;
    const chart = state.chart;
    loadBgaAsset(path, slotName === "layer", Boolean(event?.bmsonLayer)).then((asset) => {
      const wanted = slotName === "base" ? state.bgaWantedBase : state.bgaWantedLayer;
      if (!asset || wanted !== path || state.chart !== chart) return;
      if (asset.kind !== "video") current?.media?.pause();
      const slot = { ...asset, path, eventTime: event.time, mediaOffset: event.mediaOffset || 0 };
      if (slotName === "base") state.bgaBase = slot;
      else state.bgaLayer = slot;
      state.bgaBackdropLastUpdate = -Infinity;
      if (slot.kind === "video") {
        const media = slotName === "base" ? ui.video : ui.layerVideo;
        slot.media = media;
        media.dataset.sourcePath = path;
        if (media.getAttribute("src") !== slot.url) media.src = slot.url;
        media.playbackRate = playbackSpeed();
        media.preservesPitch = !ui.pitchWithSpeed.checked;
        media.currentTime = Math.max(0, time - event.time + slot.mediaOffset);
        if (state.playing) media.play().catch(() => {});
      }
      renderBgaFrame();
      if (!state.playing && chart.modeId === "maimai") draw(time);
    });
  }

  async function loadBgaAsset(path, isLayer, preserveAlpha) {
    const cacheKey = `${normalizePath(path)}:${isLayer && !preserveAlpha ? "keyed" : "normal"}`;
    if (state.bgaAssets.has(cacheKey)) return state.bgaAssets.get(cacheKey);
    const promise = (async () => {
      const extension = splitFilename(path).extension;
      if (VIDEO_EXTENSIONS.has(extension)) {
        const file = mediaCandidates(path, "video")[0];
        return file ? { kind: "video", url: URL.createObjectURL(file) } : null;
      }
      const file = findFile(path, "image");
      if (!file || !IMAGE_EXTENSIONS.has(splitFilename(file.name).extension.toLowerCase())) return null;
      let bitmap = await createImageBitmap(file);
      if (isLayer && !preserveAlpha) {
        const keyed = document.createElement("canvas");
        keyed.width = bitmap.width;
        keyed.height = bitmap.height;
        const keyedContext = keyed.getContext("2d", { willReadFrequently: true });
        keyedContext.drawImage(bitmap, 0, 0);
        const pixels = keyedContext.getImageData(0, 0, keyed.width, keyed.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          if (pixels.data[index] <= 2 && pixels.data[index + 1] <= 2 && pixels.data[index + 2] <= 2) {
            pixels.data[index + 3] = 0;
          }
        }
        keyedContext.putImageData(pixels, 0, 0);
        bitmap.close();
        bitmap = await createImageBitmap(keyed);
      }
      return { kind: "image", source: bitmap };
    })();
    state.bgaAssets.set(cacheKey, promise);
    return promise;
  }

  async function preloadBgaAssets(chart) {
    const requests = new Map();
    for (const event of chart.bgaEvents) {
      const path = chart.bmp.get(event.object);
      if (path) requests.set(`${path}:base`, [path, false, true]);
    }
    for (const event of chart.layerEvents || []) {
      const path = chart.bmp.get(event.object);
      if (path) requests.set(`${path}:layer:${Boolean(event.bmsonLayer)}`, [path, true, Boolean(event.bmsonLayer)]);
    }
    const assets = [...requests.values()];
    for (let start = 0; start < assets.length; start += 16) {
      await Promise.all(assets.slice(start, start + 16).map((args) => loadBgaAsset(...args)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  function syncBgaVideo(slot, time) {
    if (!slot.media) return;
    const elapsed = Math.max(0, time - slot.eventTime + (slot.mediaOffset || 0));
    const end = Number.isFinite(slot.media.duration) ? slot.media.duration : Infinity;
    const expected = Math.min(elapsed, end);
    if (Math.abs(slot.media.currentTime - expected) > 0.18) slot.media.currentTime = expected;
    slot.media.playbackRate = playbackSpeed();
    if (state.playing && elapsed < end && slot.media.paused) slot.media.play().catch(() => {});
  }

  function drawBgaSource(context, width, height, source, fit = "contain") {
    if (!source) return;
    const sourceWidth = source.videoWidth || source.width;
    const sourceHeight = source.videoHeight || source.height;
    if (!sourceWidth || !sourceHeight) return;
    const scale = fit === "cover"
      ? Math.max(width / sourceWidth, height / sourceHeight)
      : Math.min(width / sourceWidth, height / sourceHeight);
    const targetWidth = sourceWidth * scale;
    const targetHeight = sourceHeight * scale;
    context.drawImage(source, (width - targetWidth) / 2, (height - targetHeight) / 2, targetWidth, targetHeight);
  }

  function renderBgaFrame() {
    const rect = ui.bgaCanvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (ui.bgaCanvas.width !== width || ui.bgaCanvas.height !== height) {
      ui.bgaCanvas.width = width;
      ui.bgaCanvas.height = height;
    }
    bgaCtx.clearRect(0, 0, width, height);
    bgaCtx.fillStyle = "#000";
    bgaCtx.fillRect(0, 0, width, height);
    const baseSource = state.bgaBase?.kind === "video" ? state.bgaBase.media : state.bgaBase?.source;
    const layerSource = state.bgaLayer?.kind === "video" ? state.bgaLayer.media : state.bgaLayer?.source;
    drawBgaSource(bgaCtx, width, height, baseSource);
    drawBgaSource(bgaCtx, width, height, layerSource);
    ui.placeholder.style.display = baseSource || layerSource ? "none" : "grid";
  }

  function drawPlayfieldBgaBackdrop(width, height, frameTime = performance.now()) {
    const baseSource = state.bgaBase?.kind === "video" ? state.bgaBase.media : state.bgaBase?.source;
    const layerSource = state.bgaLayer?.kind === "video" ? state.bgaLayer.media : state.bgaLayer?.source;
    if (!state.bgaBackdrop || (!baseSource && !layerSource)) return false;
    const scale = 0.25;
    const lowWidth = Math.max(160, Math.round(width * scale));
    const lowHeight = Math.max(120, Math.round(height * scale));
    const resized = backdropFrameCanvas.width !== Math.round(width) || backdropFrameCanvas.height !== Math.round(height);
    const hasVideo = state.bgaBase?.kind === "video" || state.bgaLayer?.kind === "video";
    const changed = baseSource !== state.backdropBaseSource || layerSource !== state.backdropLayerSource;
    const dirty = state.bgaBackdropLastUpdate === -Infinity;
    const shouldRefresh = resized || dirty || ((hasVideo || changed) && frameTime - state.bgaBackdropLastUpdate >= 66);
    if (shouldRefresh && (backdropCanvas.width !== lowWidth || backdropCanvas.height !== lowHeight)) {
      backdropCanvas.width = lowWidth;
      backdropCanvas.height = lowHeight;
    }
    if (shouldRefresh) {
      if (resized) {
        backdropFrameCanvas.width = Math.round(width);
        backdropFrameCanvas.height = Math.round(height);
      }
      backdropCtx.clearRect(0, 0, lowWidth, lowHeight);
      backdropCtx.fillStyle = "#000";
      backdropCtx.fillRect(0, 0, lowWidth, lowHeight);
      const mai = state.chart?.modeId === "maimai";
      const blur = mai ? Number(ui.maiBlur.value) * scale : Number(ui.bgaBlur.value) || 0;
      backdropCtx.filter = blur > 0 ? `blur(${blur}px) saturate(1.08)` : "saturate(1.08)";
      drawBgaSource(backdropCtx, lowWidth, lowHeight, baseSource, "cover");
      drawBgaSource(backdropCtx, lowWidth, lowHeight, layerSource, "cover");
      backdropCtx.filter = "none";
      backdropFrameCtx.imageSmoothingEnabled = true;
      backdropFrameCtx.drawImage(backdropCanvas, 0, 0, width, height);
      const darkness = Number(mai ? ui.maiDarkness.value : ui.bgaDarkness.value) / 100;
      backdropFrameCtx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
      backdropFrameCtx.fillRect(0, 0, width, height);
      state.backdropBaseSource = baseSource;
      state.backdropLayerSource = layerSource;
      state.bgaBackdropLastUpdate = frameTime;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(backdropFrameCanvas, 0, 0, width, height);
    return true;
  }

  async function seekTo(time) {
    if (!state.chart) return;
    const endTime = playbackEndTime();
    const resultEnd = state.chart.mode?.resultEnd?.(state.chart);
    const target = Math.max(-(state.chart.mode?.introDuration || 0), Math.min(resultEnd ? endTime : endTime - 0.01, time));
    const resume = state.playing || state.starting;
    state.playGeneration += 1;
    cancelAnimationFrame(state.frame);
    stopAudioSources();
    state.hitNotes.clear();
    state.effects = [];
    state.pausedAt = target;
    state.lastTime = target;
    state.playing = false;
    state.starting = false;
    updateNoteCounter(target);
    updateLiveStats(target);
    updateLaneArrangement(target);
    updateInspectorCurrent();
    ui.time.textContent = `${formatTime(target)} / ${formatTime(endTime)}`;
    ui.seek.value = String(Math.round(target / endTime * 1000));
    ui.video.pause();
    ui.layerVideo.pause();
    state.bgaBase = null;
    state.bgaLayer = null;
    updateBga(target);
    if (resultEnd) {
      ui.play.title = target === endTime ? "Replay" : "Play";
      ui.play.textContent = "▶";
      ui.play.disabled = false;
    }
    if (resume && target < endTime) await play();
    else draw(target);
  }

  function laneFor(note, lanes) {
    if (typeof note !== "string" && Number.isInteger(note.lane)) return note.modLane ?? note.lane;
    if (typeof note !== "string" && Number.isInteger(note.stepLane)) return note.stepLane;
    const channel = typeof note === "string" ? note : note.channel;
    const side = Number(channel[0]);
    const key = typeof note === "string" ? channel[1] : (note.modKey || channel[1]);
    const local = LANE_ORDER[key] ?? 0;
    if (lanes === 8) return local;
    if (side === 2 || side === 6) return 8 + (local === 0 ? 7 : local - 1);
    return local;
  }

  function laneGeometry(lanes, fieldWidth, left, hasScratch = true) {
    const scratchRatio = Number(ui.scratchWidth.value) / 100;
    const scratchCount = hasScratch ? (lanes === 16 ? 2 : 1) : 0;
    const regularCount = lanes - scratchCount;
    const unit = fieldWidth / (regularCount + scratchCount * scratchRatio);
    const geometry = [];
    let cursor = left;
    for (let lane = 0; lane < lanes; lane++) {
      const scratch = hasScratch && (lane === 0 || (lanes === 16 && lane === 15));
      const width = unit * (scratch ? scratchRatio : 1);
      geometry.push({ x: cursor, width, scratch });
      cursor += width;
    }
    return geometry;
  }

  function isWhiteKeyLane(lane, lanes, hasScratch = true) {
    if (!hasScratch) return lane % 2 === 0;
    const localLane = lanes === 16 && lane >= 8 ? lane - 7 : lane;
    return localLane % 2 === 1;
  }

  function drawLaneLightBar(column, effect, hitY, life) {
    const x = column.x;
    const width = Math.max(2, column.width);
    const color = effect.color || "#65d8ff";
    const beamHeight = Math.min(hitY, HIT_LIGHT_HEIGHT);
    const beamTop = hitY - beamHeight;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const columnFill = ctx.createLinearGradient(0, beamTop, 0, hitY);
    columnFill.addColorStop(0, color + "00");
    columnFill.addColorStop(0.2, color + "16");
    columnFill.addColorStop(0.52, color + "50");
    columnFill.addColorStop(0.78, color + "aa");
    columnFill.addColorStop(1, "#ffffff");
    ctx.globalAlpha = life * 0.66;
    ctx.fillStyle = columnFill;
    ctx.fillRect(x, beamTop, width, beamHeight);
    ctx.restore();
  }

  function drawBombEffect(column, effect, hitY, age, life, baseLaneWidth) {
    const center = column.x + column.width / 2;
    const laneX = column.x;
    const laneWidth = column.width;
    const progress = Math.max(0, Math.min(1, age / HIT_EFFECT_DURATION));
    const color = effect.color || "#65d8ff";
    const bombSize = Math.max(72, Math.min(132, baseLaneWidth * HIT_BOMB_SCALE));
    const radius = bombSize * (0.32 + progress * 0.55);
    const burstWidth = bombSize * (1.12 + progress * 0.44);
    const burstHeight = bombSize * (0.72 - progress * 0.12);
    const coreY = hitY;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = life;

    const horizontal = ctx.createRadialGradient(center, coreY, 0, center, coreY, burstWidth * 0.58);
    horizontal.addColorStop(0, "#ffffff");
    horizontal.addColorStop(0.16, color);
    horizontal.addColorStop(0.42, color + "88");
    horizontal.addColorStop(1, color + "00");
    ctx.save();
    ctx.translate(center, coreY);
    ctx.scale(1.65, 0.42);
    ctx.fillStyle = horizontal;
    ctx.beginPath();
    ctx.arc(0, 0, burstWidth * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const vertical = ctx.createLinearGradient(0, coreY - burstHeight, 0, hitY + 8);
    vertical.addColorStop(0, color + "00");
    vertical.addColorStop(0.45, color + "77");
    vertical.addColorStop(0.78, "#ffffff");
    vertical.addColorStop(1, color + "66");
    ctx.globalAlpha = life * 0.82;
    ctx.fillStyle = vertical;
    ctx.fillRect(laneX, coreY - burstHeight, laneWidth, burstHeight + 12);

    const core = ctx.createRadialGradient(center, coreY, 0, center, coreY, radius);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.28, color);
    core.addColorStop(0.66, color + "55");
    core.addColorStop(1, color + "00");
    ctx.globalAlpha = life;
    ctx.fillStyle = core;
    ctx.save();
    ctx.translate(center, coreY);
    ctx.scale(Math.max(1, laneWidth / Math.max(1, radius * 1.15)), 0.78);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = life * (1 - progress) * 0.55;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, coreY, radius * (0.78 + progress * 0.5), 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = life * 0.6;
    ctx.strokeStyle = color + "aa";
    ctx.lineWidth = 2;
    for (let ray = 0; ray < 8; ray++) {
      const angle = -Math.PI / 2 + ray * Math.PI / 4 + progress * 0.18;
      const inner = radius * 0.45;
      const outer = radius * (1.25 + progress * 0.85) * (ray % 2 ? 0.78 : 1);
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * inner, coreY + Math.sin(angle) * inner);
      ctx.lineTo(center + Math.cos(angle) * outer, coreY + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHoldLaneEffect(column, color, hitY, time, startTime, baseLaneWidth) {
    const age = Math.max(0, time - startTime);
    const pulse = 0.86 + Math.sin(age * 12) * 0.14;
    const center = column.x + column.width / 2;
    const coreY = hitY;
    const bombSize = Math.max(72, Math.min(132, baseLaneWidth * HIT_BOMB_SCALE));
    const radius = bombSize * (0.33 + pulse * 0.05);
    const rotation = age * 4.6;
    const beamHeight = Math.min(hitY, HIT_LIGHT_HEIGHT * 0.86);
    const beamTop = hitY - beamHeight;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createLinearGradient(0, beamTop, 0, hitY);
    glow.addColorStop(0, color + "00");
    glow.addColorStop(0.36, color + "14");
    glow.addColorStop(0.75, color + "62");
    glow.addColorStop(1, "#ffffff");
    ctx.globalAlpha = 0.28 * pulse;
    ctx.fillStyle = glow;
    ctx.fillRect(column.x, beamTop, column.width, beamHeight);

    const halo = ctx.createRadialGradient(center, coreY, 0, center, coreY, radius * 1.65);
    halo.addColorStop(0, "#ffffff");
    halo.addColorStop(0.22, color);
    halo.addColorStop(0.62, color + "66");
    halo.addColorStop(1, color + "00");
    ctx.globalAlpha = 0.58 * pulse;
    ctx.fillStyle = halo;
    ctx.save();
    ctx.translate(center, coreY);
    ctx.scale(Math.max(1, column.width / Math.max(1, radius * 1.08)), 0.72);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const core = ctx.createRadialGradient(center, coreY, 0, center, coreY, radius * 0.62);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.34, color);
    core.addColorStop(1, color + "00");
    ctx.globalAlpha = 0.72 * pulse;
    ctx.fillStyle = core;
    ctx.fillRect(column.x, coreY - radius * 0.42, column.width, radius * 0.72);

    ctx.globalAlpha = 0.42 * pulse;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center, coreY, radius * (0.82 + Math.sin(age * 9) * 0.06), 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.52 * pulse;
    ctx.strokeStyle = color + "b8";
    ctx.lineWidth = 2;
    for (let ray = 0; ray < 8; ray++) {
      const angle = rotation + ray * Math.PI / 4;
      const inner = radius * 0.48;
      const outer = radius * (1.38 + (ray % 2) * 0.22);
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * inner, coreY + Math.sin(angle) * inner);
      ctx.lineTo(center + Math.cos(angle) * outer, coreY + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  function hitEffectColor(note, lane, chart) {
    const scratch = chart.hasScratch !== false && (lane === 0 || (chart.lanes === 16 && lane === 15));
    if (scratch) return "#ffcf55";
    return isWhiteKeyLane(lane, chart.lanes, chart.hasScratch !== false) ? "#dcecff" : "#6f8cff";
  }

  function registerHits(previous, time) {
    // The circular renderer reconstructs hit effects directly from chart time.
    if (!state.chart || state.chart.modeId === "maimai") return;
    const notes = state.chart.hitNotes;
    const start = upperBoundTime(notes, previous);
    const end = upperBoundTime(notes, time);
    if (state.chart.modeId === "stepmania") {
      // One receptor per lane can flash in a frame, even on a wall of chords.
      if (!ui.hitEffects.checked) return;
      const lanes = new Set();
      for (let index = end - 1; index >= start && lanes.size < state.chart.lanes; index--) {
        const note = notes[index];
        if (lanes.has(note.stepLane)) continue;
        lanes.add(note.stepLane);
        state.effects.push({ lane: note.stepLane, started: note.time });
      }
      return;
    }
    for (let index = start; index < end; index++) {
      const note = notes[index];
      if (state.hitNotes.has(note)) continue;
      state.hitNotes.add(note);
      if (ui.hitEffects.checked) {
        const lane = laneFor(note, state.chart.lanes);
        state.effects.push({
          lane,
          started: time,
          color: hitEffectColor(note, lane, state.chart)
        });
      }
    }
  }

  function updateNoteCounter(time) {
    if (!state.chart) {
      ui.judgeText.textContent = "0000 / 0000";
      return;
    }
    const notes = state.chart.hitNotes;
    const passed = upperBoundTime(notes, time);
    const total = Math.max(state.chart.noteCount, notes.length);
    const width = Math.max(4, String(total).length);
    ui.judgeText.textContent = `${String(passed).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
  }

  function updateLiveStats(time) {
    if (!state.chart) {
      ui.currentKps.textContent = "0.0";
      ui.peakKps.textContent = "0.0";
      renderPlayerRadar();
      return;
    }

    const notes = state.chart.hitNotes;
    const realSecondInChartTime = playbackSpeed();
    const kpsStart = lowerBoundTime(notes, Math.max(0, time - realSecondInChartTime));
    const kpsEnd = upperBoundTime(notes, time);
    const currentKps = kpsEnd - kpsStart;
    if (state.playing) state.peakKps = Math.max(state.peakKps, currentKps);

    const densityWindow = 2 * playbackSpeed();
    const densityStart = lowerBoundTime(notes, Math.max(0, time - densityWindow));
    const densityEnd = upperBoundTime(notes, time);
    const density = (densityEnd - densityStart) / 2;

    ui.currentKps.textContent = currentKps.toFixed(1);
    ui.peakKps.textContent = state.peakKps.toFixed(1);
  }

  function syncViewVisibility() {
    const loaded = Boolean(state.chart);
    ui.startView.hidden = loaded;
    ui.viewTabs.hidden = !loaded;
    ui.chartControls.hidden = !loaded;
    ui.playerView.hidden = !loaded || state.view !== "player";
    ui.inspectorView.hidden = !loaded || state.view !== "inspector";
  }

  function switchView(view) {
    state.view = view === "inspector" ? "inspector" : "player";
    syncViewVisibility();
    viewButtons.forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (state.view === "inspector") renderInspector();
    else {
      syncCanvasSize();
      draw(state.pausedAt);
      renderBgaFrame();
    }
  }

  function setSidePanelCollapsed(collapsed) {
    state.sidePanelCollapsed = collapsed;
    ui.playerView.classList.toggle("side-collapsed", collapsed);
    ui.sidePanelToggle.setAttribute("aria-expanded", String(!collapsed));
    ui.sidePanelToggle.textContent = collapsed ? "Stats" : "Hide";
    ui.sidePanelToggle.title = collapsed ? "Show KPS and notes radar" : "Hide KPS and notes radar";
    requestAnimationFrame(() => {
      syncCanvasSize();
      draw(state.pausedAt);
      renderPlayerRadar();
    });
  }

  function setBgaBackdrop(enabled) {
    if (enabled && !chartHasBga(state.chart)) return;
    state.bgaBackdrop = enabled;
    state.bgaBackdropLastUpdate = -Infinity;
    ui.playerView.classList.toggle("bga-backdrop", enabled);
    ui.bgaBackdropToggle.classList.toggle("active", enabled);
    ui.bgaBackdropToggle.setAttribute("aria-pressed", String(enabled));
    ui.bgaBackdropToggle.title = enabled
      ? "Show BGA in side panel"
      : "Show BGA behind playfield";
    renderBgaFrame();
    requestAnimationFrame(() => {
      syncCanvasSize();
      draw(state.pausedAt);
    });
  }

  function invalidateBgaBackdrop() {
    state.bgaBackdropLastUpdate = -Infinity;
    draw(state.pausedAt);
  }

  function isAirOrScratch(chart, note) {
    if (chart.ugc) return ["a", "H", "S", "C"].includes(note.parentType || note.type);
    if (chart.modeId === "maimai") return Boolean(note.area);
    const lane = laneFor(note, chart.lanes);
    return chart.hasScratch !== false && (lane === 0 || (chart.lanes === 16 && lane === 15));
  }

  function chartAnalysis(chart) {
    const notes = chart.hitNotes;
    let peak = 0;
    let left = 0;
    for (let right = 0; right < notes.length; right++) {
      while (notes[left]?.time < notes[right].time - 1) left++;
      peak = Math.max(peak, right - left + 1);
    }
    const chords = new Map();
    const laneCounts = Array(chart.lanes + Number(chart.modeId === "maimai")).fill(0);
    let special = 0, maxChord = 0;
    for (const note of notes) {
      const key = note.beat.toFixed(6);
      chords.set(key, (chords.get(key) || 0) + 1);
      maxChord = Math.max(maxChord, chords.get(key));
      if (chart.ugc) {
        for (let lane = Math.max(0, Math.floor(note.x)); lane < Math.min(chart.lanes, Math.ceil(note.x + note.width)); lane++) laneCounts[lane]++;
      } else if (chart.modeId === "maimai" && note.area === "C") laneCounts[8]++;
      else laneCounts[laneFor(note, chart.lanes)]++;
      if (isAirOrScratch(chart, note)) special++;
    }
    const bpms = chart.bpmChanges.map((change) => change.bpm).filter(Number.isFinite);
    const chordSizes = [...chords.values()].filter((count) => count >= 2);
    const chordNotes = chordSizes.reduce((sum, count) => sum + count, 0);
    const chordExcess = chordSizes.reduce((sum, count) => sum + count - 1, 0);
    const chordRate = chordSizes.length / Math.max(1, chart.duration);
    const averageChordSize = chordSizes.length ? chordNotes / chordSizes.length : 0;
    const longCount = chart.longNotes.filter((note) => note.longStart).length;
    const averageNps = notes.length / Math.max(1, chart.duration);
    const bpmRatio = Math.max(...bpms) / Math.max(1, Math.min(...bpms));
    const soflanChanges = Math.max(0, chart.bpmChanges.length - 1);
    const chordRatio = chordExcess / Math.max(1, notes.length);
    const chordScore = 100 * (
      chordRatio / 0.22 * 0.55
      + chordRate / 1.2 * 0.3
      + Math.max(0, averageChordSize - 2) / 2 * 0.15
    );
    return {
      peak,
      maxChord,
      laneCounts,
      special,
      longNotes: longCount,
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
      radar: [
        Math.min(200, averageNps / 8 * 100),
        Math.min(200, peak / 18 * 100),
        Math.min(200, special / Math.max(1, notes.length) / 0.2 * 100),
        Math.min(200, ((Math.log2(Math.max(1, bpmRatio)) / 2) + soflanChanges / 24) * 100),
        Math.min(200, longCount / Math.max(1, notes.length) / 0.25 * 100),
        Math.min(200, chordScore)
      ]
    };
  }

  function renderInspector() {
    const chart = state.chart;
    if (!chart) return;
    const analysis = chartAnalysis(chart);
    ui.inspectorTitle.textContent = chart.header.TITLE || chart.name;
    if (chart.mode?.inspectorSubtitle) {
      ui.inspectorSubtitle.textContent = chart.mode.inspectorSubtitle(chart, chartArtistLabel(chart));
    } else {
      const modLabel = state.laneMod === "rrandom" ? "R-Random"
        : state.laneMod === "srandom" ? "S-Random"
          : state.laneMod[0].toUpperCase() + state.laneMod.slice(1);
      ui.inspectorSubtitle.textContent = `${chartArtistLabel(chart)} · ${chart.lanes === 16 ? "Double play" : "Single play"} · ${chart.measureStarts.length - 1} measures · ${modLabel}`;
    }
    ui.analysisNotes.textContent = String(chart.noteCount);
    ui.analysisPeak.textContent = analysis.peak.toFixed(1);
    ui.analysisChord.textContent = String(analysis.maxChord);
    $("analysisSpecialLabel").textContent = chart.ugc ? "AIR hits" : chart.modeId === "maimai" ? "Touch" : "Scratch";
    $("laneDistributionTitle").textContent = chart.ugc ? "Hits covering each lane" : "Lane distribution";
    $("maiLegend").hidden = chart.modeId !== "maimai";
    $("keyLegend").hidden = !!chart.ugc || chart.modeId === "maimai";
    $("ugcLegend").hidden = !chart.ugc;
    if (chart.ugc) {
      chart.mode.inspectorLegend($("ugcNoteSymbols"));
      $("ugcNoteDetail").textContent = "Point to or tap a note for details.";
    }
    ui.analysisScratch.textContent = String(analysis.special);
    ui.analysisLong.textContent = String(analysis.longNotes);
    ui.analysisBpm.textContent = analysis.minBpm === analysis.maxBpm
      ? String(analysis.minBpm)
      : `${analysis.minBpm}-${analysis.maxBpm}`;
    renderLaneDistribution(chart.ugc && ui.ugcMirror.checked ? analysis.laneCounts.reverse() : analysis.laneCounts);
    renderNotesRadar(ui.notesRadar, analysis.radar);
    renderMeasureGrid(chart);
  }

  function renderLaneDistribution(counts) {
    const maximum = Math.max(1, ...counts);
    ui.laneDistribution.replaceChildren();
    counts.forEach((count, lane) => {
      const row = document.createElement("div");
      row.className = "lane-stat";
      const label = document.createElement("span");
      label.textContent = state.chart?.modeId === "maimai" && lane === 8 ? "C" : state.chart?.hasScratch !== false && (lane === 0 || (counts.length === 16 && lane === 15))
        ? "SC"
        : String(state.chart?.hasScratch === false ? lane + 1 : counts.length === 16 && lane >= 8 ? lane - 7 : lane);
      const meter = document.createElement("span");
      meter.className = "lane-meter";
      const fill = document.createElement("i");
      fill.style.width = `${count / maximum * 100}%`;
      meter.append(fill);
      const value = document.createElement("b");
      value.textContent = String(count);
      row.append(label, meter, value);
      ui.laneDistribution.append(row);
    });
  }

  let densityCache;
  function renderDensityGraph(chart) {
    const canvas = ui.densityGraph;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const cssWidth = Math.max(1, Math.round(canvas.clientWidth));
    const cssHeight = Math.max(1, Math.round(canvas.clientHeight));
    const backingWidth = Math.round(cssWidth * pixelRatio);
    const backingHeight = Math.round(cssHeight * pixelRatio);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    const context = canvas.getContext("2d");
    if (densityCache?.chart === chart && densityCache.width === cssWidth &&
        densityCache.height === cssHeight && densityCache.ratio === pixelRatio) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(densityCache.image, 0, 0);
      drawDensityProgress(state.pausedAt);
      return;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const width = cssWidth;
    const height = cssHeight;
    const duration = Math.max(0.001, chart.duration || 0);
    const plotLeft = 28;
    const plotRight = width - 10;
    const plotTop = 8;
    const plotBottom = height - 20;
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotHeight = Math.max(1, plotBottom - plotTop);
    const bins = Math.min(
      Math.max(72, Math.ceil(duration / 0.9)),
      Math.max(72, Math.floor(plotWidth / 3.2))
    );
    const values = Array(bins).fill(0);
    const specialValues = Array(bins).fill(0);
    for (const note of chart.hitNotes) {
      const index = Math.min(bins - 1, Math.floor(note.time / duration * bins));
      values[index]++;
      if (isAirOrScratch(chart, note)) specialValues[index]++;
    }
    const maximum = Math.max(1, ...values);
    const sortedValues = values.filter((value) => value > 0).sort((a, b) => a - b);
    const middle = sortedValues.length / 2;
    const medianDensity = !sortedValues.length ? 0 : sortedValues.length % 2
      ? sortedValues[Math.floor(middle)]
      : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#101010";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#343a40";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line++) {
      const y = plotBottom - line / 4 * plotHeight;
      context.beginPath();
      context.moveTo(plotLeft, y);
      context.lineTo(plotRight, y);
      context.stroke();
    }
    for (let division = 0; division <= 10; division++) {
      const x = plotLeft + division / 10 * plotWidth;
      context.beginPath();
      context.moveTo(x, plotTop);
      context.lineTo(x, plotBottom);
      context.stroke();
    }
    const barWidth = Math.max(2, plotWidth / bins - 0.6);
    values.forEach((value, index) => {
      const x = plotLeft + index / bins * plotWidth;
      const barHeight = value / maximum * plotHeight;
      context.fillStyle = "rgba(150, 155, 154, .72)";
      context.fillRect(x, plotBottom - barHeight, barWidth, barHeight);
      if (specialValues[index]) {
        const specialHeight = specialValues[index] / maximum * plotHeight;
        context.fillStyle = chart.ugc ? "#8dff98" : "rgba(255, 82, 101, .9)";
        context.fillRect(x, plotBottom - specialHeight, barWidth, specialHeight);
      }
    });
    const medianY = plotBottom - medianDensity / maximum * plotHeight;
    context.strokeStyle = "rgba(255, 255, 255, .55)";
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(plotLeft, medianY);
    context.lineTo(plotRight, medianY);
    context.stroke();
    context.setLineDash([]);
    const bpmSteps = chart.bpmChanges
      .filter((change) => Number.isFinite(change.time) && Number.isFinite(change.bpm))
      .map((change) => ({ time: Math.max(0, Math.min(duration, change.time)), bpm: change.bpm * playbackSpeed() }))
      .sort((a, b) => a.time - b.time);
    if (!bpmSteps.length || bpmSteps[0].time > 0.001) bpmSteps.unshift({ time: 0, bpm: bpmAt(0) * playbackSpeed() });
    const bpmValues = bpmSteps.map((change) => change.bpm);
    const minimumBpm = Math.min(...bpmValues);
    const maximumBpm = Math.max(...bpmValues);
    const bpmToY = (bpm) => {
      if (Math.abs(maximumBpm - minimumBpm) < 0.001) return plotBottom - plotHeight * 0.72;
      const ratio = (bpm - minimumBpm) / (maximumBpm - minimumBpm);
      return plotBottom - (0.2 + ratio * 0.68) * plotHeight;
    };
    const timeToX = (time) => plotLeft + Math.max(0, Math.min(1, time / duration)) * plotWidth;
    context.strokeStyle = "#00f030";
    context.lineWidth = 2;
    context.beginPath();
    bpmSteps.forEach((change, index) => {
      const x = timeToX(change.time);
      const y = bpmToY(change.bpm);
      if (index === 0) context.moveTo(plotLeft, y);
      else {
        const previous = bpmSteps[index - 1];
        context.lineTo(x, bpmToY(previous.bpm));
        context.lineTo(x, y);
      }
      const nextX = timeToX(bpmSteps[index + 1]?.time ?? duration);
      context.lineTo(nextX, y);
    });
    context.stroke();
    context.font = "700 9px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#00f030";
    const labelBuckets = new Set();
    for (const change of bpmSteps) {
      const x = timeToX(change.time);
      const y = bpmToY(change.bpm);
      if (x < plotLeft + 2 || x > plotRight - 16) continue;
      const bucket = `${Math.round(x / 8)}:${formatBpm(change.bpm)}`;
      if (labelBuckets.has(bucket)) continue;
      labelBuckets.add(bucket);
      context.fillText(formatBpm(change.bpm), x + 2, Math.max(plotTop + 6, y - 7));
    }
    context.fillStyle = "rgba(255, 255, 255, .72)";
    context.fillText(medianDensity.toFixed(medianDensity % 1 ? 1 : 0), plotLeft + 3, medianY - 7);
    context.fillStyle = "#7d8790";
    context.textAlign = "right";
    context.fillText(String(maximum), plotLeft - 5, plotTop + 2);
    context.fillText("0", plotLeft - 5, plotBottom);
    context.textAlign = "left";
    context.fillText(formatTime(0), 0, height - 8);
    context.textAlign = "right";
    context.fillText(formatTime(duration), width - 1, height - 8);
    const image = document.createElement("canvas");
    image.width = backingWidth; image.height = backingHeight;
    image.getContext("2d").drawImage(canvas, 0, 0);
    densityCache = { chart, width, height, ratio: pixelRatio, image };
    drawDensityProgress(state.pausedAt);
  }

  function drawDensityProgress(time) {
    const chart = state.chart;
    if (!chart) return;
    const canvas = ui.densityGraph;
    const context = canvas.getContext("2d");
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const plotLeft = 28;
    const plotRight = width - 10;
    const plotTop = 8;
    const plotBottom = height - 20;
    const x = Math.max(plotLeft, Math.min(plotRight, plotLeft + time / Math.max(0.001, chart.duration) * (plotRight - plotLeft)));
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.strokeStyle = currentDifficultyStyle()[1];
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, plotTop);
    context.lineTo(x, plotBottom);
    context.stroke();
    context.fillStyle = currentDifficultyStyle()[1];
    context.beginPath();
    context.moveTo(x - 4, plotTop);
    context.lineTo(x + 4, plotTop);
    context.lineTo(x, plotTop + 6);
    context.closePath();
    context.fill();
    context.restore();
  }

  function renderPlayerRadar() {
    const chart = state.chart;
    const values = chart ? chartAnalysis(chart).radar : [0, 0, 0, 0, 0, 0];
    renderNotesRadar(ui.playerNotesRadar, values, { compact: true });
  }

  function renderNotesRadar(canvas, values, options = {}) {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const cssWidth = Math.max(1, Math.round(canvas.clientWidth));
    const cssHeight = Math.max(1, Math.round(canvas.clientHeight));
    const backingWidth = Math.round(cssWidth * pixelRatio);
    const backingHeight = Math.round(cssHeight * pixelRatio);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    const context = canvas.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const width = cssWidth;
    const height = cssHeight;
    const centerX = width / 2;
    const centerY = height / 2 + 2;
    const compact = Boolean(options.compact);
    const maximumRadius = Math.min(width * (compact ? 0.31 : 0.4), height * (compact ? 0.33 : 0.4));
    const radius100 = maximumRadius * 0.68;
    const labels = ["NOTES", "PEAK", state.chart?.ugc ? "AIR" : "SCRATCH", "SOF-LAN", "CHARGE", "CHORD"];
    const colors = ["#f064cf", "#f6d64a", "#ff7c58", "#6d7cff", "#49d8df", "#b7e65c"];
    const levelColor = currentDifficultyStyle()[1];
    const point = (axis, value = 100) => {
      const angle = -Math.PI / 2 + axis * Math.PI / 3;
      const normalized = Math.max(0, Math.min(200, value));
      const distance = normalized <= 100
        ? radius100 * normalized / 100
        : radius100 + (maximumRadius - radius100) * (normalized - 100) / 100;
      return [centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance];
    };

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0d1014";
    context.fillRect(0, 0, width, height);
    for (let ring = 1; ring <= 4; ring++) {
      context.beginPath();
      for (let axis = 0; axis < 6; axis++) {
        const [x, y] = point(axis, ring * 25);
        if (axis === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = "rgba(185,205,216,.25)";
      context.lineWidth = ring === 4 ? 2 : 1;
      context.stroke();
    }
    for (let axis = 0; axis < 6; axis++) {
      const [x, y] = point(axis, 200);
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(x, y);
      context.strokeStyle = "rgba(185,205,216,.25)";
      context.lineWidth = 1;
      context.stroke();
    }

    context.beginPath();
    values.forEach((value, axis) => {
      const [x, y] = point(axis, Math.max(4, Math.min(200, value)));
      if (axis === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.globalAlpha = 0.48;
    context.fillStyle = levelColor;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = levelColor;
    context.lineWidth = 2;
    context.stroke();

    context.textAlign = "center";
    context.textBaseline = "middle";
    labels.forEach((label, axis) => {
      const angle = -Math.PI / 2 + axis * Math.PI / 3;
      const value = Math.round(values[axis] || 0);
      const labelRadius = maximumRadius + (compact ? 17 : 23);
      context.font = `500 ${compact ? 8 : 12}px Segoe UI, Arial, sans-serif`;
      const labelWidth = context.measureText(label).width;
      context.font = `500 ${compact ? 8 : 12}px Segoe UI, Arial, sans-serif`;
      const valueText = String(value);
      const valueWidth = context.measureText(valueText).width;
      const halfWidth = Math.max(labelWidth, valueWidth) / 2;
      const x = Math.max(
        halfWidth + 4,
        Math.min(width - halfWidth - 4, centerX + Math.cos(angle) * labelRadius)
      );
      const y = Math.max(
        compact ? 12 : 17,
        Math.min(height - (compact ? 14 : 19), centerY + Math.sin(angle) * labelRadius)
      );
      context.fillStyle = "#aab3ba";
      context.fillText(label, x, y);
      context.fillStyle = "#f2f5f7";
      context.fillText(valueText, x, y + (compact ? 9 : 13));
    });

    const [scaleX, scaleY] = point(0, 100);
    context.font = `600 ${compact ? 7 : 9}px Segoe UI, Arial, sans-serif`;
    context.fillStyle = "#b9cdd8";
    context.fillText("100", scaleX + 12, scaleY + 3);
  }

  let measureObserver;
  function clearMeasureGrid() {
    measureObserver?.disconnect();
    measureObserver = null;
    ui.measureGrid.replaceChildren();
  }

  function renderMeasureGrid(chart) {
    const measuresPerColumn = Number(ui.inspectorColumnSize.value) || 4;
    const measureCount = Math.max(1, chart.measureStarts.length - 1);
    const groups = Array.from({ length: measureCount }, () => []);
    for (const note of chart.ugc ? chart.hitNotes : chart.displayNotes) {
      const authored = chart.ugc ? undefined : note.measure;
      const measure = Math.min(measureCount - 1, Math.max(0, authored ?? upperBoundValue(chart.measureStarts, note.beat) - 1));
      groups[measure].push(note);
    }
    clearMeasureGrid();
    // Large charts can require gigabytes if every measure owns a full bitmap.
    // Keep all cards navigable and allocate only the visible canvas surfaces.
    if (measureCount > 64) {
      measureObserver = new IntersectionObserver((entries, observer) => {
        if (observer !== measureObserver) return;
        for (const { target, isIntersecting } of entries) {
          const canvas = target.firstElementChild;
          if (!isIntersecting) {
            if (canvas.width) canvas.width = canvas.height = 0;
            continue;
          }
          const measure = Number(target.dataset.measure);
          canvas.width = 324;
          canvas.height = 348;
          drawMeasure(canvas, chart, measure, groups[measure]);
        }
      }, { root: $("inspectorScroller"), rootMargin: "180px" });
    }
    state.followedMeasure = -1;
    for (let start = 0; start < measureCount; start += measuresPerColumn) {
      const column = document.createElement("div");
      column.className = "measure-column";
      for (let measure = start; measure < Math.min(measureCount, start + measuresPerColumn); measure++) {
        const card = document.createElement("div");
        card.className = "measure-card";
        card.dataset.measure = String(measure);
        const canvas = document.createElement("canvas");
        if (measureObserver) {
          canvas.width = canvas.height = 0;
          measureObserver.observe(card);
        } else {
          canvas.width = 324;
          canvas.height = 348;
          drawMeasure(canvas, chart, measure, groups[measure]);
        }
        if (chart.mode?.identifyNote) {
          const identify = event => {
            const rect = canvas.getBoundingClientRect(), mirror = ui.ugcMirror.checked;
            const unit = (event.clientX - rect.left) / rect.width * 16;
            const y = (event.clientY - rect.top) / rect.height * canvas.height;
            const detail = chart.mode.identifyNote(chart, groups[measure], mirror ? 16-unit : unit,
              y, canvas.height, chart.measureStarts[measure], chart.measureStarts[measure+1], mirror);
            canvas.title = detail;
            $("ugcNoteDetail").textContent = detail ? `Measure ${measure+1} · ${detail}` : "Point to or tap a note for details.";
          };
          canvas.addEventListener("pointermove", identify);
          canvas.addEventListener("click", identify);
        }
        const number = document.createElement("span");
        number.className = "measure-number";
        number.textContent = String(measure + 1);
        const progress = document.createElement("i");
        progress.className = "measure-progress";
        card.append(canvas, progress, number);
        column.append(card);
      }
      ui.measureGrid.append(column);
    }
    updateInspectorCurrent();
  }

  function drawMeasure(canvas, chart, measure, notes) {
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const startBeat = chart.measureStarts[measure];
    const endBeat = chart.measureStarts[measure + 1] ?? startBeat + 4;
    if (chart.mode?.drawMeasure) {
      chart.mode.drawMeasure({
        context, chart, measure, notes, width, height, startBeat, endBeat, settings: ugcSettings()
      });
      return;
    }
    const laneWidth = width / chart.lanes;
    const plotTop = 3;
    const plotBottom = height - 3;
    const plotHeight = plotBottom - plotTop;
    const beatY = (beat) => plotBottom
      - (beat - startBeat) / Math.max(0.001, endBeat - startBeat) * plotHeight;
    context.fillStyle = "#090c0f";
    context.fillRect(0, 0, width, height);
    for (let lane = 0; lane < chart.lanes; lane++) {
      context.fillStyle = chart.hasScratch !== false && (lane === 0 || (chart.lanes === 16 && lane === 15))
        ? "#19140d"
        : isWhiteKeyLane(lane, chart.lanes, chart.hasScratch !== false)
          ? "#171a1e"
          : "#0e1115";
      context.fillRect(lane * laneWidth, 0, laneWidth, height);
      context.strokeStyle = "#34404a";
      context.strokeRect(lane * laneWidth, 0, laneWidth, height);
    }
    if (chart.lanes === 16) {
      const centerX = laneWidth * 8;
      context.fillStyle = "#030506";
      context.fillRect(centerX - 3, 0, 6, height);
      context.fillStyle = "#8fa4b0";
      context.fillRect(centerX - 0.75, 0, 1.5, height);
    }
    context.strokeStyle = "#2e3942";
    for (let division = 0; division <= 16; division++) {
      const y = plotBottom - division / 16 * plotHeight;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    const bpmEvents = chart.bpmChanges.filter((event) => event.beat >= startBeat && event.beat < endBeat);
    for (const event of bpmEvents) {
      const y = beatY(event.beat);
      context.strokeStyle = "#00f030";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      context.fillStyle = "#00f030";
      context.font = "700 12px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(formatBpm(event.bpm), Math.min(width - 32, width - laneWidth * 0.78), y - 9);
      context.font = "700 8px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.fillText("BPM", Math.min(width - 32, width - laneWidth * 0.78), y + 7);
    }
    for (const note of notes) {
      const lane = laneFor(note, chart.lanes);
      const y = beatY(note.beat);
      const scratch = chart.hasScratch !== false && (lane === 0 || (chart.lanes === 16 && lane === 15));
      const noteColor = scratch ? "#ffbf2f" : isWhiteKeyLane(lane, chart.lanes, chart.hasScratch !== false) ? "#f3f5f6" : "#377dff";
      context.fillStyle = noteColor;
      if (note.longStart && note.longPair) {
        const pairBeat = Math.min(endBeat, note.longPair.beat);
        const pairY = beatY(pairBeat);
        context.globalAlpha = 0.62;
        context.fillStyle = noteColor;
        context.fillRect(lane * laneWidth + laneWidth * 0.25, pairY, laneWidth * 0.5, Math.max(4, y - pairY));
        context.globalAlpha = 1;
      }
      context.fillStyle = noteColor;
      context.fillRect(lane * laneWidth + 2, y - 3, Math.max(2, laneWidth - 4), 6);
    }
  }

  function updateInspectorCurrent() {
    if (!state.chart || state.view !== "inspector") return;
    const beat = state.chart.secondsToBeat(state.pausedAt);
    const starts = state.chart.measureStarts;
    const measure = Math.max(0, Math.min(starts.length - 2, upperBoundValue(starts, beat) - 1));
    const old = ui.measureGrid.querySelector(".measure-card.current");
    const card = Number(old?.dataset.measure) === measure ? old : ui.measureGrid.querySelector(`.measure-card[data-measure="${measure}"]`);
    if (card !== old && old) {
      old.classList.remove("current");
      old.querySelector(".measure-progress").style.display = "none";
    }
    if (card) {
      card.classList.add("current");
      const start = starts[measure], end = starts[measure + 1] ?? start + 4;
      const position = Math.max(0, Math.min(1, (beat - start) / Math.max(.001, end - start)));
      const progress = card.querySelector(".measure-progress");
      progress.style.display = "block";
      progress.style.bottom = `${position * 100}%`;
    }
    renderDensityGraph(state.chart);
    if (ui.inspectorFollow.checked && state.followedMeasure !== measure) {
      state.followedMeasure = measure;
      card?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }

  function upperBoundValue(items, value) {
    let low = 0, high = items.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (items[middle] <= value) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function lowerBoundBeat(items, beat) {
    let low = 0, high = items.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (items[middle].beat < beat) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function syncCanvasSize() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const rect = ui.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width * ratio), height = Math.floor(rect.height * ratio);
    if (ui.canvas.width !== width || ui.canvas.height !== height) {
      ui.canvas.width = width; ui.canvas.height = height;
    }
    state.canvasWidth = rect.width;
    state.canvasHeight = rect.height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawLaneReadout(chart, time, playLeft, playRight, judgeY, width, height) {
    if (!chart) return;
    const effectiveBpm = bpmAt(time) * playbackSpeed();
    const readoutWidth = ui.scrollMode.value === "iidx" ? 112 : 92;
    const readoutHeight = ui.scrollMode.value === "iidx" ? 82 : 54;
    const gap = 16;
    const hasRightRoom = playRight + gap + readoutWidth <= width - 8;
    const hasLeftRoom = playLeft - gap - readoutWidth >= 8;
    if (!hasRightRoom && !hasLeftRoom) return;
    const readoutX = hasRightRoom
      ? playRight + gap
      : playLeft - gap - readoutWidth;
    const readoutY = Math.max(16, Math.min(height - readoutHeight - 16, judgeY - readoutHeight - 20));
    const rows = ui.scrollMode.value === "iidx"
      ? [
          ["HS", hiSpeed().toFixed(2), "#61dfff"],
          ["GN", String(Math.round(greenNumber(time))), "#88ff63"],
          ["BPM", formatBpm(effectiveBpm), "#ff4054"]
        ]
      : [
          ["PX/S", String(Math.round(Number(ui.speed.value))), "#61dfff"],
          ["BPM", formatBpm(effectiveBpm), "#ff4054"]
        ];
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, .92)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    rows.forEach(([label, value, color], index) => {
      const rowY = readoutY + 12 + index * 29;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = "900 11px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillStyle = color;
      ctx.fillText(label, readoutX, rowY + 2);
      ctx.textAlign = "right";
      ctx.font = "900 23px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillText(value, readoutX + readoutWidth, rowY);
    });
    ctx.restore();
  }

  function drawBpmChangeMarkers(chart, currentBeat, lastBeat, noteDistance, playLeft, playRight, hitY, height, width) {
    if (!chart?.bpmChanges?.length) return;
    const labelOutsideX = Math.min(width - 52, playRight + 10);
    const labelInsideX = playRight - 62;
    const canDrawOutside = labelOutsideX + 48 < width;
    ctx.save();
    ctx.font = "800 20px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const change of chart.bpmChanges) {
      if (change.beat <= currentBeat + 0.001 || change.beat > lastBeat) continue;
      const distance = noteDistance(change);
      if (distance < 0 || distance > height) continue;
      const y = hitY - distance;
      if (y < 14 || y > height - 12) continue;
      ctx.strokeStyle = "rgba(0, 240, 48, .82)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playLeft, y);
      ctx.lineTo(playRight, y);
      ctx.stroke();
      const x = canDrawOutside ? labelOutsideX : Math.max(playLeft + 4, labelInsideX);
      ctx.fillStyle = "#00f030";
      ctx.fillText(formatBpm(change.bpm * playbackSpeed()), x, y);
    }
    ctx.restore();
  }

  function draw(time, frameTime = performance.now()) {
    const width = state.canvasWidth, height = state.canvasHeight;
    if (state.view === "inspector" || !(width > 0 && height > 0)) return;
    const chart = state.chart;
    const ownStage = chart?.modeId === "ugc" || chart?.modeId === "maimai";
    // The UGC stage is opaque and covers the canvas itself.
    if (!ownStage || state.bgaBackdrop) ctx.clearRect(0, 0, width, height);
    const hasBackdrop = drawPlayfieldBgaBackdrop(width, height, frameTime);
    if (!hasBackdrop && !ownStage) {
      ctx.fillStyle = themeColor("--canvas-bg");
      ctx.fillRect(0, 0, width, height);
    }
    if (chart?.mode?.drawPlayfield) {
      state.effects = state.effects.filter((effect) => time - effect.started < HIT_EFFECT_DURATION);
      chart.mode.drawPlayfield({
        context: ctx,
        chart,
        time,
        width,
        height,
        scrollMode: ui.scrollMode.value,
        fixedScrollSpeed: Number(ui.speed.value),
        hiSpeed: hiSpeed(),
        effects: state.effects,
        hitEffectsEnabled: ui.hitEffects.checked,
        ...(chart.modeId === "maimai" ? maiFieldSettings() : {}),
        hitEffectDuration: HIT_EFFECT_DURATION,
        frameTime,
        settings: ugcSettings(),
        maiBackground: state.bgaBase?.kind === "video" ? state.bgaBase.media : state.bgaBase?.source,
        jacket: state.playbackJacket,
        hasBackdrop,
        laneDarkness: Number(ui.laneDarkness.value) / 100,
        noteThickness: Number(ui.noteThickness.value),
        speed: ui.scrollMode.value === "iidx"
          ? Math.max(0.25, hiSpeed())
          : Math.max(0.25, Number(ui.speed.value) / 400)
      });
      return;
    }
    const lanes = chart?.lanes || 8;
    const widthScale = Number(ui.columnWidth.value) / 100;
    const idealWidth = (lanes === 16 ? height * 1.28 : height * 0.78) * widthScale;
    const minimumWidth = (lanes === 16 ? 680 : 460) * widthScale;
    const fieldWidth = Math.min(width - 32, Math.max(minimumWidth, idealWidth));
    const left = (width - fieldWidth) / 2;
    const hasScratch = chart?.hasScratch !== false;
    const geometry = laneGeometry(lanes, fieldWidth, left, hasScratch);
    const judgeY = height - 86;
    const judgeTopY = judgeY - JUDGE_LINE_WIDTH / 2;

    for (let lane = 0; lane < lanes; lane++) {
      const column = geometry[lane];
      const laneAlpha = Math.max(0.3, Math.min(0.95, Number(ui.laneDarkness.value) / 100));
      ctx.fillStyle = state.bgaBackdrop
        ? column.scratch
          ? `rgba(12, 8, 4, ${laneAlpha})`
          : isWhiteKeyLane(lane, lanes, hasScratch)
            ? `rgba(18, 24, 29, ${laneAlpha})`
            : `rgba(5, 8, 12, ${Math.min(0.98, laneAlpha + 0.04)})`
        : column.scratch
          ? themeColor("--lane-scratch")
          : isWhiteKeyLane(lane, lanes, hasScratch)
            ? themeColor("--lane-white")
            : themeColor("--lane-blue");
      ctx.fillRect(column.x, 0, column.width, height);
      ctx.strokeStyle = themeColor("--lane-border");
      ctx.beginPath(); ctx.moveTo(column.x, 0); ctx.lineTo(column.x, height); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(left + fieldWidth, 0); ctx.lineTo(left + fieldWidth, height); ctx.stroke();
    if (lanes === 16) {
      const centerX = geometry[8].x;
      ctx.fillStyle = "#030506";
      ctx.fillRect(centerX - 4, 0, 8, height);
      ctx.fillStyle = "#90a8b5";
      ctx.fillRect(centerX - 1, 0, 2, height);
    }
    ctx.strokeStyle = themeColor("--judge-line"); ctx.lineWidth = JUDGE_LINE_WIDTH;
    ctx.beginPath(); ctx.moveTo(left, judgeY); ctx.lineTo(left + fieldWidth, judgeY); ctx.stroke();
    ctx.lineWidth = 1;

    if (chart) {
      const fixedPxPerSecond = Number(ui.speed.value);
      const pixelsPerBeat = judgeTopY * hiSpeed() / 4;
      const currentBeat = chart.secondsToBeat(time);
      const visibleSeconds = height / Math.max(1, fixedPxPerSecond);
      const lastBeat = Math.ceil(ui.scrollMode.value === "fixed"
        ? chart.secondsToBeat(time + visibleSeconds)
        : currentBeat + height / pixelsPerBeat);

      for (const beat of chart.measureStarts) {
        if (beat < currentBeat || beat > lastBeat) continue;
        const distance = ui.scrollMode.value === "iidx"
          ? (beat - currentBeat) * pixelsPerBeat
          : (chart.beatToSeconds(beat) - time) * fixedPxPerSecond;
        if (distance < 0 || distance > height) continue;
        const y = judgeTopY - distance;
        ctx.strokeStyle = themeColor("--measure-line");
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + fieldWidth, y);
        ctx.stroke();
      }
      ctx.lineWidth = 1;

      const notes = chart.displayNotes;
      const noteThickness = Number(ui.noteThickness.value);
      const noteDistance = (note) => ui.scrollMode.value === "iidx"
        ? (note.beat - currentBeat) * pixelsPerBeat
        : (note.time - time) * fixedPxPerSecond;
      drawBpmChangeMarkers(chart, currentBeat, lastBeat, noteDistance, left, left + fieldWidth, judgeTopY, height, width);
      const activeLongHolds = [];

      for (const note of chart.longNotes) {
        if (!note.longStart || !note.longPair) continue;
        const startDistance = noteDistance(note);
        const endDistance = noteDistance(note.longPair);
        if (endDistance <= 0 || startDistance > height || endDistance > height && startDistance > height) continue;
        const lane = laneFor(note, lanes);
        const column = geometry[lane];
        const startBottomY = Math.min(judgeTopY, judgeTopY - startDistance);
        const endBottomY = Math.max(0, judgeTopY - endDistance);
        const startTopY = startBottomY - noteThickness;
        const endTopY = endBottomY - noteThickness;
        const bodyX = column.x + Math.max(5, column.width * 0.22);
        const bodyWidth = Math.max(4, column.width - Math.max(10, column.width * 0.44));
        const noteColor = column.scratch
          ? themeColor("--note-scratch")
          : isWhiteKeyLane(lane, lanes, hasScratch)
            ? themeColor("--note-white")
            : themeColor("--note-blue");
        if (ui.hitEffects.checked && time >= note.time && time <= note.longPair.time) {
          activeLongHolds.push({
            column,
            color: hitEffectColor(note, lane, chart),
            startTime: note.time
          });
        }
        ctx.globalAlpha = 0.62;
        ctx.fillStyle = noteColor;
        ctx.fillRect(bodyX, endBottomY, bodyWidth, Math.max(noteThickness, startTopY - endBottomY));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = noteColor;
        ctx.strokeRect(bodyX + .5, endBottomY + .5, bodyWidth - 1, Math.max(noteThickness, startTopY - endBottomY) - 1);
        ctx.fillStyle = noteColor;
        ctx.fillRect(column.x + 3, endTopY, column.width - 6, noteThickness);
        ctx.fillRect(column.x + 3, startTopY, column.width - 6, noteThickness);
      }

      const visibleStart = upperBoundTime(notes, time);
      const visibleEnd = ui.scrollMode.value === "fixed"
        ? upperBoundTime(notes, time + visibleSeconds)
        : upperBoundTime(notes, chart.beatToSeconds(lastBeat));
      for (let index = visibleStart; index < visibleEnd; index++) {
        const note = notes[index];
        if (/^[56]/.test(note.channel)) continue;
        const delta = note.time - time;
        const distance = noteDistance(note);
        if (distance < 0 || (ui.scrollMode.value === "fixed" && delta > visibleSeconds) || distance > height) continue;
        const lane = laneFor(note, lanes);
        const column = geometry[lane];
        const bottomY = judgeTopY - distance;
        ctx.fillStyle = column.scratch
          ? themeColor("--note-scratch")
          : isWhiteKeyLane(lane, lanes, hasScratch)
            ? themeColor("--note-white")
            : themeColor("--note-blue");
        ctx.fillRect(column.x + 3, bottomY - noteThickness, column.width - 6, noteThickness);
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.fillRect(column.x + 4, bottomY - noteThickness + 1, column.width - 8, Math.min(2, noteThickness));
      }

      if (state.suddenEnabled) {
        const coverHeight = judgeY * Number(ui.suddenAmount.value) / 100;
        ctx.fillStyle = themeColor("--cover-bg");
        ctx.fillRect(left, 0, fieldWidth, coverHeight);
        ctx.fillStyle = themeColor("--cover-edge");
        ctx.fillRect(left, coverHeight - 3, fieldWidth, 3);
        ctx.fillStyle = "rgba(127, 225, 255, .28)";
        ctx.fillRect(left, coverHeight, fieldWidth, 1);
      }

      state.effects = state.effects.filter((effect) => time - effect.started < HIT_EFFECT_DURATION);
      const regularLaneWidth = Math.min(...geometry.filter((column) => !column.scratch).map((column) => column.width));
      const effectBaseLaneWidth = Number.isFinite(regularLaneWidth) ? regularLaneWidth : geometry[0]?.width || 42;
      for (const hold of activeLongHolds) {
        drawHoldLaneEffect(hold.column, hold.color, judgeTopY, time, hold.startTime, effectBaseLaneWidth);
      }
      for (const effect of state.effects) {
        const column = geometry[effect.lane];
        if (!column) continue;
        const age = time - effect.started;
        const normalizedAge = Math.max(0, Math.min(1, age / HIT_EFFECT_DURATION));
        const life = Math.pow(1 - normalizedAge, 1.35);
        const x = column.x;
        drawLaneLightBar(column, effect, judgeTopY, life);
        drawBombEffect(column, effect, judgeTopY, age, life, effectBaseLaneWidth);
        ctx.globalAlpha = life;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 3, judgeTopY - noteThickness, column.width - 6, noteThickness);
        ctx.globalAlpha = 1;
      }
      drawLaneReadout(chart, time, left, left + fieldWidth, judgeY, width, height);
    }
  }

  function formatTime(seconds) {
    const value = Math.floor(Math.abs(seconds || 0));
    return `${seconds < 0 ? "−" : ""}${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function updateScrollControls(redraw = true) {
    const iidx = ui.scrollMode.value === "iidx";
    ui.speedLabel.textContent = iidx ? (state.chart?.modeId === "stepmania" ? "XMod multiplier" : "Hi-Speed") : "Scroll speed";
    if (iidx) {
      ui.speed.min = "1";
      ui.speed.max = "1999";
      ui.speed.step = "1";
      ui.speed.value = String(Math.round(state.iidxHispeed * 100));
      ui.speedValue.min = "0.01";
      ui.speedValue.max = "19.99";
      ui.speedValue.step = "0.01";
      ui.speedValue.value = state.iidxHispeed.toFixed(2);
      updateTempoDisplay();
    } else {
      ui.speed.min = "50";
      ui.speed.max = "4000";
      ui.speed.step = "10";
      ui.speed.value = String(state.fixedScrollSpeed);
      ui.speedValue.min = "50";
      ui.speedValue.max = "4000";
      ui.speedValue.step = "10";
      ui.speedValue.value = String(state.fixedScrollSpeed);
      ui.scrollModeValue.value = "PX";
    }
    if (redraw) draw(state.pausedAt);
  }

  function bindRange(input, output, suffix, onInput = () => draw(state.pausedAt)) {
    input.addEventListener("input", () => {
      output.value = `${input.value}${suffix}`;
      onInput();
    });
  }

  function ugcSettings() {
    return {
      noteSpeed: Number(ui.ugcSpeed.value),
      mirror: ui.ugcMirror.checked,
      divisions: Number(ui.ugcLines.value),
      color: Number(ui.ugcColor.value),
      scale: Number(ui.ugcScale.value) / 100,
      visualDelay: Number(ui.ugcOffset.value) / 1000
    };
  }

  function bindUgcSettings() {
    const fields = [
      [ui.ugcSpeed, ui.ugcSpeedValue, ""],
      [ui.ugcScale, ui.ugcScaleValue, "%"],
      [ui.ugcOffset, ui.ugcOffsetValue, "ms"],
      [ui.ugcMirror], [ui.ugcLines], [ui.ugcColor]
    ];
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("vsrg-ugc-settings-v1")) || {}; } catch { /* Storage may be unavailable. */ }
    for (const [input, output, suffix] of fields) {
      const value = saved[input.id];
      if (input.type === "checkbox") input.checked = value === true;
      else if (value !== undefined && Number.isFinite(Number(value))) {
        if (input.tagName === "SELECT") {
          if ([...input.options].some((option) => option.value === String(value))) input.value = String(value);
        } else input.value = String(clamp(Number(value), Number(input.min), Number(input.max)));
      }
      const update = () => {
        if (output) output.value = input === ui.ugcSpeed ? (Number(input.value) === 20 ? "Sonic" : Number(input.value).toFixed(2)) : `${input.value}${suffix}`;
        const values = Object.fromEntries(fields.map(([field]) => [field.id, field.type === "checkbox" ? field.checked : field.value]));
        try { localStorage.setItem("vsrg-ugc-settings-v1", JSON.stringify(values)); } catch { /* Playback works without storage. */ }
        draw(chartTimeNow());
        if (state.chart?.modeId === "ugc" && state.view === "inspector" && input === ui.ugcMirror) renderInspector();
      };
      if (output) output.value = input === ui.ugcSpeed ? (Number(input.value) === 20 ? "Sonic" : Number(input.value).toFixed(2)) : `${input.value}${suffix}`;
      input.addEventListener("input", update);
    }
  }

  function restartPlaybackForAudioChange() {
    state.stretchedBuffers.clear();
    if (state.chart && (state.playing || state.starting)) seekTo(chartTimeNow());
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function maiFieldSettings() {
    return {
      hitEffectsEnabled: ui.maiEffects.checked,
      mediaBlur: Number(ui.maiBlur.value),
      mediaDarkness: Number(ui.maiDarkness.value) / 100,
      sensorVisibility: Number(ui.maiSensors.value) / 100,
      comboOpacity: Number(ui.maiComboOpacity.value) / 100,
      maiSpeed: Number($("maiSpeed").value),
      maiExtraInfo: $("maiExtraInfo").checked
    };
  }

  function bindControls() {
    MaiExportUI.bind(() => {
      const chart = state.chart;
      if (chart?.modeId !== "maimai") throw new Error("Open a maimai chart first.");
      const media = chart.songMedia;
      return {
        chart, field: maiFieldSettings(), speed: playbackSpeed(), pitch: ui.pitchWithSpeed.checked,
        hitsounds: ui.keysounds.checked, volume: Number(ui.volume.value), stretch: stretchAudioBuffer,
        cover: media.cover && findFile(media.cover, "image"),
        video: media.video && findFile(media.video, "video"),
        song: media.audio && findFile(media.audio, "audio")
      };
    });
    const openMaiNotes = window.MaiNotes.bind((file, chart) => {
      resetLoadedContent();
      state.files.set(file.name, file);
      state.charts.push(chart);
      finishChartImport();
      switchView("player");
    });
    for (const event of ["loadeddata", "seeked"]) {
      ui.video.addEventListener(event, () => {
        if (!state.playing && state.chart?.modeId === "maimai") {
          state.bgaBackdropLastUpdate = -Infinity;
          draw(chartTimeNow());
        }
      });
    }
    for (const [input, suffix] of [[ui.maiBlur, "px"], [ui.maiDarkness, "%"], [ui.maiSensors, "%"], [ui.maiComboOpacity, "%"]]) {
      input.value = localStorage.getItem("vsrg-" + input.id) ?? input.defaultValue;
      const output = $(input.id + "Value");
      output.value = input.value + suffix;
      bindRange(input, output, suffix, () => {
        localStorage.setItem("vsrg-" + input.id, input.value);
        if (input === ui.maiBlur || input === ui.maiDarkness) state.bgaBackdropLastUpdate = -Infinity;
        draw(chartTimeNow());
      });
    }
    ui.maiEffects.checked = localStorage.getItem("vsrg-maiEffects") === "on";
    ui.maiEffects.addEventListener("change", () => {
      localStorage.setItem("vsrg-maiEffects", ui.maiEffects.checked ? "on" : "off");
      draw(chartTimeNow());
    });
    const extraInfo = $("maiExtraInfo");
    extraInfo.checked = localStorage.getItem("vsrg-maimai-extra-info") === "on";
    extraInfo.addEventListener("change", () => {
      localStorage.setItem("vsrg-maimai-extra-info", extraInfo.checked ? "on" : "off");
      draw(chartTimeNow());
    });
    const maiSpeed = $("maiSpeed");
    maiSpeed.value = localStorage.getItem("vsrg-maimai-speed") ?? maiSpeed.defaultValue;
    $("maiSpeedValue").value = maiSpeed.value;
    maiSpeed.addEventListener("input", () => {
      $("maiSpeedValue").value = maiSpeed.value;
      localStorage.setItem("vsrg-maimai-speed", maiSpeed.value);
      draw(chartTimeNow());
    });
    $("startFolder").addEventListener("click", () => ui.folder.click());
    $("startFiles").addEventListener("click", () => ui.files.click());
    const setOpenMenu = (open) => {
      ui.openMenuPanel.hidden = !open;
      ui.openButton.setAttribute("aria-expanded", String(open));
    };
    ui.openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpenMenu(ui.openMenuPanel.hidden);
    });
    $("maiNotesOpen").addEventListener("click", openMaiNotes);
    $("maiNotesToolbar").addEventListener("click", openMaiNotes);
    ui.openFilesOption.addEventListener("click", () => {
      setOpenMenu(false);
      ui.files.click();
    });
    ui.openFolderOption.addEventListener("click", () => {
      setOpenMenu(false);
      ui.folder.click();
    });
    document.addEventListener("click", (event) => {
      if (!ui.openMenu.contains(event.target)) setOpenMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.code === "Escape") setOpenMenu(false);
    });
    window.addEventListener("stepmaniaSkinLoaded", () => draw(chartTimeNow()));
    ui.sidePanelToggle.addEventListener("click", () => setSidePanelCollapsed(!state.sidePanelCollapsed));
    for (const input of [ui.files, ui.folder]) {
      input.addEventListener("change", async () => {
        const selection = Array.from(input.files);
        input.value = "";
        await loadFiles(selection);
      });
    }
    ui.select.addEventListener("change", () => selectChart(Number(ui.select.value)));
    ui.play.addEventListener("click", () => state.playing || state.starting ? pause() : play());
    ui.stop.addEventListener("click", stop);
    ui.bgaBackdropToggle.addEventListener("click", () => setBgaBackdrop(!state.bgaBackdrop));
    viewButtons.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
    ui.inspectorColumnSize.addEventListener("change", renderInspector);
    ui.inspectorCurrent.addEventListener("click", () => {
      updateInspectorCurrent();
      const current = ui.measureGrid.querySelector(".measure-card.current");
      current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
    ui.inspectorFollow.addEventListener("change", () => {
      state.followedMeasure = -1;
      if (ui.inspectorFollow.checked) updateInspectorCurrent();
    });
    ui.densityGraph.addEventListener("click", async (event) => {
      if (!state.chart) return;
      const bounds = ui.densityGraph.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
      await seekTo(ratio * state.chart.duration);
      if (!state.playing) await play();
    });

    ui.scrollMode.addEventListener("change", updateScrollControls);
    $("stepmaniaSpeedScripts").addEventListener("change", () => draw(chartTimeNow()));
    ui.stepmaniaScrollDirection.addEventListener("change", () => draw(state.pausedAt));
    ui.speed.addEventListener("input", () => {
      if (ui.scrollMode.value === "iidx") {
        state.iidxHispeed = Number(ui.speed.value) / 100;
        ui.speedValue.value = state.iidxHispeed.toFixed(2);
        updateTempoDisplay();
      } else {
        state.fixedScrollSpeed = Number(ui.speed.value);
        ui.speedValue.value = String(state.fixedScrollSpeed);
      }
      draw(state.pausedAt);
    });
    ui.speedValue.addEventListener("input", () => {
      const value = Number(ui.speedValue.value);
      if (!Number.isFinite(value)) return;
      if (ui.scrollMode.value === "iidx") {
        state.iidxHispeed = clamp(value, 0.01, 19.99);
        ui.speed.value = String(Math.round(state.iidxHispeed * 100));
        updateTempoDisplay();
      } else {
        state.fixedScrollSpeed = clamp(value, 50, 4000);
        ui.speed.value = String(state.fixedScrollSpeed);
      }
      draw(state.pausedAt);
    });
    ui.speedValue.addEventListener("change", () => {
      ui.speedValue.value = ui.scrollMode.value === "iidx"
        ? state.iidxHispeed.toFixed(2)
        : String(state.fixedScrollSpeed);
    });
    bindRange(ui.columnWidth, ui.columnWidthValue, "%");
    bindRange(ui.scratchWidth, ui.scratchWidthValue, "%");
    bindRange(ui.noteThickness, ui.noteThicknessValue, "px");
    bindRange(ui.bgaBlur, ui.bgaBlurValue, "px", invalidateBgaBackdrop);
    bindRange(ui.bgaDarkness, ui.bgaDarknessValue, "%", invalidateBgaBackdrop);
    bindRange(ui.laneDarkness, ui.laneDarknessValue, "%", () => draw(state.pausedAt));
    bindRange(ui.stepmaniaColumnSpacing, ui.stepmaniaColumnSpacingValue, "%", () => draw(state.pausedAt));
    bindRange(ui.suddenAmount, ui.suddenAmountValue, "%", () => {
      updateTempoDisplay();
      draw(state.pausedAt);
    });

    modButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.laneMod = button.dataset.mod;
        applyLaneMod();
      });
    });

    ui.sudden.addEventListener("click", () => {
      state.suddenEnabled = !state.suddenEnabled;
      ui.sudden.classList.toggle("active", state.suddenEnabled);
      ui.sudden.setAttribute("aria-pressed", String(state.suddenEnabled));
      ui.suddenAmount.disabled = !state.suddenEnabled;
      updateTempoDisplay();
      draw(state.pausedAt);
    });

    ui.songSpeed.addEventListener("input", () => {
      setPlaybackRate(ui.songSpeed.value);
    });
    ui.songSpeedValue.addEventListener("input", () => {
      const value = Number(ui.songSpeedValue.value);
      if (!Number.isFinite(value)) return;
      setPlaybackRate(value);
    });
    ui.songSpeedValue.addEventListener("change", () => {
      ui.songSpeedValue.value = ui.songSpeed.value;
    });
    ui.pitchWithSpeed.addEventListener("change", restartPlaybackForAudioChange);
    ui.keysounds.addEventListener("change", async () => {
      await updatePlaybackEnd();
      restartPlaybackForAudioChange();
      ui.time.textContent = `${formatTime(state.pausedAt)} / ${formatTime(playbackEndTime())}`;
    });

    ui.volume.addEventListener("input", () => {
      ui.volumeValue.value = `${Math.round(Number(ui.volume.value) * 100)}%`;
      if (state.gain) state.gain.gain.value = Number(ui.volume.value);
    });

    ui.seek.addEventListener("pointerdown", () => {
      state.seeking = true;
    });
    ui.seek.addEventListener("input", () => {
      if (!state.chart) return;
      const endTime = playbackEndTime();
      const target = Number(ui.seek.value) / 1000 * endTime;
      ui.time.textContent = `${formatTime(target)} / ${formatTime(endTime)}`;
      draw(target);
    });
    ui.seek.addEventListener("change", async () => {
      state.seeking = false;
      await seekTo(Number(ui.seek.value) / 1000 * playbackEndTime());
    });
    ui.back.addEventListener("click", () => seekTo(state.pausedAt - 10));
    ui.forward.addEventListener("click", () => seekTo(state.pausedAt + 10));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", async (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName)
      )) return;
      if (!state.chart) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (state.playing || state.starting) pause();
        else await play();
        return;
      }
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        const direction = event.code === "ArrowLeft" ? -1 : 1;
        await seekTo(state.pausedAt + direction * (event.shiftKey ? 10 : 5));
        return;
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        stop();
      }
    });
    for (const media of [ui.video, ui.layerVideo]) {
      media.addEventListener("error", () => {
        const source = media.dataset.sourcePath || media.currentSrc || media.src || "";
        const hint = BROWSER_UNSUPPORTED_MEDIA_EXTENSIONS.has(splitFilename(source.toLowerCase()).extension)
          ? " WMV/ASF video is not decoded by this browser; convert it to MP4/WebM."
          : "";
        ui.status.textContent = `A BGA video could not be decoded by this browser.${hint}`;
      });
    }
  }

  function initialize() {
    setPlaybackRate(100);
    ui.pitchWithSpeed.checked = false;
    ui.columnWidth.value = "80";
    ui.columnWidthValue.value = "80%";
    ui.scratchWidth.value = "155";
    ui.scratchWidthValue.value = "155%";
    ui.bgaBlur.value = "4";
    ui.bgaBlurValue.value = "4px";
    ui.bgaDarkness.value = "48";
    ui.bgaDarknessValue.value = "48%";
    ui.laneDarkness.value = "72";
    ui.laneDarknessValue.value = "72%";
    ui.stepmaniaScrollDirection.value = "up";

    bindControls();
    bindUgcSettings();
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("bms-player-theme");
    refreshPalette();

    const canvasObserver = new ResizeObserver(() => {
      syncCanvasSize();
      draw(state.pausedAt);
      renderPlayerRadar();
    });
    canvasObserver.observe(ui.canvas);

    syncCanvasSize();
    updateLaneArrangement();
    updateScrollControls();
    setSidePanelCollapsed(true);
    setBgaBackdrop(false);
    renderPlayerRadar();
    ui.status.textContent += supportsHevc() ? " HEVC is available." : " HEVC is unavailable; compatible video fallbacks will be tried.";
  }

  initialize();
})();
