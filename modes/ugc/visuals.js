(function () {
  "use strict";

  // Original procedural artwork. Coordinates are projected CSS pixels; the
  // renderer owns projection, device-pixel scaling, and the chart-time clock.
  const PALETTES = Object.freeze({
    t: ["#ffbfc9", "#ff526e", "#e71f4b", "#770e29"],
    x: ["#fff8c1", "#ffe45b", "#e6a91c", "#835006"],
    f: ["#d7faff", "#5cdbff", "#258ed3", "#124477"],
    h: ["#fff6c6", "#ffc253", "#da820c", "#6e3a05"],
    s: ["#e9ffff", "#74ebff", "#24b6df", "#125770"],
    a: ["#e4ffe2", "#91ff98", "#27db6d", "#126743"],
    pink: ["#ffe6f5", "#ffa2dd", "#f149ac", "#81385f"],
    d: ["#ffbfcf", "#ff487b", "#a9164b", "#4b133b"],
  });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const crushPalettes = new Map();
  function palette(type, color) {
    if (type === "C") {
      const tint = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#c5f6ff";
      if (!crushPalettes.has(tint)) {
        const channels = [1, 3, 5].map(i => parseInt(tint.slice(i, i + 2), 16));
        const shade = (factor, white = 0) => `rgb(${channels.map(c => Math.round(c * factor + 255 * white)).join(",")})`;
        crushPalettes.set(tint, [shade(.3, .7), tint, shade(.7), shade(.35)]);
      }
      return crushPalettes.get(tint);
    }
    if (["a", "H", "S", "C"].includes(type)) return color === "I" ? PALETTES.pink : PALETTES.a;
    return PALETTES[type === "T" ? "s" : type] || PALETTES.t;
  }
  function groundNoteFace(ctx, left, top, width, height, inset = 0) {
    const w = Math.max(.1, width - inset * 2), h = Math.max(.1, height - inset * 2);
    // The camera projects this rectangle onto the lane. All four corners
    // share a radius so the texture adds no taper of its own.
    const radius = Math.max(0, Math.min(height * .16, width * .10) - inset);
    ctx.beginPath();
    ctx.roundRect(left + inset, top + inset, w, h, radius);
  }
  function gradient(ctx, top, height, stops) {
    const fill = ctx.createLinearGradient(0, top, 0, top + Math.max(0.1, height));
    for (const [at, color] of stops) fill.addColorStop(at, color);
    return fill;
  }
  function drawNote(ctx, {
    x, y, width, height = 10, type = "t", direction = "R", color,
    phase = 0, perspective = 1,
  }) {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    const w = Math.max(0.5, width), h = Math.max(1, height);
    const left = x - w / 2, top = y - h / 2;
    const colors = palette(type, color);
    const rim = clamp(h * 0.09, 0.55, 2.2);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (type === "a" || type === "C") {
      // AIR markers are flat rectangular plates; their shallow side faces
      // are projected separately by the renderer, not baked into a capsule.
      const corner = type === "C" ? Math.min(5, h * .06) : 0;
      ctx.beginPath();
      ctx.moveTo(left + corner, top); ctx.lineTo(left + w - corner, top);
      ctx.lineTo(left + w, top + corner); ctx.lineTo(left + w, top + h - corner);
      ctx.lineTo(left + w - corner, top + h); ctx.lineTo(left + corner, top + h);
      ctx.lineTo(left, top + h - corner); ctx.lineTo(left, top + corner); ctx.closePath();
      ctx.fillStyle = gradient(ctx, top, h, [[0, colors[0]], [.2, colors[1]], [.75, colors[1]], [1, colors[2]]]);
      ctx.fill(); ctx.strokeStyle = colors[0]; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "rgba(248,255,244,.85)";
      ctx.fillRect(left + w * .12, top + h * .16, w * .76, Math.max(1, h * .035));
      ctx.restore(); return;
    }

    // A small dark underside separates notes from bright hold/slide bodies.
    groundNoteFace(ctx, left, top + h * 0.055, w, h);
    ctx.fillStyle = "rgba(5,2,12,.72)";
    ctx.fill();
    groundNoteFace(ctx, left, top, w, h);
    ctx.fillStyle = gradient(ctx, top, h, [
      [0, "#ffffff"], [0.18, "#fff9ed"], [0.56, "#c2c8ca"], [0.82, "#f4f2e9"], [1, "#858e91"],
    ]);
    ctx.fill();
    groundNoteFace(ctx, left, top, w, h, rim);
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

    if (type === "s" || type === "T") {
      const stripeWidth = Math.max(1, Math.min(w * 0.82, w - rim * 5));
      ctx.fillStyle = "rgba(242,255,255,.95)";
      ctx.fillRect(x - stripeWidth / 2, y - h * 0.025, stripeWidth, Math.max(0.6, h * 0.13));
    } else if (type === "f" && w > 12) {
      const sign = direction === "L" ? -1 : 1;
      const count = Math.max(1, Math.min(7, Math.floor(w / Math.max(14, h * 1.5))));
      const gap = Math.min(h * 1.7, w / (count + 1));
      ctx.strokeStyle = "rgba(247,255,255,.98)";
      ctx.lineWidth = clamp(h * 0.14, 0.8, 2.5);
      for (let i = 0; i < count; i++) {
        const cx = x + (i - (count - 1) / 2) * gap;
        ctx.beginPath();
        ctx.moveTo(cx - sign * h * 0.16, y - h * 0.21);
        ctx.lineTo(cx + sign * h * 0.16, y);
        ctx.lineTo(cx - sign * h * 0.16, y + h * 0.21);
        ctx.stroke();
      }
    } else if (type === "x" && w > 10) {
      // Two tiny glints give EX notes a gold rather than flat yellow appearance.
      const pulse = 0.75 + Math.sin(phase * 4.2) * 0.2;
      ctx.globalAlpha *= pulse;
      ctx.strokeStyle = "#fffde5";
      ctx.lineWidth = Math.max(0.6, Math.min(1.5, perspective));
      for (const sx of [left + w * 0.16, left + w * 0.84]) {
        ctx.beginPath();
        ctx.moveTo(sx - h * 0.15, y);
        ctx.lineTo(sx + h * 0.15, y);
        ctx.moveTo(sx, y - h * 0.2);
        ctx.lineTo(sx, y + h * 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const airChevron = [[-.46, .05], [0, .34], [.46, .05], [.46, .30], [0, .49], [-.46, .30]];
  function drawAir(ctx, { x, y, width, height = 32, direction = "UC", color = "N", phase = 0 }) {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    const down = direction.startsWith("D");
    const pink = down !== (color === "I");
    const tint = pink ? "#ff91d1" : "#8dff98";
    const top = y - height * .46, bottom = y + height * .46;
    const rim = Math.max(2, Math.min(8, width * .025));
    ctx.save();
    ctx.lineJoin = "round";
    // Both directions use the same artwork. Flip it about the sprite center
    // before projection so the tail follows the head and lateral lean stays in world space.
    if (!down) {
      ctx.translate(0, 2 * y);
      ctx.scale(1, -1);
    }
    const trail = gradient(ctx, top, height * .8, [[0, "rgba(255,255,255,0)"], [.68, "rgba(255,255,255,.9)"], [1, tint]]);
    ctx.fillStyle = trail;
    ctx.save(); ctx.globalAlpha *= .4;
    ctx.beginPath(); ctx.moveTo(x - width * .46, top); ctx.lineTo(x + width * .46, top);
    ctx.lineTo(x + width * .46, y + height * .1); ctx.lineTo(x, y + height * .38);
    ctx.lineTo(x - width * .46, y + height * .1); ctx.closePath(); ctx.fill(); ctx.restore();
    for (let stripe = 0; stripe < 80; stripe++) {
      const u = stripe / 79, wave = Math.sin(stripe * 2.7 + phase * 8);
      const tip = y + height * (.10 + .28 * (1 - Math.abs(u * 2 - 1)));
      const from = top + height * (.03 + .06 * wave);
      ctx.fillRect(x - width * .46 + u * width * .92, from, width * .009, tip - from);
    }
    ctx.beginPath();
    airChevron.forEach(([px, py], i) => i ? ctx.lineTo(x + px * width, y + py * height) : ctx.moveTo(x + px * width, y + py * height));
    ctx.closePath();
    const fill = ctx.createLinearGradient(x - width * .46, y, x + width * .46, y);
    fill.addColorStop(0, pink ? "#d02ce9" : "#35c526");
    fill.addColorStop(.48, pink ? "#ff9cfb" : "#a9ff9c");
    fill.addColorStop(.51, pink ? "#f45eff" : "#68f861");
    fill.addColorStop(1, pink ? "#f59bff" : "#afffa3");
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = "#f4fff0"; ctx.lineWidth = rim; ctx.stroke();
    ctx.save(); ctx.clip();
    const roll = ((phase * -.53) % 1 + 1) % 1;
    const shine = gradient(ctx, top + roll * height - height * .2, height * .2,
      [[0, "rgba(255,255,255,0)"], [.65, "rgba(255,255,255,.28)"], [1, "rgba(255,255,255,0)"]]);
    ctx.fillStyle = shine; ctx.fillRect(x - width / 2, top, width, bottom - top);
    ctx.restore();
    ctx.restore();
  }

  function seededUnit(seed, index) {
    let value = ((Number(seed) || 0) | 0) ^ Math.imul(index + 1, 0x9e3779b1);
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
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

  function drawHitFloor(hit, paint) {
    const { type, parentType, air, color, direction, age, worldWidth, projectPoint } = hit;
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
    const action = effectType === "H" || effectType === "S";
    const duration = effectType === "C" ? .25 : effectType === "f" || action ? 1 : .5;
    if (![x, y, width, age].every(Number.isFinite) || width <= 0 || age < 0 || age >= duration) return;
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
    } else if (action) {
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

  window.UgcVisuals = Object.freeze({ drawNote, drawAir, drawHitFloor, drawHit, drawSustain });
})();
