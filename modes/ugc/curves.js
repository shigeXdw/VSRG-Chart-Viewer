(function (root) {
  "use strict";

  const cache = new WeakMap();
  const MAX_CONTROL_POINTS = 128;
  const MAX_GENERATED_POINTS = 8192;
  const MAX_CASTELJAU_WORK = 2000000;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function timing(point, tick, chart) {
    const resolution = chart?.resolution || 480;
    const beat = tick / resolution;
    return { ...point, tick, beat,
      time: chart?.beatToSeconds ? chart.beatToSeconds(beat) : point.time };
  }

  // Stable evaluation in lane/time space. Interpolating controls directly in
  // tick space would place a slide on its control polygon rather than its curve.
  function evaluate(controls, parameter) {
    const work = controls.map((point) => point.slice());
    for (let remaining = work.length - 1; remaining > 0; remaining--) {
      for (let i = 0; i < remaining; i++) {
        for (let axis = 0; axis < 4; axis++) {
          work[i][axis] = lerp(work[i][axis], work[i + 1][axis], parameter);
        }
      }
    }
    return work[0];
  }

  function speedAt(chart, tick, fallback) {
    const changes = chart?.noteSpeedChanges;
    if (!changes?.length) return fallback;
    let low = 0, high = changes.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (changes[middle].tick <= tick) low = middle + 1;
      else high = middle;
    }
    return low ? changes[low - 1].speed : fallback;
  }

  function prepare(path, chart) {
    if (!path || !Array.isArray(path.points)) return [];
    const retained = cache.get(path);
    if (retained?.chart === chart) return retained.points;
    const source = path.points;
    // Native AIR paths retain their authored vertices and interpolate linearly.
    if (!["s", "T"].includes(path.type) || !source.some((point) => point.type === "c")) {
      cache.set(path, { chart, points: source });
      return source;
    }
    const output = [], resolution = chart?.resolution || 480;
    let generated = 0, remainingWork = MAX_CASTELJAU_WORK, approximate = false;
    let start = source[0], controls = [];
    if (start) output.push(start);
    for (let index = 1; index < source.length; index++) {
      const end = source[index];
      if (end.type === "c") { controls.push(end); continue; }
      const duration = end.tick - start.tick;
      if (controls.length && Number.isFinite(duration) && duration > 0) {
        let selected = controls;
        if (selected.length > MAX_CONTROL_POINTS - 2) {
          // Keep bounded preview work for malformed or unusually dense control
          // chains. Endpoints and ordinary authored knots are always preserved.
          selected = Array.from({ length: MAX_CONTROL_POINTS - 2 }, (_, i) =>
            controls[Math.round(i * (controls.length - 1) / (MAX_CONTROL_POINTS - 3))]);
          approximate = true;
        }
        const vertices = [start, ...selected, end].map((point, i, all) => {
          const fraction = i === 0 ? 0 : i === all.length - 1 ? 1 : (point.tick - start.tick) / duration;
          const width = lerp(start.width, end.width, fraction);
          const center = point.x + point.width / 2;
          return [center - width / 2, center + width / 2, fraction,
            Number.isFinite(point.height) ? point.height : 0];
        });
        const workPerSample = vertices.length * vertices.length;
        // Native curve samples use thirty ticks at the standard 480/beat.
        const step = 30 * resolution / 480;
        const requested = Math.max(0, Math.ceil(duration / step) - 1);
        const count = Math.min(requested, MAX_GENERATED_POINTS - generated,
          Math.max(0, Math.floor(remainingWork / workPerSample)));
        if (count < requested) approximate = true;
        for (let sample = 1; sample <= count; sample++) {
          const parameter = count === requested ? sample * step / duration : sample / (count + 1);
          const [left, right, fraction, height] = evaluate(vertices, parameter);
          // Quantize in the native 480-tick domain, then return authored ticks.
          const tick = Math.floor((start.tick + duration * fraction) * 480 / resolution) * resolution / 480;
          const x = clamp(left, 0, 16);
          const width = Math.min(Math.max(right - x, 1), 16 - x);
          const point = timing(start, tick, chart);
          output.push({ ...point, type: "c", generated: true, x, width, height,
            longStart: false, longPair: undefined,
            noteSpeed: speedAt(chart, tick, start.noteSpeed), timeline: start.timeline });
        }
        generated += count;
        remainingWork -= count * workPerSample;
      }
      output.push(end);
      start = end;
      controls = [];
    }
    // A trailing run of controls has no terminating knot. Preserve those points
    // so an incomplete chart remains inspectable instead of losing its tail.
    for (const control of controls) output.push(control);
    output.sort((a, b) => a.tick - b.tick);
    if (approximate) Object.defineProperty(output, "approximate", { value: true });
    cache.set(path, { chart, points: output });
    return output;
  }

  function sampleAt(path, tick, chart) {
    const points = prepare(path, chart);
    if (!points.length || !Number.isFinite(tick)) return null;
    if (tick <= points[0].tick) return { ...points[0] };
    if (tick >= points[points.length - 1].tick) return { ...points[points.length - 1] };
    let low = 0, high = points.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (points[middle].tick <= tick) low = middle + 1;
      else high = middle;
    }
    const from = points[low - 1], to = points[low];
    if (tick === from.tick) return { ...from };
    const fraction = (tick - from.tick) / (to.tick - from.tick);
    // Native current-position lookup rounds lane edges to a thousandth.
    const endX = path.type === 'h' || path.type === 'H' ? from.x : to.x;
    const x = Math.round(lerp(from.x, endX, fraction) * 1000) / 1000;
    const right = Math.round(lerp(from.x + from.width, endX + to.width, fraction) * 1000) / 1000;
    return { ...timing(from, tick, chart), x, width: right - x,
      height: lerp(from.height || 0, to.height || 0, fraction),
      noteSpeed: speedAt(chart, tick, from.noteSpeed), generated: true };
  }

  function sampleAtTime(path, time, chart) {
    const points = prepare(path, chart);
    if (!points.length || !Number.isFinite(time)) return null;
    if (time <= points[0].time) return { ...points[0] };
    if (time >= points.at(-1).time) return { ...points.at(-1) };
    let low = 0, high = points.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (points[mid].time <= time) low = mid + 1; else high = mid;
    }
    const from = points[low - 1], to = points[low], fraction = (time - from.time) / (to.time - from.time);
    const tick = chart.secondsToBeat ? chart.secondsToBeat(time) * chart.resolution : lerp(from.tick, to.tick, fraction);
    return { ...timing(from, tick, chart), time,
      x: path.type === 'h' || path.type === 'H' ? from.x : lerp(from.x, to.x, fraction),
      width: lerp(from.width, to.width, fraction), height: lerp(from.height || 0, to.height || 0, fraction), generated: true };
  }

  root.UgcCurves = Object.freeze({ prepare, sampleAt, sampleAtTime });
})(typeof window === "undefined" ? globalThis : window);
