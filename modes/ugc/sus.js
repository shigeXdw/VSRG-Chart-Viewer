(function () {
  "use strict";

  const tapTypes = { 1: "t", 2: "x", 3: "f", 4: "d" };
  const directions = { 1: "UC", 2: "DC", 3: "UL", 4: "UR", 5: "DL", 6: "DR" };
  const unquote = value => value.trim().replace(/^"(.*)"$/, "$1");
  const id = value => parseInt(value, 36);

  function read(text, chartPath) {
    const meta = new Map(), tempos = new Map(), meters = new Map([[0, 4]]);
    const rows = [], timelineRows = [], warnings = [];
    let resolution = 480, barBase = 0, maximumBar = 0, timeline = -1, mainTimeline = -1;
    const warn = (line, message) => {
      if (warnings.length < 100) warnings.push("Line " + line + " · " + message);
    };
    const validBar = bar => Number.isInteger(bar) && bar >= 0 && bar <= 100000;
    for (const [index, raw] of text.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
      const line = index + 1, input = raw.trim();
      if (!input.startsWith("#")) continue;
      const match = /^#([a-z0-9_]+)(?:\s*:\s*|\s+)(.*)$/i.exec(input);
      if (!match && !/^#(?:NOSPEED|NOATTRIBUTE)$/i.test(input)) {
        warn(line, "Invalid SUS directive"); continue;
      }
      const key = (match?.[1] || input.slice(1)).toUpperCase();
      const value = unquote(match?.[2] || "");
      const data = /^(\d{3})([0-9A-Z]+)$/.exec(key);
      if (data) {
        const bar = Number(data[1]) + barBase, channel = data[2];
        if (!validBar(bar)) { warn(line, "Measure outside supported range"); continue; }
        maximumBar = Math.max(maximumBar, bar);
        if (channel === "02") {
          const beats = Number(value);
          if (beats > 0 && beats <= 1024) meters.set(bar, beats);
          else warn(line, "Invalid measure length " + value);
        } else if (channel === "08" || /^(?:[15][0-9A-Z]|[234][0-9A-Z]{2})$/.test(channel)) {
          const cells = value.replace(/\s+/g, "");
          if (/^(?:[a-z0-9]{2})+$/i.test(cells)) rows.push({ bar, channel, value: cells, timeline, line });
          else warn(line, "Expected pairs of base-36 digits on channel " + channel);
        } else warn(line, "Unsupported channel " + channel);
      } else if (/^BPM[0-9A-Z]{2}$/.test(key)) {
        if (Number(value) > 0 && Number.isFinite(Number(value))) tempos.set(key.slice(3), Number(value));
        else warn(line, "Invalid BPM " + value);
      } else if (/^TIL[0-9A-Z]{2}$/.test(key)) {
        for (const entry of value.split(",").filter(v => v.trim())) {
          const pos = /^\s*(\d+)'(\d+)\s*:\s*([^\s]+)\s*$/.exec(entry);
          if (!pos || !validBar(+pos[1]) || !Number.isSafeInteger(+pos[2]) || !Number.isFinite(+pos[3])) {
            warn(line, "Invalid scroll change " + entry); continue;
          }
          maximumBar = Math.max(maximumBar, +pos[1]);
          timelineRows.push({ position: pos[1] + "'" + pos[2], speed: +pos[3], timeline: id(key.slice(3)) });
        }
      } else if (key === "MEASUREBS") {
        if (validBar(Number(value))) barBase = Number(value);
        else warn(line, "Invalid measure base");
      } else if (key === "HISPEED" || key === "MEASUREHS") {
        if (!/^[0-9a-z]{2}$/i.test(value)) warn(line, "Invalid scroll group");
        else if (key === "HISPEED") timeline = id(value);
        else mainTimeline = id(value);
      } else if (key === "NOSPEED") timeline = -1;
      else if (key === "REQUEST") {
        const ticks = /^ticks_per_beat\s+(\d+)$/i.exec(value);
        if (ticks && +ticks[1] > 0 && +ticks[1] <= 1000000) resolution = +ticks[1];
        else warn(line, "Unsupported request " + value);
      } else if (["TITLE", "SUBTITLE", "ARTIST", "DESIGNER", "DESINGER", "GENRE", "SONGID",
        "DIFFICULTY", "PLAYLEVEL", "WAVE", "WAVEOFFSET", "JACKET", "BACKGROUND", "MOVIE", "MOVIEOFFSET"].includes(key)) {
        meta.set(key, value);
      } else warn(line, "Unsupported directive #" + key);
    }

    // Resolve rows only after reading the entire file: definitions and events may be out of order.
    const starts = [0];
    let beats = 4;
    for (let bar = 0; bar <= maximumBar; bar++) {
      beats = meters.get(bar) ?? beats;
      starts.push(starts[bar] + beats * resolution);
    }
    const bpmRows = [], rawNotes = [], chains = new Map(), arrows = new Map(), airHolds = [];
    for (const row of rows) {
      const { bar, channel, value, line, timeline } = row;
      for (let i = 0; i < value.length; i += 2) {
        const pair = value.slice(i, i + 2).toUpperCase();
        if (pair === "00") continue;
        const offset = (starts[bar + 1] - starts[bar]) * (i / value.length);
        const tick = starts[bar] + offset, position = bar + "'" + offset;
        if (channel === "08") {
          if (tempos.has(pair)) bpmRows.push({ position, tick, bpm: tempos.get(pair) });
          else warn(line, "Undefined BPM " + pair);
          continue;
        }
        const [kind, size] = pair, family = channel[0], x = id(channel[1]), width = id(size);
        if (kind === "0") continue;
        if (width === 0) { warn(line, "Note has zero width"); continue; }
        if (family === "1" || family === "5") {
          const type = family === "5" ? (directions[kind] ? "a" : null) : tapTypes[kind];
          if (!type) { warn(line, "Unsupported note " + pair + " on " + channel); continue; }
          const note = { type, x, width };
          if (type === "a") note.direction = directions[kind];
          const head = { position, timeline, note, children: [] };
          rawNotes.push(head);
          if (type === "a") arrows.set([tick, x, width].join("/"), head);
          continue;
        }
        if (!(family === "2" ? /^[123]$/ : /^[12345]$/).test(kind)) {
          warn(line, "Unsupported path node " + pair); continue;
        }
        const group = family + channel[2] + (family === "2" ? ":" + x : "");
        if (!chains.has(group)) chains.set(group, []);
        chains.get(group).push({ family, kind, tick, position, x, width, timeline, line });
      }
    }
    for (const nodes of chains.values()) {
      // At a shared boundary an ending path releases the channel before the next head.
      nodes.sort((a, b) => a.tick - b.tick || Number(b.kind === "2") - Number(a.kind === "2"));
      let head = null, startTick, startLine;
      for (const n of nodes) {
        const air = n.family === "4";
        if (n.kind === "1") {
          if (head) warn(startLine, "Unclosed path before next head");
          const type = air ? "H" : n.family === "2" ? "h" : "s";
          const note = { type, x: n.x, width: n.width };
          if (air) note.height = 8;
          head = { position: n.position, timeline: n.timeline, note, children: [] };
          startTick = n.tick; startLine = n.line;
        } else if (!head) warn(n.line, "Path node without a head");
        else {
          const type = n.kind === "4" ? "c" : n.kind === "5" ? "relay" : "s";
          head.children.push({ offset: n.tick - startTick, timeline: n.timeline, note: { type, x: n.x, width: n.width } });
          if (air && head.note.x !== n.x) head.note.type = "S";
          if (n.kind === "2") {
            if (air) airHolds.push({ head, key: [startTick, head.note.x, head.note.width].join("/") });
            rawNotes.push(head);
            head = null;
          }
        }
      }
      if (head) warn(startLine, "Path has no end");
    }
    const merged = new Set();
    for (const { head, key } of airHolds) {
      const arrow = arrows.get(key);
      if (arrow) { head.note.direction = arrow.note.direction; merged.add(arrow); }
    }
    bpmRows.sort((a, b) => a.tick - b.tick);
    const dir = chartPath.replaceAll("\\", "/").split("/").slice(0, -1);
    function media(key) {
      const file = meta.get(key);
      if (!file) return "";
      const parts = dir.slice();
      for (const part of file.replaceAll("\\", "/").split("/")) {
        if (part === "..") parts.pop();
        else if (part && part !== ".") parts.push(part);
      }
      return parts.join("/");
    }
    const difficulty = meta.get("DIFFICULTY") || "0";
    const [level, ...custom] = difficulty.split(":");
    const names = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "WORLD'S END", "ULTIMA"];
    const index = /^\d+$/.test(level) ? +level : names.indexOf(level.toUpperCase());
    const headers = {
      TITLE: meta.get("TITLE"), ARTIST: meta.get("ARTIST"), GENRE: meta.get("GENRE") || "SUS",
      DESIGN: meta.get("DESIGNER") || meta.get("DESINGER"), LEVEL: meta.get("PLAYLEVEL"), DIFF: Math.max(0, index),
      BGM: media("WAVE"), BGMOFS: Number(meta.get("WAVEOFFSET")) || 0, JACKET: media("JACKET"),
      BGIMG: media("BACKGROUND"), MAINTIL: mainTimeline, MAINBPM: bpmRows[0]?.tick === 0 ? bpmRows[0].bpm : 120
    };
    return { format: "sus", base: "SUS", headers, flags: { SOFFSET: false, CLICK: false }, resolution, maximumBar, warnings,
      bpmRows, timelineRows, noteSpeedRows: [], rawNotes: rawNotes.filter(head => !merged.has(head)),
      beatRows: Array.from(meters, ([bar, numerator]) => ({ bar, numerator, denominator: 4 })),
      difficultyLabel: custom.join(":") || (names[index] ? "" : level),
      movie: media("MOVIE"), movieOffset: Number(meta.get("MOVIEOFFSET")) || 0 };
  }

  window.SusChart = { read };
})();
