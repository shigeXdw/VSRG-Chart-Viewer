(function () {
  "use strict";

  const STEP_TYPES = new Map([
    ["dance-single", ["left", "down", "up", "right"]],
    ["dance-double", ["left", "down", "up", "right", "left", "down", "up", "right"]]
  ]);
  const DIFFICULTY_COLORS = {
    Beginner: "#45dc67",
    Easy: "#45dc67",
    Medium: "#ffd642",
    Hard: "#ff4d59",
    Challenge: "#c77dff",
    Edit: "#7fe1ff"
  };
  const SNAP_COLORS = [
    [4, "#ff4c46"],
    [8, "#3f82ff"],
    [12, "#b477ff"],
    [16, "#40db5a"],
    [24, "#b477ff"],
    [32, "#ffd34a"],
    [48, "#b477ff"],
    [64, "#28d4cc"],
    [192, "#b477ff"]
  ];
  const DDR_NIGHT_RECEPTOR = loadImage("assets/noteskins/ddr-night/receptor-3x1.png");
  const DDR_NIGHT_TAP_TEXTURE = loadImage("assets/noteskins/ddr-night/full/textures/Tap Note parts (mipmaps).png");
  const DDR_NIGHT_TAP_MODEL_URL = "assets/noteskins/ddr-night/full/_down tap note model.txt";
  const DDR_NIGHT_HOLD_BODIES = {
    down: loadImage("assets/noteskins/ddr-night/full/Down Hold Body Inactive (doubleres).png"),
    left: loadImage("assets/noteskins/ddr-night/full/Left Hold Body inactive (doubleres).png"),
    right: loadImage("assets/noteskins/ddr-night/full/Right Hold Body inactive (doubleres).png"),
    up: loadImage("assets/noteskins/ddr-night/full/Up Hold Body inactive (doubleres).png")
  };
  const DDR_NIGHT_HOLD_HEAD = loadImage("assets/noteskins/ddr-night/full/Down Hold Head inactive 16x1 (doubleres).png");
  const DDR_NIGHT_HOLD_CAPS = {
    down: loadImage("assets/noteskins/ddr-night/full/Down Hold BottomCap Inactive (doubleres).png"),
    left: loadImage("assets/noteskins/ddr-night/full/Left Hold BottomCap inactive (doubleres).png"),
    right: loadImage("assets/noteskins/ddr-night/full/Right Hold BottomCap inactive (doubleres).png"),
    up: loadImage("assets/noteskins/ddr-night/full/Up Hold BottomCap inactive (doubleres).png")
  };
  const DDR_NIGHT_FLASH_DIM = loadImage("assets/noteskins/ddr-night/full/Down Flash Dim (doubleres).png");
  const DDR_NIGHT_FLASH_BRIGHT = loadImage("assets/noteskins/ddr-night/full/Down Flash Bright (doubleres).png");
  const DDR_NIGHT_MODEL_SCALE = 1 / 64;
  const DDR_NIGHT_HIT_FLASH_COLOR = "#9ff7ff";
  const DDR_NIGHT_NOTE_CACHE = new Map();
  const DDR_NIGHT_TINT_CACHE = new Map();
  let ddrNightTapModel = null;
  let ddrNightTapModelRequested = false;
  let ddrNightTapModelPromise = null;
  const DDR_NIGHT_SOURCE_DOWN_ROTATION = {
    down: 0,
    up: Math.PI,
    left: Math.PI / 2,
    right: -Math.PI / 2
  };
  const SNAP_INDEXES = [
    [4, 0],
    [8, 1],
    [12, 2],
    [16, 3],
    [24, 4],
    [32, 5],
    [48, 6],
    [64, 7],
    [192, 7]
  ];
  const DDR_NIGHT_IMAGES = [
    DDR_NIGHT_RECEPTOR,
    DDR_NIGHT_TAP_TEXTURE,
    DDR_NIGHT_HOLD_HEAD,
    DDR_NIGHT_FLASH_DIM,
    DDR_NIGHT_FLASH_BRIGHT,
    ...Object.values(DDR_NIGHT_HOLD_CAPS),
    ...Object.values(DDR_NIGHT_HOLD_BODIES)
  ];

  function notifyDdrNightSkinChanged() {
    DDR_NIGHT_NOTE_CACHE.clear();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stepmaniaSkinLoaded"));
  }

  for (const image of DDR_NIGHT_IMAGES) {
    image.addEventListener("load", notifyDdrNightSkinChanged, { once: true });
  }

  function loadImage(src) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    return image;
  }

  function imageReady(image) {
    if (image.complete && image.naturalWidth) return Promise.resolve(image);
    if (typeof image.decode === "function") {
      return image.decode().catch(() => image);
    }
    return new Promise((resolve) => {
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => resolve(image), { once: true });
    });
  }

  function readCommands(text) {
    const commands = [];
    let index = 0;
    while (index < text.length) {
      const hash = text.indexOf("#", index);
      if (hash < 0) break;
      const colon = text.indexOf(":", hash + 1);
      if (colon < 0) break;
      const name = text.slice(hash + 1, colon).trim().toUpperCase();
      let end = colon + 1;
      while (end < text.length && text[end] !== ";") end++;
      commands.push({ name, value: text.slice(colon + 1, end).trim() });
      index = end + 1;
    }
    return commands;
  }

  function parseList(value, separator = ",") {
    return String(value || "")
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function parseTimingPairs(value, fallback) {
    const pairs = parseList(value)
      .map((entry) => {
        const [beat, amount] = entry.split("=").map(Number);
        return Number.isFinite(beat) && Number.isFinite(amount) ? { beat, value: amount } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.beat - b.beat);
    return pairs.length ? pairs : fallback;
  }

  function makeTiming(bpms, stops, offset) {
    const changes = [...bpms].sort((a, b) => a.beat - b.beat);
    if (!changes.length || changes[0].beat > 0) changes.unshift({ beat: 0, value: 120 });
    const stopRows = [...stops].sort((a, b) => a.beat - b.beat);

    function beatToSeconds(beat) {
      let seconds = -(Number(offset) || 0);
      let cursor = changes[0].beat;
      let bpm = changes[0].value;
      for (let index = 1; index < changes.length; index++) {
        const change = changes[index];
        if (change.beat >= beat) break;
        seconds += (change.beat - cursor) * 60 / bpm;
        for (const stop of stopRows) {
          if (stop.beat > cursor && stop.beat <= change.beat) seconds += stop.value;
        }
        cursor = change.beat;
        bpm = change.value;
      }
      seconds += (beat - cursor) * 60 / bpm;
      for (const stop of stopRows) {
        if (stop.beat > cursor && stop.beat <= beat) seconds += stop.value;
      }
      return seconds;
    }

    function secondsToBeat(seconds) {
      let low = -64;
      let high = Math.max(256, changes.at(-1).beat + 256);
      while (beatToSeconds(high) < seconds) high *= 2;
      for (let step = 0; step < 36; step++) {
        const middle = (low + high) / 2;
        if (beatToSeconds(middle) < seconds) low = middle;
        else high = middle;
      }
      return (low + high) / 2;
    }

    return {
      beatToSeconds,
      secondsToBeat,
      bpmChanges: changes.map((change) => ({
        beat: change.beat,
        bpm: change.value,
        time: beatToSeconds(change.beat)
      }))
    };
  }

  function splitSmNotes(value) {
    const parts = [];
    let start = 0;
    for (let colon = 0; colon < value.length && parts.length < 5; colon++) {
      if (value[colon] !== ":") continue;
      parts.push(value.slice(start, colon).trim());
      start = colon + 1;
    }
    parts.push(value.slice(start).trim());
    return {
      stepType: parts[0] || "dance-single",
      description: parts[1] || "",
      difficulty: parts[2] || "Edit",
      meter: parts[3] || "0",
      radar: parts[4] || "",
      notes: parts[5] || ""
    };
  }

  function commandMap(commands) {
    const map = new Map();
    for (const command of commands) map.set(command.name, command.value);
    return map;
  }

  function extractSscCharts(commands) {
    const globals = [];
    const charts = [];
    let current = null;
    for (const command of commands) {
      if (command.name === "NOTEDATA") {
        current = [];
        charts.push(current);
      } else if (current) {
        current.push(command);
      } else {
        globals.push(command);
      }
    }
    return { globals: commandMap(globals), charts: charts.map(commandMap) };
  }

  function snapColor(beat) {
    for (const [snap, color] of SNAP_COLORS) {
      const position = beat * snap / 4;
      if (Math.abs(position - Math.round(position)) < 0.0001) return color;
    }
    return "#cfd6dc";
  }

  function snapIndex(beat) {
    for (const [snap, index] of SNAP_INDEXES) {
      const position = beat * snap / 4;
      if (Math.abs(position - Math.round(position)) < 0.0001) return index;
    }
    return 7;
  }

  function parseRows(noteText, lanes, timing, source) {
    const events = [];
    const playable = [];
    const longNotes = [];
    const hitNotes = [];
    const active = Array(lanes).fill(null);
    const measures = String(noteText || "").replace(/\/\/.*$/gm, "").split(",");

    for (let measure = 0; measure < measures.length; measure++) {
      const rows = measures[measure]
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter((row) => row && /^[0-9A-Za-z]+/.test(row));
      if (!rows.length) continue;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex].padEnd(lanes, "0");
        const beat = measure * 4 + rowIndex * 4 / rows.length;
        const time = timing.beatToSeconds(beat);
        for (let lane = 0; lane < lanes; lane++) {
          const symbol = row[lane];
          if (!symbol || symbol === "0" || symbol === "M" || symbol === "K" || symbol === "F") continue;
          const base = {
            beat,
            time,
            measure,
            channel: "1" + String(lane + 1),
            object: "",
            stepLane: lane,
            direction: source.directions[lane],
            snapColor: snapColor(beat),
            snapIndex: snapIndex(beat),
            sourceSymbol: symbol
          };
          if (symbol === "1") {
            events.push(base);
            playable.push(base);
            hitNotes.push(base);
          } else if (symbol === "2" || symbol === "4") {
            const start = { ...base, channel: "5" + String(lane + 1), longStart: true, roll: symbol === "4" };
            active[lane] = start;
            events.push(start);
            longNotes.push(start);
            hitNotes.push(start);
          } else if (symbol === "3") {
            const start = active[lane];
            const end = { ...base, channel: "5" + String(lane + 1), longStart: false, longPair: start };
            if (start) {
              start.longPair = end;
              active[lane] = null;
            }
            events.push(end);
            longNotes.push(end);
          }
        }
      }
    }

    events.sort((a, b) => a.time - b.time);
    playable.sort((a, b) => a.time - b.time);
    longNotes.sort((a, b) => a.time - b.time);
    hitNotes.sort((a, b) => a.time - b.time);
    return { events, playable, longNotes, hitNotes, displayNotes: [...playable, ...longNotes].sort((a, b) => a.time - b.time) };
  }

  function makeChart(global, entry, name, index) {
    const stepType = String(entry.STEPSTYPE || entry.stepType || "dance-single").trim();
    const directions = STEP_TYPES.get(stepType);
    if (!directions) return null;
    const lanes = directions.length;
    const offset = Number(entry.OFFSET ?? global.get?.("OFFSET") ?? global.OFFSET) || 0;
    const bpmValue = entry.BPMS ?? global.get?.("BPMS") ?? global.BPMS;
    const stopValue = entry.STOPS ?? global.get?.("STOPS") ?? global.STOPS;
    const bpms = parseTimingPairs(bpmValue, [{ beat: 0, value: Number(global.get?.("BPM") || global.BPM) || 120 }]);
    const stops = parseTimingPairs(stopValue, []);
    const timing = makeTiming(bpms, stops, offset);
    const music = entry.MUSIC ?? global.get?.("MUSIC") ?? global.MUSIC ?? "";
    const background = entry.BACKGROUND ?? global.get?.("BACKGROUND") ?? global.BACKGROUND ?? "";
    const rows = parseRows(entry.NOTES || entry.notes || "", lanes, timing, { directions });
    const wav = new Map();
    const bmp = new Map();
    const bgmEvents = [];
    if (music) {
      wav.set("__music", music);
      bgmEvents.push({ beat: 0, time: 0, channel: "01", object: "__music" });
    }
    if (background) bmp.set("__background", background);
    const bgaEvents = background ? [{ beat: 0, time: 0, channel: "04", object: "__background" }] : [];
    const measureCount = Math.max(1, Math.ceil(Math.max(0, ...rows.events.map((event) => event.beat)) / 4) + 1);
    const measureStarts = Array.from({ length: measureCount + 1 }, (_, measure) => measure * 4);
    const title = global.get?.("TITLE") || global.TITLE || name;
    const subtitle = global.get?.("SUBTITLE") || global.SUBTITLE || "";
    const artist = global.get?.("ARTIST") || global.ARTIST || "";
    const difficulty = entry.DIFFICULTY || entry.difficulty || "Edit";
    const meter = String(entry.METER || entry.meter || "0").trim();
    const chartName = [title, difficulty, meter, index + 1].filter(Boolean).join(" - ");
    const duration = Math.max(0, ...rows.events.map((event) => event.time), timing.beatToSeconds(measureStarts.at(-1)));
    return {
      name: `${chartName}.sm`,
      header: {
        TITLE: subtitle ? `${title} ${subtitle}` : title,
        ARTIST: artist,
        GENRE: "StepMania / Etterna",
        PLAYLEVEL: meter || "--",
        DIFFICULTY: difficulty,
        CHARTNAME: entry.DESCRIPTION || entry.description || difficulty,
        BPM: String(timing.bpmChanges[0]?.bpm || 120)
      },
      base: "SM",
      wav,
      bmp,
      events: [...rows.events, ...bgmEvents, ...bgaEvents].sort((a, b) => a.time - b.time),
      playable: rows.playable,
      longNotes: rows.longNotes,
      bpmChanges: timing.bpmChanges,
      duration,
      lanes,
      hasScratch: false,
      beatToSeconds: timing.beatToSeconds,
      secondsToBeat: timing.secondsToBeat,
      measureStarts,
      hitNotes: rows.hitNotes,
      displayNotes: rows.displayNotes,
      bgmEvents,
      keyEvents: [],
      bgaEvents,
      layerEvents: [],
      poorEvents: [],
      noteCount: rows.hitNotes.length,
      format: "stepmania",
      stepType,
      directions
    };
  }

  function parseSm(text, name) {
    const commands = readCommands(text);
    const global = commandMap(commands.filter((command) => command.name !== "NOTES"));
    return commands
      .filter((command) => command.name === "NOTES")
      .map((command, index) => makeChart(global, splitSmNotes(command.value), name, index))
      .filter(Boolean);
  }

  function parseSsc(text, name) {
    const { globals, charts } = extractSscCharts(readCommands(text));
    return charts
      .map((chart, index) => makeChart(globals, Object.fromEntries(chart), name, index))
      .filter(Boolean);
  }

  function arrowPath(context, x, y, size, direction) {
    const points = [
      [0, -0.58], [0.5, -0.08], [0.22, -0.08],
      [0.22, 0.58], [-0.22, 0.58], [-0.22, -0.08], [-0.5, -0.08]
    ];
    const angle = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[direction] || 0;
    context.beginPath();
    points.forEach(([px, py], index) => {
      const rx = px * Math.cos(angle) - py * Math.sin(angle);
      const ry = px * Math.sin(angle) + py * Math.cos(angle);
      const tx = x + rx * size;
      const ty = y + ry * size;
      if (index) context.lineTo(tx, ty);
      else context.moveTo(tx, ty);
    });
    context.closePath();
  }

  function drawArrow(context, x, y, size, direction, color, alpha = 1, outline = "#ffffff", phase = 0) {
    const pulse = 0.62 + Math.sin(phase * Math.PI * 2) * 0.18;
    context.save();
    context.globalAlpha = alpha;
    context.shadowColor = color;
    context.shadowBlur = 8 + pulse * 10;
    arrowPath(context, x, y, size, direction);
    const fill = context.createRadialGradient(x, y, size * 0.12, x, y, size * 0.78);
    fill.addColorStop(0, "#ffffff");
    fill.addColorStop(0.18, color);
    fill.addColorStop(0.54, color + "cc");
    fill.addColorStop(1, "#05070a");
    context.fillStyle = fill;
    context.fill();
    context.shadowBlur = 0;
    context.globalAlpha = alpha * 0.56;
    arrowPath(context, x, y, size * (0.72 + pulse * 0.06), direction);
    context.fillStyle = color;
    context.fill();
    context.globalAlpha = alpha;
    context.lineWidth = Math.max(2, size * 0.075);
    context.strokeStyle = outline;
    context.stroke();
    context.lineWidth = Math.max(1, size * 0.03);
    context.strokeStyle = "rgba(0, 0, 0, .78)";
    context.stroke();
    context.restore();
  }

  function drawDdrNightReceptor(context, x, y, size, direction, beat, alpha = 1) {
    const image = DDR_NIGHT_RECEPTOR;
    if (!image.complete || !image.naturalWidth) {
      drawArrow(context, x, y, size, direction, "#f4f6f7", alpha, "rgba(255,255,255,.72)", beat % 1);
      return;
    }
    const frameCount = 3;
    const frame = beat >= 0 && (beat * 10) % 10 >= 1 && (beat * 10) % 10 < 9 ? 1 : 0;
    const sourceWidth = image.naturalWidth / frameCount;
    const sourceHeight = image.naturalHeight;
    const angle = DDR_NIGHT_SOURCE_DOWN_ROTATION[direction] || 0;
    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.rotate(angle);
    context.shadowColor = "rgba(245, 250, 255, .9)";
    context.shadowBlur = 10;
    context.drawImage(
      image,
      frame * sourceWidth,
      0,
      sourceWidth,
      sourceHeight,
      -size,
      -size,
      size * 2,
      size * 2
    );
    context.restore();
  }

  function requestDdrNightTapModel() {
    if (ddrNightTapModelRequested) return ddrNightTapModelPromise;
    ddrNightTapModelRequested = true;
    if (typeof window !== "undefined" && window.DDR_NIGHT_TAP_MODEL_TEXT) {
      ddrNightTapModel = parseMilkshapeAsciiModel(window.DDR_NIGHT_TAP_MODEL_TEXT);
      notifyDdrNightSkinChanged();
      ddrNightTapModelPromise = Promise.resolve(ddrNightTapModel);
      return ddrNightTapModelPromise;
    }
    if (typeof fetch !== "function") {
      ddrNightTapModelPromise = Promise.resolve(null);
      return ddrNightTapModelPromise;
    }
    ddrNightTapModelPromise = fetch(DDR_NIGHT_TAP_MODEL_URL)
      .then((response) => response.ok ? response.text() : "")
      .then((text) => {
        ddrNightTapModel = parseMilkshapeAsciiModel(text);
        notifyDdrNightSkinChanged();
        return ddrNightTapModel;
      })
      .catch(() => null);
    return ddrNightTapModelPromise;
  }

  async function preloadDdrNightTapSkin() {
    await Promise.all([
      requestDdrNightTapModel(),
      imageReady(DDR_NIGHT_TAP_TEXTURE),
      imageReady(DDR_NIGHT_RECEPTOR),
      imageReady(DDR_NIGHT_HOLD_HEAD),
      imageReady(DDR_NIGHT_FLASH_DIM),
      imageReady(DDR_NIGHT_FLASH_BRIGHT),
      ...Object.values(DDR_NIGHT_HOLD_CAPS).map(imageReady),
      ...Object.values(DDR_NIGHT_HOLD_BODIES).map(imageReady)
    ]);
  }

  function parseMilkshapeAsciiModel(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const meshes = [];
    let index = lines.findIndex((line) => line === "Meshes: 2" || /^Meshes:\s*\d+/.test(line));
    if (index < 0) return null;
    index++;
    while (index < lines.length && /^"/.test(lines[index])) {
      const name = lines[index].match(/^"([^"]+)"/)?.[1] || "mesh";
      index++;
      const vertexCount = Number(lines[index++]) || 0;
      const vertices = [];
      for (let vertex = 0; vertex < vertexCount && index < lines.length; vertex++, index++) {
        const parts = lines[index].split(/\s+/).map(Number);
        vertices.push({ x: parts[1], y: -parts[2], u: parts[4], v: parts[5] });
      }
      index++; // normals count
      const normalCount = Number(lines[index - 1]) || 0;
      index += normalCount;
      const triangleCount = Number(lines[index++]) || 0;
      const triangles = [];
      for (let triangle = 0; triangle < triangleCount && index < lines.length; triangle++, index++) {
        const parts = lines[index].split(/\s+/).map(Number);
        triangles.push([parts[1], parts[2], parts[3]]);
      }
      meshes.push({ name, vertices, triangles });
    }
    return meshes;
  }

  function drawTexturedTriangle(context, image, target, source) {
    const [p0, p1, p2] = target;
    const [t0, t1, t2] = source;
    const denom = t0.x * (t1.y - t2.y) + t1.x * (t2.y - t0.y) + t2.x * (t0.y - t1.y);
    if (Math.abs(denom) < 0.0001) return;
    const a = (p0.x * (t1.y - t2.y) + p1.x * (t2.y - t0.y) + p2.x * (t0.y - t1.y)) / denom;
    const b = (p0.y * (t1.y - t2.y) + p1.y * (t2.y - t0.y) + p2.y * (t0.y - t1.y)) / denom;
    const c = (p0.x * (t2.x - t1.x) + p1.x * (t0.x - t2.x) + p2.x * (t1.x - t0.x)) / denom;
    const d = (p0.y * (t2.x - t1.x) + p1.y * (t0.x - t2.x) + p2.y * (t1.x - t0.x)) / denom;
    const e = (p0.x * (t1.x * t2.y - t2.x * t1.y)
      + p1.x * (t2.x * t0.y - t0.x * t2.y)
      + p2.x * (t0.x * t1.y - t1.x * t0.y)) / denom;
    const f = (p0.y * (t1.x * t2.y - t2.x * t1.y)
      + p1.y * (t2.x * t0.y - t0.x * t2.y)
      + p2.y * (t0.x * t1.y - t1.x * t0.y)) / denom;
    context.save();
    context.beginPath();
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.closePath();
    context.clip();
    context.setTransform(a, b, c, d, e, f);
    context.drawImage(image, 0, 0);
    context.restore();
  }

  function renderDdrNightTapFrame(snap) {
    requestDdrNightTapModel();
    const image = DDR_NIGHT_TAP_TEXTURE;
    if (!ddrNightTapModel || !image.complete || !image.naturalWidth || typeof document === "undefined") return null;
    const key = String(snap);
    if (DDR_NIGHT_NOTE_CACHE.has(key)) return DDR_NIGHT_NOTE_CACHE.get(key);
    const size = 160;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const target = canvas.getContext("2d");
    target.imageSmoothingEnabled = true;
    const uOffset = snap * 0.0625;
    for (const mesh of ddrNightTapModel) {
      for (const triangle of mesh.triangles) {
        const points = triangle.map((vertexIndex) => mesh.vertices[vertexIndex]);
        if (points.some((point) => !point)) continue;
        drawTexturedTriangle(
          target,
          image,
          points.map((point) => ({
            x: size / 2 + point.x * DDR_NIGHT_MODEL_SCALE * size,
            y: size / 2 + point.y * DDR_NIGHT_MODEL_SCALE * size
          })),
          points.map((point) => ({
            x: ((point.u + uOffset) % 1 + 1) % 1 * image.naturalWidth,
            y: ((point.v % 1) + 1) % 1 * image.naturalHeight
          }))
        );
      }
    }
    target.setTransform(1, 0, 0, 1, 0, 0);
    DDR_NIGHT_NOTE_CACHE.set(key, canvas);
    return canvas;
  }

  function drawDdrNightNote(context, x, y, size, direction, color, snap, alpha = 1) {
    const source = renderDdrNightTapFrame(snap);
    if (!source) return;
    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.rotate(DDR_NIGHT_SOURCE_DOWN_ROTATION[direction] || 0);
    context.shadowColor = color;
    context.shadowBlur = 6;
    context.drawImage(source, -size, -size, size * 2, size * 2);
    context.restore();
  }

  function getTintedImage(image, color) {
    if (!image.complete || !image.naturalWidth || typeof document === "undefined") return null;
    const key = `${image.src}|${color}`;
    if (DDR_NIGHT_TINT_CACHE.has(key)) return DDR_NIGHT_TINT_CACHE.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const target = canvas.getContext("2d");
    target.drawImage(image, 0, 0);
    target.globalCompositeOperation = "source-in";
    target.fillStyle = color;
    target.fillRect(0, 0, canvas.width, canvas.height);
    DDR_NIGHT_TINT_CACHE.set(key, canvas);
    return canvas;
  }

  function drawTintedImage(context, image, x, y, width, height, color, alpha) {
    if (!image.complete || !image.naturalWidth) return false;
    const tinted = getTintedImage(image, color);
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(tinted || image, x, y, width, height);
    context.restore();
    return true;
  }

  function drawDdrNightHitFlash(context, x, y, size, direction, color, age, duration) {
    const progress = Math.max(0, Math.min(1, age / duration));
    const dimAlpha = Math.max(0, 1 - progress) * 0.9;
    const brightAlpha = Math.max(0, 1 - progress / 0.42) * 0.8;
    context.save();
    context.translate(x, y);
    context.rotate(DDR_NIGHT_SOURCE_DOWN_ROTATION[direction] || 0);
    context.globalCompositeOperation = "lighter";
    drawTintedImage(context, DDR_NIGHT_FLASH_DIM, -size, -size, size * 2, size * 2, color, dimAlpha);
    drawTintedImage(context, DDR_NIGHT_FLASH_BRIGHT, -size, -size, size * 2, size * 2, "#ffffff", brightAlpha);
    context.restore();
  }

  function drawDdrNightHoldHead(context, x, y, size, direction, snap, alpha) {
    const image = DDR_NIGHT_HOLD_HEAD;
    if (!image.complete || !image.naturalWidth) return false;
    const frameCount = 16;
    const frameWidth = image.naturalWidth / frameCount;
    const frame = Math.max(0, Math.min(frameCount - 1, snap || 0));
    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.rotate(DDR_NIGHT_SOURCE_DOWN_ROTATION[direction] || 0);
    context.drawImage(image, frame * frameWidth, 0, frameWidth, image.naturalHeight, -size, -size, size * 2, size * 2);
    context.restore();
    return true;
  }

  function drawDdrNightHoldCap(context, x, y, size, direction, alpha) {
    const image = DDR_NIGHT_HOLD_CAPS[direction] || DDR_NIGHT_HOLD_CAPS.down;
    if (!image.complete || !image.naturalWidth) return false;
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(image, x - size, y - size, size * 2, size * 2);
    context.restore();
    return true;
  }

  function drawDdrNightHold(context, x, startY, endY, size, direction, snap, alpha = 0.92, textureAnchorY = startY) {
    const image = DDR_NIGHT_HOLD_BODIES[direction] || DDR_NIGHT_HOLD_BODIES.down;
    if (!image.complete || !image.naturalWidth) return false;
    const tailOffset = size * 0.42;
    const bodyEndY = endY >= startY ? endY - tailOffset : endY + tailOffset;
    const bodyTop = Math.round(Math.min(startY, bodyEndY));
    const bodyBottom = Math.round(Math.max(startY, bodyEndY));
    const bodyHeight = Math.max(0, bodyBottom - bodyTop);
    const width = Math.round(size * 2);
    const left = Math.round(x - width / 2);
    if (bodyHeight > 1) {
      const segmentHeight = width * image.naturalHeight / Math.max(1, image.naturalWidth);
      context.save();
      context.globalAlpha = alpha;
      context.imageSmoothingEnabled = true;
      context.beginPath();
      context.rect(left, bodyTop, width, bodyHeight);
      context.clip();
      const firstTileY = textureAnchorY - Math.ceil((textureAnchorY - bodyTop) / segmentHeight) * segmentHeight;
      for (let y = firstTileY; y < bodyBottom; y += segmentHeight) {
        context.drawImage(image, left, y, width, segmentHeight);
      }
      context.restore();
    }
    drawDdrNightHoldHead(context, x, startY, size, direction, snap, alpha);
    drawDdrNightHoldCap(context, x, endY, size, direction, alpha);
    return true;
  }

  function drawPlayfield({ context, chart, time, width, height, speed, scrollMode, fixedScrollSpeed, hiSpeed, effects = [], hitEffectsEnabled = true, hitEffectDuration = 0.36 }) {
    const directionControl = document.getElementById("stepmaniaScrollDirection");
    const downscroll = directionControl?.value === "down";
    const spacingControl = document.getElementById("stepmaniaColumnSpacing");
    const spacingScale = Math.max(0.7, Math.min(1.2, (Number(spacingControl?.value) || 92) / 100));
    const laneCount = chart.lanes;
    const oldFieldWidth = Math.min(width - 24, Math.max(laneCount * 160, height * (laneCount > 4 ? 1.05 : 0.9)));
    const oldLaneWidth = oldFieldWidth / laneCount;
    const arrowSize = Math.min(82, Math.max(46, oldLaneWidth * 0.72));
    const maxSpacing = laneCount > 1 ? Math.max(arrowSize * 1.1, (width - arrowSize * 2 - 24) / (laneCount - 1)) : oldLaneWidth;
    const laneSpacing = Math.min(maxSpacing, oldLaneWidth * spacingScale);
    const fieldWidth = laneSpacing * (laneCount - 1) + arrowSize * 2;
    const left = (width - fieldWidth) / 2;
    const laneX = (lane) => left + arrowSize + lane * laneSpacing;
    const receptorInset = Math.max(118, Math.min(150, height * 0.14));
    const receptorY = downscroll ? height - receptorInset : receptorInset;
    const pxPerSecond = scrollMode === "fixed"
      ? Math.max(50, Number(fixedScrollSpeed) || 720)
      : Math.max(180, Number(hiSpeed ?? speed) * 360);
    const visibleAhead = height / pxPerSecond + 0.5;
    const scrollSign = downscroll ? -1 : 1;

    context.fillStyle = "#050607";
    context.fillRect(0, 0, width, height);

    for (const note of chart.longNotes) {
      if (!note.longStart || !note.longPair) continue;
      if (note.longPair.time <= time || note.time > time + visibleAhead) continue;
      const startDelta = note.time - time;
      const endDelta = note.longPair.time - time;
      const rawStartY = receptorY + scrollSign * startDelta * pxPerSecond;
      const startY = startDelta > 0 ? rawStartY : receptorY;
      const endY = receptorY + scrollSign * endDelta * pxPerSecond;
      if (Math.max(startY, endY) < -arrowSize || Math.min(startY, endY) > height + arrowSize) continue;
      const x = laneX(note.stepLane);
      const bodyWidth = arrowSize * 2;
      if (!drawDdrNightHold(context, x, startY, endY, arrowSize, note.direction, note.snapIndex || 0, note.roll ? 0.82 : 0.9, rawStartY)) {
        const top = Math.min(startY, endY);
        const bottom = Math.max(startY, endY);
        const bodyGradient = context.createLinearGradient(0, top, 0, bottom);
        bodyGradient.addColorStop(0, note.snapColor + "22");
        bodyGradient.addColorStop(0.5, note.snapColor + "88");
        bodyGradient.addColorStop(1, note.snapColor + "22");
        context.globalAlpha = note.roll ? 0.56 : 0.42;
        context.fillStyle = bodyGradient;
        context.fillRect(x - bodyWidth / 2, top, bodyWidth, Math.max(4, bottom - top));
        context.globalAlpha = 1;
      }
    }

    const beat = chart.secondsToBeat(time);
    for (let lane = 0; lane < laneCount; lane++) {
      const x = laneX(lane);
      drawDdrNightReceptor(context, x, receptorY, arrowSize, chart.directions[lane], beat, 0.72);
    }
    if (hitEffectsEnabled) {
      for (const effect of effects) {
        const lane = effect.lane;
        if (lane < 0 || lane >= laneCount) continue;
        const age = time - effect.started;
        if (age < 0 || age > hitEffectDuration) continue;
        const x = laneX(lane);
        drawDdrNightHitFlash(context, x, receptorY, arrowSize, chart.directions[lane], DDR_NIGHT_HIT_FLASH_COLOR, age, hitEffectDuration);
      }
    }

    const startIndex = chart.displayNotes.findIndex((note) => note.time > time);
    const begin = startIndex < 0 ? chart.displayNotes.length : Math.max(0, startIndex - 16);
    for (let index = begin; index < chart.displayNotes.length; index++) {
      const note = chart.displayNotes[index];
      if (note.time > time + visibleAhead) break;
      const delta = note.time - time;
      if (delta <= 0) continue;
      const y = receptorY + scrollSign * delta * pxPerSecond;
      if (y < -arrowSize * 2 || y > height + arrowSize * 2) continue;
      const x = laneX(note.stepLane);
      drawDdrNightNote(context, x, y, arrowSize, note.direction, note.snapColor, note.snapIndex || 0, 0.98);
    }
  }

  PlayerModes.register({
    id: "stepmania",
    name: "StepMania / Etterna",
    detect: (file) => /\.(sm|ssc)$/i.test(file.name),
    async parse(file) {
      await preloadDdrNightTapSkin();
      const text = await file.text();
      return /\.ssc$/i.test(file.name) ? parseSsc(text, file.name) : parseSm(text, file.name);
    },
    drawPlayfield,
    selectLabel(chart) {
      return `SM ${chart.header.PLAYLEVEL || "--"} | ${chart.stepType} | ${chart.header.TITLE} [${chart.header.CHARTNAME}]`;
    },
    difficultyStyle(chart) {
      const label = chart.header.CHARTNAME || chart.header.DIFFICULTY || "StepMania";
      return [label, DIFFICULTY_COLORS[chart.header.DIFFICULTY] || "#7fe1ff"];
    },
    inspectorSubtitle(chart, artist) {
      return `${artist} · ${chart.stepType} · ${chart.measureStarts.length - 1} measures · StepMania / Etterna`;
    }
  });
})();
