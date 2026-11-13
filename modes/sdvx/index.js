(function () {
  "use strict";
  PlayerModes.register({
    id: "sdvx",
    name: "SOUND VOLTEX / K-Shoot MANIA",
    detect: (file) => /\.ksh$/i.test(file.name),
    async parse(file, context) {
      let text;
      if (file.arrayBuffer) {
        const bytes = await file.arrayBuffer();
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          text = new TextDecoder("shift-jis").decode(bytes);
        }
      } else text = await file.text();
      const chart = KshChart.parse(text, file.name, context);
      KshAudio.prepare(chart);
      return chart;
    },
    drawPlayfield: KshField.drawPlayfield,
    drawMeasure: KshField.drawMeasure,
    playbackBuffer: KshAudio.playbackBuffer,
    synthesizeSound: KshAudio.synthesizeSound,
    selectLabel: (c) => c.header.TITLE + " · " + c.header.CHARTNAME + " " + c.header.PLAYLEVEL,
    difficultyStyle: (c) => [
      c.header.CHARTNAME,
      { LIGHT: "#64c9ff", CHALLENGE: "#ffe063", EXTENDED: "#ff6d83", INFINITE: "#ca95ff" }[
        c.header.CHARTNAME
      ] || "#94e2f0"
    ],
    inspectorSubtitle: (c, artist) =>
      artist + " · BT A–D / FX L–R / VOL L–R · " + (c.measureStarts.length - 1) + " measures"
  });
})();
