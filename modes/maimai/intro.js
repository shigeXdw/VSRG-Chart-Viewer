(function () {
  "use strict";
  const enter = 0.85;
  const close = enter + 3;
  const reveal = close + 0.42;
  const uncovered = reveal + 0.56;
  const duration = uncovered + 0.55;
  const tau = 2 * Math.PI;
  const colors = ["#82aee6", "#74c87d", "#f3bf63", "#fa7d86", "#ba85ed", "#d6a7f3", "#e680be"];
  function ease(value) {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  }
  function circle(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath(); c.arc(x, y, r, 0, tau); c.fill();
  }
  function box(c, x, y, w, h, radius, color) {
    c.fillStyle = color;
    c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
  }
  function label(c, text, x, y, size, width, color, weight = 750, align = "center") {
    c.font = weight + " " + size + "px system-ui, sans-serif";
    c.fillStyle = color; c.textAlign = align; c.textBaseline = "middle";
    c.fillText(text, x, y, width);
  }
  function jacket(c, chart, image, x, y, size, accent) {
    const w = image?.naturalWidth || image?.width, h = image?.naturalHeight || image?.height;
    if (w && h) {
      const side = Math.min(w, h);
      c.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, x, y, size, size);
      return;
    }
    const gradient = c.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, accent); gradient.addColorStop(1, "#383467");
    c.fillStyle = gradient; c.fillRect(x, y, size, size);
    c.save(); c.translate(0, y + size / 2);
    c.beginPath(); c.arc(0, 0, 63, 0, tau); c.lineWidth = 1.6; c.strokeStyle = "#fff9"; c.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = (i + 0.5) * tau / 8;
      circle(c, Math.cos(angle) * 63, Math.sin(angle) * 63, 3, "#fffc");
    }
    label(c, Array.from(chart.header.TITLE || "♪")[0], 0, -1, 53, 85, "#fff7ff", 900);
    c.restore();
  }
  function card(c, chart, image, progress) {
    const accent = colors[chart.slot - 1] || colors[6];
    const width = 228;
    const height = chart.header.SUBARTIST ? 337 : 309;
    c.save();
    if (progress < 1) {
      const visibleWidth = width * progress;
      c.beginPath(); c.rect(-visibleWidth / 2, -167, visibleWidth, height + 5); c.clip();
    }
    box(c, -width / 2, -162, width, height, 14, "#46335e38");
    box(c, -width / 2, -167, width, height, 14, accent);
    box(c, -106, -126, 212, 208, 5, "#1c172b");
    jacket(c, chart, image, -99, -121, 198, accent);
    label(c, chart.header.CHARTNAME, -99, -145, 17, 147, "#221732", 900, "left");
    label(c, chart.header.PLAYLEVEL, 99, -147, 32, 59, "#221732", 900, "right");
    box(c, -108, 87, 216, 48, 6, "#211a32");
    label(c, chart.header.TITLE, 0, chart.header.ARTIST ? 103 : 110, 15, 200, "#fffcff", 850);
    label(c, chart.header.ARTIST, 0, 122, 10.5, 200, "#ede0f6");
    if (chart.header.SUBARTIST) {
      label(c, "NOTE DESIGN", 0, 146, 8, 180, "#2b2034");
      label(c, chart.header.SUBARTIST, 0, 158, 12, 200, "#22172e");
    }
    c.restore();
  }
  function draw(c, chart, time, radius, image) {
    const age = time + duration;
    if (age >= uncovered) return;
    c.save(); c.scale(radius / 300, radius / 300);
    c.beginPath(); c.arc(0, 0, 300, 0, tau); c.clip();
    const mask = "#cdb6de";
    if (age < reveal) {
      circle(c, 0, 0, 301, mask);
      const aperture = 301 * (1 - ease((age - close) / (reveal - close)));
      c.beginPath(); c.arc(0, 0, aperture, 0, tau); c.clip();
      const pastel = c.createLinearGradient(-220, 220, 220, -230);
      pastel.addColorStop(0, "#f5d9fc"); pastel.addColorStop(0.5, "#e2d8fb"); pastel.addColorStop(1, "#bedffb");
      c.fillStyle = pastel; c.fillRect(-300, -300, 600, 600);
      circle(c, 153, -128, 181, "#ffffff64");
      circle(c, -147, 170, 167, "#ffffff40");
      circle(c, -89, -62, 83, "#ffffff52");
      circle(c, 72, 100, 79, "#ffffff52");
      const progress = ease((age - 0.12) / (enter - 0.12));
      if (progress > 0) card(c, chart, image, progress);
    } else {
      const aperture = 301 * ease((age - reveal) / (uncovered - reveal));
      c.beginPath(); c.rect(-301, -301, 602, 602);
      c.moveTo(aperture, 0);
      c.arc(0, 0, aperture, 0, tau); c.fillStyle = mask; c.fill("evenodd");
    }
    c.restore();
  }
  window.MaiIntro = { duration, revealTime: reveal - duration, draw };
})();
