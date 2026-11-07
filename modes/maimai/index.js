(function () {
  "use strict";
  const colors = ["#88bbc5", "#65cb91", "#f1c359", "#ff787e", "#c99af7", "#dab8ff", "#e69ac2"];

  function songMedia(meta, chartPath, files) {
    const folder = chartPath.slice(0, chartPath.lastIndexOf("/") + 1);
    function choose(explicit, stems, extensions) {
      const candidates = explicit ? [explicit] : [];
      for (const name of stems) for (const ext of extensions) candidates.push(name + "." + ext);
      for (const name of candidates) {
        const key = folder + name.trim().toLowerCase().replaceAll("\\", "/").replace(/^\.\//, "");
        if (files.has(key)) return key;
      }
      return "";
    }
    return {
      audio: choose(meta.track || meta.music, ["track"], ["mp3", "ogg", "wav", "flac", "m4a", "aac", "opus"]),
      cover: choose(meta.cover || meta.background, ["bg"], ["png", "jpg", "jpeg", "webp"]),
      video: choose(meta.movie || meta.video, ["bg", "pv", "mv"], ["mp4", "webm", "m4v", "ogv", "mov"]),
    };
  }

  function drawMeasure({ context: ctx, chart, notes, width, height, startBeat, endBeat }) {
    const x = (lane) => ((lane + 0.5) * width) / 8;
    const y = (beat) => height - 4 - ((beat - startBeat) / (endBeat - startBeat)) * (height - 8);
    ctx.fillStyle = "#0c1b25";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#29424d";
    ctx.beginPath();
    for (let k = 1; k < 8; k++) {
      ctx.moveTo((k * width) / 8, 0);
      ctx.lineTo((k * width) / 8, height);
    }
    for (let k = 1; k < 4; k++) {
      ctx.moveTo(0, (height * k) / 4);
      ctx.lineTo(width, (height * k) / 4);
    }
    ctx.stroke();
    // Include holds and traces that entered this measure from an earlier one.
    const startTime = chart.beatToSeconds(startBeat);
    let lo = 0,
      hi = chart.prefixEnd.length;
    while (lo < hi) {
      const m = (lo + hi) >>> 1;
      if (chart.prefixEnd[m] < startTime) lo = m + 1;
      else hi = m;
    }
    const incoming = [];
    for (let i = lo; i < chart.displayNotes.length; i++) {
      const n = chart.displayNotes[i];
      if (n.beat >= startBeat) break;
      if (n.duration > 0 && n.endTime >= startTime) incoming.push(n);
    }
    for (const n of incoming.concat(notes)) {
      const color = window.MaiRenderer.colorOf(n),
        row = y(n.beat),
        origin = n.area === "C" ? width / 2 : x(n.lane);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      if (n.kind === "slide") {
        ctx.beginPath();
        ctx.moveTo(origin, y(chart.secondsToBeat(n.startTime)));
        for (const s of n.segments) ctx.lineTo(x(s.end - 1), y(chart.secondsToBeat(n.startTime + s.finish)));
        ctx.stroke();
      } else if (n.duration > 0) {
        const top = y(chart.secondsToBeat(n.endTime));
        ctx.fillRect(origin - 4, top, 8, row - top);
      }
      if (n.beat < startBeat) continue;
      if (n.area) {
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(n.area + (n.area === "C" ? "" : n.key), origin, Math.max(14, row - 7));
      }
      ctx.beginPath();
      ctx.arc(origin, row, n.area ? 5 : 8, 0, Math.PI * 2);
      if (n.area) ctx.fill();
      else ctx.stroke();
      if (n.ex) {
        ctx.strokeStyle = "#f3ffff";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  PlayerModes.register({
    id: "maimai",
    name: "maimai / Simai",
    detect: (file) => /^maidata(?:_dx)?\.txt$/i.test(file.name),
    async parse(file, { chartPath = file.name, files = new Map() } = {}) {
      const text = await file.text();
      const charts = window.MaiSimai.parse(text, file.name, (meta) => songMedia(meta, chartPath, files));
      if (!charts.length) throw new Error("No &inote_N difficulties in " + file.name);
      if (/^maidata_dx\.txt$/i.test(file.name)) {
        for (const chart of charts) chart.legacyDx = true;
      }
      charts.forEach(window.MaiAudio.attach);
      return charts;
    },
    drawPlayfield: (options) => window.MaiRenderer.draw(options),
    introDuration: window.MaiIntro.duration,
    resultEnd: chart => window.MaiClear.end(chart),
    synthesizeSound: window.MaiAudio.createBuffer,
    drawMeasure,
    selectLabel: (c) => c.header.TITLE + " · " + c.header.CHARTNAME + " " + c.header.PLAYLEVEL + (c.legacyDx ? " (legacy DX)" : ""),
    difficultyStyle: (c) => [c.header.CHARTNAME, colors[c.slot - 1] || colors[6]],
    inspectorSubtitle: (c, artist) =>
      artist + " · maimai · " + c.header.CHARTNAME + " · buttons 1–8 clockwise",
  });
})();
