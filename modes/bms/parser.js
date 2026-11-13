(function () {
  "use strict";

  // Each knot has an arrival and a departure. Objects on a stop are judged at
  // arrival; the beat remains fixed until departure. Both formats share this clock.
  function clock(initial, changes, stops) {
    const knots = new Map();
    function at(beat) {
      if (!knots.has(beat)) knots.set(beat, { beat, stop: 0 });
      return knots.get(beat);
    }
    at(0).bpm = initial;
    for (const c of changes)
      if (c.beat >= 0 && Number.isFinite(c.beat) && c.bpm > 0 && Number.isFinite(c.bpm))
        at(c.beat).bpm = c.bpm;
    for (const s of stops)
      if (s.beat >= 0 && Number.isFinite(s.beat) && s.length > 0 && Number.isFinite(s.length))
        at(s.beat).stop += s.length;
    const rows = [...knots.values()].sort((a, b) => a.beat - b.beat),
      bpmChanges = [];
    let beat = 0,
      bpm = initial,
      end = 0;
    for (const row of rows) {
      row.time = end + ((row.beat - beat) * 60) / bpm;
      if (row.bpm !== undefined) {
        bpm = row.bpm;
        bpmChanges.push({ beat: row.beat, time: row.time, bpm });
      }
      row.bpm = bpm;
      beat = row.beat;
      end = row.end = row.time + (row.stop * 60) / bpm;
    }
    function floor(key, x) {
      let lo = 0,
        hi = rows.length;
      while (lo < hi) {
        const m = (lo + hi) >>> 1;
        if (rows[m][key] <= x) lo = m + 1;
        else hi = m;
      }
      return rows[Math.max(0, lo - 1)];
    }
    function beatToSeconds(b) {
      const r = floor("beat", b);
      return (b <= r.beat ? r.time : r.end) + ((b - r.beat) * 60) / r.bpm;
    }
    function secondsToBeat(t) {
      const r = floor("time", t);
      if (t < r.time) return r.beat + ((t - r.time) * r.bpm) / 60;
      return r.beat + (Math.max(0, t - r.end) * r.bpm) / 60;
    }
    return { beatToSeconds, secondsToBeat, bpmChanges };
  }
  function* selectedLines(text, random) {
    const choices = [],
      branches = [];
    let active = true;
    for (const source of text.split(/\r\n?|\n/)) {
      const line = source.trim();
      if (!line.startsWith("#")) continue;
      const match =
        /^#(RANDOM|SETRANDOM|IF|ELSEIF|ELSE|ENDIF|END\s+IF|IFEND|ENDRANDOM)\b(?:\s+(\d+))?/i.exec(line);
      if (!match) {
        if (active) yield line;
        continue;
      }
      const cmd = match[1].toUpperCase(),
        n = Number(match[2]),
        last = branches.at(-1);
      if (cmd === "RANDOM" || cmd === "SETRANDOM") {
        choices.push(!active ? null : cmd === "SETRANDOM" ? n : 1 + Math.floor(random() * n));
      } else if (cmd === "ENDRANDOM") {
        choices.pop();
      } else if (cmd === "IF") {
        const hit = choices.at(-1) === n;
        branches.push({ parent: active, hit, depth: choices.length });
        active = active && hit;
      } else if (last) {
        // Old charts often omit ENDRANDOM. Drop nested choices at the
        // boundary of the branch that owns them.
        choices.length = Math.min(choices.length, last.depth);
        if (cmd === "ELSE" || cmd === "ELSEIF") {
          const hit = !last.hit && (cmd === "ELSE" || choices.at(-1) === n);
          active = last.parent && hit;
          last.hit ||= hit;
        } else {
          branches.pop();
          active = last.parent;
        }
      }
    }
  }
  function parse(text, name, random = Math.random) {
    const header = {},
      wav = new Map(),
      bmp = new Map(),
      bpmExt = new Map(),
      stopExt = new Map();
    const ids = { WAV: wav, BMP: bmp, BPM: bpmExt, STOP: stopExt };
    const raw = [],
      defs = [],
      ratios = new Map(),
      markers = [];
    let maxMeasure = 0;
    for (const line of selectedLines(text, random)) {
      let m;
      if ((m = /^#(WAV|BMP|BPM|STOP)([0-9a-z]{2})\s+(.+)$/i.exec(line)))
        defs.push([m[1].toUpperCase(), m[2], m[3].trim()]);
      else if ((m = /^#(\d{3})([0-9a-z]{2})\s*:(.+)$/i.exec(line))) {
        const measure = Number(m[1]),
          channel = m[2].toUpperCase(),
          data = m[3].trim();
        maxMeasure = Math.max(maxMeasure, measure);
        if (channel === "02") {
          const ratio = Number(data);
          if (ratio > 0 && Number.isFinite(ratio)) ratios.set(measure, ratio);
        } else raw.push({ measure, channel, data });
      } else if ((m = /^#([a-z][a-z0-9]*)\s*(.*)$/i.exec(line))) {
        const key = m[1].toUpperCase();
        header[key] = m[2].trim();
        if (key === "LNOBJ") markers.push(header[key]);
      }
    }
    const base = Number(header.BASE) === 62 ? 62 : 36;
    const id = (s) => (base === 62 ? s : s.toUpperCase());
    const ends = new Set(markers.map(id));
    for (const [kind, key, value] of defs)
      ids[kind].set(id(key), kind === "BPM" || kind === "STOP" ? Number(value) : value);
    const starts = [0];
    for (let i = 0; i <= maxMeasure + 1; i++) starts.push(starts[i] + 4 * (ratios.get(i) || 1));
    const events = [],
      changes = [],
      stops = [];
    for (const { measure, channel, data } of raw) {
      const count = Math.floor(data.length / 2);
      for (let i = 0; i < count; i++) {
        const object = id(data.slice(i * 2, i * 2 + 2));
        if (object === "00") continue;
        const beat = starts[measure] + ((starts[measure + 1] - starts[measure]) * i) / count;
        events.push({ beat, measure, channel, object });
        if (channel === "03" || channel === "08")
          changes.push({ beat, bpm: channel === "03" ? parseInt(object, 16) : bpmExt.get(object) });
        if (channel === "09") stops.push({ beat, length: stopExt.get(object) / 48 });
      }
    }
    const initial = Number(header.BPM),
      timing = clock(initial > 0 && Number.isFinite(initial) ? initial : 120, changes, stops);
    events.sort((a, b) => a.beat - b.beat);
    const lastKey = new Map(),
      open = new Map(),
      releases = new Set();
    function pair(head, tail) {
      head.longStart = true;
      tail.longStart = false;
      head.longPair = tail;
      tail.longPair = head;
    }
    for (const event of events) {
      event.time = timing.beatToSeconds(event.beat);
      const ch = event.channel;
      if (/^[56][1-9]$/.test(ch)) {
        lastKey.delete(Number(ch[0]) - 4 + ch[1]);
        if (open.has(ch)) {
          pair(open.get(ch), event);
          open.delete(ch);
        } else {
          open.set(ch, event);
          event.longStart = true;
        }
      } else if (/^[12][1-9]$/.test(ch)) {
        if (ends.has(event.object)) {
          releases.add(event);
          const head = lastKey.get(ch);
          if (head && head.beat < event.beat) {
            pair(head, event);
            head.channel = event.channel = Number(ch[0]) + 4 + ch[1];
          }
          lastKey.delete(ch);
        } else lastKey.set(ch, event);
      }
    }
    const playable = events.filter((e) => /^[12][1-9]$/.test(e.channel) && !releases.has(e));
    const longNotes = events.filter((e) => e.longStart !== undefined);
    const displayNotes = [...playable, ...longNotes].sort((a, b) => a.beat - b.beat);
    const hitNotes = displayNotes.filter((e) => e.longStart !== false);
    const keyEvents = events.filter((e) =>
      releases.has(e) ? wav.has(e.object) : e.longStart === true || /^[12][1-9]$/.test(e.channel)
    );
    return {
      name,
      header,
      base,
      wav,
      bmp,
      events,
      playable,
      longNotes,
      ...timing,
      hitNotes,
      displayNotes,
      keyEvents,
      duration: timing.beatToSeconds(starts[maxMeasure + 1]),
      lanes: events.some((e) => /^[26][1-9]$/.test(e.channel)) ? 16 : 8,
      measureStarts: starts,
      bgmEvents: events.filter((e) => e.channel === "01"),
      bgaEvents: events.filter((e) => e.channel === "04"),
      layerEvents: events.filter((e) => e.channel === "07"),
      poorEvents: events.filter((e) => e.channel === "06"),
      noteCount: Number(header.TOTALNOTES) || hitNotes.length
    };
  }
  window.BmsChart = { parse, clock };
})();
