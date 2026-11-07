(function () {
  "use strict";

  function upper(items, value, key) {
    let lo = 0, hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (items[mid][key] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Display beats are independent of judgment time. A negative scroll ratio
  // folds the field back; a zero ratio stacks notes without stopping the clock.
  function build(chart, scrollText, speedText) {
    const diagnostics = chart.diagnostics;
    function entries(text, kind, size) {
      return String(text || "").split(",").filter(s => s.trim()).flatMap(s => {
        const values = s.trim().split("=").map(Number);
        if (values.length !== size || values.some(v => !Number.isFinite(v)) ||
            (kind === "SPEEDS" && (values[2] < 0 || ![0, 1].includes(values[3])))) {
          diagnostics.push(`Invalid #${kind} entry: ${s.trim()}`);
          return [];
        }
        return [{ beat: values[0], ratio: values[1], duration: values[2], unit: values[3] }];
      }).sort((a, b) => a.beat - b.beat);
    }
    const scrolls = entries(scrollText, "SCROLLS", 2);
    let previous = { beat: 0, position: 0, ratio: 1 };
    for (const s of scrolls) {
      s.position = previous.position + (s.beat - previous.beat) * previous.ratio;
      previous = s;
    }
    function displayBeat(beat) {
      const s = scrolls[upper(scrolls, beat, "beat") - 1];
      return s ? s.position + (beat - s.beat) * s.ratio : beat;
    }
    const speeds = entries(speedText, "SPEEDS", 4);
    speeds.forEach((s, i) => {
      s.start = chart.beatToSeconds(s.beat);
      s.end = s.unit === 1 ? s.start + s.duration : chart.beatToSeconds(s.beat + s.duration);
      s.from = i ? speeds[i - 1].ratio : 1;
    });
    function speedAt(time, beat = chart.secondsToBeat(time)) {
      const s = speeds[upper(speeds, beat, "beat") - 1];
      if (!s) return 1;
      const p = s.end > s.start ? Math.max(0, Math.min(1, (time - s.start) / (s.end - s.start))) : 1;
      return s.from + (s.ratio - s.from) * p;
    }
    for (const note of chart.displayNotes) note.displayBeat = displayBeat(note.beat);
    const spatialNotes = [...chart.displayNotes].sort((a, b) => a.displayBeat - b.displayBeat || a.time - b.time);
    // Split holds at scroll changes so a reversal inside a hold remains visible.
    const holdPieces = [], fixedHolds = [];
    for (const head of chart.longNotes) {
      if (!head.longStart || !head.longPair) continue;
      const tail = head.longPair;
      fixedHolds.push({ head, start: head, end: tail });
      const first = upper(scrolls, head.beat, "beat");
      const last = upper(scrolls, tail.beat - 1e-9, "beat");
      const cuts = [head, ...scrolls.slice(first, last)
        .map(s => ({ beat: s.beat, time: chart.beatToSeconds(s.beat), displayBeat: displayBeat(s.beat) })), tail];
      for (let i = 1; i < cuts.length; i++) holdPieces.push({ head, start: cuts[i - 1], end: cuts[i] });
    }
    chart.scroll = { displayBeat, speedAt, spatialNotes, holdPieces, fixedHolds };
  }

  // Exact, reviewed source fingerprints only. No Lua is evaluated and filenames
  // alone never opt a script into a compatibility behavior.
  const SPEEDIST = new Set([
    "df77fde119dfae9de11d4929227f6366a67b04b3d5b9625e4268c8c1c05fa55c",
    "f78b78097db8d6dba57a2759699612d3cd8cc6087514a3bdee2205fd06863777"
  ]);
  function pathKey(path) {
    const parts = [];
    for (const part of path.replace(/\\/g, "/").toLowerCase().split("/")) {
      if (part === "..") parts.pop();
      else if (part && part !== ".") parts.push(part);
    }
    return parts.join("/");
  }
  async function attachScripts(charts, context = {}) {
    const files = new Map(Array.from(context.files || [], ([key, file]) => [pathKey(key), file]));
    const folder = pathKey(context.chartPath || "").split("/").slice(0, -1).join("/");
    const reviewed = new Map();
    for (const chart of charts) {
      chart.speedScripts = [];
      for (const actor of chart.luaActors) {
        const key = pathKey(folder + "/" + actor.path);
        const file = files.get(key);
        if (!file) {
          chart.diagnostics.push(`Missing script: ${actor.path}. Load the song folder or include its Lua files.`);
          continue;
        }
        if (!reviewed.has(key)) {
          let supported = false;
          if (file.size <= 128 * 1024 && globalThis.crypto?.subtle) {
            const text = (await file.text()).replace(/\r\n?/g, "\n").trim();
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
            const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
            supported = SPEEDIST.has(hash);
          }
          reviewed.set(key, supported);
        }
        if (reviewed.get(key)) chart.speedScripts.push({
          start: chart.beatToSeconds(actor.beat),
          end: actor.end === Infinity ? Infinity : chart.beatToSeconds(actor.end),
          xmod: 1
        });
        else chart.diagnostics.push(`Unsupported Lua script: ${actor.path}. Its actor effects are not rendered.`);
      }
    }
  }

  function frame(chart, time, { fixed = false, pixelsPerSecond = 720, xmod = 2, pixelsPerBeat = 64, scripts = true, extent = 1000 } = {}) {
    const beat = chart.secondsToBeat(time);
    const script = scripts && chart.speedScripts?.find(s => time >= s.start && time < s.end);
    const scale = fixed ? pixelsPerSecond : pixelsPerBeat * (script ? script.xmod : xmod) * chart.scroll.speedAt(time, beat);
    const origin = fixed ? time : chart.scroll.displayBeat(beat);
    const key = fixed ? "time" : "displayBeat";
    const notes = fixed ? chart.displayNotes : chart.scroll.spatialNotes;
    const radius = Math.abs(scale) > 1e-8 ? extent / Math.abs(scale) : Infinity;
    return {
      notes, scale, beat,
      begin: upper(notes, origin - radius - 1e-7, key),
      end: upper(notes, origin + radius, key),
      offset: note => (note[key] - origin) * scale
    };
  }
  globalThis.StepmaniaScroll = { build, attachScripts, frame };
})();
