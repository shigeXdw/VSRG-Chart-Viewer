(function () {
  "use strict";
  const root = new URL("../../assets/maimai-ui/", document.currentScript.src);
  function image(name, signal) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      function finish(error) {
        signal.removeEventListener("abort", abort);
        img.onload = img.onerror = null;
        if (error) reject(error); else resolve(img);
      }
      function abort() { img.src = ""; finish(signal.reason); }
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener("abort", abort, {once:true});
      img.onload = () => finish();
      img.onerror = () => finish(new Error("Could not load cabinet artwork: " + name));
      img.src = new URL(name + ".png", root).href;
    });
  }
  async function create(job, chart, field, jacket, signal) {
    const slot = Math.min(7, Math.max(1, chart.slot || 1));
    const [landscape, frame, fallback, judgments, timing] = await Promise.all(
      ["landscape", slot + "-monitor", "cover-fallback", "judgments", "timing"].map(name => image(name, signal))
    );
    signal.throwIfAborted();
    const monitor = document.createElement("canvas");
    monitor.width = 900; monitor.height = 350;
    const c = monitor.getContext("2d", {alpha:false});
    const cabinet = await MaiCabinet.createExport(field, monitor, job.machineCamera);
    if (signal.aborted) { cabinet.dispose(); signal.throwIfAborted(); }
    const end = MaiClear.end(chart), counts = chart.statsAt(Infinity, chart.noteCount).counts;
    let lastTop = "";
    function text(value, x, y, size, color, maxWidth, align = "left") {
      c.font = "850 " + size + "px system-ui";
      if (maxWidth && c.measureText(value).width > maxWidth)
        c.font = "850 " + size * maxWidth / c.measureText(value).width + "px system-ui";
      c.textBaseline = "middle"; c.textAlign = align; c.fillStyle = color;
      c.fillText(value, x, y);
    }
    function top(time) {
      const done = time >= end;
      const passed = MaiSimai.upper(chart.hitNotes, time, "time");
      const rate = (chart.achievement[passed] || 0).toFixed(4);
      const caption = done ? "TRACK COMPLETE" : time < 0 ? "TRACK START" : "NOW PLAYING";
      const key = caption + rate;
      if (lastTop === key) return;
      lastTop = key;
      c.drawImage(landscape, 0, -110, 900, 900);
      if (!done) {
        c.drawImage(frame, 0, 0, 900, 350);
        c.drawImage(jacket || fallback, 26, 30, 202, 202);
        text(chart.header.CHARTNAME, 255, 62, 38.7, "#ffffff", 440);
        text("Lv " + chart.header.PLAYLEVEL, 854, 62, 36, "#ffffff", 145, "right");
        text(chart.header.TITLE, 561, 119, 22.5, "#ffffff", 585, "center");
        text("ACHIEVEMENT", 280, 191, 17.1, "#ffea92");
        const glyphs = rate.split(".")[0].padStart(3, " ") + "." + rate.split(".")[1] + "%";
        const widths = [0.66,0.66,0.66,0.32,0.60,0.60,0.60,0.60,0.80];
        let x = 558 - widths.reduce((a,b) => a+b, 0) * 79.2 / 2;
        c.textBaseline = "alphabetic"; c.textAlign = "center";
        c.shadowColor = "#110932"; c.shadowOffsetY = 2; c.shadowBlur = 1;
        for (let i=0; i<glyphs.length; i++) {
          const width = widths[i] * 79.2;
          c.font = "900 " + (i < 4 ? 79.2 : i < 8 ? 71.28 : 59.4) + "px system-ui";
          c.fillStyle = "#ffdc63"; c.fillText(glyphs[i], x + width / 2, 294); x += width;
        }
        c.shadowBlur = c.shadowOffsetY = 0;
      } else {
        c.drawImage(judgments, 28, 62, 645, 242);
        const colors = ["#d49b21", "#d08c28", "#d76299", "#4b9a65", "#7e858d"];
        ["CRITICAL", "PERFECT", "GREAT", "GOOD", "MISS"].forEach((label,i) =>
          text(label, 208+i*99, 82, 13, colors[i], 92, "center"));
        text("PERFECT", 208, 97, 11, colors[0], 92, "center");
        counts.forEach(({name, hit}, row) => {
          const y = 126 + row*39;
          text(name, 83, y, 15, "#ffffff", 85, "center");
          [hit,0,0,0,0].forEach((value,i) => text(String(value),208+i*99,y,20,colors[i],90,"center"));
        });
        ["FAST", "LATE"].forEach((label,i) => {
          c.drawImage(timing, 695, 110+i*83, 180, 74);
          text(label, 716, 130+i*83, 18, i ? "#cb673b" : "#4081ac");
          text("0", 848, 157+i*83, 26, "#385575", null, "right");
        });
      }
      text("CHART VIEWER", 27, 11, 10, "#475569");
      text(caption, 873, 11, 10, "#725473", null, "right");
    }
    return {
      draw(time, elapsed) {
        top(time);
        if (time >= end) {
          for (let i=0; i<8; i++) {
            cabinet.light(i, 0, "#ffffff", "button");
            cabinet.light(i, i === 3 || i === 4 ? 1 : 0, i === 3 ? "#ffad48" : "#63b6ff", "wall");
          }
        } else MaiMachine.sampleLights(chart, time, cabinet.light);
        return cabinet.render(elapsed);
      },
      close() { cabinet.dispose(); }
    };
  }
  window.MaiMachineExport = {create};
})();
