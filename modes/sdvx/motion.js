(function () {
  "use strict";
  const { upper, valueAt } = KshChart;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = Math.PI / 180;
  const ease = (t) => t * t * (3 - 2 * t);
  const histories = new WeakMap();

  // Query the segment covering the open interval, so shared endpoints and zero-length
  // slams have unambiguous left and right limits when building the camera timeline.
  function steeringLine(list, beat) {
    const i = upper(list, beat) - 1,
      n = list[i],
      next = list[i + 1];
    if (n && n.beat <= beat && beat < n.endBeat) {
      const slope = (n.y - n.x) / (n.endBeat - n.beat);
      return [n.x + (beat - n.beat) * slope, slope];
    }
    if (next && next.beat - beat <= 2) return [next.x, 0];
    return null;
  }
  function steering(lasers, beat) {
    const left = steeringLine(lasers[0], beat),
      right = steeringLine(lasers[1], beat);
    return [(left?.[0] || 0) - (right ? 1 - right[0] : 0), (left?.[1] || 0) + (right?.[1] || 0)];
  }
  // Exact first-order response to a linear target. Seeking to a time inside an interval
  // produces the same pose as advancing the clock there one frame at a time.
  function follow(start, target, velocity, dt) {
    const tau = 0.115;
    return target + velocity * (dt - tau) + (start - target + velocity * tau) * Math.exp(-dt / tau);
  }
  function history(chart) {
    if (histories.has(chart)) return histories.get(chart);
    const keys = new Set([0]);
    for (const p of chart.bpmChanges) keys.add(p.beat);
    for (const p of chart.ksh.camera.tilt) keys.add(p.beat);
    for (const list of chart.ksh.lasers)
      for (const n of list) {
        keys.add(n.beat - 2);
        keys.add(n.beat);
        keys.add(n.endBeat);
      }
    const beats = [...keys].sort((a, b) => a - b),
      lines = [];
    let smooth = 0,
      held = 0;
    for (let i = 0; i < beats.length; i++) {
      const a = beats[i],
        b = beats[i + 1] ?? a;
      const time = chart.beatToSeconds(a),
        dt = chart.beatToSeconds(b) - time;
      const [mid, slope] = steering(chart.ksh.lasers, (a + b) / 2);
      const half = ((b - a) * slope) / 2;
      const v0 = mid - half,
        v1 = mid + half;
      const mode = valueAt(chart.ksh.camera.tilt, a, "normal");
      const keep = typeof mode === "string" && mode.startsWith("keep");
      if (!keep) held = v0;
      const line = { time, smooth, v0, velocity: dt ? (v1 - v0) / dt : 0, held, keep };
      lines.push(line);
      smooth = follow(smooth, v0, line.velocity, dt);
      held = keep ? keepValue(keepValue(held, v0), v1) : v1;
    }
    const camera = Object.fromEntries(
      Object.entries(chart.ksh.camera).map(([key, points]) => [
        key,
        points.map((p) => ({ ...p, beat: chart.beatToSeconds(p.beat) }))
      ])
    );
    const data = { lines, camera };
    histories.set(chart, data);
    return data;
  }
  function keepValue(old, next) {
    return !old || (Math.sign(old) === Math.sign(next) && Math.abs(next) > Math.abs(old)) ? next : old;
  }
  function impact(chart, beat, time) {
    const list = chart.ksh.spin,
      s = list[upper(list, beat) - 1];
    if (!s || !(s.length > 0)) return { angle: 0, side: 0 };
    const bpm = chart.bpmChanges[Math.max(0, upper(chart.bpmChanges, s.beat) - 1)].bpm;
    const duration = (s.length * 60) / bpm,
      age = time - chart.beatToSeconds(s.beat);
    const bounce = s.type[0] === "S",
      u = age / (duration * (bounce ? 1 : 2));
    if (u < 0 || u >= 1) return { angle: 0, side: 0 };
    const sign = /[<(]/.test(s.type) ? 1 : -1;
    if (bounce) {
      const damping = [0, 1.5, 3][s.decay] ?? 3;
      return {
        angle: 0,
        side: sign * (s.amplitude / 250) * Math.sin(Math.PI * s.frequency * u) * Math.exp(-damping * u)
      };
    }
    const wave = (t) => Math.sin(2 * Math.PI * t) * Math.exp(-3.5 * t);
    let angle;
    if (s.type.includes("(") || s.type.includes(")")) {
      if (u < 0.375) angle = (2 * Math.PI * u) / 0.375;
      else if (u < 0.75) angle = (Math.PI / 6) * wave((u - 0.375) / 0.375);
      else angle = 0;
    } else angle = ((2 * Math.PI) / 3) * wave(u);
    return { angle: sign * angle, side: 0 };
  }
  function pose(chart, time, beat, enabled) {
    if (!enabled) return { road: 0, bar: 0, side: 0, pitch: 0, zoom: 0, split: 0 };
    const { lines, camera } = history(chart);
    const read = (key) => valueAt(camera[key], time, 0, true);
    const line = lines[Math.max(0, upper(lines, time, "time") - 1)];
    const dt = Math.max(0, time - line.time);
    const steering = clamp(follow(line.smooth, line.v0, line.velocity, dt), -1, 1);
    const tilt = valueAt(camera.tilt, time, "normal", true);
    const intensity =
      typeof tilt === "string"
        ? tilt.includes("biggest")
          ? 2.5
          : tilt.includes("big") || tilt === "keep"
            ? 1.75
            : tilt.includes("normal")
              ? 1
              : 0
        : 0;
    const amount = line.keep ? keepValue(line.held, line.v0 + line.velocity * dt) : steering;
    const bank =
      typeof tilt === "number" ? -tilt * 10 * rad : clamp(amount, -1, 1) * intensity * 10 * rad;
    const fx = impact(chart, beat, time),
      rotation = read("rotation_deg") * rad;
    return {
      road: bank + rotation + fx.angle,
      bar: bank + rotation + Math.sin(fx.angle) * 20 * rad,
      side: (read("zoom_side") / 100) * 0.36 + fx.side,
      pitch: read("zoom_top") / 100,
      zoom: read("zoom_bottom") / 100,
      split: read("center_split") / 1200
    };
  }
  function cursor(list, side, time, beat, current) {
    if (current !== null) return current;
    const index = upper(list, beat) - 1,
      last = list[index],
      next = list[index + 1];
    const rest = side ? 0.62 : 0.38;
    const age = last ? Math.max(0, time - last.endTime) : Infinity;
    const remaining = next ? Math.max(0, next.time - time) : Infinity;
    if (last && next && next.time - last.endTime <= 0.48) {
      return last.y + (next.x - last.y) * ease(clamp(age / (next.time - last.endTime || 1), 0, 1));
    }
    if (last && age < 0.24) return last.y + (rest - last.y) * ease(age / 0.24);
    if (next && remaining < 0.24) return next.x + (rest - next.x) * ease(remaining / 0.24);
    return rest;
  }
  window.KshMotion = { pose, cursor };
})();
