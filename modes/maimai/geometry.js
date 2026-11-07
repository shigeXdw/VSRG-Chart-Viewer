// Geometry in judgment-ring radii. Positive angles turn clockwise on Canvas.
(function () {
  "use strict";
  const turn = 2 * Math.PI;
  const origin = { x: 0, y: 0 };
  const polar = (angle, r = 1) => ({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  const button = (n, r = 1) => polar(((n - 2.5) * Math.PI) / 4, r);
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const angleAt = (p, center) => Math.atan2(p.y - center.y, p.x - center.x);

  function sensor(area, n) {
    if (area === "C") return origin;
    const stagger = area === "D" || area === "E";
    const radii = { A: 4, B: 2.2, D: 4.1, E: 3.1 };
    return button(n - (stagger ? 0.5 : 0), radii[area] / 4.8);
  }

  function arc(center, radius, start, sweep) {
    const steps = Math.max(2, Math.ceil(Math.abs(sweep) * 24));
    return Array.from({ length: steps + 1 }, (_, i) => {
      const p = polar(start + (sweep * i) / steps, radius);
      return { x: center.x + p.x, y: center.y + p.y };
    });
  }

  function sweepBetween(a, b, sign) {
    const delta = ((((b - a) * sign) % turn) + turn) % turn;
    return sign * (delta < 1e-8 ? turn : delta);
  }

  // Join the buttons to the orbit at their tangent points, so the star
  // enters and leaves the loop without a kink.
  function loop(a, b, center, radius, sign, extraTurn) {
    const tangent = (p) => Math.acos(Math.min(1, radius / distance(p, center)));
    const first = angleAt(a, center) + sign * tangent(a);
    const last = angleAt(b, center) - sign * tangent(b);
    const sweep = sweepBetween(first, last, sign) + extraTurn * sign * turn;
    return [a, ...arc(center, radius, first, sweep), b];
  }

  function trace(points) {
    let length = 0;
    const distances = points.map((p, i) => {
      if (i) length += distance(points[i - 1], p);
      return length;
    });
    return { points, distances, length };
  }

  function position(path, fraction) {
    const target = Math.max(0, Math.min(1, fraction)) * path.length;
    let lo = 1,
      hi = path.points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (path.distances[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const a = path.points[lo - 1],
      b = path.points[lo];
    const t = (target - path.distances[lo - 1]) / (path.distances[lo] - path.distances[lo - 1] || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function buildPaths(shape, start, end, pivot) {
    const a = button(start),
      b = button(end);
    const relative = (end - start + 8) % 8;
    let points;
    switch (shape) {
      case "-":
        points = [a, b];
        break;
      case "V":
        points = [a, button(pivot), b];
        break;
      case "v":
        points = [a, origin, b];
        break;
      case "w":
        return [-1, 0, 1].map((delta) => trace([a, button(end + delta)]));
      case "s":
      case "z": {
        const d = shape === "s" ? -2 : 2;
        points = [a, button(start + d, Math.tan(Math.PI / 8)), button(start - d, Math.tan(Math.PI / 8)), b];
        break;
      }
      case "^":
      case "<":
      case ">": {
        const upper = start <= 2 || start >= 7;
        const clockwise = shape === "^" ? relative <= 4 : (shape === ">") === upper;
        const first = angleAt(a, origin);
        points = arc(origin, 1, first, sweepBetween(first, angleAt(b, origin), clockwise ? 1 : -1));
        break;
      }
      case "p":
      case "q":
      case "pp":
      case "qq": {
        const side = shape.length === 2,
          left = shape[0] === "p";
        const radius = side ? Math.cos(Math.PI / 8) / 2 : Math.sin(Math.PI / 8);
        const center = side ? button(start + (left ? 1.5 : -1.5), radius) : origin;
        const travel = left ? relative : (8 - relative) % 8;
        points = loop(a, b, center, radius, left ? -1 : 1, Number(side && (travel === 3 || travel === 4)));
        break;
      }
      default:
        throw new Error("Unknown slide shape " + shape);
    }
    return [trace(points)];
  }
  const pathCache = new Map();
  function paths(shape, start, end, pivot) {
    const key = [shape, start, end, pivot].join(":");
    if (!pathCache.has(key)) pathCache.set(key, buildPaths(shape, start, end, pivot));
    return pathCache.get(key);
  }
  window.MaiGeometry = { button, sensor, paths, position };
})();
