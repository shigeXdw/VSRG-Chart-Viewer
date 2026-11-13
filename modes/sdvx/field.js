(function () {
  "use strict";
  const blue = "#37ddff",
    pink = "#ff59af";
  const colors = { bt: "#e8f5ff", fx: "#ffac37" };
  const { upper, valueAt } = window.KshChart;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const cache = new WeakMap();
  // The outer two strips are the laser margins; BT and FX share the middle four.
  const center = (n) => (n.kind === "fx" ? (2 + (n.lane - 4) * 2) / 6 : (n.lane + 1.5) / 6);
  const laserX = (pos) => (0.5 + 5 * pos) / 6;
  const lerp = (a, b, t) => a + (b - a) * t;

  function laserAt(list, beat) {
    const n = list[upper(list, beat) - 1];
    if (!n || beat > n.endBeat + 1e-8) return null;
    return n.slam ? n.y : lerp(n.x, n.y, (beat - n.beat) / (n.endBeat - n.beat));
  }

  // Runs compact a sustained judgment stream into a start, spacing and count.
  // Evaluating these against chart time makes score and chain survive arbitrary seeks.
  function judgmentRuns(chart) {
    const runs = [];
    function add(start, step, count, weight = 1) {
      if (count > 0) runs.push({ start, step, count, weight, end: start + step * (count - 1) });
    }
    function spacing(n) {
      const bpm = chart.bpmChanges[Math.max(0, upper(chart.bpmChanges, n.beat) - 1)].bpm;
      const octave = Math.max(0, Math.floor(Math.log2(bpm)) - 7);
      const offset = clamp(valueAt(chart.ksh.tickrate, n.beat, 0), -8, 8);
      return (15 / bpm) * 2 ** (octave - offset);
    }
    for (const n of chart.hitNotes) {
      if (n.kind === "laser") continue;
      if (n.beat === n.endBeat) {
        add(n.time, 0, 1, 4);
        continue;
      }
      const step = spacing(n),
        duration = n.endTime - n.time;
      const count = Math.ceil(duration / step - 1e-8) - 2;
      if (count > 0) add(n.time + step, step, count);
      else add(n.time + duration / 2, 0, 1);
    }
    for (const lane of chart.ksh.lasers) {
      let start,
        end,
        step,
        afterSlam = false;
      function flush() {
        if (start === undefined) return;
        const skip = Number(afterSlam);
        add(start + skip * step, step, Math.floor((end - start) / step + 1e-8) - skip);
        start = undefined;
      }
      for (const n of lane) {
        if (end === undefined || Math.abs(end - n.time) > 1e-6) {
          flush();
          afterSlam = false;
          step = spacing(n);
        }
        if (n.slam) {
          flush();
          add(n.time, 0, 1);
          afterSlam = true;
        } else if (start === undefined) start = n.time;
        end = n.endTime;
      }
      flush();
    }
    runs.sort((a, b) => a.start - b.start);
    const blocks = [];
    let total = 0,
      totalWeight = 0;
    for (let i = 0; i < runs.length; i += 64) {
      const group = runs.slice(i, i + 64),
        count = group.reduce((sum, r) => sum + r.count, 0);
      const weight = group.reduce((sum, r) => sum + r.count * r.weight, 0);
      totalWeight += weight;
      blocks.push({
        weight,
        start: group[0].start,
        end: Math.max(...group.map((r) => r.end)),
        count,
        group
      });
      total += count;
    }
    return { blocks, total, totalWeight, gain: chart.ksh.gaugeGain };
  }
  function judgmentsAt(judgments, time) {
    let chain = 0,
      weight = 0;
    for (const b of judgments.blocks) {
      if (time < b.start) break;
      if (time >= b.end) {
        chain += b.count;
        weight += b.weight;
        continue;
      }
      for (const r of b.group) {
        if (time < r.start) break;
        const count =
          time >= r.end ? r.count : Math.min(r.count, 1 + Math.floor((time - r.start) / r.step));
        chain += count;
        weight += count * r.weight;
      }
    }
    return {
      chain,
      gauge: judgments.totalWeight ? Math.min(1, (weight * judgments.gain) / judgments.totalWeight) : 0,
      score: judgments.total ? Math.floor((10000000 * chain) / judgments.total) : 0
    };
  }
  function presentation(chart) {
    if (cache.has(chart)) return cache.get(chart);
    const { cuts, position } = chart.ksh.display;
    const pieces = [],
      lights = Array.from({ length: 6 }, () => []);
    for (const n of chart.displayNotes) {
      if (n.lane < 6) lights[n.lane].push(n);
      const knots = [n.beat];
      let lo = 0,
        hi = cuts.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cuts[mid] <= n.beat) lo = mid + 1;
        else hi = mid;
      }
      for (let i = lo; i < cuts.length && cuts[i] < n.endBeat; i++) knots.push(cuts[i]);
      knots.push(n.endBeat);
      const breaks = [knots[0]];
      for (let i = 1; i < knots.length; i++) {
        const a = knots[i - 1],
          b = knots[i];
        if (n.kind === "laser" && n.x !== n.y && chart.ksh.display.ramping(a)) {
          const count = Math.min(24, Math.ceil((b - a) / 0.25));
          for (let j = 1; j < count; j++) breaks.push(a + ((b - a) * j) / count);
        }
        breaks.push(b);
      }
      const x = (b) =>
        n.kind === "laser"
          ? laserX(lerp(n.x, n.y, (b - n.beat) / (n.endBeat - n.beat || 1)))
          : center(n);
      for (let i = 1; i < breaks.length; i++) {
        const beat = breaks[i - 1],
          endBeat = breaks[i];
        pieces.push({
          n,
          beat,
          endBeat,
          x: x(beat),
          y: n.slam ? laserX(n.y) : x(endBeat),
          p: position(beat),
          q: position(endBeat)
        });
      }
    }
    pieces.sort((a, b) => a.beat - b.beat);
    const chunks = [];
    for (let i = 0; i < pieces.length; i += 64) {
      const rows = pieces.slice(i, i + 64);
      chunks.push({
        rows,
        start: rows[0].beat,
        end: Math.max(...rows.map((s) => s.endBeat)),
        low: Math.min(...rows.map((s) => Math.min(s.p, s.q))),
        high: Math.max(...rows.map((s) => Math.max(s.p, s.q)))
      });
    }
    const slams = chart.ksh.lasers.map((list) => list.filter((n) => n.slam));
    const wide = chart.ksh.lasers.some((list) =>
      list.some((n) => Math.min(n.x, n.y) < 0 || Math.max(n.x, n.y) > 1)
    );
    const data = { chunks, lights, slams, wide, judgments: null };
    cache.set(chart, data);
    return data;
  }

  function poly(ctx, points, fill) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function ribbon(ctx, project, x, y, z, w, half, color) {
    poly(
      ctx,
      [project(x - half, z), project(x + half, z), project(y + half, w), project(y - half, w)],
      color
    );
  }
  function drawPlayfield({
    context: ctx,
    chart,
    time,
    width,
    height,
    hitEffectsEnabled = true,
    kshSpeed = 4,
    kshCamera = true,
    laneDarkness = 0.72,
    hasBackdrop,
    jacket
  }) {
    const stage = window.KshStage;
    const scale = Math.min(width / stage.width, height / stage.height);
    if (scale <= 0) return;
    const insetX = (width - scale * stage.width) / 2,
      insetY = (height - scale * stage.height) / 2;
    ctx.save();
    ctx.fillStyle = "#090b12";
    if (!hasBackdrop) ctx.fillRect(0, 0, width, height);
    else {
      ctx.fillRect(0, 0, insetX, height);
      ctx.fillRect(width - insetX, 0, insetX, height);
      ctx.fillRect(0, 0, width, insetY);
      ctx.fillRect(0, height - insetY, width, insetY);
    }
    ctx.translate(insetX, insetY);
    ctx.scale(scale, scale);
    width = stage.width;
    height = stage.height;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    stage.drawBackdrop(ctx, hasBackdrop);
    const skin = window.KshSkins.current,
      images = skin?.images;
    const beat = chart.secondsToBeat(time),
      { position } = chart.ksh.display,
      origin = position(beat);
    const { chunks, lights, slams } = presentation(chart),
      range = 8 / Math.max(0.5, kshSpeed);
    const pose = KshMotion.pose(chart, time, beat, kshCamera);
    const halfGap = pose.split,
      buttonX = (x) => x + (x < 0.5 ? -halfGap : halfGap);
    const judge = height * (skin?.images.console ? 0.7075 : skin ? 0.91 : 0.855);
    const zoom = 1.65 ** clamp(pose.zoom, -3, 2);
    const span = width * (skin ? 1.08 : 0.84) * zoom;
    const pitch = (clamp(pose.pitch, -5, 5) * Math.PI) / 15;
    const top = height * ((skin ? 0.36 : 0.19) - 0.56 * Math.sin(pitch));
    const at = chart.ksh.lasers.map((list) => laserAt(list, beat));
    const side = span * pose.side;
    const project = (x, z) => {
      const perspective = 1 / (1 + (12 * z) / range);
      return {
        x: ((x - 0.5) * span + side) * perspective - side,
        y: ((top - judge) * (1 - perspective)) / (1 - 1 / 13)
      };
    };
    // Rotate the lane about the camera's viewing axis. The receiver has its own
    // spin response but moves with the ordinary tilt, zoom and lateral offset.
    function orient(angle) {
      const pivot = height * 0.5,
        arm = judge - pivot;
      ctx.translate(
        width / 2 + side * Math.cos(angle) - arm * Math.sin(angle),
        pivot + side * Math.sin(angle) + arm * Math.cos(angle)
      );
      ctx.rotate(angle);
    }
    ctx.save();
    orient(pose.road);
    ctx.globalAlpha = hasBackdrop ? clamp(laneDarkness, 0, 1) : 1;
    if (images?.track) {
      const tex = images.trackSurface || images.track;
      for (const mid of [0.25 - halfGap, 0.75 + halfGap])
        ribbon(ctx, project, mid, mid, -range * 0.036, range, 0.25, "#0b1018");
      ctx.globalAlpha = 1;
      stage.track(ctx, tex, project, range, halfGap);
    } else {
      const nearDepth = skin ? -range * 0.036 : 0;
      for (let k = 0; k < 6; k++) {
        const x = buttonX((k + 0.5) / 6);
        const fill = ["#0b202a", "#141b26", "#101722", "#101722", "#141b26", "#261629"][k];
        ribbon(ctx, project, x, x, nearDepth, range, 1 / 12, fill);
      }
      ctx.globalAlpha = 1;
      for (let k = 0; k <= 6; k++) {
        const x = buttonX(k / 6);
        if (k === 3 && halfGap)
          ribbon(ctx, project, 0.5 - halfGap, 0.5 - halfGap, nearDepth, range, 0.0018, "#485771");
        ribbon(
          ctx,
          project,
          x,
          x,
          nearDepth,
          range,
          k === 0 || k === 6 ? 0.003 : 0.0015,
          k === 0 ? "#55c6de" : k === 6 ? "#de669e" : k === 3 ? "#647185" : "#435165"
        );
      }
    }
    ctx.globalAlpha = 1;
    let lo = 0,
      hi = chart.measureStarts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (chart.measureStarts[mid] < beat) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < chart.measureStarts.length && chart.measureStarts[i] < beat + 128; i++) {
      const z = position(chart.measureStarts[i]) - origin;
      if (z < 0 || z > range) continue;
      for (const mid of [0.25 - halfGap, 0.75 + halfGap]) {
        if (images?.tick) stage.surface(ctx, images.tick, project, mid, mid, z, z + 0.003 * range, 0.25);
        else ribbon(ctx, project, mid, mid, z, z + 0.001 * range, 0.25, "#505865");
      }
    }
    const visible = [];
    for (const block of chunks) {
      if (block.end < beat || block.low > origin + range || block.high < origin) continue;
      for (const s of block.rows) {
        if (s.endBeat < beat) continue;
        let p = s.p - origin,
          q = s.q - origin,
          x = s.x,
          y = s.y;
        if (beat > s.beat && s.endBeat > s.beat) {
          const t = (beat - s.beat) / (s.endBeat - s.beat);
          x = lerp(x, y, t);
          p = 0;
        }
        if (Math.max(p, q) < 0 || Math.min(p, q) > range) continue;
        if (p !== q) {
          const t0 = clamp((0 - p) / (q - p), 0, 1),
            t1 = clamp((range - p) / (q - p), 0, 1);
          const a = Math.min(t0, t1),
            b = Math.max(t0, t1);
          visible.push({
            n: s.n,
            x: lerp(x, y, a),
            y: lerp(x, y, b),
            p: lerp(p, q, a),
            q: lerp(p, q, b)
          });
        } else visible.push({ n: s.n, x, y, p, q });
      }
    }
    visible.sort(
      (a, b) =>
        Math.max(b.p, b.q) - Math.max(a.p, a.q) ||
        (a.n.kind === "laser") - (b.n.kind === "laser") ||
        (a.n.kind === "bt") - (b.n.kind === "bt")
    );
    if (images) {
      for (let side = 0; side < 2; side++) {
        const list = chart.ksh.lasers[side];
        let i = Math.max(0, upper(list, beat) - 1);
        for (; i < list.length && list[i].beat <= beat + Math.max(16, range * 4); i++) {
          const n = list[i],
            prev = list[i - 1],
            next = list[i + 1];
          if (!prev || prev.endBeat < n.beat) {
            const z = position(n.beat) - origin,
              x = laserX(n.x),
              tex = images[side ? "entryR" : "entryL"];
            if (tex && n.beat >= beat && z >= 0 && z <= range)
              stage.surface(ctx, tex, project, x, x, z - 0.0001 * range, z + 0.055 * range, 0.077);
          }
          if (!next || next.beat > n.endBeat) {
            const z = position(n.endBeat) - origin,
              x = laserX(n.y),
              tex = images[side ? "exitR" : "exitL"];
            if (tex && n.endBeat >= beat && z >= 0 && z <= range)
              stage.surface(ctx, tex, project, x, x, z, z + 0.025 * range, 0.077);
          }
        }
      }
    }
    for (const s of visible) {
      const { n, p, q } = s,
        x = n.kind === "laser" ? s.x : buttonX(s.x),
        y = n.kind === "laser" ? s.y : buttonX(s.y),
        h = n.kind === "fx" ? 0.163 : 0.079;
      const ink = n.kind === "laser" ? (n.lane === 6 ? blue : pink) : colors[n.kind];
      const side = n.lane - 6;
      const texture = images?.[n.kind === "laser" ? "laser" + side : n.kind + "Hold"];
      const active = n.time <= time && time <= n.endTime;
      const uv =
        n.kind === "laser" && skin?.gear
          ? [0, active ? 0.52 : 0.27, 1, active ? 0.72 : 0.47]
          : [0, 0, 1, 1];
      if (texture && (n.slam || n.endBeat > n.beat)) {
        if (n.slam) {
          const mid = (x + y) / 2;
          if (
            stage.surface(
              ctx,
              texture,
              project,
              mid,
              mid,
              p,
              p + range * 0.012,
              Math.abs(x - y) / 2 + h,
              uv
            )
          )
            continue;
        } else if (stage.surface(ctx, texture, project, x, y, p, q, h, uv)) continue;
      }
      if (n.slam) {
        const far = Math.min(range, p + range * 0.024);
        poly(
          ctx,
          [
            project(Math.min(x, y) - h, p),
            project(Math.max(x, y) + h, p),
            project(Math.max(x, y) + h, far),
            project(Math.min(x, y) - h, far)
          ],
          ink
        );
      } else if (n.endBeat > n.beat) {
        ribbon(
          ctx,
          project,
          x,
          y,
          p,
          q,
          h,
          n.kind === "laser"
            ? ink + (active ? "da" : "a8")
            : n.kind === "bt"
              ? active
                ? "#a4c6db"
                : "#70889a"
              : active
                ? "#eeac53"
                : "#ac752f"
        );
        if (n.kind === "laser") {
          ribbon(ctx, project, x - h + 0.006, y - h + 0.006, p, q, 0.006, ink);
          ribbon(ctx, project, x + h - 0.006, y + h - 0.006, p, q, 0.006, ink);
          ribbon(
            ctx,
            project,
            x - h * 0.62,
            y - h * 0.62,
            p,
            q,
            active ? 0.016 : 0.01,
            active ? "#f3ffff" : "#c5edfc99"
          );
        } else {
          ribbon(ctx, project, x - h * 0.83, y - h * 0.83, p, q, h * 0.1, ink);
          ribbon(ctx, project, x + h * 0.83, y + h * 0.83, p, q, h * 0.1, ink);
        }
        if (n.kind !== "laser" && n.beat >= beat && s.p === chart.ksh.display.position(n.beat) - origin)
          ribbon(ctx, project, x, x, p, p + range * 0.012, h, ink);
      } else {
        stage.chip(ctx, n.kind, project, x, p, h, range);
      }
    }
    const levels = lights.map((list) => {
      const n = list[upper(list, time, "time") - 1];
      return n ? clamp(1 - Math.max(0, time - n.endTime) / 0.15, 0, 1) : 0;
    });
    ctx.restore();
    ctx.save();
    orient(pose.bar);
    stage.drawDeck(ctx, [...levels, ...at.map((p) => Number(p !== null))]);
    stage.crit(ctx, skin ? width * 0.925 : span);
    if (!skin) stage.receptors(ctx, project, buttonX, levels);
    if (hitEffectsEnabled) {
      lights.forEach((list, lane) => {
        const n = list[upper(list, time, "time") - 1];
        if (!n) return;
        const holding = n.endTime > time;
        const age = holding ? time - n.time : time - n.endTime;
        stage.judgment(ctx, project(buttonX(center(n)), 0).x, age, holding);
      });
      for (let side = 0; side < 2; side++) {
        const list = slams[side],
          s = list[upper(list, time, "time") - 1];
        if (!s || time - s.time > 0.18) continue;
        stage.judgment(ctx, project(laserX(s.y), 0).x, time - s.time, false, side ? pink : blue);
      }
      ctx.globalAlpha = 1;
    }
    at.forEach((pos, side) => {
      const list = chart.ksh.lasers[side],
        index = upper(list, beat) - 1;
      const x = KshMotion.cursor(list, side, time, beat, pos);
      const cx = project(laserX(x), 0).x;
      if (hitEffectsEnabled && pos !== null) stage.laserContact(ctx, cx, side, time);
      stage.cursor(ctx, cx, side, pos !== null);
      const next = list[index + 1];
      if (pos === null && next && next.time - time < 0.9 && next.time >= time) {
        stage.alert(ctx, side, (side ? 1 : -1) * 220, next.time - time);
      }
    });
    ctx.restore();
    if (skin) {
      const data = presentation(chart);
      data.judgments ??= judgmentRuns(chart);
      stage.hud(ctx, chart, time, kshSpeed, judgmentsAt(data.judgments, time), jacket);
    }
    ctx.restore();
  }

  function drawMeasure({ context: ctx, chart, width, height, startBeat, endBeat }) {
    ctx.fillStyle = "#101525";
    ctx.fillRect(0, 0, width, height);
    const w = width * (presentation(chart).wide ? 0.54 : 0.84);
    const left = (width - w) / 2;
    const x = (p) => left + w * p,
      y = (b) => height - 3 - ((b - startBeat) / (endBeat - startBeat)) * (height - 6);
    for (let i = 0; i <= 6; i++) {
      ctx.fillStyle = "#394258";
      ctx.fillRect(x(i / 6), 0, 1, height);
    }
    for (const block of presentation(chart).chunks) {
      if (block.start >= endBeat) break;
      if (block.end < startBeat) continue;
      for (const s of block.rows) {
        if (s.beat >= endBeat || s.endBeat < startBeat) continue;
        const n = s.n;
        ctx.fillStyle = colors[n.kind] || (n.lane === 6 ? blue : pink);
        if (n.kind === "laser") {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = n.slam ? 3 : Math.max(2, w * 0.04);
          ctx.beginPath();
          ctx.moveTo(x(s.x), y(s.beat));
          ctx.lineTo(x(s.y), y(s.endBeat));
          ctx.stroke();
        } else {
          const size = w * (n.kind === "fx" ? 0.322 : 0.156);
          const bottom = y(Math.max(startBeat, s.beat)),
            top = y(Math.min(endBeat, s.endBeat));
          ctx.fillRect(x(s.x) - size / 2, top - 1, size, Math.max(2, bottom - top));
        }
      }
    }
  }
  window.KshField = { drawPlayfield, drawMeasure, laserAt, judgmentRuns, judgmentsAt };
})();
