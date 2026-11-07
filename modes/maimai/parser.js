(function () {
  "use strict";
  const difficulties = ["EASY", "BASIC", "ADVANCED", "EXPERT", "MASTER", "Re:MASTER", "UTAGE"];

  function number(value, allowZero = false) {
    const n = Number(value);
    if (!String(value ?? "").trim() || !Number.isFinite(n) || (allowZero ? n < 0 : n <= 0))
      throw new Error("Invalid timing value " + value);
    return n;
  }

  function duration(spec, bpm) {
    let localBpm = bpm,
      wait;
    const explicit = spec.split("##");
    if (explicit.length > 2) throw new Error("Invalid duration [" + spec + "]");
    if (explicit.length === 2) {
      wait = number(explicit[0], true);
      spec = explicit[1];
    }
    const parts = spec.split("#");
    if (parts.length > 2) throw new Error("Invalid duration [" + spec + "]");
    if (parts.length === 2 && parts[0]) localBpm = number(parts[0]);
    const value = parts.at(-1).split(":");
    let seconds;
    if (value.length === 2) seconds = ((240 / localBpm) * number(value[1], true)) / number(value[0]);
    else if (value.length === 1 && (parts.length > 1 || wait !== undefined)) seconds = number(value[0], true);
    else throw new Error("Expected a ratio or explicit seconds in [" + spec + "]");
    if (!Number.isFinite(seconds)) throw new Error("Duration outside supported range");
    return { seconds, wait: wait ?? 60 / localBpm };
  }

  function slide(token, key, bpm, prefix) {
    const segments = [];
    let start = key,
      rest = token;
    while (rest) {
      const m = /^(pp|qq|[-<>^vpqszVw])([1-8])([1-8]?)([bm]*)(?:\[([^\]]+)\])?([bm]*)/.exec(rest);
      if (!m || (m[1] === "V") !== Boolean(m[3])) throw new Error("Invalid slide segment " + rest);
      const end = Number(m[3] || m[2]),
        pivot = m[3] ? Number(m[2]) : null;
      const rel = (end - start + 8) % 8,
        shape = m[1];
      if (
        (shape === "-" && (rel < 2 || rel > 6)) ||
        (shape === "^" && (rel === 0 || rel === 4)) ||
        (["w", "s", "z"].includes(shape) && rel !== 4) ||
        (shape === "v" && rel === 4) ||
        (shape === "V" && ![2, 6].includes((pivot - start + 8) % 8))
      ) {
        throw new Error("Invalid endpoints for slide " + start + shape + (pivot || "") + end);
      }
      const paths = window.MaiGeometry.paths(shape, start, end, pivot);
      segments.push({
        shape: m[1],
        start,
        end,
        pivot,
        paths,
        length: paths[0].length,
        timing: m[5] ? duration(m[5], bpm) : null,
        break: (m[4] + m[6]).includes("b"),
        mine: (m[4] + m[6]).includes("m"),
      });
      start = end;
      rest = rest.slice(m[0].length);
    }
    if (!segments.length || !segments.at(-1).timing) throw new Error("Missing slide duration");
    const timed = segments.filter((s) => s.timing);
    if (timed.length !== 1 && timed.length !== segments.length)
      throw new Error("Use a duration on every segment or on the last segment");
    const length = segments.reduce((sum, s) => sum + s.length, 0);
    let elapsed = 0;
    for (const s of segments) {
      s.begin = elapsed;
      elapsed += timed.length === 1 ? (timed[0].timing.seconds * s.length) / (length || 1) : s.timing.seconds;
      s.finish = elapsed;
    }
    return {
      kind: "slide",
      ex: false,
      segments,
      wait: timed[0].timing.wait,
      duration: elapsed,
      break: segments.some((s) => s.break),
      mine: segments.some((s) => s.mine),
      hiddenStar: prefix.includes("!"),
    };
  }

  function parseNote(token, bpm, warn) {
    if (/^[1-8]{2,}$/.test(token)) return [...token].flatMap((c) => parseNote(c, bpm, warn));
    const ex = token.includes("x");
    token = token.replaceAll("x", "");
    if (/^[1-8][1-8]+h/.test(token)) {
      warn("Extra button before hold; using the first button in " + token);
      token = token.replace(/^([1-8])[1-8]+h/, "$1h");
    }
    const match = /^([ABDE][1-8]|C[12]?|[1-8])([bhmxf@$?!]*)(.*)$/.exec(token);
    if (!match) throw new Error("Unknown note");
    const [, place, mods, tail] = match;
    const touch = /[A-E]/.test(place[0]);
    const key = Number(place.at(-1)) || 1;
    const base = {
      key,
      area: touch ? place[0] : "",
      break: mods.includes("b"),
      ex,
      mine: mods.includes("m"),
      firework: mods.includes("f"),
      star: mods.includes("$"),
      rotate: mods.includes("$$"),
    };
    if (mods.includes("h")) {
      const bracket = /^\[([^\]]+)\]([bfm]*)$/.exec(tail);
      if (tail && !bracket) throw new Error("Invalid hold duration");
      return [
        {
          ...base,
          kind: touch ? "touchHold" : "hold",
          break: base.break || !!bracket?.[2].includes("b"),
          mine: base.mine || !!bracket?.[2].includes("m"),
          firework: base.firework || !!bracket?.[2].includes("f"),
          duration: bracket ? duration(bracket[1], bpm).seconds : 0,
        },
      ];
    }
    if (!tail) return [{ ...base, kind: touch ? "touch" : "tap" }];
    if (touch) throw new Error("Unexpected touch modifier " + tail);
    const tracks = tail.split("*").map((branch, i) => {
      const marker = i && /^[?!]/.test(branch) ? branch[0] : "";
      return { ...base, ...slide(branch.slice(marker.length), key, bpm, marker || mods) };
    });
    if (!/[?!]/.test(mods))
      tracks.unshift({ ...base, star: !mods.includes("@"), slideHead: true, kind: "tap" });
    return tracks;
  }

  function upper(items, value, key) {
    let lo = 0,
      hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (items[mid][key] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // A seek indexes the completed judgments directly, including simultaneous releases.
  function autoplayScore(hits) {
    const weights = { tap: 1, touch: 1, hold: 2, touchHold: 2, slide: 3 };
    const groups = { TAP: [], HOLD: [], SLIDE: [], TOUCH: [], BREAK: [] };
    const values = new Float64Array(hits.length + 1);
    let total = 0,
      breaks = 0;
    for (let i = 0; i < hits.length; i++) {
      const n = hits[i];
      const group = n.break ? "BREAK" : n.kind === "touchHold" ? "HOLD" : n.kind.toUpperCase();
      groups[group].push(n);
      if (n.break) breaks++;
      total += n.break ? 5 : weights[n.kind];
      values[i + 1] = total;
    }
    let earnedBreaks = 0;
    for (let i = 1; i < values.length; i++) {
      if (hits[i - 1].break) earnedBreaks++;
      values[i] = (100 * values[i]) / total + (breaks ? earnedBreaks / breaks : 0);
    }
    function statsAt(time, passed, { deluxe = values[passed], pendingBreaks = 0 } = {}) {
      const counts = Object.entries(groups).map(([name, notes]) => ({
        name,
        hit: upper(notes, time, "time"),
        total: notes.length,
      }));
      const breakHits = counts.find((group) => group.name === "BREAK").hit - pendingBreaks;
      // Classic awards 100 extra points per perfect BREAK on a 500-point tap scale.
      const finale = breaks ? deluxe - breakHits / breaks + (20 * breakHits) / total : deluxe;
      return { counts, finale, deluxe };
    }
    return { achievement: values, statsAt };
  }

  function readChart(body, line, meta, slot, media, filename) {
    const warnings = [],
      notes = [],
      tempos = [];
    let bpm = 120,
      divisor = 4,
      fixedStep = 0,
      scroll = 1,
      beat = 0;
    const first = Number(meta.first || 0);
    const lead = Math.max(0, -(Number.isFinite(first) ? first : 0));
    let time = Number.isFinite(first) ? first + lead : 0;
    if (!Number.isFinite(first)) warnings.push("Invalid &first offset; using 0.");
    const initialTime = time;
    for (const raw of body.replace(/\|\|[^\n]*/g, "").split(",")) {
      let token = raw.trim().replace(/\s+/g, "");
      const here = line + (raw.match(/^\s*/)[0].match(/\n/g) || []).length;
      line += (raw.match(/\n/g) || []).length;
      const warn = (message) => warnings.push("Line " + here + " · " + message);
      if (token === "E") break;
      // A declaration terminates an unterminated note in the upstream parser.
      const interrupted = /^[^({<]+(?=[({])/.exec(token);
      if (interrupted) {
        warn("Missing comma before declaration; skipped " + interrupted[0]);
        token = token.slice(interrupted[0].length);
      }
      for (;;) {
        const control = /^(?:\(([^)]*)\)|\{([^}]*)\}|<([A-Za-z][A-Za-z0-9]*\*[^>]*)>)/.exec(token);
        if (!control) break;
        token = token.slice(control[0].length);
        try {
          if (control[1] !== undefined) {
            bpm = number(control[1]);
            if (tempos.at(-1)?.beat === beat) tempos.pop();
            tempos.push({ beat, time, bpm });
          } else if (control[2] !== undefined) {
            if (control[2][0] === "#") fixedStep = number(control[2].slice(1));
            else {
              const subdivision = Number(control[2]);
              if (!Number.isFinite(subdivision) || subdivision === 0)
                throw new Error("Invalid timing value " + control[2]);
              divisor = subdivision;
              fixedStep = 0;
            }
          } else if (/^HS\*/i.test(control[3])) scroll = number(control[3].slice(3));
          else warn("Unsupported command " + control[0]);
        } catch (e) {
          warn(e.message);
        }
      }
      if (!tempos.length) tempos.push({ beat: 0, time: initialTime, bpm });
      if (token === "E") break;
      // MajSimai separates pseudo-EACH groups by 1/32 of the current beat.
      for (const [groupIndex, chord] of token.split(/\x60+/).entries()) {
        const group = [];
        for (const part of chord.split("/").filter(Boolean)) {
          try {
            group.push(...parseNote(part, bpm, warn));
          } catch (e) {
            warn(part + " · " + e.message);
          }
        }
        const chordHeads = group.filter((n) => n.kind !== "slide" && !n.mine);
        const heads = chordHeads.length;
        if (heads === 2 && chordHeads.every((n) => !n.area)) chordHeads[0].partner = chordHeads[1].key;
        const slides = group.filter((n) => n.kind === "slide");
        const nonMineSlides = slides.filter((n) => !n.mine);
        for (const head of chordHeads) {
          if (head.star && slides.filter((track) => track.key === head.key).length > 1)
            head.doubleStar = true;
        }
        for (const n of group) {
          n.time = time + (groupIndex * 60) / bpm / 32;
          n.beat = beat + groupIndex / 32;
          n.lane = n.key - 1;
          n.channel = "1" + n.key;
          n.each = !n.mine && (n.kind === "slide" ? nonMineSlides.length > 1 : heads > 1);
          n.scroll = scroll;
          n.startTime = n.time + (n.wait || 0);
          n.endTime = n.startTime + (n.duration || 0);
          notes.push(n);
        }
      }
      const step = fixedStep || 240 / bpm / divisor;
      time += step;
      beat += (step * bpm) / 60;
    }
    if (!tempos.length) tempos.push({ beat: 0, time: initialTime, bpm });
    // A negative subdivision can put later declarations inside an earlier passage.
    tempos.sort((a, b) => a.time - b.time);
    for (let i = 1; i < tempos.length; i++) {
      const prev = tempos[i - 1], next = tempos[i];
      next.beat = prev.beat + (next.time - prev.time) * prev.bpm / 60;
    }
    const tempoAt = (x, k) => tempos[Math.max(0, upper(tempos, x, k) - 1)];
    const secondsToBeat = (t) => {
      const p = tempoAt(t, "time");
      return p.beat + ((t - p.time) * p.bpm) / 60;
    };
    const beatToSeconds = (b) => {
      const p = tempoAt(b, "beat");
      return p.time + ((b - p.beat) * 60) / p.bpm;
    };
    notes.sort((a, b) => a.time - b.time);
    let last = time,
      maxEnd = -Infinity;
    const hitNotes = [],
      longNotes = [],
      prefixEnd = [];
    for (const n of notes) {
      n.beat = secondsToBeat(n.time);
      last = Math.max(last, n.endTime);
      prefixEnd.push((maxEnd = Math.max(maxEnd, n.endTime)));
      const hit =
        n.endTime > n.time
          ? {
              ...n,
              time: n.endTime,
              beat: secondsToBeat(n.endTime),
              lane: n.kind === "slide" ? n.segments.at(-1).end - 1 : n.lane,
            }
          : n;
      hitNotes.push(hit);
      if (n.duration > 0) {
        n.longStart = true;
        longNotes.push(n);
      }
    }
    hitNotes.sort((a, b) => a.time - b.time);
    const endBeat = Math.max(beat, secondsToBeat(last));
    if (!Number.isFinite(endBeat) || endBeat > 400000)
      throw new Error("Chart timing exceeds the supported measure range");
    const measureStarts = Array.from({ length: Math.max(2, Math.ceil(endBeat / 4) + 1) }, (_, i) => i * 4);
    const wav = new Map(),
      bmp = new Map(),
      bgmEvents = [],
      bgaEvents = [];
    if (media.audio) {
      wav.set("song", media.audio);
      bgmEvents.push({ time: lead, beat: secondsToBeat(lead), channel: "01", object: "song" });
    }
    const seek = Number(meta.mv_seek || 0),
      wait = Number(meta.mv_wait || 0);
    if (media.cover && !media.video) {
      bmp.set("cover", media.cover);
      bgaEvents.push({ time: 0, object: "cover" });
    }
    if (media.video) {
      const videoStart = lead + (Number.isFinite(wait) && wait > 0 ? wait : 0);
      bmp.set("video", media.video);
      bgaEvents.push({
        time: videoStart,
        object: "video",
        mediaOffset: Number.isFinite(seek) ? Math.max(0, seek) : 0,
      });
    }
    const difficulty = difficulties[slot - 1] || "EDIT " + slot,
      title = meta.title || filename;
    return {
      name: title + " · " + String(slot).padStart(2, "0"),
      format: "simai",
      lanes: 8,
      hasScratch: false,
      base: "Simai",
      header: {
        TITLE: title,
        ARTIST: meta.artist || "",
        GENRE: "maimai",
        CHARTNAME: difficulty,
        PLAYLEVEL: meta["lv_" + slot] || "?",
        SUBARTIST: meta["des_" + slot] || meta.des || "",
        BPM: String(tempos[0].bpm),
      },
      slot,
      songMedia: media,
      diagnostics: warnings,
      displayNotes: notes,
      hitNotes,
      longNotes,
      prefixEnd,
      noteCount: hitNotes.length,
      ...autoplayScore(hitNotes),
      playable: notes,
      events: bgmEvents,
      keyEvents: [],
      bgmEvents,
      bgaEvents,
      layerEvents: [],
      poorEvents: [],
      bmp,
      wav,
      duration: Math.max(0.1, last),
      beatToSeconds,
      secondsToBeat,
      measureStarts,
      bpmChanges: tempos,
    };
  }

  function parse(text, filename = "maidata.txt", mediaFor = () => ({})) {
    text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const meta = {},
      charts = [],
      fieldWarnings = [];
    const fields = [...text.matchAll(/^[ \t]*&([\w]+)[ \t]*=/gm)];
    let line = 1,
      previous = 0;
    for (const [index, field] of fields.entries()) {
      line += (text.slice(previous, field.index).match(/\n/g) || []).length;
      previous = field.index;
      const key = field[1].toLowerCase(),
        start = field.index + field[0].length;
      const value = text.slice(start, fields[index + 1]?.index ?? text.length);
      if (/^inote_\d+$/.test(key)) {
        if (value.trim()) charts.push({ value, line, slot: Number(key.slice(6)) });
      } else {
        meta[key] = value.trim();
        if (
          !/^(title|artist|first|des(?:_\d+)?|lv_\d+|track|music|cover|background|movie|video|mv_seek|mv_wait|clock_count|wholebpm|genre|id)$/.test(
            key,
          )
        )
          fieldWarnings.push("Line " + line + " · Unhandled song field &" + key);
      }
    }
    const media = mediaFor(meta);
    return charts.map((c) => {
      const chart = readChart(c.value, c.line, meta, c.slot, media, filename);
      chart.diagnostics.unshift(...fieldWarnings);
      return chart;
    });
  }
  window.MaiSimai = { parse, upper };
})();
