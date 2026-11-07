// Original synthesized percussion and chimes for autoplay. No external samples.
(function () {
  "use strict";
  const tau = Math.PI * 2;
  const durations = {
    tap: 0.056,
    ex: 0.066,
    break: 0.12,
    touch: 0.075,
    slide: 0.16,
    breakSlide: 0.21,
    finish: 0.115,
    firework: 0.29,
    sustain: 1,
  };
  const prefix = "mai-fx/";

  // A damped, falling impulse supplies the body; the short filtered-noise
  // edge makes it audible against music without leaving a pitched ring.
  function click(t, bodyHz, decay, noise, edge) {
    if (t < 0) return 0;
    const phase = tau * (bodyHz * t + 0.95 * (1 - Math.exp(-t / 0.0026)));
    const attack = Math.min(1, t / 0.0008);
    return attack * (0.61 * Math.sin(phase) * Math.exp(-t / decay) + edge * noise * Math.exp(-t / 0.0065));
  }

  function createBuffer(audio, object) {
    const kind = object.slice(prefix.length);
    if (!object.startsWith(prefix) || !Object.hasOwn(durations, kind)) return null;
    const rate = audio.sampleRate,
      seconds = durations[kind];
    const buffer = audio.createBuffer(1, Math.round(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    let seed = 193,
      bright = 0,
      bass = 0;
    const highCut = 1 - Math.exp((-tau * 3900) / rate);
    const lowCut = 1 - Math.exp((-tau * 540) / rate);
    for (let i = 0; i < data.length; i++) {
      const t = i / rate,
        progress = i / data.length;
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      bright += highCut * (white - bright);
      bass += lowCut * (bright - bass);
      const noise = bright - bass;
      let sample;
      switch (kind) {
        case "tap":
          sample = click(t, 235, 0.008, noise, 0.92);
          break;
        case "touch":
          sample = 0.85 * click(t, 465, 0.012, noise, 0.22);
          break;
        case "ex":
          sample = click(t, 370, 0.009, noise, 1.08) + 0.28 * click(t - 0.012, 570, 0.005, noise, 0.3);
          break;
        case "break":
          sample = click(t, 185, 0.015, noise, 1.12) + 0.62 * click(t - 0.022, 435, 0.009, noise, 0.8);
          break;
        case "finish":
          sample = 0.8 * click(t, 350, 0.011, noise, 0.55) + 0.65 * click(t - 0.031, 690, 0.011, noise, 0.35);
          break;
        case "slide":
        case "breakSlide": {
          const swell = Math.sin(Math.PI * progress) ** 1.4;
          const shimmer = Math.sin(tau * (460 * t + 2700 * t * t));
          sample = swell * (0.92 * noise + 0.085 * shimmer);
          if (kind === "breakSlide") sample += 0.68 * click(t, 205, 0.012, noise, 0.7);
          break;
        }
        case "firework": {
          const crackle = Math.sin(tau * (31 * t + 48 * t * t)) ** 8;
          sample = click(t, 125, 0.022, noise, 1.1) + noise * crackle * Math.exp(-9 * t);
          break;
        }
        case "sustain":
          // Integer cycles in one second keep the loop continuous at any sample rate.
          sample =
            (0.12 + 0.024 * Math.cos(tau * 3 * t)) *
            (Math.sin(tau * 220 * t) + 0.22 * Math.sin(tau * 440 * t));
          break;
      }
      const fade = kind === "sustain" ? 1 : Math.min(1, (seconds - t) / 0.004);
      data[i] = Math.tanh(sample) * fade;
    }
    return buffer;
  }

  function attach(chart) {
    const cues = [],
      holds = [];
    function cue(time, kind) {
      cues.push({ time, object: prefix + kind, channel: "11", maiSound: true });
    }
    for (const n of chart.displayNotes) {
      chart.duration = Math.max(chart.duration, n.endTime + (n.firework ? 0.68 : 0.32));
      if (n.mine) continue;
      const tap = n.break ? "break" : n.ex ? "ex" : "tap";
      if (n.kind === "slide") {
        cue(n.startTime, n.break ? "breakSlide" : "slide");
        if (n.break) cue(n.endTime, "finish");
      } else if (n.kind === "touchHold") {
        if (n.endTime > n.time) holds.push({ start: n.time, end: n.endTime });
        cue(n.endTime, "touch");
      } else {
        cue(n.time, n.kind === "touch" && !n.break && !n.ex ? "touch" : tap);
        if (n.kind === "hold" && n.duration > 0) cue(n.endTime, "tap");
      }
      if (n.firework) cue(n.endTime, "firework");
    }
    // Overlapping touch holds share one sustained voice. Its chart interval
    // is retained so seeking into the middle can resume the correct phase.
    const spans = [];
    for (const h of holds) {
      const prev = spans.at(-1);
      if (prev && h.start <= prev.end) prev.end = Math.max(prev.end, h.end);
      else spans.push(h);
    }
    chart.sustainEvents = spans.map((h) => ({
      time: h.start,
      audioDuration: h.end - h.start,
      object: prefix + "sustain",
      channel: "11",
      maiSound: true,
      loop: true,
    }));
    for (const event of chart.sustainEvents) cues.push(event);
    cues.sort((a, b) => a.time - b.time);
    const recent = new Map();
    chart.keyEvents = cues.filter((c) => {
      if (Math.abs(c.time - (recent.get(c.object) ?? -Infinity)) < 0.00001) return false;
      recent.set(c.object, c.time);
      return true;
    });
    chart.events = [...chart.bgmEvents, ...chart.keyEvents].sort((a, b) => a.time - b.time);
  }
  window.MaiAudio = { createBuffer, attach };
})();
