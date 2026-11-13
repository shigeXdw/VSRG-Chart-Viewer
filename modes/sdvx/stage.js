(function () {
  "use strict";
  const W = 504,
    H = 896;
  const skin = () => window.KshSkins.current;
  let plainBackdrop;
  function drawBackdrop(ctx, media) {
    if (media) return;
    ctx.fillStyle = "#090b12";
    ctx.fillRect(0, 0, W, H);
    if (!skin()) {
      if (!plainBackdrop) {
        plainBackdrop = document.createElement("canvas");
        plainBackdrop.width = 252;
        plainBackdrop.height = 448;
        const brush = plainBackdrop.getContext("2d"),
          g = brush.createRadialGradient(126, 350, 25, 126, 350, 294);
        g.addColorStop(0, "#152030");
        g.addColorStop(0.7, "#0d131e");
        g.addColorStop(1, "#090b12");
        brush.fillStyle = g;
        brush.fillRect(0, 0, 252, 448);
      }
      ctx.drawImage(plainBackdrop, 0, 0, W, H);
      return;
    }
    const bg = skin()?.images.bg;
    if (bg) {
      const s = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    }
  }
  function drawDeck(ctx, levels) {
    const s = skin(),
      im = s?.images;
    if (!im?.console) return;
    const w = s.gear ? 631 : 876,
      h = (w * im.console.height) / im.console.width,
      x = -w / 2,
      y = -(s.gear ? 3 : h * 0.098);
    ctx.drawImage(im.console, x, y, w, h);
    for (const key of ["detail0", "detail1"]) {
      if (im[key]) ctx.drawImage(im[key], x, y, w, h);
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    levels.forEach((level, i) => {
      const light = im["glow" + i];
      if (!light || !level) return;
      ctx.globalAlpha = level * 0.86;
      ctx.drawImage(light, x, y, w, h);
    });
    ctx.restore();
  }
  function crit(ctx, span) {
    const im = skin()?.images;
    if (im?.crit) {
      ctx.drawImage(im.crit, -353, -82, 706, 164);
      return;
    }
    if (im?.strip) {
      for (let x = -span / 2; x < span / 2; x += 31)
        ctx.drawImage(im.strip, x, -7, Math.min(31, span / 2 - x), 14);
    } else {
      ctx.fillStyle = "#101621";
      ctx.fillRect(-span / 2, -2, span, 7);
      ctx.fillStyle = "#e9f2fb";
      ctx.fillRect(-span / 2, -1.5, span, 2);
    }
    if (im?.cap) {
      for (const sign of [-1, 1]) {
        ctx.save();
        ctx.scale(sign, 1);
        if (im.capBack) ctx.drawImage(im.capBack, span / 2 - 14, -13, 75, 24);
        ctx.drawImage(im.cap, span / 2 - 14, -13, 75, 24);
        ctx.restore();
      }
    }
  }
  function receptors(ctx, project, buttonX, levels) {
    const left = project(buttonX(1 / 6), 0).x,
      right = project(buttonX(5 / 6), 0).x;
    ctx.fillStyle = "#131c29";
    ctx.beginPath();
    ctx.moveTo(left - 9, 2);
    ctx.lineTo(right + 9, 2);
    ctx.lineTo(right + 3, 19);
    ctx.lineTo(left - 3, 19);
    ctx.closePath();
    ctx.fill();
    for (let lane = 0; lane < 4; lane++) {
      const x = project(buttonX((lane + 1.5) / 6), 0).x,
        half = project(0.07, 0).x - project(0, 0).x;
      ctx.fillStyle = "#243141";
      ctx.fillRect(x - half, 3, half * 2, 5);
      ctx.fillStyle = "#a2b7c8";
      ctx.fillRect(x - half, 3, half * 2, 1);
      if (levels[lane] > 0) {
        ctx.globalAlpha = levels[lane];
        ctx.fillStyle = "#e8f6ff";
        ctx.fillRect(x - half, 2, half * 2, 4);
        ctx.globalAlpha = 1;
      }
    }
    for (let side = 0; side < 2; side++) {
      const x = project(buttonX((side + 1) / 3), 0).x;
      ctx.fillStyle = levels[4 + side] ? "#ffc471" : "#75573b";
      ctx.fillRect(x - 13, 11, 26, 2);
    }
  }
  function cursor(ctx, x, side, active) {
    const im = skin()?.images,
      cursor = im?.["cursor" + side],
      color = side ? "#ff389f" : "#32dbff";
    if (cursor) {
      const w = skin().gear ? 49 : 29,
        h = (w * cursor.height) / cursor.width;
      ctx.drawImage(cursor, x - w / 2, -h / 2, w, h);
      if (im.pointerTop) ctx.drawImage(im.pointerTop, x - w / 2, -h / 2, w, h);
    } else {
      ctx.save();
      ctx.translate(x, 0);
      ctx.fillStyle = "#111b28";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(9, 3);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 2);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (active) {
        ctx.fillStyle = color;
        ctx.fillRect(-3, -2, 6, 2);
      }
      ctx.restore();
    }
  }
  function judgment(ctx, x, age, held, color) {
    if (!held && age > 0.23) return;
    const t = held ? (age * 3) % 1 : age / 0.23;
    ctx.save();
    ctx.translate(x, 0);
    ctx.globalAlpha = held ? 0.8 : 1 - t;
    const im = skin()?.images;
    const sprite = held
      ? im?.["hold" + Math.floor(t * 12)]
      : im?.["hit" + Math.min(17, Math.floor(t * 18))];
    if (sprite) {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(sprite, -51, -51, 102, 102);
      ctx.restore();
      return;
    }
    if (im?.hits) {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(im.hits, -20, -128, 40, 132);
      if (im.critical) {
        ctx.drawImage(im.critical, -26, -40, 52, (52 * im.critical.height) / im.critical.width);
      }
      ctx.restore();
      return;
    }
    ctx.strokeStyle = color || "#ffed88";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 + t * 14, 7 + t * 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (skin()) {
      ctx.fillStyle = "#fff5b3";
      ctx.textAlign = "center";
      ctx.font = "bold 9px Segoe UI,sans-serif";
      ctx.fillText("CRITICAL", 0, -23 - t * 7);
    }
    ctx.restore();
  }
  const footprints = [];
  function laserContact(ctx, x, side, time) {
    const im = skin()?.images,
      frame = Math.floor(time * 24) % 12;
    const art = im?.["laserHit" + frame];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (art) ctx.drawImage(art, x - 49, -49, 98, 98);
    else {
      if (!footprints[side]) {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 32;
        const b = c.getContext("2d");
        b.scale(2, 1);
        const g = b.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.32, side ? "#fc52a8" : "#34cceb");
        g.addColorStop(1, "transparent");
        b.fillStyle = g;
        b.fillRect(0, 0, 32, 32);
        footprints[side] = c;
      }
      ctx.globalAlpha = 0.54 + 0.15 * Math.cos(time * 18);
      ctx.drawImage(footprints[side], x - 21, -7, 42, 14);
    }
    ctx.restore();
  }
  function chip(ctx, kind, project, x, p, half, range) {
    const left = project(x - half, p),
      right = project(x + half, p),
      w = right.x - left.x;
    const sprite = skin()?.images[kind];
    const aspect = sprite ? sprite.height / sprite.width : kind === "bt" ? 0.18 : 0.1;
    const height = Math.max(1.3, w * Math.min(aspect, 0.8) * 0.82);
    const deep = p + range * 0.003 * (1 + (4 * p) / range),
      l = project(x - half, deep),
      r = project(x + half, deep);
    if (sprite) {
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.5) / 4,
          dx = l.x + (left.x - l.x) * t,
          dw = r.x + (right.x - r.x) * t - dx;
        ctx.drawImage(
          sprite,
          0,
          (i * sprite.height) / 4,
          sprite.width,
          sprite.height / 4,
          dx,
          left.y - height + (i * height) / 4,
          dw,
          height / 4 + 0.16
        );
      }
    } else {
      const fx = kind === "fx",
        h = Math.max(2, height),
        inset = Math.min(2, w * 0.07);
      ctx.fillStyle = fx ? "#98602a" : "#728999";
      ctx.fillRect(left.x, left.y - h, w, h);
      ctx.fillStyle = fx ? "#ffbd62" : "#e3f2fb";
      ctx.fillRect(left.x + inset, left.y - h, w - 2 * inset, h * 0.76);
      ctx.fillStyle = fx ? "#ffde9c" : "#fff";
      ctx.fillRect(left.x + inset, left.y - h, w - 2 * inset, Math.min(1.3, h * 0.25));
    }
  }
  // Project a skin image onto both ends of a lane or laser, including lateral motion.
  // Scanlines interpolate reciprocal depth. Straight and angled ribbons use the same UVs.
  function surface(ctx, image, project, x, y, p, q, half, uv = [0, 0, 1, 1]) {
    if (!image) return false;
    const a = project(x - half, p),
      b = project(x + half, p),
      c = project(y + half, q),
      d = project(y - half, q);
    const dy = d.y - a.y;
    if (Math.abs(dy) < 0.5) return false;
    const w0 = b.x - a.x,
      w1 = c.x - d.x,
      steps = Math.max(1, Math.ceil(Math.abs(dy) / 3));
    const shear = (d.x - a.x) / dy;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(1, 0, shear, 1, a.x - shear * a.y, 0);
    const depth = (t) => (t * w1) / ((1 - t) * w0 + t * w1);
    for (let i = 0; i < steps; i++) {
      const t = i / steps,
        k = (i + 1) / steps;
      const v0 = uv[3] + (uv[1] - uv[3]) * depth(t),
        v1 = uv[3] + (uv[1] - uv[3]) * depth(k);
      ctx.drawImage(
        image,
        uv[0] * image.width,
        Math.min(v0, v1) * image.height,
        (uv[2] - uv[0]) * image.width,
        Math.max(0.01, Math.abs(v0 - v1) * image.height),
        0,
        Math.min(a.y + dy * t, a.y + dy * k),
        w0 + ((w1 - w0) * (k + t)) / 2,
        Math.abs(dy) / steps + 0.35
      );
    }
    ctx.restore();
    return true;
  }
  const tracks = new WeakMap();
  function track(ctx, image, project, range, gap) {
    // Projection has a fixed depth ratio. Pre-warp both halves once; chart zoom and center split
    // then need only two affine blits per frame. One scanline per source row keeps the rails smooth.
    let halves = tracks.get(image);
    if (!halves) {
      halves = [0, 1].map((side) => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 1024;
        const brush = canvas.getContext("2d");
        const ratio = (1 - 12 * 0.036) / 13;
        const reciprocal = (v) => (v * ratio) / (1 - v + v * ratio);
        for (let row = 0; row < 1024; row++) {
          const t = 1 - (row + 0.5) / 1024,
            w = 512 * (1 + (ratio - 1) * t);
          const depth = reciprocal(t),
            next = reciprocal(Math.min(1, t + 0.5 / 1024));
          const h = Math.max(1, (next - depth) * image.height * 2),
            sy = Math.min(image.height - 1, (1 - depth) * image.height);
          brush.drawImage(
            image,
            (side * image.width) / 2,
            sy,
            image.width / 2,
            Math.min(image.height - sy, h),
            side ? 0 : 512 - w,
            row,
            w,
            1
          );
        }
        return canvas;
      });
      tracks.set(image, halves);
    }
    for (let side = 0; side < 2; side++) {
      const edge = 0.5 + (side ? gap : -gap),
        near = project(edge, -range * 0.036),
        far = project(edge, range);
      const w = project(edge + 0.5, -range * 0.036).x - near.x,
        dy = near.y - far.y;
      if (Math.abs(dy) < 0.01) continue;
      ctx.save();
      ctx.transform(1, 0, near.x - far.x, dy, far.x, far.y);
      ctx.drawImage(halves[side], side ? 0 : -w, 0, w, 1);
      ctx.restore();
    }
  }
  function alert(ctx, side, x, until) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (0.95 - until) / 0.18);
    const im = skin()?.images,
      dir = side ? "right" : "left";
    if (im?.[dir + "Alertbase"]) {
      ctx.globalCompositeOperation = "screen";
      for (const layer of ["base", "top", "text"]) {
        const art = im[dir + "Alert" + layer];
        if (art) ctx.drawImage(art, x - 66, -96, 132, 60);
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = side ? "#ff389f" : "#32dbff";
    ctx.font = "900 23px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(side ? "R" : "L", x, -48);
    ctx.restore();
  }
  function hud(ctx, chart, time, speed, judgments, jacket) {
    const s = skin();
    if (!s) return;
    const im = s.images;
    if (im.banner) ctx.drawImage(im.banner, 0, 0, W, (W * im.banner.height) / im.banner.width);
    if (im.songPanel) ctx.drawImage(im.songPanel, 0, 98, 335, 148);
    if (im.songStrip) ctx.drawImage(im.songStrip, 93, 98, 403, 49);
    if (im.score) ctx.drawImage(im.score, 294, 154, 210, 91);
    ctx.fillStyle = "#0b1322ce";
    if (!im.songStrip) ctx.fillRect(jacket ? 66 : 12, 114, jacket ? 425 : 479, 29);
    if (jacket) ctx.drawImage(jacket, 12, 104, 49, 49);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    if (im.songStrip) {
      ctx.font = "bold 10px Segoe UI,sans-serif";
      ctx.fillText([chart.header.TITLE, chart.header.ARTIST].filter(Boolean).join(" / "), 177, 125, 280);
      ctx.fillStyle = "#ffcf6c";
      ctx.fillRect(104, 135, 290 * Math.min(1, Math.max(0, time / chart.duration)), 1.7);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 8px Segoe UI,sans-serif";
      ctx.fillText(chart.header.CHARTNAME + " " + chart.header.PLAYLEVEL, 39, 168, 48);
      const bpm =
        chart.bpmChanges[Math.max(0, KshChart.upper(chart.bpmChanges, chart.secondsToBeat(time)) - 1)]
          .bpm;
      ctx.textAlign = "left";
      ctx.font = "bold 10px Segoe UI,sans-serif";
      ctx.fillText("BPM", 9, 213);
      ctx.fillText("LANE-SPEED", 9, 229);
      ctx.textAlign = "right";
      ctx.fillText(String(Math.round(bpm)), 122, 213);
      ctx.fillText(((bpm * speed) / 100).toFixed(2), 122, 229);
    } else {
      ctx.font = "bold 14px Segoe UI,sans-serif";
      ctx.fillText(chart.header.TITLE, jacket ? 71 : 18, 127, 315);
      ctx.textAlign = "right";
      ctx.font = "bold 10px Segoe UI,sans-serif";
      ctx.fillText(chart.header.CHARTNAME + " " + chart.header.PLAYLEVEL, 483, 128, 115);
    }
    if (im.gauge) {
      ctx.drawImage(im.gauge, 422, 275, 31, 264);
      const fill = judgments.gauge >= 0.7 && im.gaugePass ? im.gaugePass : im.gaugeFill;
      if (fill && judgments.gauge > 0) {
        const frac = judgments.gauge;
        ctx.drawImage(
          fill,
          0,
          (1 - frac) * fill.height,
          fill.width,
          frac * fill.height,
          430,
          279 + (1 - frac) * 236,
          8.4,
          236 * frac
        );
      }
    }
    ctx.textAlign = "right";
    ctx.font = "bold 24px monospace";
    ctx.fillText(String(judgments.score).padStart(8, "0"), 484, 195);
    if (im.score) {
      ctx.font = "bold 12px monospace";
      ctx.fillText(String(judgments.chain).padStart(4, "0"), 374, 226);
    }
    if (judgments.chain) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff5c0";
      if (im.chain) ctx.drawImage(im.chain, 231, 494, 42, 9);
      else {
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("CHAIN", 252, 499);
      }
      ctx.font = "bold 31px monospace";
      ctx.fillText(String(judgments.chain).padStart(4, "0"), 252, 525);
    }
  }
  window.KshStage = {
    width: W,
    height: H,
    drawBackdrop,
    drawDeck,
    crit,
    cursor,
    receptors,
    judgment,
    laserContact,
    chip,
    surface,
    track,
    alert,
    hud
  };
})();
