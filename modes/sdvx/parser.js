(function () {
  "use strict";
  const positions = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno";
  const legacyFX = {
    B: "BitCrusher",
    P: "PitchShift",
    Q: "Phaser",
    X: "Wobble;12",
    A: "TapeStop",
    D: "SideChain",
    F: "Flanger"
  };
  for (const [i, div] of [4, 8, 16, 32, 12, 24].entries()) legacyFX["GHIJKL"[i]] = "Gate;" + div;
  for (const [i, div] of [8, 16, 32, 12, 24].entries()) legacyFX["STUVW"[i]] = "Retrigger;" + div;

  function upper(list, x, key = "beat") {
    let lo = 0,
      hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list[mid][key] <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function put(list, beat, value) {
    if (list.at(-1)?.beat === beat) {
      const last = list.at(-1);
      last.incoming ??= last.value;
      last.value = value;
    } else list.push({ beat, value });
  }
  function valueAt(list, beat, fallback, interpolate = false) {
    const i = upper(list, beat) - 1,
      point = list[i],
      next = list[i + 1];
    if (!point) return fallback;
    if (
      !interpolate ||
      !next ||
      typeof point.value !== "number" ||
      typeof (next.incoming ?? next.value) !== "number"
    )
      return point.value;
    return (
      point.value +
      (((next.incoming ?? next.value) - point.value) * (beat - point.beat)) / (next.beat - point.beat)
    );
  }

  function timing(bpms, offset) {
    let beat = 0,
      time = Math.max(0, offset),
      bpm = bpms[0].value;
    const bpmChanges = bpms.map((p) => {
      time += ((p.beat - beat) * 60) / bpm;
      beat = p.beat;
      bpm = p.value;
      return { beat, time, bpm };
    });
    function beatToSeconds(b) {
      const p = bpmChanges[Math.max(0, upper(bpmChanges, b) - 1)];
      return p.time + ((b - p.beat) * 60) / p.bpm;
    }
    function secondsToBeat(t) {
      const p = bpmChanges[Math.max(0, upper(bpmChanges, t, "time") - 1)];
      return p.beat + ((t - p.time) * p.bpm) / 60;
    }
    return { bpmChanges, beatToSeconds, secondsToBeat };
  }

  function scrollMap(rates, stops, clock) {
    const deltas = new Map();
    for (const stop of stops) {
      const t = clock.beatToSeconds(stop.beat);
      const bpm = clock.bpmChanges[Math.max(0, upper(clock.bpmChanges, stop.beat) - 1)].bpm;
      const end = clock.secondsToBeat(t + ((stop.value / 48) * 60) / bpm);
      deltas.set(stop.beat, (deltas.get(stop.beat) || 0) + 1);
      deltas.set(end, (deltas.get(end) || 0) - 1);
    }
    const times = rates.map((p) => ({ ...p, beat: clock.beatToSeconds(p.beat) }));
    const knots = [
      ...new Set([
        0,
        ...rates.map((p) => p.beat),
        ...deltas.keys(),
        ...clock.bpmChanges.map((p) => p.beat)
      ])
    ].sort((a, b) => a - b);
    const segments = [],
      cuts = [];
    let active = 0,
      distance = 0;
    for (let i = 0; i < knots.length; i++) {
      const beat = knots[i],
        end = knots[i + 1],
        time = clock.beatToSeconds(beat);
      active += deltas.get(beat) || 0;
      const at = upper(times, time) - 1;
      const rate = active ? 1 - active : valueAt(times, time, 1, true);
      let slope = 0;
      if (!active && at >= 0 && times[at + 1] && end !== undefined) {
        const target = times[at + 1],
          source = times[at];
        const perSec = ((target.incoming ?? target.value) - source.value) / (target.beat - source.beat);
        slope = (perSec * (clock.beatToSeconds(end) - time)) / (end - beat);
      }
      segments.push({ beat, position: distance, rate, slope });
      cuts.push(beat);
      if (end !== undefined) {
        const span = end - beat,
          turn = -rate / slope;
        if (turn > 0 && turn < span && Number.isFinite(turn)) cuts.push(beat + turn);
        distance += span * (rate + 0.5 * slope * span);
      }
    }
    const segment = (b) => segments[Math.max(0, upper(segments, b) - 1)];
    function position(b) {
      const p = segment(b),
        d = b - p.beat;
      return p.position + d * (p.rate + (d > 0 ? 0.5 * p.slope * d : 0));
    }
    return { position, cuts, ramping: (b) => segment(b).slope !== 0 };
  }

  function parse(text, filename, context = {}) {
    const meta = Object.create(null),
      definitions = Object.create(null),
      measures = [];
    const warnings = new Set();
    const warn = (message) => {
      if (warnings.size < 100) warnings.add(message);
    };
    let header = true,
      rows = [],
      commands = [],
      line = 0;
    for (const raw of text.replace(/^\uFEFF/, "").split(/\r\n?|\n/)) {
      line++;
      const s = raw.trim();
      if (!s || s.startsWith("//") || s.startsWith(";")) continue;
      if (s === "--") {
        if (header) header = false;
        else {
          measures.push(rows);
          rows = [];
        }
        continue;
      }
      if (s.startsWith("#")) {
        const m = /^#define_(fx|filter)\s+(\S+)\s+(.+)$/i.exec(s);
        if (m) definitions[m[1] + ":" + m[2]] = m[3];
        else warn("Unsupported KSH directive: " + s.split(/\s/)[0]);
        continue;
      }
      const eq = s.indexOf("=");
      if (eq >= 0 && !s.includes("|")) {
        const key = s.slice(0, eq).trim().toLowerCase(),
          value = s.slice(eq + 1).trim();
        if (header) meta[key] = value;
        else commands.push({ key, value });
        continue;
      }
      if (!header) {
        let m = /^([012]{4})\|([0-9A-Z]{2})\|([-:0-9A-Za-o]{2})(.*)$/.exec(s);
        if (!m) {
          warn("Malformed chart row at line " + line + " (kept as a rest).");
          m = ["", "0000", "00", "--", ""];
        }
        rows.push({ bt: m[1], fx: m[2], vol: m[3], spin: m[4], commands });
        commands = [];
      }
    }
    if (rows.length) measures.push(rows);
    if (commands.length) warn("Trailing chart commands have no note row.");
    if (!measures.some((m) => m.length)) throw Error("KSH file contains no chart rows.");
    const notes = [],
      lasers = [[], []],
      active = Array(6).fill(null),
      anchors = [null, null],
      wide = [false, false];
    const fx = ["", ""],
      fxParam = [null, null],
      tickrate = [],
      stops = [],
      scroll = [],
      spin = [],
      filter = [],
      filterGain = [],
      slamVolume = [];
    const camera = {
      zoom_top: [],
      zoom_bottom: [],
      zoom_side: [],
      center_split: [],
      rotation_deg: [],
      tilt: []
    };
    const initialBpm = parseFloat(meta.t);
    const bpms = [{ beat: 0, value: Number.isFinite(initialBpm) && initialBpm > 0 ? initialBpm : 120 }];
    if (meta.t && bpms[0].value !== initialBpm) warn("Invalid initial BPM. Using 120 BPM.");
    const measureStarts = [0],
      keyEvents = [],
      wav = new Map(),
      bmp = new Map(),
      automation = new Map(),
      switchFiles = new Map();
    const offset = Number.isFinite(Number(meta.o)) ? Number(meta.o) / 1000 : 0;
    const folder = (context.chartPath || "").replace(/[^/]*$/, "");
    function pathFor(s) {
      const parts = [];
      for (const part of (folder + s.replaceAll("\\", "/")).toLowerCase().split("/")) {
        if (part === "..") parts.pop();
        else if (part && part !== ".") parts.push(part);
      }
      return parts.join("/");
    }
    function sample(name) {
      if (!name) return "";
      const path = pathFor(name);
      if (!wav.has(path)) wav.set(path, path);
      return path;
    }
    function note(lane, beat, endBeat, extra = {}) {
      return { lane, beat, endBeat, kind: lane < 4 ? "bt" : lane < 6 ? "fx" : "laser", ...extra };
    }
    function closeHold(lane, b) {
      const h = active[lane];
      if (!h) return;
      h.endBeat = b;
      notes.push(h);
      active[lane] = null;
    }
    function sound(name, presets) {
      return presets.includes(name) ? "@ksh/" + name : sample(name);
    }
    const slamPresets = ["up", "down", "swing", "mute"],
      chipPresets = ["clap", "clap_punchy", "clap_impact", "snare", "snare_lo"];
    function segment(side, a, b, x, y, slam) {
      const n = note(6 + side, a, b, { x, y, slam });
      lasers[side].push(n);
      notes.push(n);
      return n;
    }
    let meter = 4,
      pendingMeter,
      previousEnd = 0;
    const readMeter = (value) => {
      const [n, d] = value.split("/").map(Number);
      if (n > 0 && d > 0 && Number.isFinite((4 * n) / d)) return (4 * n) / d;
      warn("Invalid beat=" + value);
      return meter;
    };
    for (const block of measures) {
      const start = previousEnd;
      meter = pendingMeter ?? meter;
      pendingMeter = undefined;
      for (const cmd of block[0]?.commands || [])
        if (cmd.key === "beat") {
          meter = readMeter(cmd.value);
        }
      for (let j = 0; j < block.length; j++) {
        const row = block[j],
          beat = start + (meter * j) / block.length;
        const chipSamples = [null, null];
        let slamSample = "";
        for (const { key, value } of row.commands) {
          const num = Number(value);
          if (key === "beat") {
            if (j !== 0) pendingMeter = readMeter(value);
          } else if (key === "t" && num > 0 && Number.isFinite(num)) put(bpms, beat, num);
          else if (key === "stop" && num > 0 && Number.isFinite(num)) stops.push({ beat, value: num });
          else if (key === "scroll_speed" && Number.isFinite(num)) put(scroll, beat, num / 100);
          else if (Object.hasOwn(camera, key) && (Number.isFinite(num) || key === "tilt"))
            put(camera[key], beat, Number.isFinite(num) ? num : value);
          else if (key === "laserrange_l" || key === "laserrange_r")
            wide[Number(key.endsWith("_r"))] = value === "2x";
          else if (key === "fx-l" || key === "fx-r") {
            const k = Number(key === "fx-r");
            fx[k] = value;
            if (active[4 + k]) active[4 + k].effects.push({ beat, value });
          } else if ((key === "fx-l_param1" || key === "fx-r_param1") && Number.isFinite(num)) {
            fxParam[Number(key.startsWith("fx-r"))] = num;
          } else if (key === "fx-l_se" || key === "fx-r_se") {
            const [file, vol] = value.split(";");
            chipSamples[Number(key === "fx-r_se")] = {
              object: sound(file, chipPresets),
              gain: vol === undefined ? 1 : Number(vol) / 100
            };
          } else if (/^(fx|filter):[^:]+:(mix|wavelength)$/.test(key)) {
            if (!automation.has(key)) automation.set(key, []);
            put(automation.get(key), beat, value);
          } else if (key === "filtertype") put(filter, beat, value);
          else if (key === "pfiltergain" && Number.isFinite(num)) put(filterGain, beat, num / 100);
          else if (key === "chokkakuvol" && Number.isFinite(num)) put(slamVolume, beat, num / 100);
          else if (key === "chokkakuse") slamSample = sound(value, slamPresets);
          else if (key === "tickrate_offset" && Number.isFinite(num)) put(tickrate, beat, num);
          else warn("Unsupported chart command: " + key);
        }
        for (let lane = 0; lane < 6; lane++) {
          const ch = lane < 4 ? row.bt[lane] : row.fx[lane - 4];
          const chip = ch === (lane < 4 ? "1" : "2");
          if (ch === "0" || chip) closeHold(lane, beat);
          if (chip) {
            notes.push(note(lane, beat, beat));
            const se = chipSamples[lane - 4];
            if (se?.object) keyEvents.push({ beat, ...se });
          } else if (ch !== "0" && !active[lane]) {
            let value = lane < 4 ? "" : legacyFX[ch] || fx[lane - 4];
            if (lane >= 4 && "ABP".includes(ch) && fxParam[lane - 4] !== null)
              value += ";" + fxParam[lane - 4];
            active[lane] = note(lane, beat, beat, { effects: [{ beat, value }] });
          }
        }
        for (let k = 0; k < 2; k++) if (row.fx[k] === "0") fxParam[k] = null;
        for (let k = 0; k < 2; k++) {
          const ch = row.vol[k],
            prev = anchors[k];
          if (ch === "-") {
            if (prev) wide[k] = false;
            anchors[k] = null;
            continue;
          }
          if (ch === ":") {
            if (!prev) warn("Laser continuation without a start point.");
            continue;
          }
          const x = (positions.indexOf(ch) / 50) * (wide[k] ? 2 : 1) - (wide[k] ? 0.5 : 0);
          let effective = beat;
          if (prev) {
            const slam = prev.x !== x && beat - prev.beat <= 0.125 + 1e-8;
            if (slam && prev.effective < prev.beat)
              segment(k, prev.effective, prev.beat, prev.x, prev.x, false);
            const n = segment(
              k,
              slam ? prev.beat : prev.effective,
              slam ? prev.beat : beat,
              prev.x,
              x,
              slam
            );
            if (slam) {
              effective = prev.beat;
              if (prev.spin) spin.push({ beat: n.beat, ...prev.spin });
              const sampleName = prev.sample || "@ksh/swing";
              if (sampleName !== "@ksh/mute") {
                const volume = valueAt(slamVolume, n.beat, Number(meta.chokkakuvol ?? 50) / 100);
                const scale = meta.chokkakuautovol === "0" ? 1 : Math.min(1, Math.abs(n.y - n.x));
                keyEvents.push({ beat: n.beat, object: sampleName, gain: volume * scale });
              }
            }
          }
          const m = /^([@S])([()<>])(\d+)(?:;(\d+))?(?:;(\d+))?(?:;(\d+))?$/.exec(row.spin);
          if (row.spin && !m) warn("Unsupported lane spin: " + row.spin);
          anchors[k] = {
            beat,
            effective,
            x,
            sample: slamSample,
            spin: m
              ? {
                  type: m[1] + m[2],
                  length: Number(m[3]) / 48,
                  amplitude: Number(m[4] || 250),
                  frequency: Number(m[5] || 3),
                  decay: Number(m[6] ?? 2)
                }
              : null
          };
        }
      }
      previousEnd = start + meter;
      measureStarts.push(previousEnd);
    }
    for (let lane = 0; lane < 6; lane++) closeHold(lane, previousEnd);
    const clock = timing(bpms, offset),
      display = scrollMap(scroll, stops, clock);
    for (const n of notes) {
      n.time = clock.beatToSeconds(n.beat);
      n.endTime = clock.beatToSeconds(n.endBeat);
    }
    notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
    let measure = 0;
    for (const n of notes) {
      while (measure + 1 < measures.length && measureStarts[measure + 1] <= n.beat) measure++;
      n.measure = measure;
    }
    for (const e of keyEvents) {
      e.time = clock.beatToSeconds(e.beat);
      e.channel = "11";
    }
    keyEvents.sort((a, b) => a.time - b.time);
    const bgmEvents = [],
      bgaEvents = [];
    const [dry, wet] = String(meta.m || "").split(";");
    const songStart = Math.max(0, -offset);
    if (dry) {
      bgmEvents.push({
        object: sample(dry),
        time: songStart,
        beat: clock.secondsToBeat(songStart),
        channel: "01",
        gain: Math.max(0, Number(meta.mvol ?? 100) / 100)
      });
    }
    const availableWet = wet && context.files?.has(pathFor(wet));
    if (availableWet) sample(wet);
    else if (wet) warn("Pre-rendered FX track missing: " + wet);
    const backdrop = String(meta.bg || "").split(";")[0];
    const still = /\.(png|jpe?g|bmp|webp|gif)$/i.test(backdrop) ? backdrop : meta.jacket;
    if (meta.jacket) bmp.set("jacket", pathFor(meta.jacket));
    if (still) {
      bmp.set("backdrop", pathFor(still));
      bgaEvents.push({ object: "backdrop", time: 0 });
    }
    if (meta.v) {
      const movieStart = songStart + (Number(meta.vo) || 0) / 1000;
      bmp.set("movie", pathFor(meta.v));
      bgaEvents.push({
        object: "movie",
        time: Math.max(0, movieStart),
        mediaOffset: Math.max(0, -movieStart)
      });
    }
    for (const [key, definition] of Object.entries(definitions)) {
      if (!/(?:^|;)type=switchaudio(?:;|$)/i.test(definition)) continue;
      const filename = /(?:^|;)filename=([^;]+)/i.exec(definition)?.[1];
      if (!filename) continue;
      const path = sample(filename);
      switchFiles.set(key, path);
      if (context.files && !context.files.has(path)) warn("SwitchAudio track missing: " + filename);
    }
    const chart = {
      name: filename,
      header: {
        TITLE: meta.title || filename,
        ARTIST: meta.artist || "",
        SUBARTIST: meta.effect || "",
        GENRE: "SOUND VOLTEX / K-Shoot MANIA",
        CHARTNAME: (meta.difficulty || "edit").toUpperCase(),
        PLAYLEVEL: meta.level || "?",
        BPM: String(bpms[0].value)
      },
      base: "KSH",
      format: "ksh",
      lanes: 8,
      hasScratch: false,
      ...clock,
      measureStarts,
      wav,
      bmp,
      bgmEvents,
      bgaEvents,
      keyEvents,
      events: [...bgmEvents, ...keyEvents].sort((a, b) => a.time - b.time),
      layerEvents: [],
      poorEvents: [],
      displayNotes: notes,
      hitNotes: notes,
      noteCount: notes.length,
      playable: notes.filter((n) => n.beat === n.endBeat),
      longNotes: notes.filter((n) => n.endBeat > n.beat),
      duration: Math.max(0.1, clock.beatToSeconds(previousEnd)),
      ksh: {
        gaugeGain: Number(meta.total) >= 100 ? Number(meta.total) / 100 : 2.1,
        tickrate,
        lasers,
        display,
        camera,
        spin: spin.sort((a, b) => a.beat - b.beat),
        definitions,
        automation,
        switchFiles,
        filter,
        filterGain,
        defaultFilter: meta.filtertype || "peak",
        defaultMix: Number(meta.pfiltergain ?? 50) / 100,
        wet: availableWet ? pathFor(wet) : ""
      }
    };
    for (const n of chart.longNotes) n.longStart = true;
    chart.diagnostics = [...warnings];
    return chart;
  }
  window.KshChart = { parse, upper, valueAt };
})();
