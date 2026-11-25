(function () {
  "use strict";

  // Original procedural artwork. Coordinates are projected CSS pixels; the
  // renderer owns projection, device-pixel scaling, and the chart-time clock.
  const PALETTES = Object.freeze({
    t: ["#ffaba8", "#f6413b", "#c71a26", "#700e19"],
    x: ["#fffde1", "#fff279", "#f2cf28", "#b78b17"],
    f: ["#d7faff", "#5cdbff", "#258ed3", "#124477"],
    h: ["#fff6c6", "#ffc253", "#da820c", "#6e3a05"],
    s: ["#d4edff", "#4087f0", "#2753c0", "#172d71"],
    a: ["#e4ffe2", "#91ff98", "#27db6d", "#126743"],
    pink: ["#ffe6f5", "#ffa2dd", "#f149ac", "#81385f"],
    d: ["#bbd7fc", "#2a58c4", "#182c73", "#080e29"],
  });
  const actionFace = ["#fff0ff", "#f535e9", "#bb1db5"];
  const slideFace = ["#bdffff", "#52edfa", "#16bdd0", "#067b91"];
  const airPlateCorner = (width, depth) => Math.min(6, width / 2, depth / 2);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const crushPalettes = new Map();
  function palette(type, color) {
    if (type === "C") {
      const tint = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#b94dfa";
      if (!crushPalettes.has(tint)) {
        const channels = [1, 3, 5].map(i => parseInt(tint.slice(i, i + 2), 16));
        const shade = (factor, white = 0) => `rgb(${channels.map(c => Math.round(c * factor + 255 * white)).join(",")})`;
        crushPalettes.set(tint, [shade(.3, .7), tint, shade(.7), shade(.35)]);
      }
      return crushPalettes.get(tint);
    }
    if (type === "a" && color === "I") return PALETTES.pink;
    return PALETTES[type === "T" ? "s" : type] || PALETTES.t;
  }
  function groundNoteFace(ctx, left, top, width, height, radius, inset = 0) {
    const w = Math.max(.1, width - inset * 2), h = Math.max(.1, height - inset * 2);
    // The camera projects this rectangle onto the lane. All four corners
    // share a radius so the texture adds no taper of its own.
    ctx.beginPath();
    ctx.roundRect(left + inset, top + inset, w, h, Math.max(0, radius - inset));
  }
  function gradient(ctx, top, height, stops) {
    const fill = ctx.createLinearGradient(0, top, 0, top + Math.max(0.1, height));
    for (const [at, color] of stops) fill.addColorStop(at, color);
    return fill;
  }
  function drawNote(ctx, {
    x, y, width, height = 10, type = "t", color,
    phase = 0,
  }) {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    const w = Math.max(0.5, width), h = Math.max(1, height);
    const left = x - w / 2, top = y - h / 2;
    const slide = type === "s" || type === "T";
    const colors = type === "a" ? actionFace : slide ? slideFace : palette(type, color);
    const rim = clamp(h * 0.09, 0.55, 2.2);
    const radius = type === "h" ? Math.min(h * .16, w * .10) : Math.min(h * .23, w * .14);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (type === "d") {
      ctx.beginPath();
      ctx.roundRect(left, top, w, h, Math.min(2, w * .2, h * .1));
      ctx.fillStyle = gradient(ctx, top, h, [[0, colors[1]], [.3, colors[2]], [1, colors[3]]]);
      ctx.fill();
      ctx.strokeStyle = colors[0]; ctx.lineWidth = rim;
      ctx.stroke();
      ctx.restore(); return;
    }

    if (type === "a" || type === "C") {
      // Both AIR plates share the top outline. The renderer projects their side faces.
      ctx.beginPath();
      ctx.roundRect(left, top, w, h, airPlateCorner(w, h));
      ctx.fillStyle = gradient(ctx, top, h, [[0, colors[1]], [.4, colors[1]], [1, colors[2]]]);
      const alpha = ctx.globalAlpha;
      if (type === "C") ctx.globalAlpha = alpha * .74;
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = clamp(h * .075, 1, 4.5);
      ctx.shadowColor = colors[1];
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.restore(); return;
    }

    if (type === "f") {
      const bezel = Math.min(h * .09, w * .045);
      groundNoteFace(ctx, left, top, w, h, radius);
      ctx.fillStyle = gradient(ctx, top, h, [[0, "#f5f6f7"], [.48, "#a9aeb8"], [1, "#edeff6"]]);
      ctx.fill();
      groundNoteFace(ctx, left, top, w, h, radius, bezel);
      ctx.fillStyle = gradient(ctx, top, h, [[0, "#404854"], [.5, "#626972"], [1, "#454b58"]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      const reflection = ctx.createLinearGradient(left, 0, left + w, 0);
      for (const [at, value] of [[.12, "#24eff800"], [.42, "#39c8f59b"], [.58, "#39c8f59b"], [.88, "#24eff800"]]) {
        reflection.addColorStop(at, value);
      }
      ctx.fillStyle = reflection;
      ctx.fillRect(left, top, w, h);
      ctx.restore();
      const padWidth = w * .43, padHeight = h * .72;
      const padTop = y - padHeight / 2;
      ctx.beginPath();
      ctx.roundRect(x - padWidth / 2, padTop, padWidth, padHeight, Math.min(w * .045, h * .11));
      ctx.fillStyle = gradient(ctx, padTop, padHeight, [[0, "#70eaff"], [.45, "#31bfdd"], [1, "#176482"]]);
      ctx.fill();
      ctx.strokeStyle = "#9ce4ee";
      ctx.lineWidth = bezel * .43;
      ctx.stroke();
      ctx.fillStyle = "#defaff";
      ctx.fillRect(x - padWidth * .19, y - h * .055, padWidth * .38, h * .11);
      ctx.restore(); return;
    }

    if (slide || type === "x") {
      const glow = type === "x" ? "#ffeb6788" : "#c98bfa80";
      const bloomTop = top - h * .2;
      ctx.fillStyle = gradient(ctx, bloomTop, h * .5, [[0, "transparent"], [.43, glow], [1, "transparent"]]);
      ctx.fillRect(left + w * .05, bloomTop, w * .9, h * .5);
    }

    // A small dark underside separates notes from bright hold/slide bodies.
    groundNoteFace(ctx, left, top + h * 0.055, w, h, radius);
    ctx.fillStyle = "rgba(5,2,12,.72)";
    ctx.fill();
    groundNoteFace(ctx, left, top, w, h, radius);
    ctx.fillStyle = gradient(ctx, top, h, [
      [0, "#ffffff"], [0.18, "#fff9ed"], [0.56, "#c2c8ca"], [0.82, "#f4f2e9"], [1, "#858e91"],
    ]);
    ctx.fill();
    groundNoteFace(ctx, left, top, w, h, radius, rim);
    ctx.fillStyle = gradient(ctx, top + rim, h - rim * 2, [
      [0, colors[0]], [0.2, colors[0]], [0.42, colors[1]], [0.69, colors[2]], [1, colors[3]],
    ]);
    ctx.fill();

    if (w > 10 && h > 3) {
      // Crisp reflected strip on the upper surface; no texture or bitmap copy.
      const gleamY = top + h * 0.24;
      ctx.strokeStyle = "rgba(255,255,255,.94)";
      ctx.lineWidth = clamp(h * 0.075, 0.5, 1.8);
      ctx.beginPath();
      ctx.moveTo(left + Math.min(w * 0.08, h), gleamY);
      ctx.lineTo(left + w - Math.min(w * 0.08, h), gleamY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.24)";
      ctx.lineWidth = Math.max(0.5, h * 0.08);
      ctx.beginPath();
      ctx.moveTo(left + w * 0.08, top + h * 0.83);
      ctx.lineTo(left + w * 0.92, top + h * 0.83);
      ctx.stroke();
    }

    if (slide || type === "x") {
      const stripeWidth = Math.max(1, Math.min(w * 0.82, w - rim * 5));
      const ex = type === "x";
      ctx.fillStyle = ex ? "#fffce0" : "#d2ffff";
      const opacity = ex ? .84 + .16 * Math.sin(phase * 4.2) : .75;
      ctx.globalAlpha *= opacity;
      ctx.fillRect(x - stripeWidth / 2, y, stripeWidth, Math.max(0.6, h * (ex ? .16 : .09)));
    }
    ctx.restore();
  }

  const airChevron = [[-.46, .05], [0, .34], [.46, .05], [.46, .30], [0, .49], [-.46, .30]];
  function drawAir(ctx, { x, y, width, height = 32, direction = "UC", color = "N" }) {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    const down = direction.startsWith("D");
    const pink = down !== (color === "I");
    const tint = pink ? "#ff91d1" : "#8dff98";
    const top = y - height * .46;
    const half = width * .46, tip = y + height * .1;
    const rim = Math.max(2, Math.min(8, width * .025));
    ctx.save();
    ctx.lineJoin = "round";
    // Both directions use the same artwork. Flip it about the sprite center
    // before projection so the tail follows the head and lateral lean stays in world space.
    if (!down) {
      ctx.translate(0, 2 * y);
      ctx.scale(1, -1);
    }
    // Shear both halves by the slope of the arrow's trailing edge.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.transform(-side, height * .29 / half, 0, 1, x + side * half, 0);
      ctx.fillStyle = gradient(ctx, top, tip - top,
        [[0, "rgba(255,255,255,0)"], [.68, "rgba(255,255,255,.9)"], [1, tint]]);
      ctx.save(); ctx.globalAlpha *= .4;
      ctx.beginPath(); ctx.rect(0, top, half, tip - top); ctx.fill(); ctx.restore();
      for (let stripe = 0; stripe < 40; stripe++) {
        const wave = Math.sin((side < 0 ? stripe : 79 - stripe) * 2.7);
        const from = top + height * (.03 + .06 * wave);
        ctx.fillRect((stripe + .5) * half / 40 - width * .0045, from, width * .009, tip - from);
      }
      ctx.restore();
    }
    ctx.beginPath();
    airChevron.forEach(([px, py], i) => i ? ctx.lineTo(x + px * width, y + py * height) : ctx.moveTo(x + px * width, y + py * height));
    ctx.closePath();
    const fill = ctx.createLinearGradient(x - width * .46, y, x + width * .46, y);
    fill.addColorStop(0, pink ? "#e840e1" : "#20d824");
    fill.addColorStop(.48, pink ? "#ff70f0" : "#59fc41");
    fill.addColorStop(.51, pink ? "#ee3cda" : "#1cda24");
    fill.addColorStop(1, pink ? "#fc7aef" : "#63f845");
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = "#f4fff0"; ctx.lineWidth = rim; ctx.stroke();
    ctx.restore();
  }

  function seededUnit(seed, index) {
    let value = ((Number(seed) || 0) | 0) ^ Math.imul(index + 1, 0x9e3779b1);
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
  }
  function flameTongue(ctx, x, y, radius, rise, drift) {
    const tip = x + drift;
    ctx.beginPath();
    ctx.moveTo(x - radius, y);
    ctx.bezierCurveTo(x - radius * 1.2, y - rise * .51, tip + radius * .29, y - rise * .6, tip, y - rise);
    ctx.bezierCurveTo(tip + radius * .9, y - rise * .78, x + radius * .59, y - rise * .6, x + radius * .84, y - rise * .39);
    ctx.bezierCurveTo(x + radius * 1.27, y - rise * .19, x + radius, y - rise * .07, x + radius, y);
    ctx.quadraticCurveTo(x, y + 5, x - radius, y);
    ctx.closePath(); ctx.fill();
  }

  const mineFramesByWidth = new Map();
  function bakeMineFrames(span) {
    const width = Math.max(64, span * 32), bodyArea = 64, backPad = 34, height = bodyArea + backPad, count = 12;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height * count;
    const ctx = canvas.getContext("2d"), y = backPad + bodyArea / 2;
    const tongues = span * 2 + 1, spacing = width * .58 / tongues;
    return Array.from({ length: count }, (_, frame) => {
      const phase = frame * Math.PI * 2 / count;
      ctx.save();
      ctx.translate(0, frame * height);
      drawNote(ctx, { x: width / 2, y, width: width * .96, height: 43, type: "d" });
      ctx.save();
      ctx.translate(width / 2, y - 13);
      ctx.scale(width * .43, 29);
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      halo.addColorStop(0, "#36c9ffe0");
      halo.addColorStop(.48, "#135bff65");
      halo.addColorStop(1, "#1256ff00");
      ctx.fillStyle = halo;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
      for (let i = 0; i < tongues; i++) {
        const wave = phase + seededUnit(21, i) * Math.PI * 2;
        const x = width * .21 + (i + .5 + (seededUnit(12, i) - .5) * .46) * spacing;
        const radius = spacing * (.73 + seededUnit(35, i) * .36);
        const rise = Math.min(y - 7, 32 + 23 * seededUnit(51, i) + 8 * Math.sin(wave));
        const drift = radius * (.39 + .68 * Math.cos(wave + i));
        ctx.fillStyle = gradient(ctx, y - rise, rise + 5,
          [[0, "#2385ff00"], [.26, "#2262fc75"], [.62, "#199fffce"], [.83, "#45c1ffad"], [1, "#0f60fa00"]]);
        ctx.shadowColor = "#286cff9a"; ctx.shadowBlur = 5;
        flameTongue(ctx, x, y, radius, rise, drift);
        ctx.shadowBlur = 0;
        const core = rise * .57;
        ctx.fillStyle = gradient(ctx, y - core, core + 5,
          [[0, "#2a96ff00"], [.43, "#40bcffaa"], [.71, "#82e4ffba"], [1, "#43cbff00"]]);
        flameTongue(ctx, x - radius * .13, y + 1, radius * .51, core, drift * .8);
      }
      ctx.restore();
      return { canvas, region: [0, frame * height, width, height], backPadding: backPad / bodyArea };
    });
  }

  function mineSprite(time, lanes = 1) {
    const span = 2 ** Math.round(Math.log2(clamp(lanes, 1, 16)));
    if (!mineFramesByWidth.has(span)) mineFramesByWidth.set(span, bakeMineFrames(span));
    const frames = mineFramesByWidth.get(span), frame = Math.floor(time * 24) % frames.length;
    return frames[(frame + frames.length) % frames.length];
  }
  function projectedPolygon(ctx, projectPoint, points) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const p = projectPoint(...point);
      if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
  }

  // Each palette shares one small sheet. Transparent gutters isolate filtered cells.
  const sprites = { ring: [0, 0, 128, 128], flash: [128, 0, 64, 64],
    spark: [128, 64, 32, 32], streak: [160, 64, 32, 32] };
  const AIR_ACTION_TRAIL_TIME = .24, AIR_ACTION_BURST_TIME = .32;
  const isAirAction = parentType => parentType === "H" || parentType === "S";
  const effectAtlases = new WeakMap();
  function effectAtlas(colors) {
    if (effectAtlases.has(colors)) return effectAtlases.get(colors);
    const canvas = document.createElement("canvas");
    canvas.width = 192; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const ring = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
    for (const [at, color] of [[0, "transparent"], [.78, "transparent"], [.85, colors[1]], [.89, colors[0]], [.93, colors[1]], [1, "transparent"]]) ring.addColorStop(at, color);
    ctx.fillStyle = ring; ctx.fillRect(0, 0, 128, 128);
    const flash = ctx.createRadialGradient(160, 32, 0, 160, 32, 30);
    flash.addColorStop(0, "#fffef3"); flash.addColorStop(.35, colors[0]); flash.addColorStop(.7, colors[1]); flash.addColorStop(1, "transparent");
    ctx.fillStyle = flash; ctx.fillRect(128, 0, 64, 64);
    ctx.fillStyle = colors[1]; ctx.beginPath();
    ctx.moveTo(144, 65); ctx.lineTo(156, 80); ctx.lineTo(144, 95); ctx.lineTo(132, 80); ctx.closePath(); ctx.fill();
    ctx.fillStyle = colors[0]; ctx.beginPath();
    ctx.moveTo(144, 69); ctx.lineTo(148, 80); ctx.lineTo(144, 91); ctx.lineTo(140, 80); ctx.closePath(); ctx.fill();
    ctx.fillStyle = gradient(ctx, 65, 30, [[0, "transparent"], [.5, colors[1]], [.91, colors[0]], [1, "transparent"]]);
    ctx.fillRect(162, 65, 28, 30);
    effectAtlases.set(colors, canvas);
    return canvas;
  }

  let actionTrailTexture;
  function airActionTrail() {
    if (actionTrailTexture) return actionTrailTexture;
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = gradient(ctx, 0, canvas.height, [
      [0, "#efffff00"], [.12, "#efffffbd"], [.29, "#f7ffff"], [.87, "#ffffff"], [1, "#eefff200"],
    ]);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const edges = ctx.createLinearGradient(0, 0, canvas.width, 0);
    for (const [at, color] of [[0, "#ffffff00"], [.1, "#ffffff"], [.9, "#ffffff"], [1, "#ffffff00"]]) {
      edges.addColorStop(at, color);
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = edges;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    actionTrailTexture = canvas;
    return canvas;
  }

  function drawHitFloor(hit, paint) {
    const { type, parentType, air, color, direction, age, worldWidth, projectPoint } = hit;
    if (isAirAction(parentType)) {
      if (age < 0 || age >= AIR_ACTION_TRAIL_TIME) return;
      const retreat = age / AIR_ACTION_TRAIL_TIME;
      // Keep the initial retreat gentle, then send the entire strip past the lane's far edge.
      const travel = 2250 * retreat + 2600 * retreat ** 4;
      const near = -40 + travel, far = 2180 + travel;
      const half = worldWidth * .31, alpha = .63 * (1 - retreat) ** .8;
      paint(airActionTrail(), undefined, [
        projectPoint(-half, 0, far), projectPoint(half, 0, far),
        projectPoint(half, 0, near), projectPoint(-half, 0, near),
      ], alpha);
      return;
    }
    const kind = parentType || type, duration = kind === "C" ? .25 : .5;
    if (age < 0 || age >= duration || (!air && parentType && ["h", "s", "T"].includes(kind))) return;
    const progress = age / duration, ease = 1 - (1 - progress) ** 3;
    const atlas = effectAtlas(hitPalette(kind, air, color, direction));
    const draw = (region, rx, rz, elevation) => paint(atlas, region, [
      projectPoint(-rx, elevation, rz), projectPoint(rx, elevation, rz),
      projectPoint(rx, elevation, -rz), projectPoint(-rx, elevation, -rz)
    ], (1 - progress) ** 2);
    draw(sprites.ring, worldWidth * .36 + 60 * ease, 25 + 75 * ease, 0);
    if (age < .12) draw(sprites.flash, worldWidth * .48, 24, 1);
  }

  const actionBurstTextures = new Map();
  const actionBurstCell = 160;
  function airActionBurstTexture(inverted) {
    if (actionBurstTextures.has(inverted)) return actionBurstTextures.get(inverted);
    const canvas = document.createElement("canvas"), size = actionBurstCell, center = size / 2;
    canvas.width = size * 2; canvas.height = size;
    const ctx = canvas.getContext("2d");
    const bright = inverted ? "#ff49ee" : "#99ff16";
    const tint = inverted ? "#e421ce" : "#51ed08";
    const halo = ctx.createRadialGradient(center, center, 0, center, center, center);
    const hub = inverted ? "#ffd1a6" : "#ddff62";
    for (const [at, value] of [[0, hub], [.14, bright + "f4"], [.34, tint + "91"], [.61, tint + "38"], [1, tint + "00"]]) {
      halo.addColorStop(at, value);
    }
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    const rays = ctx.createRadialGradient(center, center, 0, center, center, center);
    for (const [at, value] of [[0, hub], [.25, bright], [.55, bright + "d4"], [1, tint + "00"]]) {
      rays.addColorStop(at, value);
    }
    ctx.fillStyle = rays;
    for (let i = 0; i < 34; i++) {
      const angle = (i + seededUnit(67, i) * .72) * Math.PI * 2 / 34;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const reach = center * (.45 + seededUnit(31, i) * .53), spread = 1.4 + seededUnit(61, i) * 2.2;
      ctx.globalAlpha = .32 + seededUnit(19, i) * .66;
      ctx.beginPath();
      ctx.moveTo(center + dx * 12 - dy * spread, center + dy * 12 + dx * spread);
      ctx.lineTo(center + dx * reach, center + dy * reach);
      ctx.lineTo(center + dx * 12 + dy * spread, center + dy * 12 - dx * spread);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const core = ctx.createRadialGradient(size + center, center, 0, size + center, center, center);
    for (const [at, value] of [[0, "#fffef2"], [.22, "#fcffba"], [.42, bright + "dc"], [.68, tint + "6b"], [1, tint + "00"]]) {
      core.addColorStop(at, value);
    }
    ctx.fillStyle = core;
    ctx.fillRect(size, 0, size, size);
    const flare = ctx.createLinearGradient(size + 2, 0, canvas.width - 2, 0);
    for (const [at, value] of [[0, "#ffd57c00"], [.29, "#ffda7b73"], [.5, "#ffffdfed"], [.71, "#ffda7b73"], [1, "#ffd57c00"]]) {
      flare.addColorStop(at, value);
    }
    ctx.fillStyle = flare;
    ctx.fillRect(size + 2, center - 1.5, size - 4, 3);
    actionBurstTextures.set(inverted, canvas);
    return canvas;
  }

  function drawAirActionBurst(ctx, x, y, progress, inverted) {
    const atlas = airActionBurstTexture(inverted), cell = actionBurstCell;
    const rays = 112, core = 72;
    ctx.save();
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * (1 - progress) ** 1.35;
    ctx.drawImage(atlas, 0, 0, cell, cell, x - rays / 2, y - rays / 2, rays, rays);
    const coreLife = Math.max(0, 1 - progress * 3.5);
    if (coreLife > 0) {
      ctx.globalAlpha = alpha * .88 * coreLife ** 1.35;
      ctx.drawImage(atlas, cell, 0, cell, cell, x - core / 2, y - core / 2, core, core);
    }
    ctx.restore();
  }

  function hitPalette(kind, air, color, direction) {
    const effectColor = kind === "a" ? (String(direction).startsWith("D") !== (color === "I") ? "I" : "N") : color;
    return palette(kind === "C" ? "C" : air ? "a" : kind, effectColor);
  }

  function screenProjection(x, y) {
    return (dx, up, depth = 0) => ({ x: x + dx, y: y - up - depth * .25, scale: 1 });
  }

  function beam(ctx, project, halfWidth, height, color) {
    const top = project(0, height), base = project(0, 0);
    if (Math.abs(base.y - top.y) < .01) return;
    const fill = ctx.createLinearGradient(0, top.y, 0, base.y);
    fill.addColorStop(0, "rgba(255,255,255,0)"); fill.addColorStop(1, color);
    ctx.fillStyle = fill;
    projectedPolygon(ctx, project, [[-halfWidth, 0], [halfWidth, 0], [halfWidth, height], [-halfWidth, height]]);
    ctx.fill();
  }

  const shearedParticles = new WeakMap();
  function uprightSpark(ctx, atlas, region, project, offset, elevation, width, height) {
    const top = project(offset, elevation + height / 2), bottom = project(offset, elevation - height / 2);
    const w = width * (top.scale + bottom.scale) / 2, h = bottom.y - top.y;
    if (w <= 0 || h <= 0) return;
    const lean = bottom.x - top.x;
    const left = Math.min(top.x, bottom.x) - w / 2;
    if (Math.abs(lean) < .35) {
      ctx.drawImage(atlas, ...region, (top.x + bottom.x - w) / 2, top.y, w, h);
      return;
    }
    // Reuse the small sprite at nearby slopes. Its on-screen bounds still
    // come from the projected endpoints, including under mirror and scaling.
    const shift = Math.round(4 * lean / w) * 8;
    if (!shift || Math.abs(shift) > 192) {
      ctx.save(); ctx.transform(w, 0, lean, h, top.x - w / 2, top.y);
      ctx.drawImage(atlas, ...region, 0, 0, 1, 1); ctx.restore();
      return;
    }
    if (!shearedParticles.has(atlas)) shearedParticles.set(atlas, new Map());
    const cache = shearedParticles.get(atlas), key = shift * 2 + (region === sprites.streak ? 1 : 0);
    let sprite = cache.get(key);
    if (!sprite) {
      sprite = document.createElement("canvas"); sprite.width = 32 + Math.abs(shift); sprite.height = 32;
      const paint = sprite.getContext("2d"); paint.transform(1, 0, shift / 32, 1, Math.max(0, -shift), 0);
      paint.drawImage(atlas, ...region, 0, 0, 32, 32);
      cache.set(key, sprite);
    }
    ctx.drawImage(sprite, left, top.y, w + Math.abs(lean), h);
  }

  function drawHit(ctx, { x, y, width, worldWidth = width, projectPoint, type = "t", parentType, age, seed = 0, air = false, color, direction = "R" }) {
    const effectType = parentType || type;
    const action = isAirAction(parentType), airPathStart = !action && isAirAction(type);
    const duration = action ? AIR_ACTION_BURST_TIME : effectType === "C" ? .25 : effectType === "f" || airPathStart ? 1 : .5;
    if (![x, y, width, age].every(Number.isFinite) || width <= 0 || age < 0 || age >= duration) return;
    if (action) {
      drawAirActionBurst(ctx, x, y, age / duration, color === "I");
      return;
    }
    const project = projectPoint || screenProjection(x, y);
    const progress = clamp(age / Math.min(duration, .5), 0, 1), life = (1 - progress) ** 2;
    const colors = hitPalette(effectType, air, color, direction);
    ctx.save();
    const initialAlpha = ctx.globalAlpha;
    if (effectType === "C") {
      const travel = Math.sin(progress * Math.PI / 2);
      ctx.globalAlpha = initialAlpha * .75 * Math.cos(progress * Math.PI / 2);
      ctx.fillStyle = colors[1];
      for (const sign of [-1, 1]) {
        const angle = sign * age * 60 * Math.PI / 18, cos = Math.cos(angle), sin = Math.sin(angle);
        const fragment = (dx, dy) => project(sign * 150 * travel + dx * cos + dy * sin, 500 * travel - dx * sin + dy * cos);
        projectedPolygon(ctx, fragment, [[-6, -20], [6, -20], [6, 20], [-6, 20]]); ctx.fill();
      }
    } else if (effectType === "a") {
      ctx.globalAlpha = initialAlpha * life * .32;
      beam(ctx, project, worldWidth * .45, 400 * Math.sin(progress * Math.PI / 2), colors[1]);
    } else if (effectType === "f") {
      const sign = direction === "L" ? -1 : 1;
      ctx.fillStyle = colors[0];
      for (let column = 0; column < 4; column++) {
        const p = (age - column * .05) / .8;
        if (p < 0 || p >= 1) continue;
        const offset = sign * ((column - 1.5) * worldWidth * .17 + 27 * p), elevation = 48 * p;
        const mark = (dx, up) => project(offset + sign * dx, elevation + up);
        ctx.globalAlpha = initialAlpha * (1 - p) ** 2 * .6;
        projectedPolygon(ctx, mark, [[-5, 6], [6, 0], [-5, -6], [-5, -3], [1, 0], [-5, 3]]); ctx.fill();
      }
    } else if (airPathStart) {
      ctx.globalAlpha = initialAlpha * (1 - age) ** 2 * .55;
      ctx.fillStyle = colors[1];
      for (let streak = -1; streak <= 1; streak++) {
        const cx = streak * worldWidth * .24, lo = 48 * (.1 + age), hi = 48 * (.45 + age * 1.4);
        projectedPolygon(ctx, project, [[cx-1, lo], [cx+1, lo], [cx+1, hi], [cx-1, hi]]); ctx.fill();
      }
    }
    ctx.globalAlpha = initialAlpha * life;
    if (life > 0) {
      const ex = effectType === "x", atlas = effectAtlas(colors);
      for (let i = 0; i < (ex ? 45 : 40); i++) {
        const position = seededUnit(seed, i), velocity = seededUnit(seed + 17, i);
        const offset = (position - .5) * (worldWidth * .82 + 20 * progress);
        const elevation = (90 + velocity * 210) * progress, size = (1 - progress) * (2 + velocity * 5);
        uprightSpark(ctx, atlas, ex ? sprites.streak : sprites.spark, project, offset, elevation,
          size * (ex ? .45 : 2), size * (ex ? 2.5 + velocity * 2 : 3.4));
      }
    }
    ctx.restore();
  }

  function drawSustain(ctx, { x, y, width, worldWidth = width, projectPoint, type = "h", phase = 0 }) {
    if (![x, y, width].every(Number.isFinite) || width <= 0) return;
    const project = projectPoint || screenProjection(x, y), colors = palette(type);
    // Project a constant-width strip on the same plane as the ribbon.
    const far = 100, near = -30;
    const halfWidth = worldWidth * .46;
    const back = project(0, 1, far), front = project(0, 1, near);
    ctx.save();
    ctx.globalAlpha *= .68 + Math.sin(phase * Math.PI * 4) * .12;
    const fill = ctx.createLinearGradient(0, back.y, 0, front.y);
    fill.addColorStop(0, "rgba(255,255,255,0)"); fill.addColorStop(.75, colors[1]); fill.addColorStop(1, colors[0]);
    ctx.fillStyle = fill;
    projectedPolygon(ctx, project, [[-halfWidth, 1, near], [-halfWidth, 1, far], [halfWidth, 1, far], [halfWidth, 1, near]]);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,242,.95)";
    projectedPolygon(ctx, project, [[-worldWidth * .43, 2, -3], [worldWidth * .43, 2, -3], [worldWidth * .43, 2, 3], [-worldWidth * .43, 2, 3]]);
    ctx.fill(); ctx.restore();
  }

  window.UgcVisuals = Object.freeze({ airPlateCorner, drawNote, drawAir, mineSprite, drawHitFloor, drawHit, drawSustain });
})();
