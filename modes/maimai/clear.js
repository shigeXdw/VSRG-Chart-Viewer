(function () {
  "use strict";
  const tau = Math.PI * 2;
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => (x = clamp(x), x * x * (3 - 2 * x));
  const closeAt = 1.22, closedAt = closeAt + 0.42;
  const openAt = closedAt + 1, revealedAt = openAt + 0.54;

  // Song/chart time only: pause, seek and replay never need animation timers.
  function start(chart) {
    if (!chart.noteCount) return Infinity;
    return Math.max(chart.duration, chart.playbackEnd || 0, chart.hitNotes.at(-1).time + 0.68);
  }
  function end(chart) {
    return chart.noteCount ? start(chart) + revealedAt + 0.95 : 0;
  }
  function phase(age) {
    if (age < 0) return null;
    return {
      opacity: ease(age / 0.24),
      result: age >= openAt,
      shutter: age < closedAt ? ease((age - closeAt) / (closedAt - closeAt)) :
        1 - ease((age - openAt) / (revealedAt - openAt))
    };
  }
  function disc(c, r, fill) {
    c.beginPath(); c.arc(0, 0, r, 0, tau); c.fillStyle = fill; c.fill();
  }
  function ring(c, r, w, color) {
    c.beginPath(); c.arc(0, 0, r, 0, tau); c.lineWidth = w; c.strokeStyle = color; c.stroke();
  }
  function label(c, text, x, y, size, color, weight = 700, align = "center") {
    c.font = weight + " " + size + "px system-ui, sans-serif";
    c.textAlign = align; c.textBaseline = "middle"; c.fillStyle = color; c.fillText(text, x, y);
  }
  // Five original monoline glyphs. The outline and offset ink share the exact
  // same geometry so the lettering stays crisp at every cabinet size.
  const lettering = [
    "M45 -25 H23 Q3 -25 3 -4 V5 Q3 25 23 25 H45",
    "M57 -25 V25 H91",
    "M137 -25 H104 V25 H137 M105 0 H132",
    "M150 25 L170 -25 L191 25 M158 9 H183",
    "M205 25 V-25 H224 Q243 -25 243 -11 Q243 3 224 3 H206 M224 3 L246 25"
  ];
  // Reuse the cabinet menu artwork on its canvas-backed result screen.
  let resultButtons;
  function loadResultButtons() {
    return ["back", "next"].map(name => {
    const image = new Image();
    image.src = "assets/maimai-ui/button-" + name + ".png";
    return image;
    });
  }
  let word;
  function clearMark(c, age) {
    if (!word) { word = new Path2D(); for (const glyph of lettering) word.addPath(new Path2D(glyph)); }
    c.save();
    const pop = 0.72 + 0.28 * ease(age / 0.24) + 0.055 * Math.sin(Math.PI * clamp(age / 0.42));
    c.scale(1.79 * pop, 1.79 * pop); c.rotate(-0.065); c.transform(1, 0, -0.12, 1, 0, 0); c.translate(-124, 0);
    const ink = c.createLinearGradient(0, 20, 248, -10);
    for (const [stop, color] of [[0,"#f524a9"],[0.36,"#6948eb"],[0.68,"#00c9e1"],[1,"#c92bb8"]]) ink.addColorStop(stop, color);
    c.lineCap = "square"; c.lineJoin = "round";
    c.save(); c.translate(0, 4); c.strokeStyle = "#28103e"; c.lineWidth = 16; c.stroke(word); c.restore();
    c.strokeStyle = ink; c.lineWidth = 15; c.stroke(word);
    c.strokeStyle = "#fffdff"; c.lineWidth = 8; c.stroke(word);
    c.restore();
  }
  function wheel(c, age) {
    disc(c, 301, "#201338");
    const colors = ["#cd3aa5", "#46367c", "#148db9", "#7c499b", "#db8f54", "#50417b"];
    c.save(); c.rotate(-0.27 + 0.16 * Math.min(age, closedAt));
    for (let i = 0; i < 24; i++) {
      c.rotate(tau / 24);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(317, -14); c.lineTo(317, 30); c.closePath();
      c.fillStyle = colors[i % colors.length]; c.fill();
    }
    c.restore();
    const light = c.createRadialGradient(0, 0, 5, 0, 0, 287);
    light.addColorStop(0, "#fff8fa"); light.addColorStop(0.43, "#f9e6f5df"); light.addColorStop(1, "#d086bf00");
    disc(c, 290, light);
    const spread = ease(age / 0.62);
    ring(c, 89 + 28 * spread, 6, "#7532a5");
    ring(c, 126 + 44 * spread, 9, "#18c7e7");
    ring(c, 178 + 58 * spread, 15, "#fd40a7");
    ring(c, 235 + 57 * spread, 4, "#ff9ed8");
  }
  function burst(c, age) {
    wheel(c, age);
    clearMark(c, age);
    label(c, "A U T O P L A Y", 0, 100, 10, "#412243", 850);
  }
  function shutter(c, amount) {
    if (!amount) return;
    const angle = 0.45;
    c.save(); c.rotate(angle);
    const gap = (1 - amount) * 310;
    for (const side of [-1, 1]) {
      c.save(); c.scale(side, 1); c.translate(gap, 0);
      const panel = c.createLinearGradient(0, -150, 190, 230);
      panel.addColorStop(0, "#382065"); panel.addColorStop(0.48, "#261247"); panel.addColorStop(1, "#503080");
      c.fillStyle = panel; c.fillRect(-0.5, -320, 331, 640);
      c.save();
      c.beginPath(); c.rect(12, -320, 319, 640); c.clip();
      // Keep the bands level with the playfield as each mirrored panel moves.
      c.rotate(-side * angle);
      for (let i = -5; i <= 5; i++) {
        c.fillStyle = i % 2 ? "#ffffff07" : "#1007222c";
        c.fillRect(-480, i * 93, 960, 23);
      }
      c.restore();
      c.fillStyle = side > 0 ? "#f939a5" : "#9351de"; c.fillRect(0, -320, side > 0 ? 10 : 5, 640);
      c.fillStyle = "#dfb2fc"; c.fillRect(16, -320, 1, 640);
      c.restore();
    }
    c.restore();
  }
  function fitted(c, text, x, y, size, available, color, weight) {
    text = String(text || "");
    c.font = weight + " " + size + "px system-ui";
    if (c.measureText(text).width > available) {
      const glyphs = Array.from(text);
      let lo = 0, hi = glyphs.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        if (c.measureText(glyphs.slice(0, mid).join("") + "…").width <= available) lo = mid;
        else hi = mid - 1;
      }
      text = glyphs.slice(0, lo).join("").trimEnd() + "…";
    }
    label(c, text, x, y, size, color, weight);
  }
  // This edge runs continuously through the jacket, row starts and rate plate.
  const edge = y => -122 - 0.48 * y;
  function band(c, y, height, left, right, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(left, y);
    c.lineTo(right, y); c.lineTo(right - height * 0.48, y + height);
    c.lineTo(left - height * 0.48, y + height); c.closePath(); c.fill();
  }
  function jacket(c, image, x, y, size) {
    c.fillStyle = "#170e28"; c.fillRect(x - 2, y - 2, size + 4, size + 4);
    const w = image?.naturalWidth || image?.width, h = image?.naturalHeight || image?.height;
    if (w && h) {
      const src = Math.min(w, h);
      c.drawImage(image, (w - src) / 2, (h - src) / 2, src, src, x, y, size, size);
    } else {
      c.save(); c.translate(x + size / 2, y + size / 2);
      const g = c.createLinearGradient(-52, -52, 54, 50);
      g.addColorStop(0, "#de409c"); g.addColorStop(0.55, "#644ba0"); g.addColorStop(1, "#16749c");
      c.fillStyle = g; c.fillRect(-size / 2, -size / 2, size, size);
      ring(c, size * 0.35, 2, "#fff3fa"); ring(c, size * 0.23, 1, "#ffffff88");
      for (let k = 0; k < 8; k++) {
        c.rotate(tau / 8); c.fillStyle = "#fff2fa"; c.fillRect(-2, -size * .35 - 2, 4, 4);
      }
      disc(c, 5, "#fff6fb"); c.restore();
    }
  }
  const rowPalette = {
    TAP: ["#ff499f", "#ffe0ef", "#901548"],
    HOLD: ["#ffba3d", "#fff0c5", "#815107"],
    SLIDE: ["#3ddaff", "#d9f5ff", "#07537b"],
    TOUCH: ["#36e4c1", "#d4fbef", "#086350"],
    BREAK: ["#ff7449", "#ffdfce", "#8f3216"]
  };

  function resultRows(c, chart, elapsed) {
    const { counts } = chart.statsAt(chart.duration, chart.noteCount);
    counts.forEach(({name, total}, i) => {
      const share = total / chart.noteCount;
      const reveal = ease((elapsed - 0.06 * i) / 0.44);
      const y = -132 + i * 37;
      const left = edge(y) + 5;
      const [accent, tint, ink] = rowPalette[name];
      const fill = c.createLinearGradient(left, 0, 252, 0);
      fill.addColorStop(0, tint); fill.addColorStop(0.55, "#fffdff"); fill.addColorStop(1, tint);
      c.save();
      c.translate(22 * (1 - reveal), 0);
      c.globalAlpha *= reveal;
      band(c, y, 31, left, 253, fill);
      band(c, y, 31, left, left + 5, accent);
      if (share > 0) band(c, y + 28, 3, left - 8, left - 8 + (250 - left) * share * reveal, accent);
      label(c, name, left + 12, y + 15, 18, ink, 850, "left");
      label(c, String(total), 83, y + 15, 23, "#251c33", 850);
      label(c, (share * 100).toFixed(1) + "%", 188, y + 15, 16.5, ink, 750);
      c.restore();
    });
  }

  function resultSparkles(c, elapsed) {
    const progress = clamp((elapsed - 0.24) / 1.18);
    if (progress === 0 || progress === 1) return;
    c.save();
    c.globalAlpha *= Math.sin(Math.PI * progress);
    for (let i = 0; i < 21; i++) {
      const angle = i * tau / 21 + 0.16 * progress;
      const distance = 246 + 40 * progress + 7 * Math.sin(i * 4);
      const size = (2.2 + i % 3) * (1 - 0.55 * progress);
      c.save(); c.translate(Math.cos(angle) * distance, Math.sin(angle) * distance);
      c.rotate(angle + progress);
      c.fillStyle = ["#ffe08a", "#8dfcff", "#ff9dde"][i % 3];
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const r = k % 2 ? size * 0.28 : size;
        const x = r * Math.cos(k * tau / 8), y = r * Math.sin(k * tau / 8);
        if (k) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath(); c.fill(); c.restore();
    }
    c.restore();
  }

  function result(c, chart, rank, rate, image, elapsed, cabinet) {
    wheel(c, 0.9 + 0.7 * ease(elapsed / 1.4));
    disc(c, 301, "#23133380");
    // Broad violet sleeve on the left with a narrow two-colour cut edge.
    const sleeve = c.createLinearGradient(-270, -160, -100, 175);
    sleeve.addColorStop(0, "#282259"); sleeve.addColorStop(0.5, "#612570"); sleeve.addColorStop(1, "#321b61");
    band(c, -330, 660, -580, edge(-330), sleeve);
    band(c, -330, 660, edge(-330) - 9, edge(-330) - 3, "#f435aa");
    band(c, -330, 660, edge(-330) - 2, edge(-330) + 2, "#8744d7");
    label(c, "AUTOPLAY  /  RESULT", 14, -231, 18, "#fff3fc", 850);
    jacket(c, image, -225, -191, 127);
    band(c, -58, 31, -320, edge(-58) - 10, "#fff0f7");
    fitted(c, chart.header.TITLE, -192, -43, 17.5, 161, "#431731", 850);
    fitted(c, chart.header.ARTIST, -204, -12, 13, 149, "#fae7ff", 700);
    label(c, "RANK", -205, 21, 13, "#ffcdf0", 800);
    const gold = c.createLinearGradient(0, 34, 0, 73);
    gold.addColorStop(0, "#ffffe6"); gold.addColorStop(0.5, "#ffe477"); gold.addColorStop(1, "#ffab50");
    label(c, rank, -211, 55, 39, gold, 900);
    band(c, 90, 34, -320, edge(90) - 10, "#291137");
    const duration = Math.floor(chart.duration);
    label(c, Math.floor(duration / 60) + ":" + String(duration % 60).padStart(2, "0"), -222, 107, 21, "#ffb4dc", 850);
    fitted(c, chart.header.CHARTNAME + "   /   LV " + chart.header.PLAYLEVEL, 70, -182, 22, 247, "#fff5fc", 850);
    label(c, "NOTES", 83, -148, 13, "#fff5fc");
    label(c, "SHARE", 188, -148, 13, "#fff5fc");
    resultRows(c, chart, elapsed);
    band(c, 67, 34, edge(67) + 5, 158, "#ffe6f6");
    label(c, "MAX COMBO", edge(67) + 14, 84, 16, "#923368", 850, "left");
    label(c, String(chart.noteCount), 83, 84, 24, "#302638", 850);
    const plate = c.createLinearGradient(-188, 0, 216, 0);
    plate.addColorStop(0, "#ffe0a0"); plate.addColorStop(0.45, "#fffbed"); plate.addColorStop(1, "#ffe5f1");
    band(c, 136, 65, edge(136) + 5, 224, plate);
    const shine = clamp((elapsed - 0.42) / 0.88);
    if (shine > 0 && shine < 1) {
      const x = -138 + 440 * shine;
      const glint = c.createLinearGradient(x - 42, 159, x + 40, 181);
      glint.addColorStop(0, "#ffffff00"); glint.addColorStop(0.5, "#ffffffee"); glint.addColorStop(1, "#ffffff00");
      band(c, 136, 65, edge(136) + 5, 224, glint);
    }
    band(c, 136, 65, edge(136) + 5, -53, "#402142");
    label(c, "DELUXE", -133, 159, 15, "#ffbfdf", 850);
    label(c, "RATE", -133, 179, 15, "#fff6fb", 850);
    label(c, rate.toFixed(4) + "%", 66, 169, 40, "#38203d", 900);
    resultSparkles(c, elapsed);
    ring(c, 297, 2, "#ffa8db");
    if (cabinet) {
      resultButtons.forEach((sprite, i) => {
        if (!sprite.complete || !sprite.naturalWidth) return;
        c.save();
        c.globalAlpha *= ease(elapsed / 0.54);
        c.translate((i ? 1 : -1) * 102.4062, 247.2288);
        c.rotate((i ? -1 : 1) * Math.PI / 8);
        c.drawImage(sprite, -70.8, -37.2, 141.6, 74.4);
        c.restore();
      });
    }
  }
  function draw(c, age, radius, chart, rank, rate, image, cabinet = false) {
    if (cabinet && !resultButtons) resultButtons = loadResultButtons();
    const p = phase(age);
    if (!p || !p.opacity) return;
    c.save(); c.scale(radius / 300, radius / 300);
    c.beginPath(); c.arc(0, 0, 300, 0, tau); c.clip(); c.globalAlpha *= p.opacity;
    if (p.shutter < 1) {
      if (p.result) result(c, chart, rank, rate, image, age - openAt, cabinet);
      else burst(c, age);
    }
    shutter(c, p.shutter);
    c.restore();
  }
  window.MaiClear = { start, end, phase, draw };
})();
