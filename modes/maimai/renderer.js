(function () {
  "use strict";
  const { button, sensor, position } = window.MaiGeometry;
  const tau = Math.PI * 2;
  const backgroundRadius = 1.18;
  const backgroundDiameter = 2 * backgroundRadius;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const palette = { tap: "#ef4386", touch: "#1fd7fc", slide: "#16cffa", each: "#ffd428", break: "#ff7937" };
  const colorOf = (n) =>
    n.mine ? "#977caa" : n.break
      ? palette.break
      : n.each
        ? palette.each
        : n.area
          ? palette.touch
          : n.kind === "slide" || n.star
            ? palette.slide
            : palette.tap;
  const sprites = new Map();

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.0001, r), 0, tau);
  }
  function polygon(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  function bevel(ctx, color, radius) {
    const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
    gradient.addColorStop(0, "#fff4e6");
    gradient.addColorStop(0.22, color);
    gradient.addColorStop(0.63, color);
    gradient.addColorStop(1, "#ffe6ca");
    return gradient;
  }

  function stroke(ctx, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function stamp(shape, color, ex) {
    const key = shape + color + ex;
    if (sprites.has(key)) return sprites.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.translate(80, 80);
    ctx.lineJoin = "round";
    if (shape === "guide") {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
      glow.addColorStop(0, "#fff");
      glow.addColorStop(0.12, "#fff8ea");
      glow.addColorStop(0.33, color + "ad");
      glow.addColorStop(1, color + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(-70, -70, 140, 140);
    } else if (shape === "mine") {
      const points = Array.from({ length: 16 }, (_, i) => {
        const angle = i * Math.PI / 8, radius = i % 2 ? 36 : 61;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      });
      polygon(ctx, points);
      ctx.fillStyle = "#392943";
      ctx.fill();
      stroke(ctx, color, 7);
      circle(ctx, 0, 0, 16);
      stroke(ctx, "#f2ddfa", 6);
    } else if (shape === "tap") {
      circle(ctx, 0, 0, 51);
      if (ex) stroke(ctx, "#fff4e6b0", 39);
      stroke(ctx, "#291625", 32);
      stroke(ctx, "#fff6fb", 28);
      // Alternate the direction of the polish on successive quarters.
      const light = color === palette.break ? "#ffbf20" : color === palette.each ? "#fff25b" : "#ff8ac5";
      for (let i = 0; i < 4; i++) {
        const a = (i * tau) / 4,
          b = a + tau / 4;
        const polish = ctx.createLinearGradient(
          51 * Math.cos(a),
          51 * Math.sin(a),
          51 * Math.cos(b),
          51 * Math.sin(b),
        );
        polish.addColorStop(0, light);
        polish.addColorStop(1, color);
        ctx.beginPath();
        ctx.arc(0, 0, 51, a, b + 0.003);
        stroke(ctx, polish, 22);
      }
    } else if (shape === "star" || shape === "doubleStar") {
      const points = Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5 - Math.PI / 2,
          r = i % 2 ? 29 : 53;
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
      ctx.lineJoin = "miter";
      const layers = shape === "doubleStar" ? 2 : 1;
      for (let i = 0; i < layers; i++) {
        ctx.save();
        if (i === 0 && layers === 2) ctx.rotate(Math.PI / 5);
        polygon(ctx, points);
        if (ex) stroke(ctx, "#fffaeab0", 26);
        stroke(ctx, "#211321", 21);
        stroke(ctx, "#fff8e9", 17);
        stroke(ctx, bevel(ctx, color, 55), 12);
        stroke(ctx, color === palette.slide ? "#136de9" : color === palette.break ? "#ff4120" : "#ffb914", 4);
        ctx.restore();
      }
    } else {
      const solid = shape === "touchHold";
      polygon(ctx, [
        [0, 23],
        [-30, -20],
        [30, -20],
      ]);
      if (solid) {
        ctx.fillStyle = bevel(ctx, color, 36);
        ctx.fill();
      }
      const band = solid ? 8 : 14;
      stroke(ctx, "#171522", band + (ex ? 12 : 8));
      stroke(ctx, "#fff7ec", band + 4);
      stroke(ctx, color, band);
      const tip = ctx.createRadialGradient(0, 23, 0, 0, 23, 12);
      tip.addColorStop(0, "#fff");
      tip.addColorStop(0.32, "#fff9e9");
      tip.addColorStop(1, color + "00");
      ctx.fillStyle = tip;
      ctx.fillRect(-12, 11, 24, 24);
    }
    sprites.set(key, canvas);
    return canvas;
  }
  function sprite(ctx, shape, color, ex, p, size, angle = 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.drawImage(stamp(shape, color, ex), -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function buttonLight(ctx, key, color, strength) {
    const p = button(key);
    ctx.save();
    ctx.globalAlpha = clamp(strength) * 0.85;
    circle(ctx, p.x, p.y, 0.041);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  const spawnRadius = 0.255;
  const radialDistance = (progress) => spawnRadius + (1 - spawnRadius) * progress;

  function cabinet(ctx, R, hasMedia, visibility) {
    // A single sector is repeated at 45-degree intervals. The square
    // sensors sit between button axes, the inner sensors sit on them.
    ctx.lineJoin = "round";
    ctx.globalAlpha = visibility;
    for (let k = 0; k < 8; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 4);
      ctx.lineWidth = 1.25 / R;
      ctx.strokeStyle = "#87878e";
      ctx.setLineDash([1.4 / R, 3.8 / R]);
      ctx.beginPath();
      ctx.moveTo(0.148, -0.988);
      ctx.lineTo(0.109, -0.721);
      ctx.quadraticCurveTo(0.224, -0.599, 0.389, -0.587);
      ctx.lineTo(0.433, -0.587);
      ctx.lineTo(0.594, -0.804);
      ctx.stroke();
      ctx.setLineDash([]);

      const tile = ctx.createLinearGradient(0, -0.8, 0, -0.28);
      tile.addColorStop(0, hasMedia ? "#39383e" : "#29292d");
      tile.addColorStop(0.63, "#212125");
      tile.addColorStop(1, "#19191b");
      ctx.fillStyle = tile;
      ctx.strokeStyle = hasMedia ? "#9a98a1" : "#595961";
      ctx.lineWidth = 1.65 / R;
      polygon(ctx, [
        [0, -0.796],
        [0.145, -0.65],
        [0, -0.505],
        [-0.145, -0.65],
      ]);
      ctx.fill();
      ctx.stroke();
      polygon(ctx, [
        [0.014, -0.463],
        [0.127, -0.582],
        [0.316, -0.503],
        [0.316, -0.342],
        [0.261, -0.288],
        [0.123, -0.288],
        [0.014, -0.392],
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    circle(ctx, 0, 0, spawnRadius);
    stroke(ctx, "rgba(255, 225, 143, 0.27)", 1 / R);
    circle(ctx, 0, 0, 1);
    ctx.strokeStyle = "#e4e5eb";
    ctx.lineWidth = 3.1 / R;
    ctx.stroke();
    for (let k = 1; k <= 8; k++) {
      const p = button(k);
      circle(ctx, p.x, p.y, 0.029);
      ctx.fillStyle = "#f0eff4";
      ctx.fill();
    }
  }

  const ranks = [
    [100.5, "SSS+"],
    [100, "SSS"],
    [99.5, "SS+"],
    [99, "SS"],
    [98, "S+"],
    [97, "S"],
    [94, "AAA"],
    [90, "AA"],
    [80, "A"],
    [75, "BBB"],
    [70, "BB"],
    [60, "B"],
    [50, "C"],
    [0, "D"],
  ];
  const rankColors = {
    D: [149, 100, 169],
    C: [135, 116, 203],
    B: [92, 153, 215],
    BB: [79, 167, 212],
    BBB: [69, 180, 193],
    A: [73, 190, 104],
    AA: [62, 179, 114],
    AAA: [71, 181, 137],
    S: [162, 177, 202],
    "S+": [181, 193, 210],
    SS: [201, 207, 214],
    "SS+": [221, 213, 186],
    SSS: [236, 183, 54],
    "SSS+": [255, 201, 70],
  };
  function frameShade(rgb, tint, amount, alpha = 1) {
    return "rgba(" + rgb.map((v) => Math.round(v + (tint - v) * amount)).join(",") + "," + alpha + ")";
  }
  const rankTimelines = new WeakMap();
  function rankTimeline(chart) {
    if (rankTimelines.has(chart)) return rankTimelines.get(chart);
    const changes = [{ time: -Infinity, rank: "D" }];
    // Find the first judgment at each threshold. A chord can skip several ranks.
    for (let i = ranks.length - 2; i >= 0; i--) {
      const [threshold, rank] = ranks[i];
      let lo = 1,
        hi = chart.achievement.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (chart.achievement[mid] < threshold) lo = mid + 1;
        else hi = mid;
      }
      if (lo === chart.achievement.length) break;
      const time = chart.hitNotes[lo - 1].time;
      if (time === changes.at(-1).time) changes.at(-1).rank = rank;
      else changes.push({ time, rank });
    }
    rankTimelines.set(chart, changes);
    return changes;
  }

  const ease = (t) => t * t * (3 - 2 * t);
  const rateTravel = 0.22;
  function displayedRates(chart, passed, time) {
    let deluxe = chart.achievement[passed], pendingBreaks = 0;
    for (let i = passed; i > 0; i--) {
      const hit = chart.hitNotes[i - 1];
      const age = time - hit.time;
      if (age >= rateTravel) break;
      const pending = 1 - ease(clamp(age / rateTravel));
      deluxe -= (chart.achievement[i] - chart.achievement[i - 1]) * pending;
      if (hit.break) pendingBreaks += pending;
    }
    return { deluxe: Math.max(0, deluxe), pendingBreaks };
  }

  // All HUD labels share a typeface. Measure its small alphabet once at a fixed size.
  const hudGlyphWidths = new Map();
  let hudLayer;
  const hudHalfAngle = 0.84;
  const clearPercent = 80;
  const clearTimes = new WeakMap();

  function clearTime(chart) {
    if (clearTimes.has(chart)) return clearTimes.get(chart);
    const index = chart.achievement.findIndex(value => value >= clearPercent);
    let crossing = Infinity;
    if (index > 0) {
      // The displayed bar can cross between judgments while several gains overlap.
      let lo = chart.hitNotes[index - 1].time, hi = lo + rateTravel;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const passed = window.MaiSimai.upper(chart.hitNotes, mid, "time");
        if (displayedRates(chart, passed, mid).deluxe < clearPercent) lo = mid;
        else hi = mid;
      }
      crossing = hi;
    }
    clearTimes.set(chart, crossing);
    return crossing;
  }

  function clearLetterColor(time, index) {
    const phase = time / 3.2 - index * 0.16;
    const lightness = 72 + 12 * Math.cos(tau * phase);
    return `hsl(${phase * 360} 95% ${lightness}%)`;
  }

  function hud(target, chart, gauge, time) {
    // Mask just the small header surface so its transparent ends reveal the chart underneath.
    const scale = Math.ceil(target.getTransform().a);
    const halfWidth = Math.ceil(backgroundRadius * Math.sin(hudHalfAngle) * scale) + 1;
    const top = Math.ceil(backgroundRadius * scale) + 1;
    const height = top - Math.floor((backgroundRadius - 0.085) * Math.cos(hudHalfAngle) * scale) + 1;
    if (hudLayer?.scale !== scale) {
      const canvas = document.createElement("canvas");
      canvas.width = halfWidth * 2;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(scale, 0, 0, scale, halfWidth, top);
      const mask = ctx.createConicGradient(-Math.PI / 2 - hudHalfAngle, 0, 0);
      const span = 2 * hudHalfAngle / tau;
      mask.addColorStop(0, "transparent");
      const fadeSpan = span * 0.18;
      mask.addColorStop(fadeSpan, "#000");
      mask.addColorStop(span - fadeSpan, "#000");
      mask.addColorStop(span, "transparent");
      hudLayer = { scale, ctx, mask };
    }
    const { ctx, mask } = hudLayer;
    const x = -halfWidth / scale, y = -top / scale;
    const w = ctx.canvas.width / scale, h = height / scale;
    ctx.clearRect(x, y, w, h);
    drawHud(ctx, chart, gauge, time);
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = mask;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    target.drawImage(ctx.canvas, x, y, w, h);
  }

  function drawHud(ctx, chart, gauge, time) {
    const changes = rankTimeline(chart),
      transition = 0.3;
    const first = window.MaiSimai.upper(changes, time - transition, "time") - 1;
    const last = window.MaiSimai.upper(changes, time, "time") - 1;
    const outer = backgroundRadius,
      base = outer - 0.085,
      mid = (base + outer) / 2;
    function band(left, right, inner, edge, fill) {
      ctx.beginPath();
      ctx.arc(0, 0, edge, left - Math.PI / 2, right - Math.PI / 2);
      ctx.arc(0, 0, inner, right - Math.PI / 2, left - Math.PI / 2, true);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    function label(angle, value, size, color, maxWidth, offset = 0, layout = value) {
      const radius = mid - offset;
      ctx.save();
      ctx.font = "600 100px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let width = 0;
      for (const glyph of layout) {
        if (!hudGlyphWidths.has(glyph)) hudGlyphWidths.set(glyph, ctx.measureText(glyph).width / 100);
        width += hudGlyphWidths.get(glyph) * size;
      }
      const fit = Math.min(1, maxWidth / width);
      let cursor = angle - width * fit / (2 * radius);
      const perLetter = typeof color === "function";
      if (!perLetter) ctx.fillStyle = color;
      const leadingSlots = layout.length - value.length;
      for (let i = 0; i < layout.length; i++) {
        const arc = hudGlyphWidths.get(layout[i]) * size * fit / radius;
        if (i < leadingSlots) {
          cursor += arc;
          continue;
        }
        ctx.save();
        ctx.rotate(cursor + arc / 2);
        ctx.translate(0, -radius);
        ctx.scale(size * fit / 100, size / 100);
        if (perLetter) ctx.fillStyle = color(i - leadingSlots);
        ctx.fillText(value[i - leadingSlots], 0, 0);
        ctx.restore();
        cursor += arc;
      }
      ctx.restore();
    }
    const rankHalfAngle = 0.135;
    const start = -hudHalfAngle + 0.014,
      end = -rankHalfAngle - 0.08,
      mark = start + (end - start) * clearPercent / 100;
    ctx.save();
    ctx.lineJoin = "round";
    // Blend across chart time up to the next actual rank, even during rests.
    const current = changes[last],
      next = changes[last + 1];
    const startTime = Math.max(0, current.time);
    const endTime = next?.time ?? (chart.playbackEnd || chart.duration);
    const progress = ease(clamp((time - startTime) / Math.max(0.001, endTime - startTime)));
    const from = rankColors[current.rank],
      to = next ? rankColors[next.rank] : from;
    const rgb = from.map((v, i) => v + (to[i] - v) * progress);
    const accent = frameShade(rgb, 255, 0.35);
    const surface = ctx.createRadialGradient(0, 0, base, 0, 0, outer);
    surface.addColorStop(0, frameShade(rgb, 0, 0.78, 0));
    surface.addColorStop(1, frameShade(rgb, 0, 0.78));
    band(-hudHalfAngle, hudHalfAngle, base, outer, surface);
    band(-hudHalfAngle, hudHalfAngle, outer - 0.004, outer, accent);

    const track = mid - 0.006;
    band(start, end, track - 0.006, track + 0.006, "#47505c");
    if (gauge > 0) {
      const tip = start + (end - start) * clamp(gauge / 100);
      band(start, tip, track - 0.006, track + 0.006, "#58dce8");
    }
    band(mark - 0.0018, mark + 0.0018, track - 0.013, track + 0.013, "#e5eef4");
    const clearAngle = (mark + end) / 2;
    if (gauge < clearPercent) {
      label(clearAngle, "CLEAR", 0.026, "#e0e7ed", 0.1, -0.018);
    } else {
      const age = Math.max(0, time - clearTime(chart));
      const rise = ease(clamp(age / 0.35));
      const wave = ease(clamp((age - 0.7) / 0.9));
      const glow = rise * (1 - wave);
      ctx.save();
      if (wave < 1) {
        ctx.save();
        ctx.rotate(clearAngle);
        ctx.translate(0, -mid - 0.018);
        ctx.scale(0.09, 0.032);
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        halo.addColorStop(0, "#fff7c5da");
        halo.addColorStop(0.45, "#ffd27aaa");
        halo.addColorStop(1, "#ffc66a00");
        ctx.globalAlpha = glow;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = halo;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
        label(clearAngle, "CLEAR", 0.026, "#e0e7ed", 0.1, -0.018);
        ctx.globalAlpha = glow;
        ctx.shadowColor = "#fff3c4";
        ctx.shadowBlur = Math.min(18, ctx.getTransform().a * 0.034) * glow;
        label(clearAngle, "CLEAR", 0.026 * (1 + 0.18 * glow), "#ffffff", 0.118, -0.018);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = wave;
      label(clearAngle, "CLEAR", 0.026, index => clearLetterColor(age, index), 0.1, -0.018);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    const rankHalfWidth = outer * Math.sin(rankHalfAngle);
    ctx.rect(-rankHalfWidth, -outer, 2 * rankHalfWidth, outer - base + 0.025);
    ctx.clip();
    let remaining = 1;
    for (let i = last; i >= first; i--) {
      const progress = i === first ? 1 : ease(clamp((time - changes[i].time) / transition));
      ctx.globalAlpha = remaining * progress;
      const rank = changes[i].rank;
      label(0, rank, 0.065, accent, 2 * mid * rankHalfAngle, (1 - progress) * 0.055 - (1 - remaining) * 0.045);
      remaining *= 1 - progress;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    band(rankHalfAngle, rankHalfAngle + 0.003, base + 0.022, outer - 0.022, "#75808a");
    const percent = Math.floor(gauge * 10000 + 1e-8) / 10000;
    // Reserve three integer slots so even a carry to 100% leaves every other slot in place.
    label(rankHalfAngle + 0.20, percent.toFixed(4) + "%", 0.056, "#f3f5f8", 0.423, 0, "000.0000%");
    ctx.restore();
  }
  let rimCache;
  let rimHasMedia, rimVisibility;
  function drawCabinet(ctx, R, hasMedia, visibility) {
    const pixels = Math.max(1, Math.ceil(R * 2.32 * Math.min(window.devicePixelRatio || 1, 2)));
    if (rimCache?.width !== pixels || rimHasMedia !== hasMedia || rimVisibility !== visibility) {
      rimHasMedia = hasMedia;
      rimVisibility = visibility;
      rimCache = document.createElement("canvas");
      rimCache.width = rimCache.height = pixels;
      const target = rimCache.getContext("2d");
      target.translate(pixels / 2, pixels / 2);
      target.scale(pixels / 2.32, pixels / 2.32);
      cabinet(target, R, hasMedia, visibility);
    }
    ctx.drawImage(rimCache, -1.16, -1.16, 2.32, 2.32);
  }

  const trackMarkers = new WeakMap();
  function markersFor(path) {
    if (!trackMarkers.has(path)) {
      const count = Math.max(2, Math.ceil(path.length / 0.108));
      const markers = Array.from({ length: count }, (_, i) => {
        const p = position(path, (i + 1) / count),
          c = Math.cos(p.angle),
          d = Math.sin(p.angle);
        // A concave, six-corner marker keeps its notch on tight curves.
        const corners = [
          [0.052, 0],
          [0.002, 0.074],
          [-0.048, 0.074],
          [0.002, 0],
          [-0.048, -0.074],
          [0.002, -0.074],
        ];
        return corners.flatMap(([x, y]) => [p.x + x * c - y * d, p.y + x * d + y * c]);
      });
      trackMarkers.set(path, markers);
    }
    return trackMarkers.get(path);
  }

  const fanMarkers = new WeakMap();
  function drawFan(ctx, segment, progress, color) {
    if (!fanMarkers.has(segment)) {
      const bars = Array.from({ length: 11 }, (_, i) => {
        const t = (i + 1) / 12;
        return segment.paths.map((path) => position(path, t));
      });
      fanMarkers.set(segment, bars);
    }
    const bars = fanMarkers.get(segment);
    ctx.lineJoin = "bevel";
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (let i = Math.floor(progress * bars.length); i < bars.length; i++) {
      const [left, mid, right] = bars[i];
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(mid.x, mid.y);
      ctx.lineTo(right.x, right.y);
    }
    stroke(ctx, "#171a25", 0.053);
    stroke(ctx, color, 0.035);
  }

  function slideAt(ctx, n, time, color) {
    const elapsed = time - n.startTime;
    for (const s of n.segments) {
      if (elapsed >= s.finish) continue;
      const progress = clamp((elapsed - s.begin) / (s.finish - s.begin || 1));
      if (s.shape === "w") {
        drawFan(ctx, s, progress, n.break ? "#ffb525" : color);
        continue;
      }
      for (const path of s.paths) {
        const markers = markersFor(path);
        const first = Math.max(0, Math.ceil(progress * markers.length) - 1);
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = first; i < markers.length; i++) {
          const points = markers[i];
          ctx.moveTo(points[0], points[1]);
          for (let j = 2; j < points.length; j += 2) ctx.lineTo(points[j], points[j + 1]);
          ctx.closePath();
        }
        stroke(ctx, "#241521", n.break ? 0.029 : 0.022);
        if (n.break) stroke(ctx, "#ff7424", 0.013);
        ctx.fillStyle = n.break ? "#ffdc20" : color;
        ctx.fill();
        if (n.break) {
          ctx.beginPath();
          for (let i = first; i < markers.length; i++) {
            const p = markers[i];
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(p[2], p[3]);
            ctx.lineTo(p[4], p[5]);
            ctx.lineTo(p[6], p[7]);
            ctx.closePath();
          }
          ctx.fillStyle = "#ff9d12";
          ctx.fill();
        }
      }
    }
  }

  function tracingStars(ctx, n, time, color) {
    if (time >= n.endTime || time < n.time || (n.hiddenStar && time < n.startTime)) return;
    const elapsed = Math.max(0, time - n.startTime);
    const s = n.segments.find((part) => part.finish > elapsed) || n.segments.at(-1);
    const progress = clamp((elapsed - s.begin) / (s.finish - s.begin || 1));
    ctx.save();
    ctx.globalAlpha *= n.wait > 0 ? clamp((time - n.time) / n.wait) : 1;
    for (const path of s.paths) {
      const p = position(path, progress);
      sprite(ctx, "star", color, false, p, 0.34, p.angle + Math.PI / 2);
    }
    ctx.restore();
  }
  function touch(ctx, n, time, lead, color) {
    const p = sensor(n.area, n.key),
      approach = clamp(1 + (time - n.time) / lead);
    const hold = n.kind === "touchHold";
    const colors = n.break
      ? ["#ff3a29", "#ffb21a", "#ff3a29", "#ffb21a"]
      : ["#ff601d", "#ffdc17", "#1ac278", "#1ea8f5"];
    // The sensor point appears first. Its four petals fade in at rest, then
    // accelerate towards the sensor during the remainder of the approach.
    ctx.save();
    const fadeFraction = 0.2;
    const inward = clamp((approach - fadeFraction) / (1 - fadeFraction));
    const gap = (hold ? 0.07 : 0.046) + 0.063 * (1 - inward ** 3);
    ctx.save();
    ctx.globalAlpha *= clamp(approach / fadeFraction);
    for (let i = 0; i < 4; i++) {
      const angle = ((i + (hold ? 0.5 : 0)) * tau) / 4;
      sprite(
        ctx,
        hold ? "touchHold" : "touch",
        hold ? colors[i] : color,
        n.ex,
        { x: p.x + Math.sin(angle) * gap, y: p.y - Math.cos(angle) * gap },
        hold ? 0.285 : 0.26,
        angle,
      );
    }
    ctx.restore();
    if (hold && time > n.time) {
      const progress = clamp((time - n.time) / (n.duration || 1));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 0.26, -Math.PI / 2, -Math.PI / 2 + progress * tau);
      ctx.closePath();
      ctx.clip();
      const border = ctx.createConicGradient(-Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) {
        border.addColorStop(i / 4, colors[i]);
        border.addColorStop((i + 1) / 4, colors[i]);
      }
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.roundRect(-0.14, -0.14, 0.28, 0.28, 0.055);
      stroke(ctx, "#fff5e8", 0.032);
      stroke(ctx, border, 0.023);
      ctx.restore();
    }
    circle(ctx, p.x, p.y, 0.019);
    ctx.fillStyle = color;
    ctx.fill();
    stroke(ctx, "#211522", 0.005);
    ctx.restore();
  }
  function radialGuide(ctx, n, time, lead, color) {
    const progress = 1 + (time - n.time) / (lead / 1.35);
    if (progress <= 0 || progress >= 1) return;
    const radius = radialDistance(progress);
    const p = button(n.key, radius);
    const angle = Math.atan2(p.y, p.x);
    const spread = 1;
    const fade = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 2 * radius * Math.sin(spread / 2));
    fade.addColorStop(0, color + "a8");
    fade.addColorStop(0.4, color + "64");
    fade.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.arc(0, 0, radius, angle - spread, angle + spread);
    stroke(ctx, fade, 0.006);
    sprite(ctx, "guide", color, false, p, 0.105 * clamp(progress * 5));
    if (n.partner && n.partner !== n.key) {
      const other = button(n.partner, radius);
      const link = ctx.createLinearGradient(p.x, p.y, other.x, other.y);
      link.addColorStop(0, "#ffe052ba");
      link.addColorStop(0.5, "#ffe05212");
      link.addColorStop(1, "#ffe052ba");
      const delta = ((n.partner - n.key + 12) % 8) - 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, angle, angle + (delta * Math.PI) / 4, delta < 0);
      stroke(ctx, link, 0.009);
    }
  }

  function radial(ctx, n, time, lead, color, effects) {
    // Radial notes first grow on the inner ring, then travel at a constant speed.
    const travel = lead / 1.35;
    const progress = clamp(1 + (time - n.time) / travel);
    const scale = 0.35 * clamp((time - n.time + lead) / (lead - travel)) + 0.65 * clamp(progress * 4);
    if (scale <= 0) return;
    const head = button(n.key, radialDistance(progress));
    if (n.kind === "hold") {
      if (effects && time >= n.time) buttonLight(ctx, n.key, color, 0.76);
      const tail = button(n.key, radialDistance(clamp(1 + (time - n.endTime) / travel)));
      // A hold has one continuous hollow body between its moving endpoints.
      const length = Math.hypot(head.x - tail.x, head.y - tail.y);
      const cap = 0.065 * scale,
        half = 0.089 * scale;
      ctx.save();
      ctx.translate(tail.x, tail.y);
      ctx.rotate(((n.key - 2.5) * Math.PI) / 4);
      polygon(ctx, [
        [-cap, 0],
        [-cap * 0.3, -half],
        [length + cap * 0.3, -half],
        [length + cap, 0],
        [length + cap * 0.3, half],
        [-cap * 0.3, half],
      ]);
      ctx.lineJoin = "miter";
      if (n.ex) stroke(ctx, "#fff4eca8", 0.065 * scale);
      stroke(ctx, "#291925", 0.047 * scale);
      stroke(ctx, "#fff2f8", 0.04 * scale);
      stroke(ctx, bevel(ctx, color, half), 0.028 * scale);
      if (time >= n.time) stroke(ctx, color + "8c", 0.049 * scale);
      sprite(ctx, "guide", color, false, { x: 0, y: 0 }, 0.11 * scale);
      ctx.restore();
      return;
    }
    const angle = n.star
      ? n.rotate || n.slideHead
        ? (time - n.time) * 3
        : 0
      : ((n.key - 2.5) * Math.PI) / 4;
    sprite(
      ctx,
      n.mine ? "mine" : n.doubleStar ? "doubleStar" : n.star ? "star" : "tap",
      color,
      n.ex,
      head,
      (n.star ? 0.345 : 0.265) * scale,
      angle,
    );
  }
  const hitDuration = 0.32,
    fireworkDuration = 0.68;
  const rays = ["#ff656b", "#ffcf58", "#dcff77", "#59ebbe", "#8ad3ff", "#c59aff", "#ff92da"];
  function firework(ctx, n, time) {
    const age = (time - n.endTime) / fireworkDuration;
    if (age < 0 || age >= 1) return;
    const p = sensor(n.area, n.key);
    ctx.save();
    circle(ctx, 0, 0, backgroundRadius);
    ctx.clip();
    ctx.translate(p.x, p.y);
    ctx.rotate(n.key * 0.73 + age * 0.13);
    const r = 0.2 + 2.25 * (1 - (1 - age) ** 2);
    ctx.globalAlpha = 0.62 * Math.min(1, age * 15) * (1 - age);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(tau / 18);
      polygon(ctx, [
        [0.04 + age * 0.2, 0],
        [r, -0.115 * r],
        [r, 0.115 * r],
      ]);
      ctx.fillStyle = rays[i % rays.length];
      ctx.fill();
    }
    ctx.restore();
  }

  function flash(ctx, n, time, color, onset = n.endTime) {
    const age = (time - onset) / hitDuration;
    if (age < 0 || age >= 1) return;
    if (!n.area) buttonLight(ctx, n.kind === "slide" ? n.segments.at(-1).end : n.key, color, 1 - age);
    const spots =
      n.kind === "slide"
        ? n.segments.at(-1).paths.map((path) => path.points.at(-1))
        : [n.area ? sensor(n.area, n.key) : button(n.key)];
    ctx.save();
    ctx.globalAlpha = 1 - age;
    const radius = 0.056 + Math.sqrt(age) * 0.12;
    for (const p of spots) {
      ctx.save();
      ctx.translate(p.x, p.y);
      circle(ctx, 0, 0, radius * 0.68);
      ctx.strokeStyle = n.area ? "#ffe88b" : color;
      ctx.lineWidth = 0.018 * (1 - age) + 0.004;
      ctx.stroke();
      const count = n.area || n.break ? 8 : n.kind === "slide" ? 5 : 4;
      if (n.area) {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.45);
        glow.addColorStop(0, "#fff5b5a8");
        glow.addColorStop(0.45, "#f9c64420");
        glow.addColorStop(0.7, "#ffe78c70");
        glow.addColorStop(1, "#ffda6200");
        circle(ctx, 0, 0, radius * 1.45);
        ctx.fillStyle = glow;
        ctx.fill();
      }
      ctx.rotate(0.23 + n.key + age * 0.65);
      for (let i = 0; i < count; i++) {
        ctx.rotate(tau / count);
        const w = (i % 2 ? 0.018 : 0.027) * (1 - age);
        polygon(ctx, [
          [radius - w * 2, 0],
          [radius, -w],
          [radius + 2.8 * w, 0],
          [radius, w],
        ]);
        ctx.fillStyle = i % 2 ? "#fff9db" : n.area ? "#ffdc62" : color;
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  let coverCache;
  function fieldMedia(ctx, media, R, darkness, blur, videoFrameTime) {
    const w = media?.videoWidth || media?.naturalWidth || media?.width;
    const h = media?.videoHeight || media?.naturalHeight || media?.height;
    if (!w || !h || (media.readyState !== undefined && media.readyState < 2)) return false;
    const side = Math.min(w, h);
    let source = media;
    const video = media.videoWidth !== undefined || videoFrameTime !== undefined;
    const timestamp = videoFrameTime ?? media.currentTime;
    if (!video || blur > 0) {
      // Stills are filtered once; a blurred movie uses a smaller reusable surface.
      const diameter = backgroundDiameter * R;
      const filteredScale = video ? Math.min(0.5, 2 / Math.max(1, blur)) : 0.5;
      const resolution =
        blur > 0
          ? "filter" in ctx
            ? filteredScale
            : 1 / (1 + blur)
          : Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(1, Math.min(side, Math.ceil(diameter * resolution)));
      if (
        coverCache?.source !== media ||
        coverCache.canvas.width !== size ||
        coverCache.blur !== blur ||
        coverCache.url !== media.currentSrc
      ) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        coverCache = { source: media, url: media.currentSrc, canvas, blur, time: -Infinity };
      }
      if (
        coverCache.time === -Infinity ||
        (video &&
          (videoFrameTime !== undefined || media.paused
            ? timestamp !== coverCache.time
            : Math.abs(timestamp - coverCache.time) >= 1 / 30))
      ) {
        const target = coverCache.canvas.getContext("2d");
        target.clearRect(0, 0, size, size);
        const radius = (blur * size) / diameter;
        target.filter = radius ? "blur(" + radius + "px)" : "none";
        const pad = Math.ceil(2 * radius);
        target.drawImage(
          media,
          (w - side) / 2,
          (h - side) / 2,
          side,
          side,
          -pad,
          -pad,
          size + 2 * pad,
          size + 2 * pad,
        );
        coverCache.time = video ? timestamp : 0;
      }
      source = coverCache.canvas;
    }
    ctx.save();
    circle(ctx, 0, 0, backgroundRadius);
    ctx.clip();
    if (source === media)
      ctx.drawImage(media, (w - side) / 2, (h - side) / 2, side, side, -backgroundRadius, -backgroundRadius, backgroundDiameter, backgroundDiameter);
    else ctx.drawImage(source, -backgroundRadius, -backgroundRadius, backgroundDiameter, backgroundDiameter);
    ctx.fillStyle = "rgba(0,0,0," + darkness + ")";
    ctx.fillRect(-backgroundRadius, -backgroundRadius, backgroundDiameter, backgroundDiameter);
    ctx.restore();
    return true;
  }

  let comboLayout;
  function combo(ctx, count, R, opacity) {
    if (!count || !opacity) return;
    ctx.save();
    ctx.scale(1 / R, 1 / R);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (comboLayout?.radius !== R) {
      const labelFont = "800 " + 0.075 * R + "px system-ui";
      const numberFont = "800 " + 0.16 * R + "px ui-monospace, monospace";
      ctx.font = labelFont;
      const label = ctx.measureText("COMBO");
      ctx.font = numberFont;
      const digits = ctx.measureText("0123456789");
      const gap = 0.033 * R;
      const height = label.actualBoundingBoxAscent + label.actualBoundingBoxDescent +
        gap + digits.actualBoundingBoxAscent + digits.actualBoundingBoxDescent;
      const labelY = -height / 2 + label.actualBoundingBoxAscent;
      const numberY = height / 2 - digits.actualBoundingBoxDescent;
      comboLayout = { radius: R, labelFont, numberFont, labelY, numberY };
    }
    ctx.globalAlpha *= opacity;
    ctx.fillStyle = "#d5d1d8";
    ctx.strokeStyle = "#302c35";
    ctx.lineWidth = 0.006 * R;
    ctx.font = comboLayout.labelFont;
    ctx.strokeText("COMBO", 0, comboLayout.labelY);
    ctx.fillText("COMBO", 0, comboLayout.labelY);
    ctx.font = comboLayout.numberFont;
    ctx.strokeText(String(count), 0, comboLayout.numberY);
    ctx.fillText(String(count), 0, comboLayout.numberY);
    ctx.restore();
  }

  function extraInfo(ctx, chart, time, passed, rates, width, height, side, footer, field) {
    const { counts, finale, deluxe } = chart.statsAt(time, passed, rates);
    const pct = (n, places) => (Math.floor(n * 10 ** places + 1e-8) / 10 ** places).toFixed(places) + "%";
    const ticks = Math.floor(Math.abs(time) * 10000);
    const clock =
      (time < 0 ? "−" : "") + Math.floor(ticks / 600000) +
      ":" +
      String(Math.floor(ticks / 10000) % 60).padStart(2, "0") +
      "." +
      String(ticks % 10000).padStart(4, "0");
    counts.push({ name: "ALL", hit: passed, total: chart.noteCount });
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f1f6";
    ctx.strokeStyle = "#16141d";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    function text(value, x, y, size, limit) {
      ctx.font = "700 " + size + "px system-ui";
      ctx.strokeText(value, x, y, limit);
      ctx.fillText(value, x, y, limit);
    }
    if (side) {
      const textRadius = field.radius + Math.min(40, side * 0.23);
      const span = Math.max(1, Math.min(side - 22, width - field.x - textRadius - 8));
      // Align the left edge to a concentric arc. Both columns stay on a horizontal baseline.
      const rowLeft = y => field.x + Math.sqrt(Math.max(0, textRadius ** 2 - (y - field.y) ** 2));
      const line = Math.min(24, height / 12),
        size = Math.min(17, line * 0.74);
      let y = (height - (4 + counts.length) * line) / 2 + line / 2;
      for (const [label, value] of [
        ["FiNALE Rate", pct(finale, 2)],
        ["DELUXE Rate", pct(deluxe, 4)],
      ]) {
        text(label, rowLeft(y), y, size * 0.79, span);
        y += line * 0.8;
        text(value, rowLeft(y), y, size * 1.17, span);
        y += line * 1.18;
      }
      for (const { name, hit, total } of counts) {
        const x = rowLeft(y);
        text(name, x, y, size * 0.82, span * 0.37);
        text(hit + " / " + total, x + span * 0.4, y, size * 0.91, span * 0.6);
        y += line;
      }
      text(clock, 14, height - 12, size, span);
    } else {
      const x = 10,
        col = (width - 2 * x) / 3,
        row = footer / 4,
        top = height - footer;
      text("FiNALE  " + pct(finale, 2), x, top + row / 2, 13, width * 0.46);
      text("DELUXE  " + pct(deluxe, 4), width / 2, top + row / 2, 13, width * 0.46);
      counts.forEach(({ name, hit, total }, i) => {
        text(
          name + "  " + hit + "/" + total,
          x + (i % 3) * col,
          top + (1.5 + Math.floor(i / 3)) * row,
          12,
          col - 5,
        );
      });
      text(clock, x, top + row * 3.5, 12, width * 0.45);
    }
    ctx.restore();
  }

  function draw({
    context: ctx,
    chart,
    time,
    width,
    height,
    hasBackdrop,
    maiBackground,
    videoFrameTime,
    outerColor = "#101011",
    bottomInset = 48,
    cabinetGlass = false,
    infoScale = 1,
    jacket,
    mediaDarkness = 0.82,
    mediaBlur = 0,
    sensorVisibility = 0.29,
    comboOpacity = 0.15,
    hitEffectsEnabled = false,
    maiSpeed = 4,
    maiExtraInfo = false,
  }) {
    const usableHeight = Math.max(1, height - bottomInset);
    const side = maiExtraInfo && (width >= 580 || usableHeight < 180) ? Math.min(180, width * 0.27) : 0;
    const footer = maiExtraInfo && !side ? Math.min(84, usableHeight * 0.42) : 0;
    const fieldWidth = width - side;
    const fieldHeight = usableHeight - footer;
    const shortSide = Math.min(fieldWidth, fieldHeight);
    if (shortSide <= 0) return;
    const padding = cabinetGlass ? 0 : Math.min(24, Math.max(10, shortSide * 0.035), shortSide / 4);
    const R = (shortSide - 2 * padding) / backgroundDiameter;
    const cx = Math.min(width / 2, fieldWidth - padding - backgroundRadius * R),
      cy = fieldHeight / 2,
      baseLead = 1.58 / Math.max(1, maiSpeed);
    ctx.save();
    if (!hasBackdrop) {
      ctx.fillStyle = outerColor;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(R, R);
    ctx.lineCap = "round";
    const age = time - window.MaiClear.start(chart);
    const passed = window.MaiSimai.upper(chart.hitNotes, time, "time");
    const rates = displayedRates(chart, passed, time);
    if (time >= window.MaiIntro.revealTime && age < 0.24) {
      const hasMedia = fieldMedia(ctx, maiBackground, R, mediaDarkness, mediaBlur, videoFrameTime);
      if (!hasMedia) {
        circle(ctx, 0, 0, backgroundRadius);
        const gray = Math.round(48 * (1 - mediaDarkness));
        ctx.fillStyle = "rgb(" + gray + "," + gray + "," + (gray + 2) + ")";
        ctx.fill();
      }
      drawCabinet(ctx, R, hasMedia, sensorVisibility);
      combo(ctx, passed, R, comboOpacity);
      const notes = chart.displayNotes;
      let lo = 0,
        hi = notes.length;
      while (lo < hi) {
        const m = (lo + hi) >>> 1;
        if (chart.prefixEnd[m] < time - fireworkDuration) lo = m + 1;
        else hi = m;
      }
      const touchLead = baseLead * 1.55,
        radialLead = baseLead * 1.35;
      const end = window.MaiSimai.upper(notes, time + touchLead / 0.25, "time");
      for (let i = lo; i < end; i++) {
        if (!notes[i].mine && notes[i].firework) firework(ctx, notes[i], time);
      }
      for (const tracks of [true, false]) {
        for (let i = lo; i < end; i++) {
          const n = notes[i],
            lead = (n.area ? touchLead : n.kind === "slide" ? baseLead : radialLead) / Math.max(0.25, n.scroll);
          if (n.time - time > lead || time - n.endTime > fireworkDuration) continue;
          const color = colorOf(n);
          if (tracks) {
            if (n.kind === "slide" && time < n.endTime) {
              ctx.save();
              ctx.globalAlpha =
                time >= n.time - 0.05 ? 1 : 0.5 * clamp((time - n.time + lead) / Math.min(0.2, lead));
              slideAt(ctx, n, time, color);
              ctx.restore();
            } else if (!n.area && n.kind !== "slide") radialGuide(ctx, n, time, lead, color);
          } else if (time >= n.endTime) {
            if (hitEffectsEnabled && !n.mine) flash(ctx, n, time, color);
          } else if (n.kind === "slide") tracingStars(ctx, n, time, color);
          else {
            if (n.area) touch(ctx, n, time, lead, color);
            else radial(ctx, n, time, lead, color, hitEffectsEnabled && !n.mine);
            if (hitEffectsEnabled && !n.mine && n.duration > 0) flash(ctx, n, time, color, n.time);
          }
        }
      }
      hud(ctx, chart, rates.deluxe, time);
    }
    if (time < 0) window.MaiIntro.draw(ctx, chart, time, backgroundRadius, jacket);
    if (age >= 0) {
      const rank = ranks.find(([threshold]) => rates.deluxe >= threshold)?.[1] || "D";
      window.MaiClear.draw(ctx, age, backgroundRadius, chart, rank, rates.deluxe, jacket, cabinetGlass);
    }
    ctx.restore();
    if (maiExtraInfo) {
      ctx.scale(infoScale, infoScale);
      extraInfo(ctx, chart, time, passed, rates, width / infoScale, usableHeight / infoScale, side, footer, {
        x: cx / infoScale, y: cy / infoScale, radius: backgroundRadius * R / infoScale
      });
    }
    ctx.restore();
  }
  window.MaiRenderer = { draw, colorOf };
})();
