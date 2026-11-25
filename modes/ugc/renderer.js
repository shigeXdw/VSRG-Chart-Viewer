(function () {
  "use strict";

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const AIR = new Set(["a", "H", "S", "C"]);
  const FIELD_COLORS = ["#d8dae6", "#ed576e", "#ec9b5e", "#e4ca61", "#b9dd5f", "#73d78d", "#62cfc7", "#739fdf", "#a577d2"];
  const CRUSH_COLORS = { "0": "#b94dfa", "1": "#ff565d", "2": "#ffad54", "3": "#ffe76b", "4": "#b8f763", "5": "#71fba1", "6": "#6df4df", "7": "#70d9ff", "8": "#82b5ff", "9": "#7d89ff", A: "#aa91ff", Y: "#df7bff", B: "#ffa1da", C: "#ffffff", D: "#484654" };
  const WARP_DEPTH = 5120;
  const HORIZON = 0.84;
  const AIR_DEPTH_PER_HEIGHT = .3125;
  const AIR_LINE_HALF_WIDTH = 28;
  const AIR_WIDTH_RATIO = 0.75;
  const AIR_ARROW_HEIGHT = 233;
  const AIR_ARROW_TOP_FADE = 0.15;
  const AIR_ARROW_PERIOD = 0.365;
  const GROUND_CAP_DEPTH = 96;

  function scrollDuration(speed = 6) {
    speed = Number.isFinite(Number(speed)) ? clamp(Number(speed), 1, 20) : 6;
    return 7 / (speed <= 10 ? speed : (speed - 10) ** 2 + 10);
  }

  function fieldFor(width, height, scale = 1) {
    const field = {
      width, height, cx: width / 2, cy: 0,
      focal: height / (2 * Math.tan(Math.PI / 8)) * Math.min(1, width / (height * 1.23)) * clamp(scale, 0.5, 1),
      judgeY: height * 0.91
    };
    field.cy = field.judgeY - project(field, 8, 0).y;
    field.horizonY = project(field, 8, HORIZON).y;
    return field;
  }

  const cameraLength = Math.hypot(1140, 2386);
  const fy = -1140 / cameraLength, fz = -2386 / cameraLength;
  function project(field, lane, depth, elevation = 0) {
    const worldHeight = elevation * 466 / 16;
    const y = worldHeight - 850, z = -depth * WARP_DEPTH - 856 - worldHeight * AIR_DEPTH_PER_HEIGHT;
    const cameraDepth = Math.max(16, y * fy + z * fz);
    return {
      x: field.cx + (lane - 8) * 64 * field.focal / cameraDepth,
      y: field.cy - (y * -fz + z * fy) * field.focal / cameraDepth,
      scale: field.focal / cameraDepth, cameraDepth
    };
  }

  function polygon(ctx, points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function line(ctx, a, b, color, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  const roadCaches = new WeakMap();
  function road(ctx, f, settings, chart, darkness) {
    const matrix = ctx.getTransform?.(), ratio = Math.hypot(matrix?.a || 1, matrix?.b || 0);
    const key = [f.width, f.height, f.focal, ratio, settings.color, chart.fieldColor, settings.divisions, darkness].join(":");
    let cached = roadCaches.get(ctx);
    if (!cached || cached.key !== key) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(f.width * ratio)); canvas.height = Math.max(1, Math.round(f.height * ratio));
      const context = canvas.getContext("2d"); context.scale(ratio, ratio);
      paintRoad(context, f, settings, chart, darkness);
      cached = { key, canvas }; roadCaches.set(ctx, cached);
    }
    ctx.drawImage(cached.canvas, 0, 0, f.width, f.height);
  }

  function paintRoad(ctx, f, settings, chart, darkness) {
    const far = HORIZON, near = -0.045;
    const outline = [project(f, -0.9, near), project(f, 16.9, near), project(f, 16.9, far), project(f, -0.9, far)];
    polygon(ctx, outline, "#13071f");
    const points = [project(f, 0, near), project(f, 16, near), project(f, 16, far), project(f, 0, far)];
    polygon(ctx, points, `rgba(14,5,30,${clamp(darkness + 0.17, 0.4, 0.99)})`);
    ctx.save(); polygon(ctx, points); ctx.clip();
    for (let lane = -20; lane < 17; lane += .22) {
      const drift = (far - near) * 20;
      polygon(ctx, [project(f, lane, near), project(f, lane + .045, near),
        project(f, lane + drift + .045, far), project(f, lane + drift, far)], "rgba(125,59,171,.07)");
    }
    ctx.restore();
    const color = FIELD_COLORS[settings.color >= 0 ? settings.color : chart.fieldColor] || FIELD_COLORS[8];
    line(ctx, points[0], points[3], color, 1.2);
    line(ctx, points[1], points[2], color, 1.2);
    const divisions = [0, 2, 4, 8, 16].includes(settings.divisions) ? settings.divisions : 8;
    ctx.save(); ctx.globalAlpha = 0.44;
    for (let i = 1; i < divisions; i++) line(ctx, project(f, i * 16 / divisions, near), project(f, i * 16 / divisions, far), color, i * 2 === divisions ? 1.2 : 0.7);
    ctx.restore();
  }

  function mixPoint(a, b, t, chart) {
    const time = lerp(a.time, b.time, t), tick = chart.secondsToBeat(time) * chart.resolution;
    return { ...a, tick, beat: tick / chart.resolution, time,
      x: lerp(a.x, b.x, t), width: lerp(a.width, b.width, t), height: lerp(a.height || 0, b.height || 0, t) };
  }

  function segments(path, chart, time, distance, duration, until) {
    const points = window.UgcCurves ? window.UgcCurves.prepare(path, chart) : path.points;
    const result = [];
    const earliest = path.type === "C" ? time - duration * .25 : time;
    for (let i = Math.max(1, lowerBound(points, earliest)); i < points.length; i++) {
      let a = points[i - 1], b = points[i];
      if (a.time > until) break;
      if (path.type === 'C' && a.time < time && b.time > a.time) {
        const end = b.time > time ? mixPoint(a, b, (time - a.time) / (b.time - a.time), chart) : b;
        const da = (a.time - time) / duration, db = (end.time - time) / duration;
        if (db >= -.25) result.push({ a: da < -.25 ? mixPoint(a, end, (-.25 - da) / (db - da), chart) : a, b: end, da: Math.max(-.25, da), db });
      }
      if (b.time < time || b.time === a.time) continue;
      if (a.time < time) {
        const startX = a.x;
        a = mixPoint(a, b, clamp((time - a.time) / (b.time - a.time), 0, 1), chart);
        if (path.type === "h" || path.type === "H") a.x = startX;
      }
      let da = distance(a), db = distance(b);
      const minimumDepth = path.type === 'C' ? -.25 : -.04;
      if (Math.max(da, db) < minimumDepth || Math.min(da, db) > HORIZON) continue;
      if (Math.abs(db - da) > 1e-9) {
        let lo = 0, hi = 1;
        const ta = (minimumDepth - da) / (db - da), tb = (HORIZON - da) / (db - da);
        lo = Math.max(lo, Math.min(ta, tb)); hi = Math.min(hi, Math.max(ta, tb));
        if (lo > hi) continue;
        const originalA = a, originalB = b, originalDa = da, originalDb = db;
        if (lo > 0) a = mixPoint(originalA, originalB, lo, chart);
        if (hi < 1) b = mixPoint(originalA, originalB, hi, chart);
        da = lerp(originalDa, originalDb, lo); db = lerp(originalDa, originalDb, hi);
      }
      result.push({ a, b, da, db });
    }
    return result;
  }

  const ribbonTextures = new Map();
  function ribbonTexture(kind) {
    if (ribbonTextures.has(kind)) return ribbonTextures.get(kind);
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 4;
    const context = canvas.getContext("2d"), fill = context.createLinearGradient(0, 0, 256, 0);
    for (let i = 0; i <= 32; i++) {
      const strength = Math.pow(Math.sin(i / 32 * Math.PI), kind === "h" ? .65 : .48);
      const color = kind === "h"
        ? `rgba(${Math.round(lerp(193,255,strength))},${Math.round(lerp(120,222,strength))},${Math.round(lerp(222,67,strength))},${lerp(.38,.98,strength)})`
        : kind === "stripe" ? "rgba(168,250,255,.75)"
        : `rgba(${Math.round(lerp(92,18,strength))},${Math.round(lerp(137,204,strength))},255,${lerp(.28,.8,strength)})`;
      fill.addColorStop(i / 32, color);
    }
    context.fillStyle = fill; context.fillRect(0, 0, 256, 4);
    ribbonTextures.set(kind, canvas); return canvas;
  }

  const ribbonWedges = new WeakMap();
  function paintRibbonSpan(ctx, texture, quad, ratio) {
    const [tl, tr, br, bl] = quad;
    const topWidth = tr.x - tl.x, bottomWidth = br.x - bl.x;
    const narrowAtTop = topWidth <= bottomWidth;
    const narrow = Math.min(topWidth, bottomWidth), wide = Math.max(topWidth, bottomWidth);
    if (wide <= 0 || Math.abs(bl.y - tl.y) < .001) return;
    const from = narrowAtTop ? tl : bl, to = narrowAtTop ? bl : tl;
    // Neighboring segments own whole device rows. Partial coverage on both
    // sides of a join would otherwise leave a dark line across the ribbon.
    const y0 = Math.round(from.y * ratio) / ratio, y1 = Math.round(to.y * ratio) / ratio;
    const rise = y1 - y0, spread = 1 - narrow / wide;
    if (!rise) return;
    ctx.save();
    ctx.transform(1, 0, (to.x + wide / 2 - from.x - narrow / 2) / rise, Math.sign(rise),
      from.x + narrow / 2, y0);
    if (spread * wide < .5) {
      ctx.drawImage(texture, -wide / 2, 0, wide, Math.abs(rise));
    } else {
      // A slice of one pre-painted triangle maps to any trapezoid. The
      // gradient varies across the ribbon only, so a shear and scale suffice.
      let wedge = ribbonWedges.get(texture);
      if (!wedge) {
        wedge = document.createElement("canvas"); wedge.width = wedge.height = 512;
        const paint = wedge.getContext("2d");
        for (let y = 0; y < wedge.height; y++) {
          const w = y + .5;
          paint.drawImage(texture, (wedge.width - w) / 2, y, w, 1);
        }
        ribbonWedges.set(texture, wedge);
      }
      const sh = wedge.height * spread;
      ctx.drawImage(wedge, 0, wedge.height - sh, wedge.width, sh, -wide / 2, 0, wide, Math.abs(rise));
    }
    ctx.restore();
  }

  function airRibbonSpan(ctx, f, { a, b, da, db }, inverted) {
    const strip = (halfWidth, color) => {
      const at = (p, d, side) => project(f, p.x + p.width / 2 + side * Math.min(p.width / 2, halfWidth / 64), d, p.height ?? 8);
      polygon(ctx, [at(a, da, -1), at(a, da, 1), at(b, db, 1), at(b, db, -1)], color);
    };
    strip(AIR_LINE_HALF_WIDTH, inverted ? "rgba(239,114,247,.17)" : "rgba(125,255,36,.17)");
    strip(16, inverted ? "rgba(239,114,247,.35)" : "rgba(125,255,36,.35)");
    strip(8, inverted ? "#e77df2" : "#7aff09");
    strip(1.7, "rgba(250,255,221,.85)");
  }

  function ribbon(ctx, f, path, spans, gpu) {
    const air = AIR.has(path.type), hold = path.type === "h";
    if (!air) {
      const ratio = gpu ? 1 : Math.abs(ctx.getTransform?.()?.a || 1);
      const paint = (texture, quad) => {
        if (gpu) gpu.draw(texture, quad, f.width, f.height);
        else paintRibbonSpan(ctx, texture, quad, ratio);
      };
      const texture = ribbonTexture(hold ? "h" : "s"), stripe = !hold && ribbonTexture("stripe");
      for (const { a, b, da, db } of spans) {
        const quad = [project(f, b.x, db), project(f, b.x + b.width, db), project(f, a.x + a.width, da), project(f, a.x, da)];
        paint(texture, quad);
        if (stripe) {
          const leftA = a.x + a.width / 2 - Math.min(a.width * .16, 8 / 64), rightA = a.x + a.width - (leftA - a.x);
          const leftB = b.x + b.width / 2 - Math.min(b.width * .16, 8 / 64), rightB = b.x + b.width - (leftB - b.x);
          const center = [project(f, leftB, db), project(f, rightB, db), project(f, rightA, da), project(f, leftA, da)];
          if (gpu) paint(stripe, center);
          else {
            for (const point of center) point.y = Math.round(point.y * ratio) / ratio;
            polygon(ctx, center, "rgba(168,250,255,.75)");
          }
        }
      }
      return;
    }
    if (path.type === "H" || path.type === "S") {
      const inverted = path.color === "I";
      const { a: head, da: depth } = spans[0];
      if (head === path.points[0] && (head.height ?? 8) > 0) {
        // Connect the visible start arrow to the authored path for rendering only.
        const base = { x: head.x, width: head.width, height: 0 };
        airRibbonSpan(ctx, f, { a: base, b: head, da: depth, db: depth }, inverted);
      }
      for (const span of spans) airRibbonSpan(ctx, f, span, inverted);
      return;
    }
    if (path.type !== "C") return;
    const tint = path.color === "0" || path.color === "Y" ? "#c5f6ff" : CRUSH_COLORS[path.color] || "#c5f6ff";
    const halfWidth = path.color === "0" ? 14 : 7;
    for (const { a, b, da, db } of spans) {
      const edge = (p, d, side, size) => project(f, p.x + p.width / 2 + side * size / 64, d, p.height || 0);
      for (const [size, alpha] of [[halfWidth, .22], [halfWidth * .72, .55], [halfWidth * .42, 1]]) {
        ctx.save(); ctx.globalAlpha *= alpha;
        polygon(ctx, [edge(a, da, -1, size), edge(a, da, 1, size), edge(b, db, 1, size), edge(b, db, -1, size)], tint);
        ctx.restore();
      }
    }
  }

  const textureCaches = new WeakMap();
  function capDepth(type) {
    return AIR.has(type) ? 80 : type === "h" ? 108.56 : GROUND_CAP_DEPTH;
  }

  function noteTexture(type, width, direction, color, time, arrow) {
    const visual = window.UgcVisuals;
    if (!textureCaches.has(visual)) textureCaches.set(visual, new Map());
    const cache = textureCaches.get(visual), margin = 4;
    const worldWidth = Math.max(8, Math.round(width * 64 / 8) * 8 - (AIR.has(type) && !arrow ? 8 : 0));
    const worldHeight = arrow ? AIR_ARROW_HEIGHT : capDepth(type);
    // AIR scrolls through a repeated static texture on its fixed mesh.
    const phase = type === "x" ? Math.floor(((time % 1.6 + 1.6) % 1.6) * 10) : 0;
    const key = [type, worldWidth, arrow ? direction[0] : "", color, phase, arrow].join(":");
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key); cache.set(key, hit);
      return hit;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((worldWidth + margin * 2) * 2);
    const tileHeight = Math.ceil((worldHeight + margin * 2) * 2);
    canvas.height = arrow ? tileHeight * 2 : tileHeight;
    const context = canvas.getContext("2d");
    context.scale(2, 2);
    // Leave transparent space fore and aft of the ground face on its projected quad.
    const faceHeight = AIR.has(type) ? worldHeight : worldHeight * 0.70;
    const options = { x: margin + worldWidth / 2, y: margin + worldHeight / 2,
      width: worldWidth, height: faceHeight, type, direction, color, phase: phase / 10 };
    if (arrow) {
      visual.drawAir(context, options);
      // Bake a second copy so one source window can cross the seam.
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(canvas, 0, 0, canvas.width, tileHeight, 0, tileHeight, canvas.width, tileHeight);
    } else visual.drawNote(context, options);
    const texture = { canvas, margin, tileHeight };
    if (cache.size >= 192) cache.delete(cache.keys().next().value);
    cache.set(key, texture);
    return texture;
  }

  function noteQuad(f, point, depth, type, margin = 0, backPadding = 0) {
    const air = AIR.has(type);
    const elevation = air ? (point.height ?? 8) + (type === "C" ? 5.33336 : 12) * 16 / 466 : 0;
    const halfDepth = (capDepth(type) / 2 + margin) / WARP_DEPTH;
    const back = depth + halfDepth * (1 + 2 * backPadding);
    const left = point.x + ((air ? 4 : 0) - margin) / 64, right = point.x + point.width - ((air ? 4 : 0) - margin) / 64;
    return [project(f, left, back, elevation), project(f, right, back, elevation),
      project(f, right, depth - halfDepth, elevation), project(f, left, depth - halfDepth, elevation)];
  }

  function arrowQuad(f, point, depth, margin = 0) {
    const direction = point.direction || "UC";
    const lateral = direction.endsWith("L") ? -150 / 64 : direction.endsWith("R") ? 150 / 64 : 0;
    const lean = direction.startsWith("D") ? -lateral : lateral;
    const half = point.width * AIR_WIDTH_RATIO / 2 + margin / 64;
    const center = point.x + point.width / 2, left = center - half, right = center + half;
    // A diagonal shifts the entire 233-unit mesh up by 16 units.
    const base = lean ? 16 : 0;
    const top = (base + AIR_ARROW_HEIGHT) * 16 / 466, bottom = base * 16 / 466;
    return [project(f, left + lean, depth, top), project(f, right + lean, depth, top),
      project(f, right, depth, bottom), project(f, left, depth, bottom)];
  }

  function surface(ctx, f, texture, quad, region, topFade = 0) {
    const [tl, tr, br, bl] = quad, height = bl.y - tl.y;
    // Elevated horizontal faces can pass above the camera. Reflect the
    // scan direction together with the canvas, retaining the original UVs.
    if (height < -.001) {
      ctx.save(); ctx.translate(0, f.height); ctx.scale(1, -1);
      surface(ctx, f, texture, quad.map(p => ({ ...p, y: f.height - p.y })), region, topFade);
      ctx.restore(); return;
    }
    if (height <= .001 || Math.max(tr.x, br.x) < 0 || Math.min(tl.x, bl.x) > f.width) return;
    const transform = ctx.getTransform?.();
    const pixelRatio = Math.hypot(transform?.a || 1, transform?.b || 0);
    const step = 1 / pixelRatio;
    const top = Math.max(0, Math.ceil(tl.y / step - .5)) * step;
    const bottom = Math.min(f.height, Math.ceil(bl.y / step - .5) * step);
    const [sx, sourceY, sw, sourceHeight] = region || [0, 0, texture.width, texture.height];
    const vAt = t => t * tl.cameraDepth / (bl.cameraDepth * (1 - t) + tl.cameraDepth * t);
    // One affine shear follows the projected center exactly. Subdivide only
    // as far as the changing width and perspective texture scale require.
    const topWidth = tr.x - tl.x, bottomWidth = br.x - bl.x;
    const shear = ((bl.x + br.x) - (tl.x + tr.x)) / (2 * height);
    const widthLimit = height * step * 2 / Math.max(.001, Math.abs(bottomWidth - topWidth));
    const depthLimit = Math.sqrt(2 * height * step * Math.min(tl.cameraDepth, bl.cameraDepth)
      / Math.max(.001, Math.abs(tl.cameraDepth - bl.cameraDepth)));
    const band = step * Math.max(1, Math.floor(Math.min(height, widthLimit, depthLimit) / step));
    ctx.save();
    ctx.transform(1, 0, shear, 1, -shear * tl.y, 0);
    const alpha = ctx.globalAlpha;
    for (let start = top; start < bottom; start += band) {
      const end = Math.min(bottom, start + band);
      const t0 = clamp((start - tl.y) / height, 0, 1), t1 = clamp((end - tl.y) / height, 0, 1);
      const v0 = vAt(t0), v1 = vAt(t1);
      const w = lerp(topWidth, bottomWidth, (t0 + t1) / 2);
      const sy = sourceY + v0 * sourceHeight, sh = (v1 - v0) * sourceHeight;
      if (sh <= 0 || w <= 0) continue;
      const x = (tl.x + tr.x - w) / 2;
      if (v0 >= topFade) {
        if (topFade) ctx.globalAlpha = alpha;
        ctx.drawImage(texture, sx, sy, sw, sh, x, start, w, end - start);
        continue;
      }
      // Subdivide the fade without changing the parent band's texture mapping.
      const sourcePerRow = sh / (end - start);
      for (let y = start; y < end;) {
        const fading = vAt(clamp((y - tl.y) / height, 0, 1)) < topFade;
        const next = fading ? Math.min(end, y + step) : end;
        const ramp = Math.min(1, vAt(clamp(((y + next) / 2 - tl.y) / height, 0, 1)) / topFade);
        ctx.globalAlpha = alpha * ramp * ramp * (3 - 2 * ramp);
        ctx.drawImage(texture, sx, sy + sourcePerRow * (y - start), sw, sourcePerRow * (next - y), x, y, w, next - y);
        y = next;
      }
    }
    ctx.restore();
  }

  const faceTextures = new Map(), crushGlowTextures = new Map();
  const CRUSH_GLOW_HEIGHT = 1.9;
  const actionRungColors = Array.from({ length: 8 }, (_, i) => {
    const opacity = .65 * (1 - i / 9);
    return [`rgba(225,86,248,${opacity})`, `rgba(121,44,164,${opacity})`];
  });

  function crushGlowTexture(color) {
    if (crushGlowTextures.has(color)) return crushGlowTextures.get(color);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const h = canvas.height;
    const glow = ctx.createLinearGradient(0, 0, 0, h);
    glow.addColorStop(0, color + "00");
    glow.addColorStop(.24, color + "0e");
    glow.addColorStop(.57, color + "58");
    glow.addColorStop(.8, color + "9e");
    glow.addColorStop(1, color + "b0");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, h);
    const edges = ctx.createLinearGradient(0, 0, canvas.width, 0);
    edges.addColorStop(0, "#ffffff00");
    edges.addColorStop(.17, "#ffffff");
    edges.addColorStop(.83, "#ffffff");
    edges.addColorStop(1, "#ffffff00");
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = edges;
    ctx.fillRect(0, 0, canvas.width, h);
    crushGlowTextures.set(color, canvas);
    return canvas;
  }

  function drawAirActionRungs(ctx, f, point, depth) {
    const height = point.height ?? 8;
    const spacing = .92, center = point.x + point.width / 2;
    const count = Math.min(actionRungColors.length, Math.floor((height - .2) / spacing));
    const front = depth - 22 / WARP_DEPTH, rear = depth + 11 / WARP_DEPTH;
    for (let rung = count; rung > 0; rung--) {
      const elevation = height - rung * spacing;
      const lower = elevation - .12;
      const half = point.width / 2 * (.98 - rung * .017);
      const left = center - half, right = center + half;
      const frontLeft = project(f, left, front, elevation), frontRight = project(f, right, front, elevation);
      const [topInk, frontInk] = actionRungColors[rung - 1];
      polygon(ctx, [project(f, left, rear, elevation), project(f, right, rear, elevation),
        frontRight, frontLeft], topInk);
      polygon(ctx, [frontLeft, frontRight, project(f, right, front, lower), project(f, left, front, lower)],
        frontInk);
    }
  }

  function plateWalls(ctx, f, point, depth, type, tint, gpu) {
    const crush = type === "C", half = point.width * 32 - 4;
    const cut = window.UgcVisuals.airPlateCorner(half * 2, 80);
    const outline = [[-half + cut, 40], [half - cut, 40], [half, 40 - cut], [half, -40 + cut],
      [half - cut, -40], [-half + cut, -40], [-half, -40 + cut], [-half, 40 - cut]];
    const center = point.x + point.width / 2, elevation = point.height ?? 8;
    const top = elevation + (crush ? 5.33336 : 12) * 16 / 466, bottom = elevation - (crush ? 2.66664 : 6) * 16 / 466;
    const cameraX = (8 - center) * 64, cameraZ = -856 - depth * WARP_DEPTH - elevation * 466 / 16 * AIR_DEPTH_PER_HEIGHT;
    const color = crush ? tint + "b8" : "#746388";
    const at = ([x, z], h) => project(f, center + x / 64, depth + z / WARP_DEPTH, h);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      if ((b[0] - a[0]) * (cameraZ - a[1]) <= (b[1] - a[1]) * (cameraX - a[0])) continue;
      if (crush && a[1] === -40 && b[1] === -40) {
        const texture = crushGlowTexture(tint), upper = top + CRUSH_GLOW_HEIGHT;
        const wall = [at([b[0], 40], upper), at([a[0], 40], upper), at(a, bottom), at(b, bottom)];
        if (gpu) gpu.draw(texture, wall, f.width, f.height);
        else surface(ctx, f, texture, wall);
        continue;
      }
      const wall = [at(a, top), at(b, top), at(b, bottom), at(a, bottom)];
      if (gpu) {
        if (!faceTextures.has(color)) {
          const tex = document.createElement("canvas"); tex.width = tex.height = 1;
          const paint = tex.getContext("2d"); paint.fillStyle = color; paint.fillRect(0, 0, 1, 1);
          faceTextures.set(color, tex);
        }
        gpu.draw(faceTextures.get(color), wall, f.width, f.height);
      } else polygon(ctx, wall, color);
    }
  }

  function isArrow(point, type) {
    return type === "a" || ((type === "H" || type === "S") && !point.parentType);
  }

  function airShadows(ctx, f, paths, heads) {
    if (!paths.length && !heads.some(h => AIR.has(h.type))) return;
    ctx.save();
    polygon(ctx, [project(f, 0, -.045), project(f, 16, -.045), project(f, 16, HORIZON), project(f, 0, HORIZON)]);
    ctx.clip();
    const ink = "rgba(0,0,0,.38)";
    for (const { path, spans } of paths) {
      const edge = (p, depth, side) => {
        if (path.type === "C") {
          const half = path.color === "0" ? 14 : 7;
          return project(f, p.x + p.width / 2 + side * half / 64, depth);
        }
        const half = Math.min(p.width / 2, AIR_LINE_HALF_WIDTH / 64);
        return project(f, p.x + p.width / 2 + side * half, depth);
      };
      for (const { a, b, da, db } of spans) {
        if ((a.height ?? 8) <= 0 && (b.height ?? 8) <= 0) continue;
        polygon(ctx, [edge(a, da, -1), edge(a, da, 1), edge(b, db, 1), edge(b, db, -1)], "rgba(0,0,0,.24)");
      }
    }
    for (const {point, type, depth} of heads) {
      if (!AIR.has(type) || isArrow(point, type) || (point.height ?? 8) <= 0) continue;
      const center = point.x + point.width / 2;
      const width = point.width * AIR_WIDTH_RATIO;
      const half = type === "C" ? Math.max(0, point.width / 2 - 4 / 64) : width / 2;
      const near = depth - 23 / WARP_DEPTH, far = depth + 23 / WARP_DEPTH;
      polygon(ctx, [project(f, center-half, far), project(f, center+half, far),
        project(f, center+half, near), project(f, center-half, near)], ink);
    }
    ctx.restore();
  }

  function noteHead(ctx, f, point, depth, type, time, color, gpu, arrowPhase) {
    if (type === "d") {
      const phase = time + point.x * .027 + point.time * .31;
      const { canvas, region, backPadding } = window.UgcVisuals.mineSprite(phase, point.width);
      const quad = noteQuad(f, point, depth, type, 4, backPadding);
      if (gpu) gpu.draw(canvas, quad, f.width, f.height, region);
      else surface(ctx, f, canvas, quad, region);
      return;
    }
    const arrow = isArrow(point, type);
    const textureType = point.exStart && !point.generated ? "x" : AIR.has(type) && type !== "C" ? "a" : type;
    const tint = type === "C" ? CRUSH_COLORS[color || point.color] || CRUSH_COLORS["0"] : color || point.color || "N";
    const direction = point.direction || "UC";
    const { canvas, margin, tileHeight } = noteTexture(textureType, point.width, direction, tint, time, arrow);
    const quad = arrow ? arrowQuad(f, point, depth, margin) : noteQuad(f, point, depth, textureType, margin);
    let region;
    if (arrow) {
      const offset = direction.startsWith("D") ? 1 - arrowPhase : arrowPhase;
      region = [0, offset * tileHeight, canvas.width, tileHeight];
    } else if (AIR.has(type)) plateWalls(ctx, f, point, depth, type, tint, gpu);
    const topFade = arrow ? AIR_ARROW_TOP_FADE : 0;
    if (gpu) gpu.draw(canvas, quad, f.width, f.height, region, 1, topFade);
    else surface(ctx, f, canvas, quad, region, topFade);
  }

  function lowerBound(rows, time) {
    let lo = 0, hi = rows.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].time < time) lo = mid + 1; else hi = mid; }
    return lo;
  }

  function judgment(ctx, f) {
    // The bright center occupies only part of the native strip's full quad.
    const quad = [project(f, 0, 12 / WARP_DEPTH), project(f, 16, 12 / WARP_DEPTH), project(f, 16, -12 / WARP_DEPTH), project(f, 0, -12 / WARP_DEPTH)];
    const fill = ctx.createLinearGradient(0, quad[0].y, 0, quad[3].y);
    [[0, "#8f4a10"], [0.16, "#e6b347"], [0.35, "#fff8dc"], [0.7, "#fffefa"], [0.84, "#e2b958"], [1, "#6a3810"]].forEach(([t, color]) => fill.addColorStop(t, color));
    polygon(ctx, quad, fill);
    line(ctx, project(f, 0, 18 / WARP_DEPTH), project(f, 16, 18 / WARP_DEPTH), "rgba(239,177,63,.48)");
    line(ctx, project(f, 0, -18 / WARP_DEPTH), project(f, 16, -18 / WARP_DEPTH), "rgba(239,177,63,.28)");
  }

  function airJudgeQuad(f, height = 8) {
    // Keep the shallow guide centered at the contact depth as the AIR path rises.
    const at = (x, z) => project(f, 8 + x / 64, (-z - 233 * AIR_DEPTH_PER_HEIGHT) / WARP_DEPTH, height);
    return [at(-900, -111), at(900, -111), at(900, -39), at(-900, -39)];
  }

  function airJudgment(ctx, f, height, opacity) {
    const quad = airJudgeQuad(f, height);
    const glow = ctx.createLinearGradient(0, quad[0].y, 0, quad[3].y);
    glow.addColorStop(0, "rgba(128,255,170,0)");
    glow.addColorStop(.43, "rgba(151,255,182,.15)");
    glow.addColorStop(.5, "rgba(227,255,232,.9)");
    glow.addColorStop(.57, "rgba(151,255,182,.15)");
    glow.addColorStop(1, "rgba(128,255,170,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha *= .20 * opacity;
    polygon(ctx, quad, glow); ctx.restore();
  }

  let contactSprite;
  function airContact(ctx, f, point, opacity) {
    if (!contactSprite) {
      contactSprite = document.createElement("canvas");
      contactSprite.width = 128; contactSprite.height = 16;
      const paint = contactSprite.getContext("2d");
      paint.scale(64, 8);
      const glow = paint.createRadialGradient(1, 1, 0, 1, 1, 1);
      glow.addColorStop(0, "#f4fff5"); glow.addColorStop(.22, "#dbffe3");
      glow.addColorStop(.62, "rgba(165,255,186,.56)"); glow.addColorStop(1, "rgba(165,255,186,0)");
      paint.fillStyle = glow; paint.fillRect(0, 0, 2, 2);
    }
    const lane = point.x + point.width / 2;
    // The spot and the center of the guide share the same projection.
    const depth = (75 - 233 * AIR_DEPTH_PER_HEIGHT) / WARP_DEPTH;
    const center = project(f, lane, depth, point.height ?? 8);
    const rx = Math.min(point.width * 64 * .35, 76) * center.scale;
    const ry = Math.max(.8, Math.min(rx * .10, 3.2 * center.scale));
    ctx.save(); ctx.globalAlpha *= opacity;
    ctx.drawImage(contactSprite, center.x-rx, center.y-ry, 2*rx, 2*ry);
    ctx.restore();
  }

  const airGuidePaths = new WeakMap();
  function drawAirGuide(ctx, f, chart, time, hitEffectsEnabled) {
    let paths = airGuidePaths.get(chart);
    if (!paths) {
      paths = chart.paths.filter(path => path.type === "H" || path.type === "S")
        .map(path => ({ path, time: path.points[0].time, end: path.points.at(-1) }))
        .sort((a, b) => a.time - b.time);
      let latestEnd;
      for (const entry of paths) {
        if (!latestEnd || entry.end.time >= latestEnd.time) latestEnd = entry.end;
        entry.latestEnd = latestEnd;
      }
      airGuidePaths.set(chart, paths);
    }
    const next = lowerBound(paths, time);
    const contacts = [];
    for (let i = next - 1; i >= 0 && paths[i].latestEnd.time > time; i--) {
      if (paths[i].end.time > time) contacts.push(window.UgcCurves.sampleAtTime(paths[i].path, time, chart));
    }
    for (let i = next; i < paths.length && paths[i].time === time; i++) {
      if (paths[i].end.time > time) contacts.push(paths[i].path.points[0]);
    }
    if (contacts.length) {
      const heights = new Set(contacts.map(point => point.height ?? 8));
      for (const height of heights) airJudgment(ctx, f, height, 1);
      for (const point of contacts) airContact(ctx, f, point, .9);
    } else if (next < paths.length && paths[next].time - time < 0.5) {
      const upcoming = paths[next], previous = paths[next - 1]?.latestEnd;
      let height = upcoming.path.points[0].height ?? 8;
      let strength = 1 - (upcoming.time - time) / 0.5;
      if (previous && upcoming.time > previous.time && upcoming.time - previous.time <= 0.5) {
        const progress = (time - previous.time) / (upcoming.time - previous.time);
        height = (previous.height ?? 8) * (1 - progress) + height * progress;
        strength = 1;
      }
      airJudgment(ctx, f, height, strength);
    }
    if (!hitEffectsEnabled) return;
    const fade = .18;
    for (let i = lowerBound(chart.hitNotes, time - fade); i < chart.hitNotes.length; i++) {
      const n = chart.hitNotes[i];
      if (n.time > time) break;
      const type = n.parentType || n.type;
      if (type === "S" || type === "H") airContact(ctx, f, n, (1 - (time - n.time) / fade) ** 2);
    }
  }

  const fittedLabels = new WeakMap();
  function fitText(ctx, text, maxWidth) {
    text = String(text || "");
    let cache = fittedLabels.get(ctx);
    if (!cache) { cache = new Map(); fittedLabels.set(ctx, cache); }
    const key = JSON.stringify([ctx.font, maxWidth, text]);
    if (cache.has(key)) return cache.get(key);
    let result = text;
    if (ctx.measureText(result).width > maxWidth) {
      while (result && ctx.measureText(result + "…").width > maxWidth) result = result.slice(0, -1);
      result += "…";
    }
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  }

  const hudNumber = new Intl.NumberFormat("en-US");
  function hud(ctx, f, chart, time, settings, jacket) {
    // Keep the three cards adjacent like the playback header. At phone widths
    // the statistics move to a second row so song titles have readable type.
    const compact = f.width < 740, scale = Math.min(f.width / (compact ? 360 : 790), f.height / (compact ? 450 : 345), 2.1);
    const width = f.width / scale - 16, left = compact ? width * .33 : width * .29;
    const right = compact ? width - left - 4 : width * .32, mid = width - right - left - 8;
    const accent = chart.header.UGC_COLOR || "#9955ee", passed = lowerBound(chart.hitNotes, time + 1e-8);
    const total = chart.hitNotes.length, progress = clamp(time / Math.max(.01, chart.duration), 0, 1);
    ctx.save(); ctx.textBaseline = "middle";
    ctx.save(); ctx.scale(scale, scale); ctx.translate(8, 5);
    const rect = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
    const label = (txt, x, y, font, color, max, align = "left") => {
      ctx.textAlign = align; ctx.font = font; ctx.fillStyle = color;
      ctx.fillText(max === undefined ? txt : fitText(ctx, txt, max), x, y);
    };
    rect(0, 0, width, 70, "#12131a");
    label("CHART VIEWER", 10, 8, "800 9px system-ui", "#f7d756");
    const profileFill = ctx.createLinearGradient(0, 16, left, 68);
    profileFill.addColorStop(0, "#eace66");
    profileFill.addColorStop(.44, "#fff7ce");
    profileFill.addColorStop(1, "#eed17a");
    rect(1, 16, left - 2, 52, profileFill);
    polygon(ctx, [{ x:1, y:16 }, { x:left * .74, y:16 }, { x:left * .55, y:68 }, { x:1, y:68 }], "#ffffff40");
    polygon(ctx, [{ x:left * .86, y:16 }, { x:left - 1, y:16 }, { x:left - 1, y:35 }], "#cd9a3255");
    rect(1, 66, left - 2, 2, "#d1ae53");
    if (!compact) {
      rect(4, 18, 48, 46, "#272432");
      polygon(ctx, [{ x:12, y:22 }, { x:44, y:22 }, { x:44, y:50 }, { x:28, y:59 }, { x:12, y:50 }],
        "#ffd259", "#fff4bc", 1.5);
      polygon(ctx, [{ x:23, y:30 }, { x:38, y:40 }, { x:23, y:50 }], "#2e2530");
    }
    const nameX = compact ? 10 : 59;
    label("AUTO PLAY", nameX, 42, compact ? "900 16px system-ui" : "900 25px system-ui", "#25212b", left - nameX - 5);
    const sx = compact ? 0 : left + 4, sy = compact ? 72 : 0, sw = compact ? width : mid;
    rect(sx, sy, sw, 70, "#161722");
    const prism = ctx.createLinearGradient(sx, sy + 16, sx + sw, sy + 67);
    prism.addColorStop(0, "#8ceac7"); prism.addColorStop(.3, "#eeeaff"); prism.addColorStop(.65, "#b3d8ff"); prism.addColorStop(1, "#e5a3f1");
    rect(sx + 1, sy + 16, sw - 2, 52, prism);
    polygon(ctx, [{x:sx+2,y:sy+18},{x:sx+sw*.52,y:sy+17},{x:sx+sw*.24,y:sy+65}], "rgba(255,255,255,.38)");
    polygon(ctx, [{x:sx+sw*.64,y:sy+16},{x:sx+sw-1,y:sy+23},{x:sx+sw-1,y:sy+33}], "rgba(142,83,210,.32)");
    label("PLAYBACK", sx + 10, sy + 8, "800 9px system-ui", "#f7d756");
    const bpmIndex = Math.max(0, lowerBound(chart.bpmChanges, time + 1e-8) - 1);
    const bpm = chart.bpmChanges[bpmIndex]?.bpm || chart.header.BPM;
    label("BPM  " + Number(Number(bpm).toFixed(2)), sx + sw * .59, sy + 8, "800 9px system-ui", "#f4f1fa");
    label("NOTES", sx + 12, sy + 28, "800 11px system-ui", "#302c37");
    label(hudNumber.format(passed) + " / " + hudNumber.format(total), sx + 58, sy + 28, "900 15px system-ui", "#211e28", sw - 67);
    const barX = sx + 12, barW = sw - 24;
    rect(barX, sy + 40, barW, 15, "#fff"); rect(barX + 1, sy + 41, barW - 2, 13, "#272534");
    rect(barX + 2, sy + 43, (barW - 4) * progress, 9, "#f7cf4c");
    const step = (barW * .64) / 10;
    for (let i = 0; i < 10; i++) {
      const x = barX + barW * .18 + i * step, y = sy + 58;
      polygon(ctx, [{x:x+4,y},{x:x+step,y},{x:x+step-4,y:y+8},{x,y:y+8}], i < progress * 10 ? "#ddbc38" : "#514f58", "#ece8d3", .7);
    }
    const rx = width - right;
    rect(rx, 0, right, 70, "#101117");
    label("SPEED  " + (settings.noteSpeed === 20 ? "SONIC" : Number(settings.noteSpeed || 6).toFixed(2)), rx + 8, 8, "700 9px system-ui", "#fff");
    label("MIRROR  " + (settings.mirror ? "ON" : "OFF"), rx + right * .61, 8, "700 9px system-ui", "#d7d4dc");
    const size = 48, tx = rx + size + 8, available = right - size - 12;
    rect(rx + 2, 17, right - 4, 51, "#f8f7fa");
    if (jacket) ctx.drawImage(jacket, rx + 4, 18, size, size);
    else {
      rect(rx + 4, 18, size, size, "#272432");
      label("♪", rx + 18, 41, "800 23px system-ui", accent);
    }
    rect(tx - 2, 18, available, 26, "#201e28"); rect(tx - 2, 18, 4, 26, accent);
    label(chart.header.UGC_DIFFICULTY || "CHART", tx + 5, 32, "900 16px system-ui", "#fff", available - 52);
    rect(rx + right - 43, 19, 39, 24, accent);
    if (chart.header.UGC_WEATTR)
      label(chart.header.UGC_WEATTR, rx + right - 23.5, 31, "900 18px system-ui", "#201e28", 35, "center");
    else label("LV " + (chart.header.PLAYLEVEL || "—"), rx + right - 40, 31, "900 10px system-ui", "#fff", 35);
    label(chart.header.TITLE, tx, 51, "800 12px system-ui", "#24212c", available);
    label(chart.header.ARTIST, tx, 62, "600 9px system-ui", "#5b5563", available);
    ctx.restore();
    if (time < chart.leadInSeconds) {
      const alpha = 0.7 + 0.2 * Math.cos(time * Math.PI * 2);
      ctx.globalAlpha = alpha; ctx.textAlign = "center"; ctx.fillStyle = "#fff0d1";
      ctx.font = `800 ${clamp(f.width * 0.04, 22, 48)}px system-ui`;
      ctx.fillText("READY", f.cx, f.height * 0.55);
    }
    ctx.restore();
  }

  function draw({ context: ctx, chart, time, width, height, settings = {}, jacket = null, hasBackdrop = false, laneDarkness = 0.72, hitEffectsEnabled = true }) {
    const visualTime = time - (Number(settings.visualDelay) || 0);
    const f = fieldFor(width, height, settings.scale ?? 1), duration = scrollDuration(settings.noteSpeed);
    const distance = p => chart.noteDistance(p, visualTime) / duration;
    ctx.save();
    if (!hasBackdrop) {
      ctx.fillStyle = "#241c2b";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.save();
    if (settings.mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
    road(ctx, f, settings, chart, laneDarkness);
    const until = chart.visibleUntil?.(visualTime, HORIZON * duration) ?? Infinity;
    const paths = chart.paths.filter(p => p.points[0].time <= until && p.points.at(-1).time >= visualTime - (p.type === "C" ? duration * .25 : 0) && !(p.type === "C" && p.color === "Z"))
      .map(path => ({ path, spans: segments(path, chart, visualTime, distance, duration, until) }))
      .filter(p => p.spans.length).sort((a, b) => b.spans[0].da - a.spans[0].da);
    const visible = [];
    const addHead = (point, type, color) => {
      const depth = distance(point);
      if (depth >= -.04 && depth <= HORIZON) visible.push({ point, type, color, depth });
    };
    for (let i = lowerBound(chart.displayNotes, visualTime); i < chart.displayNotes.length; i++) {
      const note = chart.displayNotes[i];
      if (note.time > until) break;
      if (!note.decorative && !(note.type === "C" && note.color === "Z")) addHead(note, note.type, note.color);
    }
    for (const { path } of paths) {
      if (!AIR.has(path.type) && path.points[0].time < visualTime && path.points.at(-1).time > visualTime && window.UgcCurves) {
        const point = window.UgcCurves.sampleAtTime(path, visualTime, chart);
        addHead(point, path.type, path.color);
      }
      const points = path.points;
      for (let i = Math.max(1, lowerBound(points, visualTime)); i < points.length && points[i].time <= until; i++) {
        if (points[i].type === "s") addHead(points[i], path.type, path.color);
      }
      const ticks = path.tickNotes || [];
      for (let i = lowerBound(ticks, visualTime); i < ticks.length && ticks[i].time <= until; i++) addHead(ticks[i], "C", path.color);
    }
    visible.sort((a, b) => b.depth - a.depth || Number(a.type === "x") - Number(b.type === "x"));
    const airPaths = paths.filter(p => AIR.has(p.path.type));
    const groundPaths = paths.filter(p => !AIR.has(p.path.type));
    if (groundPaths.length) {
      const gpu = window.UgcSurfaces?.begin(ctx, f);
      groundPaths.forEach(p => ribbon(ctx, f, p.path, p.spans, gpu));
      gpu?.end(ctx, width, height);
    }
    judgment(ctx, f);
    const arrowCycle = visualTime / AIR_ARROW_PERIOD;
    const arrowPhase = arrowCycle - Math.floor(arrowCycle);
    const drawHeads = air => {
      const heads = visible.filter(h => AIR.has(h.type) === air);
      if (!heads.length) return;
      // Project the supports on the main canvas to keep the AIR sprite pass batched.
      if (air) for (const { point, depth, type } of heads) {
        if ((type === "H" || type === "S") && point.parentType) drawAirActionRungs(ctx, f, point, depth);
      }
      const gpu = window.UgcSurfaces?.begin(ctx, f);
      heads.forEach(h => noteHead(ctx, f, h.point, h.depth, h.type, visualTime, h.color, gpu, arrowPhase));
      gpu?.end(ctx, width, height);
    };
    const drawGroundSustains = () => {
      if (!hitEffectsEnabled) return;
      for (const { path } of groundPaths) {
        if (path.points[0].time > visualTime) continue;
        const p = window.UgcCurves?.sampleAtTime(path, visualTime, chart) || path.points[0];
        const center = project(f, p.x + p.width / 2, 0);
        const projectPoint = (x, y, z = 0) => project(f, p.x + p.width / 2 + x / 64, z / WARP_DEPTH, y * 16 / 466);
        window.UgcVisuals.drawSustain(ctx, { x: center.x, y: center.y, width: p.width * 64 * center.scale, worldWidth: p.width * 64, projectPoint, type: path.type, phase: visualTime });
      }
    };
    drawGroundSustains();
    drawHeads(false);
    airShadows(ctx, f, airPaths, visible);
    airPaths.forEach(p => ribbon(ctx, f, p.path, p.spans));
    drawAirGuide(ctx, f, chart, visualTime, hitEffectsEnabled);
    drawHeads(true);
    if (hitEffectsEnabled) {
      const hits = [];
      for (let index = lowerBound(chart.hitNotes, visualTime - 1); index < chart.hitNotes.length && chart.hitNotes[index].time <= visualTime; index++) {
        const p = chart.hitNotes[index], type = p.parentType || p.type, air = AIR.has(type);
        const elevation = air && !isArrow(p, type) ? p.height ?? 8 : 0;
        const center = project(f, p.x + p.width / 2, 0, elevation);
        const projectPoint = (x, y, z = 0) => project(f, p.x + p.width / 2 + x / 64, z / WARP_DEPTH, elevation + y * 16 / 466);
        hits.push({ x: center.x, y: center.y, width: p.width * 64 * center.scale, worldWidth: p.width * 64, projectPoint, type: p.exStart ? "x" : p.type,
          parentType: p.parentType, age: visualTime - p.time, seed: index, air, direction: p.direction, color: type === "C" ? CRUSH_COLORS[p.color] : p.color });
      }
      if (hits.length) {
        const gpu = window.UgcSurfaces?.begin(ctx, f);
        const paint = (atlas, region, quad, alpha) => {
          if (gpu) gpu.draw(atlas, quad, width, height, region, alpha);
          else {
            ctx.save(); ctx.globalAlpha *= alpha;
            surface(ctx, f, atlas, quad, region); ctx.restore();
          }
        };
        for (const hit of hits) window.UgcVisuals.drawHitFloor(hit, paint);
        gpu?.end(ctx, width, height);
        for (const hit of hits) window.UgcVisuals.drawHit(ctx, hit);
      }
    }
    ctx.restore(); hud(ctx, f, chart, time, settings, jacket); ctx.restore();
  }

  window.UgcRenderer = Object.freeze({ crushColors: Object.freeze(CRUSH_COLORS), draw, scrollDuration, fieldFor, project, noteQuad, arrowQuad, airJudgeQuad });
})();
