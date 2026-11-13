(function () {
  "use strict";
  const { upper, valueAt } = KshChart;
  const supported = new Set([
    "gate",
    "retrigger",
    "echo",
    "phaser",
    "pitchshift",
    "switchaudio",
    "fx",
    "flanger",
    "bitcrusher",
    "wobble",
    "tapestop",
    "sidechain",
    "lpf",
    "hpf",
    "peak",
    "none"
  ]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function controlRange(value, fallback) {
    if (!value) return [fallback, fallback];
    const parts = String(value).split(">").map(parseFloat);
    if (!parts.every(Number.isFinite)) return [fallback, fallback];
    return [clamp(parts[0] / 100, 0, 1), clamp(parts.at(-1) / 100, 0, 1)];
  }
  function effect(chart, name, family, beat) {
    const [key = "", param, feedback] = String(name || "").split(";");
    const def = chart.ksh.definitions[family + ":" + key];
    const params = Object.fromEntries((def || "").split(";").map((s) => s.split("=")));
    const prefix = family + ":" + key.toLowerCase() + ":";
    const wave = valueAt(chart.ksh.automation.get(prefix + "wavelength") || [], beat, params.waveLength);
    const mix = valueAt(chart.ksh.automation.get(prefix + "mix") || [], beat, params.mix);
    const raw = (params.type || key).toLowerCase();
    const type =
      /^lpf/.test(raw) || raw === "lowpassfilter"
        ? "lpf"
        : /^hpf/.test(raw) || raw === "highpassfilter"
          ? "hpf"
          : raw === "peakfilter"
            ? "peak"
            : raw === "bitc"
              ? "bitcrusher"
              : raw;
    const defaults = { gate: 4, echo: 4, bitcrusher: 5, wobble: 12, tapestop: 50, pitchshift: 12 };
    const amount =
      param !== undefined && Number.isFinite(Number(param))
        ? Number(param)
        : Number(String(wave || "").split("/")[1]) || defaults[type] || 8;
    const division = clamp(amount, 1, 192);
    return {
      type,
      division,
      amount,
      level: controlRange(mix, 1),
      gate: controlRange(params.rate, 0.5).at(-1),
      file: chart.ksh.switchFiles.get(family + ":" + key),
      feedback: clamp(Number(feedback ?? 60) / 100, 0, 1),
      custom: !!def,
      key
    };
  }

  function prepare(chart) {
    const { ksh } = chart,
      spans = [],
      warnings = new Set();
    function add(n, from, to, name, family) {
      if (to <= from) return;
      const prefix = family + ":" + String(name).split(";")[0].toLowerCase() + ":";
      const changes = ["mix", "wavelength"].map((k) => ksh.automation.get(prefix + k) || []);
      for (let start = from; start < to; ) {
        const end = Math.min(to, ...changes.map((list) => list[upper(list, start)]?.beat ?? Infinity));
        const fx = effect(chart, name, family, start);
        record(n, start, end, fx, family);
        start = end;
      }
    }
    function record(n, from, to, fx, family) {
      if (!ksh.wet && fx.custom)
        warnings.add(
          "Custom " + family + " " + fx.key + " uses the viewer's " + fx.type + " approximation."
        );
      if (!ksh.wet && fx.type && !supported.has(fx.type))
        warnings.add("Unsupported audio effect: " + fx.key);
      spans.push({ from, to, fx, n, family });
    }
    for (const n of chart.longNotes) {
      if (n.kind === "fx") {
        for (let i = 0; i < n.effects.length; i++) {
          const p = n.effects[i],
            to = n.effects[i + 1]?.beat ?? n.endBeat;
          add(n, p.beat, to, p.value, "fx");
        }
      } else if (n.kind === "laser") {
        let b = n.beat;
        while (b < n.endBeat) {
          const to = Math.min(
            n.endBeat,
            ksh.filter[upper(ksh.filter, b)]?.beat ?? Infinity,
            ksh.filterGain[upper(ksh.filterGain, b)]?.beat ?? Infinity
          );
          add(n, b, to, valueAt(ksh.filter, b, ksh.defaultFilter), "filter");
          b = to;
        }
      }
    }
    ksh.audioSpans = spans.sort((a, b) => a.from - b.from);
    chart.diagnostics.push(...warnings);
  }

  const rendered = new WeakMap();
  async function mix(chart, dry, audio, getBuffer) {
    const { audioSpans, wet } = chart.ksh;
    if (!audioSpans.length) return dry;
    const wetBuffer = wet ? await getBuffer(wet) : null;
    const fileBuffers = new Map();
    const names = [...new Set(audioSpans.map((item) => item.fx.file).filter(Boolean))];
    await Promise.all(names.map(async (name) => fileBuffers.set(name, await getBuffer(name))));
    const output = audio.createBuffer(dry.numberOfChannels, dry.length, dry.sampleRate);
    const rate = dry.sampleRate,
      origin = chart.bgmEvents[0].time;
    for (let c = 0; c < dry.numberOfChannels; c++) output.copyToChannel(dry.getChannelData(c), c);
    // Work only on affected sample ranges; the result is seekable on the same clock as the dry song.
    let lastYield = performance.now();
    for (const span of audioSpans) {
      const { n, fx } = span;
      const switched = fileBuffers.get(fx.file) || wetBuffer;
      if (!switched && (fx.type === "switchaudio" || fx.type === "fx")) continue;
      if (!switched && (!fx.type || !supported.has(fx.type) || fx.type === "none")) continue;
      const from = clamp(Math.round((chart.beatToSeconds(span.from) - origin) * rate), 0, dry.length);
      const to = clamp(Math.round((chart.beatToSeconds(span.to) - origin) * rate), 0, dry.length);
      if (to <= from) continue;
      const bpm = chart.bpmChanges[Math.max(0, upper(chart.bpmChanges, span.from) - 1)].bpm;
      const period = Math.max(1, Math.round((240 * rate) / (bpm * fx.division)));
      const wetMix = clamp(valueAt(chart.ksh.filterGain, span.from, chart.ksh.defaultMix), 0, 1);
      const xAt = (b) =>
        n.kind === "laser" ? clamp(n.x + ((n.y - n.x) * (b - n.beat)) / (n.endBeat - n.beat), 0, 1) : 1;
      const a = xAt(span.from),
        b = xAt(span.to);
      for (let c = 0; c < dry.numberOfChannels; c++) {
        const dest = output.getChannelData(c),
          src = dry.getChannelData(c);
        const baked = switched?.getChannelData(Math.min(c, switched.numberOfChannels - 1));
        let low = src[from] || 0,
          soft = low;
        const stages = new Float64Array(4);
        const phaseWindow = Math.max(2, Math.round(rate * 0.04));
        const pitchRatio = 2 ** (clamp(fx.amount, -48, 48) / 12);
        for (let i = from; i < to; i++) {
          const j = i - from,
            t = j / (to - from),
            phase = (j % period) / period,
            s = src[i];
          let v = s;
          if (baked && i < baked.length) v = baked[i];
          else if (fx.type === "gate") v = phase < fx.gate ? s : 0;
          else if (fx.type === "sidechain") v = s * (0.15 + 0.85 * phase);
          else if (fx.type === "retrigger") v = src[from + (j % period)];
          else if (fx.type === "bitcrusher")
            v = src[i - (j % Math.max(1, Math.min(64, Math.round(fx.division))))];
          else if (fx.type === "echo")
            v = (s + (j >= period ? src[i - period] * fx.feedback : 0)) / (1 + fx.feedback);
          else if (fx.type === "phaser") {
            const coeff = 0.4 + 0.35 * Math.sin((j / rate) * 3);
            let pass = s;
            for (let k = 0; k < stages.length; k++) {
              const next = stages[k] - coeff * pass;
              stages[k] = pass + coeff * next;
              pass = next;
            }
            v = (s + pass) * 0.5;
          } else if (fx.type === "pitchshift") {
            // Crossfade two delay taps so pitch changes without moving later notes.
            const phase = ((((j * (1 - pitchRatio)) / phaseWindow) % 1) + 1) % 1,
              other = (phase + 0.5) % 1;
            const weight = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
            const tap = (p) => src[Math.max(0, i - Math.round(p * phaseWindow))];
            v = weight * tap(phase) + (1 - weight) * tap(other);
          } else if (fx.type === "tapestop")
            v = src[from + Math.floor(j * (1 - t * clamp(fx.amount / 100, 0, 1)))];
          else if (fx.type === "flanger")
            v =
              (s +
                0.7 *
                  src[Math.max(0, i - Math.floor(rate * (0.002 + 0.0015 * Math.sin((j / rate) * 4))))]) /
              1.7;
          else {
            let knob = a + (b - a) * t;
            if (n.lane === 7) knob = 1 - knob;
            const control = fx.type === "wobble" ? (1 + Math.sin(phase * Math.PI * 2)) / 2 : knob;
            const cutoff = fx.type === "lpf" ? 0.96 - 0.95 * control : 0.012 + 0.69 * control * control;
            low += cutoff * (s - low);
            soft += cutoff * 0.28 * (low - soft);
            v = fx.type === "peak" ? s + 1.4 * (low - soft) : fx.type === "hpf" ? s - low : low;
          }
          const knob =
            span.family === "filter"
              ? clamp(n.lane === 7 ? 1 - (a + (b - a) * t) : a + (b - a) * t, 0, 1)
              : 1;
          const blend =
            (fx.level[0] + (fx.level[1] - fx.level[0]) * knob) *
            (span.family === "filter" && !baked ? wetMix : 1);
          const fade = Math.min(1, (i - from) / 64, (to - i) / 64) * blend;
          dest[i] = dest[i] * (1 - fade) + v * fade;
        }
      }
      if (performance.now() - lastYield > 22) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
    }
    return output;
  }
  function playbackBuffer(chart, object, buffer, audio, getBuffer) {
    if (!buffer || object !== chart.bgmEvents[0]?.object) return buffer;
    let cached = rendered.get(buffer);
    if (cached?.chart !== chart) {
      cached = { chart, promise: mix(chart, buffer, audio, getBuffer) };
      rendered.set(buffer, cached);
      cached.promise.catch(() => {
        if (rendered.get(buffer) === cached) rendered.delete(buffer);
      });
    }
    return cached.promise;
  }
  // Short, original synthesized cues for charts that name KSM presets.
  function synthesizeSound(audio, object) {
    if (!object.startsWith("@ksh/")) return null;
    const name = object.slice(5),
      slam = ["up", "down", "swing"].includes(name);
    const rate = audio.sampleRate,
      duration = slam ? 0.15 : 0.11;
    const buffer = audio.createBuffer(1, Math.round(rate * duration), rate);
    const data = buffer.getChannelData(0);
    let phase = 0,
      noise = 17,
      previous = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate,
        p = t / duration;
      noise = (Math.imul(1664525, noise) + 1013904223) >>> 0;
      const white = noise / 2147483648 - 1,
        bright = white - previous;
      previous = white;
      const freq = slam
        ? name === "down"
          ? 920 - 690 * p
          : 270 + 940 * p
        : name === "snare_lo"
          ? 130
          : 195;
      phase += (freq * 2 * Math.PI) / rate;
      const envelope = Math.min(1, t * 850) * Math.exp(-p * (slam ? 5 : 6));
      data[i] =
        envelope *
        (slam ? 0.32 * Math.sin(phase) + 0.15 * bright : 0.26 * bright + 0.14 * Math.sin(phase));
    }
    return buffer;
  }
  window.KshAudio = { prepare, playbackBuffer, synthesizeSound };
})();
