(function () {
  "use strict";

  const DIFFICULTIES = [
    ["BASIC", "#43d86b"], ["ADVANCED", "#f4c542"], ["EXPERT", "#f04e63"],
    ["MASTER", "#9b63ff"], ["WORLD'S END", "#d9e0e5"], ["ULTIMA", "#ff445d"]
  ];
  const NOTE_TYPES = new Set(["t", "T", "x", "f", "d", "h", "s", "c", "a", "H", "S", "C"]);
  const RESOLUTION = 480;

  function base36(value) {
    return /^[0-9a-z]+$/i.test(value || "") ? parseInt(value, 36) : 0;
  }

  function commandParts(line) {
    // Empty fields are significant (e.g. an intentionally absent BGM).
    return line.slice(1).split("\t").map((part) => part.trim());
  }

  function parseNoteBody(body, parentType, highPrecision) {
    const type = body[0];
    if (!NOTE_TYPES.has(type)) return null;
    const child = Boolean(parentType);
    if (!child && type !== "c" && body.length < 3) return null;
    const geometry = body.length >= 3 ? {
      x: base36(body[1]), width: Math.max(1, base36(body[2]))
    } : {};
    const digits = highPrecision ? 2 : 1;
    // AIR holds can use either a lone color flag or a height followed by the flag.
    const extendedHold = type === "H" && body.length >= 3 + digits + 1;
    const air = extendedHold || type === "S" || type === "C" || parentType === "H" || parentType === "S" || parentType === "C";
    const note = { type, ...geometry };
    if (air && body.length > 3) {
      // The shipped parser selects the encoding from HIPRECISION, including
      // in VER 8: two base36 digits / 10 when true, one integer digit otherwise.
      note.height = base36(body.slice(3, 3 + digits)) / (digits === 2 ? 10 : 1);
      if (!child) note.color = body[3 + digits] || "N";
    } else if (type === "a") {
      note.direction = body.slice(3, 5) || "UC";
      note.color = body[5] || "N";
    } else if (type === "H") {
      note.color = body[3] || "N";
      note.height = 8;
    } else if (type === "f" || type === "x") note.direction = body[3] || "A";
    return note;
  }

  function parseUgc(text, name) {
    const headers = {}, flags = { SOFFSET: true, CLICK: true, HIPRECISION: false }, warnings = [];
    const bpmRows = [], beatRows = [], timelineRows = [], noteSpeedRows = [], rawNotes = [];
    let currentLong = null, currentTimeline = 0, maximumBar = 0;
    const validPosition = (value) => /^\d+'\d+$/.test(value || "")
      && value.split("'").every((part) => Number.isSafeInteger(Number(part)));
    const warn = (message) => { if (!warnings.includes(message)) warnings.push(message); };
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim());
    // Header flags determine the encoding of all notes, independent of line order.
    for (const line of lines) {
      if (!line.startsWith("@")) continue;
      const [command, ...args] = commandParts(line), key = command.toUpperCase();
      if (key === "FLAG" && args.length >= 2) {
        const flag = args[0].toUpperCase();
        flags[flag] = args[1].toUpperCase() === "TRUE";
        // Native command order matters: disabling SOFFSET enables CLICK;
        // a later explicit CLICK FALSE can disable it again.
        if (flag === "SOFFSET" && !flags[flag]) flags.CLICK = true;
      }
      else if (!["BPM", "BEAT", "TIL", "SPDMOD", "USETIL"].includes(key)) headers[key] = args.join("\t");
    }
    const version = Number(headers.VER) || 8;
    if (Number(headers.EXVER) >= 1) flags.EXLONG = true;
    const resolution = Number.isSafeInteger(Number(headers.TICKS)) && Number(headers.TICKS) > 0 ? Number(headers.TICKS) : RESOLUTION;
    if (headers.SPDDEF !== undefined || headers.SPDFLD !== undefined) warn("Extended SPDDEF/SPDFLD note-speed fields are not yet supported.");
    if (headers.BGSCENE || headers.FLDSCENE) warn("External 3D scenes are not rendered.");

    for (const line of lines) {
      if (line.startsWith("@")) {
        const [command, ...args] = commandParts(line), key = command.toUpperCase();
        const minimum = { BPM: 2, BEAT: 3, TIL: 3, SPDMOD: 2, USETIL: 1 }[key];
        if (minimum && (args.length < minimum || args.slice(0, minimum).some((arg) => arg === ""))) {
          warn(`Incomplete @${key} command ignored.`); continue;
        }
        if (key === "USETIL") currentTimeline = Number(args[0]) || 0;
        else if (key === "BEAT") {
          const [bar, numerator, denominator] = args.map(Number);
          if (Number.isInteger(bar) && bar >= 0 && bar <= 100000 && Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator) && numerator > 0 && denominator > 0) {
            beatRows.push({ bar, numerator, denominator }); maximumBar = Math.max(maximumBar, bar);
          }
        } else if (key === "BPM" || key === "TIL" || key === "SPDMOD") {
          const position = args[key === "TIL" ? 1 : 0], value = Number(args[key === "TIL" ? 2 : 1]);
          if (!validPosition(position) || !Number.isFinite(value) || (key === "BPM" && value <= 0)) continue;
          const bar = Number(position.split("'")[0]);
          if (bar > 100000) { warn("Chart positions beyond 100000 measures ignored."); continue; }
          maximumBar = Math.max(maximumBar, bar);
          if (key === "BPM") bpmRows.push({ position, bpm: value });
          else if (key === "TIL") timelineRows.push({ position, speed: value, timeline: Number(args[0]) || 0 });
          else noteSpeedRows.push({ position, speed: value });
        }
        continue;
      }
      const match = line.match(/^#([^:>]+)[:>](.+)$/);
      if (!match) continue;
      const [, position, body] = match, [payload, interval] = body.split(",");
      const absolute = validPosition(position);
      // An invalid parent ends the previous path; its children must not attach to it.
      if (position.includes("'") && !absolute) { currentLong = null; continue; }
      const note = parseNoteBody(payload, absolute ? null : currentLong?.note.type, flags.HIPRECISION);
      if (absolute) {
        currentLong = null;
        const bar = Number(position.split("'")[0]);
        if (!note || bar > 100000) continue;
        maximumBar = Math.max(maximumBar, bar);
        const raw = { position, note, interval, timeline: currentTimeline, children: [] };
        rawNotes.push(raw);
        if (["T", "h", "s", "H", "S", "C"].includes(note.type)) currentLong = raw;
      } else if (currentLong && note && /^\d+$/.test(position) && Number.isSafeInteger(Number(position))) {
        currentLong.children.push({ offset: Number(position), note, timeline: currentTimeline });
      }
    }

    return buildFieldChart(name, { format: "ugc", base: "UGC v" + version, headers, flags, warnings, resolution, bpmRows, beatRows,
      timelineRows, noteSpeedRows, rawNotes, maximumBar });
  }

  function buildFieldChart(name, { format, base, headers, flags, warnings, resolution, bpmRows, beatRows,
    timelineRows, noteSpeedRows, rawNotes, maximumBar }) {
    const explicitClicks = [];
    const signatures = new Map([[0, [4, 4]]]);
    for (const row of beatRows) signatures.set(row.bar, [row.numerator, row.denominator]);
    const measureTicks = [0];
    let signature = signatures.get(0);
    function extendMeasures(bar) {
      while (measureTicks.length <= bar + 1 && measureTicks.length <= 100002) {
        const index = measureTicks.length - 1;
        signature = signatures.get(index) || signature;
        measureTicks.push(measureTicks[index] + resolution * signature[0] * 4 / signature[1]);
      }
    }
    extendMeasures(maximumBar + 1);
    const barTick = (position) => {
      const [bar, tick] = position.split("'").map(Number);
      return measureTicks[bar] + tick;
    };
    const initialBpm = Number.isFinite(Number(headers.MAINBPM)) && Number(headers.MAINBPM) > 0 ? Number(headers.MAINBPM) : bpmRows[0]?.bpm || 120;
    const bpmMap = new Map([[0, initialBpm]]);
    for (const row of bpmRows) bpmMap.set(barTick(row.position), row.bpm);
    const bpmChanges = [...bpmMap].map(([tick, bpm]) => ({ tick, bpm })).sort((a, b) => a.tick - b.tick);
    const firstBpm = bpmChanges[0].bpm;
    const leadInSeconds = flags.SOFFSET && flags.CLICK ? measureTicks[1] / resolution * 60 / firstBpm : 0;
    let seconds = leadInSeconds, cursor = 0, bpm = firstBpm;
    for (const change of bpmChanges) {
      seconds += (change.tick - cursor) / resolution * 60 / bpm;
      change.time = seconds; cursor = change.tick; bpm = change.bpm;
    }
    function lastAt(rows, target, key) {
      let low = 0, high = rows.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (rows[middle][key] <= target) low = middle + 1; else high = middle;
      }
      return rows[Math.max(0, low - 1)];
    }
    const tickToSeconds = (tick) => {
      const row = lastAt(bpmChanges, tick, "tick");
      return row.time + (tick - row.tick) / resolution * 60 / row.bpm;
    };
    const secondsToTick = (time) => {
      const row = lastAt(bpmChanges, time, "time");
      return row.tick + (time - row.time) * row.bpm / 60 * resolution;
    };
    const parsedSpeedChanges = timelineRows.map((row) => ({ ...row, tick: barTick(row.position) })).sort((a, b) => a.tick - b.tick);
    const noteSpeedChanges = [{ tick: 0, speed: 1 }, ...noteSpeedRows.map((row) => ({ ...row, tick: barTick(row.position) }))].sort((a, b) => a.tick - b.tick);
    const timelineChanges = new Map();
    for (const change of parsedSpeedChanges) {
      if (!timelineChanges.has(change.timeline)) timelineChanges.set(change.timeline, [{ tick: 0, speed: 1, position: 0, secondsPosition: 0 }]);
      const rows = timelineChanges.get(change.timeline), previous = rows[rows.length - 1];
      if (change.tick === previous.tick) previous.speed = change.speed;
      else rows.push({ ...change,
        position: previous.position + (change.tick - previous.tick) / resolution * previous.speed,
        secondsPosition: previous.secondsPosition + (tickToSeconds(change.tick) - tickToSeconds(previous.tick)) * previous.speed
      });
    }
    const mainTimeline = Number(headers.MAINTIL) || 0;
    function timelinePosition(tick, timeline = mainTimeline) {
      const rows = timelineChanges.get(timeline);
      if (!rows) return tick / resolution;
      const row = lastAt(rows, tick, "tick");
      return row.position + (tick - row.tick) / resolution * row.speed;
    }
    const timedTimelines = new Map();
    for (const change of parsedSpeedChanges) {
      if (!timedTimelines.has(change.timeline)) timedTimelines.set(change.timeline, []);
      const rows = timedTimelines.get(change.timeline), previous = rows[rows.length - 1];
      const time = tickToSeconds(change.tick) - leadInSeconds;
      rows.push({ time, speed: change.speed,
        position: previous ? previous.position + (time - previous.time) * previous.speed : time });
    }
    // Bound how far ahead a point can be visible even if a later stop or
    // reverse section brings it back. Without SPDMOD each timeline distance
    // is the integral of its speed over elapsed seconds.
    let minimumForwardSpeed = 1, maximumLostDistance = 0;
    for (const rows of timedTimelines.values()) {
      for (const row of rows) if (row.speed > 0) minimumForwardSpeed = Math.min(minimumForwardSpeed, row.speed);
    }
    for (const rows of timedTimelines.values()) {
      let loss = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].speed >= minimumForwardSpeed) continue;
        if (i + 1 === rows.length) { loss = Infinity; break; }
        loss += (minimumForwardSpeed - rows[i].speed) * (rows[i + 1].time - rows[i].time);
      }
      maximumLostDistance = Math.max(maximumLostDistance, loss);
    }
    const hasSpeedModifiers = noteSpeedChanges.some(row => row.speed !== 1);
    function visibleUntil(time, horizonDistance) {
      if (hasSpeedModifiers || time < leadInSeconds) return Infinity;
      return time + (horizonDistance + maximumLostDistance) / minimumForwardSpeed + 1e-6;
    }
    function scrollPosition(time, timeline, noteSpeed = 1, noteTime = time) {
      const rows = timedTimelines.get(timeline);
      // Observed native behavior: without any explicit TIL, SPDMOD has no effect.
      if (!rows?.length) return time;
      let low = 0, high = rows.length;
      const lookupTime = Math.max(time, 0);
      while (low < high) {
        const middle = (low + high) >> 1;
        if (rows[middle].time <= lookupTime) low = middle + 1; else high = middle;
      }
      const previous = rows[low - 1], boundary = rows[low] || previous;
      const start = previous?.time || 0, position = previous?.position || 0;
      let speed = previous ? previous.speed : 1;
      // Only the final partial segment receives SPDMOD, and only when that
      // segment contains the target note. This also covers time before the
      // first TIL and seeking beyond a note into a later segment.
      if (boundary && noteTime >= start && (start === boundary.time || noteTime < boundary.time)) speed *= noteSpeed;
      return position + (time - start) * speed;
    }
    function timelineSeconds(tick, timeline = mainTimeline) {
      return scrollPosition(tickToSeconds(tick) - leadInSeconds, timeline);
    }
    function noteDistance(note, currentTime) {
      const absoluteTime = Number.isFinite(note.time) ? note.time : tickToSeconds(note.tick);
      const time = absoluteTime - leadInSeconds;
      const speed = Number.isFinite(note.noteSpeed) ? note.noteSpeed : 1;
      const rows = timedTimelines.get(note.timeline);
      // Most ordinary charts have no TIL or one constant event at zero.
      // Avoid repeated timing searches for every off-screen note each frame.
      if (!rows?.length) return absoluteTime - currentTime;
      if (rows.length === 1 && rows[0].time === 0) return (absoluteTime - currentTime) * rows[0].speed * speed;
      return scrollPosition(time, note.timeline, speed)
        - scrollPosition(currentTime - leadInSeconds, note.timeline, speed, time);
    }

    const notes = [], paths = [], hitNotes = [];
    const maximumGeneratedCrushTicks = 250000;
    let generatedCrushTicks = 0;
    let lastEventTick = measureTicks[maximumBar];
    for (const raw of rawNotes) {
      const tick = barTick(raw.position);
      lastEventTick = Math.max(lastEventTick, tick);
      if (raw.note.type === "c") { explicitClicks.push({ tick, time: tickToSeconds(tick) }); continue; }
      const parent = { ...raw.note, tick, beat: tick / resolution, time: tickToSeconds(tick),
        measure: Number(raw.position.split("'")[0]), lane: Math.max(0, Math.min(15, Math.floor(raw.note.x || 0))),
        timeline: raw.timeline, noteSpeed: lastAt(noteSpeedChanges, tick, "tick").speed,
        channel: "u0", object: "ugc", ugc: true };
      parent.decorative = parent.type === "C" && Number(raw.interval) === 0;
      notes.push(parent);
      // Decorative AIR-CRUSH paths (interval zero) have no judgment at the head.
      if (!(parent.type === "C" && Number(raw.interval) === 0)) hitNotes.push(parent);
      const points = [parent];
      for (const child of raw.children.sort((a, b) => a.offset - b.offset)) {
        const childTick = tick + child.offset, previous = points[points.length - 1];
        const point = { ...child.note, tick: childTick, beat: childTick / resolution, time: tickToSeconds(childTick),
          x: child.note.x ?? previous.x, width: child.note.width ?? previous.width, height: child.note.height ?? previous.height,
          timeline: child.timeline, noteSpeed: lastAt(noteSpeedChanges, childTick, "tick").speed,
          parentType: parent.type, color: child.note.color ?? parent.color, lane: Math.max(0, Math.min(15, Math.floor(child.note.x ?? previous.x))),
          channel: "u0", object: "ugc", ugc: true };
        points.push(point);
        if (point.type === "s" && parent.type !== "h" && parent.type !== "C") hitNotes.push(point);
      }
      if (points.length > 1) {
        parent.longStart = true; parent.longPair = points[points.length - 1];
        const path = { type: parent.type, points, color: parent.color, interval: raw.interval, tickNotes: [] };
        if (parent.type === "C" && /^\d+$/.test(raw.interval || "")) {
          const interval = Number(raw.interval);
          if (Number.isSafeInteger(interval) && interval > 0) {
            const requested = Math.floor((parent.longPair.tick - tick) / interval);
            const count = Math.min(requested, maximumGeneratedCrushTicks - generatedCrushTicks);
            if (count < requested) {
              const message = "AIR-CRUSH generated ticks limited to 250000 per chart.";
              if (!warnings.includes(message)) warnings.push(message);
            }
            let segment = 1;
            for (let index = 1; index <= count; index++) {
              const tickPosition = tick + index * interval;
              while (segment < points.length - 1 && points[segment].tick < tickPosition) segment++;
              const from = points[segment - 1], to = points[segment];
              const fraction = to.tick > from.tick ? (tickPosition - from.tick) / (to.tick - from.tick) : 1;
              const interpolate = (a, b) => a + (b - a) * fraction;
              const x = interpolate(from.x, to.x);
              const tickNote = { type: "C", parentType: "C", crushTick: true, generated: true,
                tick: tickPosition, beat: tickPosition / resolution, time: tickToSeconds(tickPosition),
                x, width: interpolate(from.width, to.width), height: interpolate(from.height || 0, to.height || 0),
                color: parent.color, timeline: parent.timeline,
                noteSpeed: lastAt(noteSpeedChanges, tickPosition, "tick").speed,
                lane: Math.max(0, Math.min(15, Math.floor(x))),
                channel: "u0", object: "ugc", ugc: true };
              path.tickNotes.push(tickNote);
              hitNotes.push(tickNote);
            }
            generatedCrushTicks += count;
          }
        }
        paths.push(path);
      }
      lastEventTick = Math.max(lastEventTick, points.at(-1).tick);
    }
    // Extend the inspector's bar grid when a long note reaches beyond its head's bar.
    while (measureTicks.at(-1) <= lastEventTick && measureTicks.length <= 100000) extendMeasures(measureTicks.length);
    notes.sort((a, b) => a.time - b.time); hitNotes.sort((a, b) => a.time - b.time);
    const boundary = measureTicks.findIndex(tick => tick > lastEventTick);
    const measureStarts = measureTicks.slice(0, boundary < 0 ? measureTicks.length : boundary + 1).map(tick => tick / resolution);
    const maximumTick = Math.max(measureTicks[maximumBar + 1], lastEventTick);
    const bgmOffset = leadInSeconds + (Number.isFinite(Number(headers.BGMOFS)) ? Number(headers.BGMOFS) : 0), wav = new Map(), bgmEvents = [];
    if (headers.BGM) {
      wav.set("ugc-bgm", headers.BGM);
      bgmEvents.push({ time: Math.max(0, bgmOffset), beat: secondsToTick(Math.max(0, bgmOffset)) / resolution,
        channel: "01", object: "ugc-bgm", audioOffset: Math.max(0, -bgmOffset) });
    }
    const bmp = new Map(), bgaEvents = [];
    const assetPath = (name = "") => name.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
    if (headers.BGIMG && assetPath(headers.BGIMG) !== assetPath(headers.JACKET)) {
      bmp.set("ugc-bg", headers.BGIMG);
      bgaEvents.push({ time: 0, beat: 0, channel: "04", object: "ugc-bg" });
    }
    const difficultyIndex = Math.max(0, Math.min(5, Math.floor(Number(headers.DIFF) || 0))), style = DIFFICULTIES[difficultyIndex];
    return {
      name, format, jacket: headers.JACKET || "", header: {
        TITLE: headers.TITLE || name, ARTIST: headers.ARTIST || "", SUBARTIST: headers.DESIGN ? `charted by ${headers.DESIGN}` : "",
        GENRE: headers.GENRE || "UGC", PLAYLEVEL: headers.LEVEL || headers.CONST || "--", BPM: String(firstBpm),
        DIFFICULTY: String(difficultyIndex), UGC_DIFFICULTY: style[0], UGC_COLOR: style[1]
      },
      base, resolution, mainTimeline, leadInSeconds, flags, warnings,
      fieldColor: Number.isFinite(Number(headers.FLDCOL)) ? Number(headers.FLDCOL) : -1,
      wav, bmp, events: [...notes, ...bgmEvents], playable: notes, longNotes: notes.filter((note) => note.longStart), paths,
      bpmChanges: bpmChanges.map((change) => ({ ...change, beat: change.tick / resolution })),
      speedChanges: parsedSpeedChanges, noteSpeedChanges, timelinePosition, timelineSeconds, noteDistance, visibleUntil,
      duration: tickToSeconds(maximumTick) + 2, lanes: 16, fieldUnits: 16, hasScratch: false,
      beatToSeconds: (beat) => tickToSeconds(beat * resolution), secondsToBeat: (time) => secondsToTick(time) / resolution,
      measureStarts, hitNotes, displayNotes: notes, bgmEvents, keyEvents: [], bgaEvents, layerEvents: [], poorEvents: [],
      noteCount: hitNotes.length, explicitClicks, ugc: true
    };
  }

  function fillPolygon(context, points, fill) {
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.closePath();
    context.fillStyle = fill; context.fill();
  }

  const groundInk = { t: "#ff526e", x: "#ffe45b", d: "#ff487b", h: "#ffc253", f: "#5cdbff", s: "#74ebff", T: "#74ebff" };
  const noteNames = { t: "Tap", x: "EX tap", d: "Damage", h: "Hold", f: "Flick", s: "Slide", T: "Slide", H: "AIR hold", S: "AIR slide", C: "AIR crush", a: "AIR" };
  const directions = { UC: "up", UL: "up-left", UR: "up-right", DC: "down", DL: "down-left", DR: "down-right", L: "left", R: "right" };

  function noteInk(type, note) {
    if (type === "C") return window.UgcRenderer.crushColors[note.color] || "#c5f6ff";
    if (groundInk[type]) return groundInk[type];
    const down = (note.direction || "UC").startsWith("D");
    return down !== (note.color === "I") ? "#ff91d1" : "#8dff98";
  }

  function drawInspectorNote(ctx, note, x, w, y, height) {
    const type = note.parentType || note.type, ink = noteInk(type, note), cx = x + w / 2;
    const bar = (top, h) => {
      ctx.fillStyle = "#141421"; ctx.fillRect(x, top - 1, w, h + 2);
      ctx.fillStyle = ink; ctx.fillRect(x + 1, top, Math.max(1,w - 2), h);
    };
    const mark = (points, color) => {
      ctx.beginPath();
      points.forEach(([px,py],i) => i ? ctx.lineTo(px,py) : ctx.moveTo(px,py));
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = "#171524"; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    };
    if (groundInk[type]) {
      bar(y - 3, 6);
      const radius = Math.min(6, w * .3);
      if (type === "x") {
        fillPolygon(ctx,[{x:cx-radius,y},{x:cx,y:y-7},{x:cx+radius,y},{x:cx,y:y+7}], "#fff5b7");
        ctx.fillStyle = "#765016"; ctx.fillRect(cx-1.5,y-2,3,4);
      } else if (type === "d") {
        mark([[cx-radius,y-4],[cx+radius,y+4]],ink);
        mark([[cx-radius,y+4],[cx+radius,y-4]],ink);
      } else if (type === "f") {
        const sign = note.direction === "L" ? -1 : 1;
        mark([[cx-sign*radius,y-6],[cx+sign*radius,y],[cx-sign*radius,y+6]],"#e6fbff");
      } else if (type === "h") {
        ctx.fillStyle = "#ffe8ae";
        for (const edge of [x+1,x+w-4]) ctx.fillRect(edge,y-6,3,12);
      } else if (type === "s" || type === "T") {
        ctx.fillStyle = "#156488"; ctx.fillRect(cx-radius,y-2,2*radius,4);
      }
      return;
    }
    if (note.parentType || type === "C") {
      bar(y - 2, 4);
      if (type === "C") {
        const r = Math.min(w*.4,7);
        mark([[cx-r,y],[cx,y-6],[cx+r,y],[cx,y+6],[cx-r,y]],ink);
      } else {
        ctx.fillStyle = ink; ctx.fillRect(cx-5,y-5,10,10);
        ctx.fillStyle = "#21352c"; ctx.fillRect(cx-2,y-2,4,4);
      }
      return;
    }
    // Fixed-size chevrons stay legible even on a full-width or one-lane note.
    const dir = note.direction || "UC", sign = dir.startsWith("D") ? 1 : -1;
    const lean = dir.endsWith("L") ? -1 : dir.endsWith("R") ? 1 : 0;
    const length = Math.hypot(lean,sign), dx = lean/length, dy = sign/length;
    const base = Math.max(12, Math.min(height-12, y-12));
    ctx.fillStyle = ink; ctx.fillRect(x+1,base-1,Math.max(1,w-2),2);
    const tip = [cx+dx*7,base+dy*7];
    mark([[cx-dx*7,base-dy*7],tip],ink);
    mark([[cx-dy*7,base+dx*7],tip,[cx+dy*7,base-dx*7]],ink);
  }

  function inspectorLegend(container) {
    if (container.childElementCount) return;
    for (const [label,type,extra] of [
      ["Tap","t"], ["EX tap","x"], ["Damage","d"], ["Hold","h"], ["Slide","s"],
      ["Flick left","f",{direction:"L"}], ["Flick right","f",{direction:"R"}],
      ["AIR up","a",{direction:"UC"}], ["AIR down","a",{direction:"DC"}],
      ["AIR hold","H"], ["AIR slide","S"], ["AIR action","s",{parentType:"H"}],
      ["AIR crush","C"], ["BPM change","bpm"]
    ]) {
      const item = document.createElement("span"), canvas = document.createElement("canvas");
      canvas.width = 52; canvas.height = 36; canvas.setAttribute("aria-hidden","true");
      const ctx = canvas.getContext("2d");
      if (type === "bpm") { ctx.fillStyle = "#00f030"; ctx.fillRect(3,17,46,2); }
      else if (type === "H" || type === "S") {
        ctx.strokeStyle = "#8dff98"; ctx.lineWidth = type === "H" ? 6 : 3;
        for (const offset of type === "H" ? [0] : [-3,3]) {
          ctx.beginPath(); ctx.moveTo(22+offset,32); ctx.lineTo((type === "H" ? 22 : 31)+offset,4); ctx.stroke();
        }
      } else drawInspectorNote(ctx,{type,...extra},3,46,type === "a" ? 29 : 18,36);
      item.append(canvas,label); container.append(item);
    }
  }

  function identifyNote(chart, notes, lane, y, height, start, end, mirror) {
    const beatAt = start + (height-3-y) / (height-6) * (end-start);
    const describe = (n, body = false) => {
      const type = n.parentType || n.type;
      let label = noteNames[type] || type;
      if (n.parentType) label += type === "C" ? " tick" : " action";
      let dir = n.direction;
      if (mirror && dir) dir = dir.replace(/[LR]/g, c => c === "L" ? "R" : "L");
      if (directions[dir] && (type === "a" || type === "f")) label += " " + directions[dir];
      if (body) label += " body";
      if (["a","H","S"].includes(type) && n.color === "I") label += " (inverted color)";
      const left = mirror ? 16-n.x-n.width : n.x;
      const first = Math.floor(left)+1, last = Math.ceil(left+n.width);
      const placement = first === last ? "lane " + first : "lanes " + first + "–" + last;
      const raised = ["H","S","C"].includes(type) && Number.isFinite(n.height);
      return label + " · " + placement + (raised ? " · height " + Number(n.height.toFixed(2)) : "");
    };
    let closest = Infinity, beat;
    for (const n of notes) {
      if (lane < n.x || lane >= n.x+n.width) continue;
      const row = height-3-(n.beat-start)/(end-start)*(height-6);
      const arrow = !n.parentType && ["a","S","H"].includes(n.type);
      const delta = Math.min(Math.abs(y-row), arrow ? Math.abs(y-Math.max(12,Math.min(height-12,row-12))) : Infinity);
      if (delta > 8) continue;
      if (delta < closest) { closest = delta; beat = n.beat; }
    }
    if (beat !== undefined) {
      // Include every judgment under the pointer on that beat, including the base of a raised arrow.
      return notes.filter(n => n.beat === beat && lane >= n.x && lane < n.x+n.width).map(n => describe(n)).join(" / ");
    }
    const bodies = [];
    for (const path of chart.paths) {
      if (beatAt < path.points[0].beat || beatAt > path.points.at(-1).beat || (path.type === "C" && path.color === "Z")) continue;
      const p = window.UgcCurves.sampleAt(path, beatAt*chart.resolution, chart);
      const air = ["H","S","C"].includes(path.type);
      if (air ? Math.abs(lane-p.x-p.width/2) > .3 : lane < p.x || lane >= p.x+p.width) continue;
      bodies.push(describe({...p,type:path.type,parentType:null},true));
    }
    return bodies.join(" / ");
  }

  function drawMeasure({ context, chart, notes, width, height, startBeat, endBeat, settings = {} }) {
    context.save();
    if (settings.mirror) { context.translate(width, 0); context.scale(-1, 1); }
    context.fillStyle = "#070a10";
    context.fillRect(0, 0, width, height);
    const beatY = (beat) => height - 3 - (beat - startBeat) / Math.max(0.001, endBeat - startBeat) * (height - 6);
    for (let unit = 0; unit <= 16; unit += 2) {
      const x = unit / 16 * width;
      context.strokeStyle = unit === 8 ? "#a9bac4" : "#34434c";
      context.lineWidth = unit === 8 ? 2.5 : 1;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    const beats = endBeat - startBeat;
    const step = Math.max(.25, 2 ** Math.ceil(Math.log2(beats / 48)));
    for (let offset = 0; offset < beats; offset += step) {
      const y = beatY(startBeat + offset);
      context.strokeStyle = Number.isInteger(offset) ? "#53616b" : "#202d35";
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    const unit = width / 16;
    for (const path of chart.paths) {
      if (path.points[0].beat >= endBeat || path.points.at(-1).beat < startBeat ||
          (path.type === "C" && path.color === "Z")) continue;
      const points = window.UgcCurves.prepare(path, chart);
      const hold = path.type === "h" || path.type === "H";
      const fill = path.type === "h" ? "rgba(255,182,65,.66)"
        : path.type === "C" ? noteInk("C", path.color === "Y" ? {color:"0"} : path)
        : path.type === "S" || path.type === "H" ? (path.color === "I" ? "#dc70cf" : "#64cb82")
        : "rgba(61,210,255,.60)";
      for (let index = 1; index < points.length; index++) {
        const a = points[index-1], b = points[index];
        if (a.beat >= endBeat) break;
        if (b.beat <= startBeat || b.beat <= a.beat) continue;
        const edge = (beat, side) => {
          const t = (beat - a.beat) / (b.beat - a.beat);
          const left = hold ? a.x : a.x + (b.x - a.x) * t;
          const w = a.width + (b.width - a.width) * t;
          const body = ["C", "S", "H"].includes(path.type) ? Math.min(path.type === "S" ? .65 : .4, w) : w;
          return { x: (left + (w + side * body) / 2) * unit, y: beatY(beat) };
        };
        const start = Math.max(startBeat, a.beat), end = Math.min(endBeat, b.beat);
        if (path.type === "S") {
          for (const side of [-1, 1]) fillPolygon(context,
            [edge(start,side), edge(start,side*.32), edge(end,side*.32), edge(end,side)], fill);
        } else fillPolygon(context, [edge(start,-1), edge(start,1), edge(end,1), edge(end,-1)], fill);
      }
    }
    for (const change of chart.bpmChanges) {
      if (change.beat < startBeat || change.beat >= endBeat) continue;
      context.fillStyle = "#00f030"; context.fillRect(0, beatY(change.beat) - 1, width, 2);
    }
    const isAir = n => ["a", "H", "S", "C"].includes(n.parentType || n.type);
    for (const air of [false, true]) for (const n of notes) {
      if (isAir(n) === air) drawInspectorNote(context, n, n.x * unit, Math.max(2,n.width * unit), beatY(n.beat), height);
    }
    context.restore();
  }

  PlayerModes.register({
    id: "ugc",
    name: "UGC",
    detect: (file) => /\.(ugc|sus)$/i.test(file.name),
    async parse(file, context) {
      const text = await file.text();
      if (/\.sus$/i.test(file.name)) {
        const source = window.SusChart.read(text, context?.chartPath || file.name);
        const chart = buildFieldChart(file.name, source);
        chart.diagnostics = source.warnings;
        if (source.difficultyLabel) chart.header.UGC_DIFFICULTY = source.difficultyLabel;
        if (source.movie) {
          chart.bmp.set("sus-movie", source.movie);
          chart.bgaEvents.push({ time: Math.max(0, source.movieOffset), mediaOffset: Math.max(0, -source.movieOffset),
            object: "sus-movie", channel: "04" });
        }
        return chart;
      }
      return parseUgc(text, file.name);
    },
    drawPlayfield: (options) => window.UgcRenderer.draw(options),
    scrollDuration: (speed) => window.UgcRenderer.scrollDuration(speed),
    drawMeasure, inspectorLegend, identifyNote,
    selectLabel(chart) {
      return `LV ${chart.header.PLAYLEVEL} | 16-Lane | ${chart.header.TITLE} [${chart.header.UGC_DIFFICULTY}]`;
    },
    difficultyStyle(chart) {
      return [chart.header.UGC_DIFFICULTY, chart.header.UGC_COLOR];
    },
    inspectorSubtitle(chart, artist) {
      return `${artist} · ${chart.format.toUpperCase()} · 16-unit field · ${chart.measureStarts.length - 1} measures`;
    }
  });
})();
