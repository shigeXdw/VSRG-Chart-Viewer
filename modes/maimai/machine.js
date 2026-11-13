(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function text(id, value) {
    const element = $(id);
    if (element.textContent !== value) element.textContent = value;
  }
  const tones = ["#5086af", "#76ae39", "#c59218", "#d55442", "#8e57b5", "#9369a9", "#b95d88"];
  const tone = (c) => tones[c.slot - 1] || tones[0];
  const ring = document.getElementById("machineButtons");
  const host = $("maiMachine"),
    shell = host.querySelector(".machine-shell"),
    glass = host.querySelector(".machine-glass");
  const menu = $("machineMenu"),
    list = $("machineCards"),
    canvas = $("playfield"),
    panel = canvas.parentElement;
  const player = $("playerView"),
    buttons = [],
    lights = new Array(16).fill("");
  let api,
    enabled = false,
    phase = "off",
    library = null,
    songs = [],
    song = 0,
    diff = 0,
    readyChoice = 1,
    chart = null,
    launching = false;
  let cards = [],
    artUrls = new Map(),
    lastTop = "";
  const menus = new Set(["songs", "difficulty", "ready", "settings"]);
  const lightIndex = new WeakMap();
  const active = () => phase !== "off";
  const choices = () => songs[song] || [];
  const candidate = () => choices()[diff];
  const bloomCanvas = $("machineBloom"),
    bloomContext = bloomCanvas.getContext("2d");
  const sampler = document.createElement("canvas");
  sampler.width = sampler.height = 16;
  const sampleContext = sampler.getContext("2d", { willReadFrequently: true });
  let lastBloom = -Infinity,
    blockedSampling = false;
  function bloom(force = false) {
    if (!active()) return;
    const now = performance.now();
    if (!force && now - lastBloom < 125) return;
    lastBloom = now;
    const isMenu = menus.has(phase),
      c = isMenu ? candidate() : chart;
    let pixels;
    if (!blockedSampling) {
      try {
        sampleContext.clearRect(0, 0, 16, 16);
        if (isMenu) {
          sampleContext.fillStyle = tone(c);
          sampleContext.fillRect(0, 0, 16, 16);
          const image = list.querySelector('[aria-hidden="false"] img');
          if (image?.complete && image.naturalWidth) sampleContext.drawImage(image, 0, 0, 16, 16);
        } else if (canvas.width && canvas.height) sampleContext.drawImage(canvas, 0, 0, 16, 16);
        pixels = sampleContext.getImageData(0, 0, 16, 16).data;
      } catch {
        blockedSampling = true;
      }
    }
    bloomContext.clearRect(0, 0, 160, 245);
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) * Math.PI) / 8 - Math.PI / 2;
      let r = 0,
        g = 0,
        b = 0;
      if (pixels) {
        for (const radius of [4, 5, 6]) {
          const x = Math.round(7.5 + radius * Math.cos(a)),
            y = Math.round(7.5 + radius * Math.sin(a)),
            p = (y * 16 + x) * 4;
          r += pixels[p] / 3;
          g += pixels[p + 1] / 3;
          b += pixels[p + 2] / 3;
        }
      } else {
        r = 130;
        g = 205;
        b = 210;
      }
      const peak = Math.max(r, g, b);
      if (peak < 12) continue;
      const color = [r, g, b].map((v) => Math.round(95 + (160 * v) / peak)).join(",");
      const x = 80 + 70 * Math.cos(a),
        y = 141 + 70 * Math.sin(a);
      const gradient = bloomContext.createRadialGradient(x, y, 0, x, y, 38);
      const alpha = (isMenu ? 0.42 : 0.58) * Math.min(1, peak / 150);
      gradient.addColorStop(0, "rgba(" + color + "," + alpha + ")");
      gradient.addColorStop(0.35, "rgba(" + color + "," + alpha * 0.55 + ")");
      gradient.addColorStop(1, "rgba(" + color + ",0)");
      bloomContext.fillStyle = gradient;
      bloomContext.fillRect(x - 38, y - 38, 76, 76);
    }
  }
  function arc(start, end, inside, outside) {
    const points = [];
    function vertex(deg, r) {
      const a = (deg * Math.PI) / 180;
      points.push((50 + r * Math.sin(a)).toFixed(3) + "% " + (50 - r * Math.cos(a)).toFixed(3) + "%");
    }
    for (let i = 0; i <= 8; i++) vertex(start + ((end - start) * i) / 8, outside);
    for (let i = 8; i >= 0; i--) vertex(start + ((end - start) * i) / 8, inside);
    return "polygon(" + points.join(",") + ")";
  }
  function light(i, power, color, kind = "wall") {
    const value = Math.round(power * 100) / 100,
      key = value + "/" + color,
      slot = i + (kind === "wall" ? 8 : 0),
      prefix = kind === "wall" ? "--wall-" : "--";
    if (lights[slot] === key) return;
    lights[slot] = key;
    buttons[i].style.setProperty(prefix + "power", value);
    buttons[i].style.setProperty(prefix + "light", color);
    MaiCabinet.light(i, value, color, kind);
  }
  function action(key) {
    if (phase === "playing" || phase === "off") return "";
    if (phase === "result") return key === 4 || key === 5 ? "Select difficulty" : "";
    if (phase === "settings") return {
      1: "Increase", 2: "Next category", 3: "Right", 4: "Done",
      5: "Back", 6: "Left", 7: "Previous category", 8: "Decrease"
    }[key] || "";
    if (key === 4) return phase === "ready" ? (readyChoice === 1 ? "Start track" : "Options") : "Next";
    if (key === 5) return phase === "songs" ? "" : "Back";
    if (phase === "ready") return key === 3 && readyChoice < 2 ? "Right" : key === 6 && readyChoice > 0 ? "Left" : "";
    const index = phase === "songs" ? song : diff,
      length = phase === "songs" ? songs.length : choices().length;
    return key === 3 && index < length - 1 ? "Right" : key === 6 && index > 0 ? "Left" : "";
  }
  function controls() {
    buttons.forEach((button, i) => {
      const label = action(i + 1);
      if (label) button.dataset.action = label;
      else delete button.dataset.action;
      button.tabIndex = label ? 0 : -1;
      button.setAttribute("aria-disabled", String(!label));
      button.setAttribute("aria-label", "Button " + (i + 1) + (label ? " · " + label : ""));
      button.title = label ? label + " (" + (i + 1) + ")" : "Button " + (i + 1);
      const color = i === 3 ? "#ffad48" : i === 4 ? "#63b6ff" : "#65deff";
      light(i, 0, "#ffffff", "button");
      light(i, label ? 1 : 0, color);
    });
    for (const [id, key] of [["machineBack", 5], ["machineNext", 4]]) {
      const element = $(id), label = action(key);
      if (element.dataset.label === label) continue;
      element.dataset.label = label;
      element.replaceChildren();
      if (!label) continue;
      const caption = document.createElement("small"), title = document.createElement("strong");
      caption.textContent = label.toUpperCase();
      title.textContent = { Back: "もどる", Next: "つぎへ", "Start track": "スタート", Options: "設定", Done: "決定", "Select difficulty": "難易度" }[label] || label;
      element.setAttribute("aria-label", label);
      element.append(caption, title);
    }
    menu.dataset.left = action(6);
    menu.dataset.right = action(3);
  }
  function cover(el, c) {
    const file = c?.songMedia?.cover;
    let url = artUrls.get(file);
    if (!url && file) {
      const blob = api.file(file);
      if (blob) {
        url = URL.createObjectURL(blob);
        artUrls.set(file, url);
      }
    }
    if (el.dataset.image === (url || "")) return;
    el.dataset.image = url || "";
    el.replaceChildren();
    if (url) {
      const img = new Image();
      img.alt = "";
      img.src = url;
      img.onload = () => {
        if (menus.has(phase)) bloom(true);
      };
      el.append(img);
    }
  }
  function monitorValue(value) {
    const element = $("machineValue");
    if (element.dataset.value === value) return;
    element.dataset.value = value;
    const rate = /^(\d{1,3})\.(\d{4})%$/.exec(value);
    if (!rate) {
      delete element.dataset.rate;
      element.removeAttribute("aria-label");
      element.textContent = value;
      return;
    }
    if (!element.dataset.rate) {
      element.dataset.rate = "true";
      element.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
        const digit = document.createElement("span");
        digit.className = i < 3 ? "rate-integer" : i === 3 ? "rate-point" : i < 8 ? "rate-fraction" : "rate-percent";
        digit.setAttribute("aria-hidden", "true");
        digit.append(document.createTextNode(""));
        return digit;
      }));
    }
    element.setAttribute("aria-label", value);
    const characters = rate[1].padStart(3, "\u00a0") + "." + rate[2] + "%";
    // Keep each glyph's cell and the decimal point stationary across updates,
    // including the 9→10 and 99→100 boundaries and on the mirrored monitor.
    Array.from(element.children).forEach((digit, i) => {
      if (digit.firstChild.nodeValue !== characters[i]) digit.firstChild.nodeValue = characters[i];
    });
  }
  function monitor(c, caption, value, label, detail) {
    const key = [c.name, caption, value, label, detail].join("|");
    if (key === lastTop) return;
    lastTop = key;
    host.dataset.uiTheme = String(Math.min(7, Math.max(1, c.slot || 1)));
    if (host.style.getPropertyValue("--cabinet-tone") !== tone(c))
      host.style.setProperty("--cabinet-tone", tone(c));
    text("machineMonitorDifficulty", c.header.CHARTNAME);
    text("machineMonitorLevel", "Lv " + c.header.PLAYLEVEL);
    text("machineTitle", c.header.TITLE);
    text("machineMonitorPhase", caption);
    text("machineMonitorDetail", detail);
    monitorValue(value);
    text("machineValueLabel", label);
    cover(host.querySelector(".machine-monitor-cover"), c);
  }
  function songCard(item) {
    const card = document.createElement("div");
    card.className = "machine-card";
    card.dataset.uiTheme = String(Math.min(7, Math.max(1, item.slot || 1)));
    card.style.setProperty("--color", tone(item));
    const tab = document.createElement("span");
    tab.className = "machine-card-tab";
    tab.textContent = "DX / SIMAI";
    const art = document.createElement("div");
    art.className = "machine-cover";
    art.style.setProperty("--tone", tone(item));
    const difficulty = document.createElement("div");
    difficulty.className = "machine-card-difficulty";
    const name = document.createElement("strong"), level = document.createElement("span");
    name.textContent = item.header.CHARTNAME;
    level.textContent = "Lv " + item.header.PLAYLEVEL;
    difficulty.append(name, level);
    const title = document.createElement("strong"), artist = document.createElement("small");
    title.className = "machine-card-title";
    title.textContent = item.header.TITLE;
    artist.className = "machine-card-artist";
    artist.textContent = item.header.ARTIST || "";
    const footer = document.createElement("div");
    footer.className = "machine-card-footer";
    const credit = document.createElement("span"), bpm = document.createElement("span");
    const label = document.createElement("small"), designer = document.createElement("b");
    label.textContent = "NOTES DESIGNER";
    designer.textContent = item.header.SUBARTIST || "—";
    credit.append(label, designer);
    bpm.textContent = "BPM " + (item.header.BPM || "—");
    footer.append(credit, bpm);
    card.append(tab, art, difficulty, title, artist, footer);
    return card;
  }
  function optionCard(sound) {
    const card = document.createElement("div");
    card.className = "machine-card machine-option-card";
    card.dataset.option = sound ? "sound" : "viewer";
    card.dataset.uiTheme = sound ? "2" : String(Math.min(7, Math.max(1, candidate().slot || 1)));
    card.style.setProperty("--color", sound ? "#75bd44" : tone(candidate()));
    const title = document.createElement("h3"), icon = document.createElement("div"), detail = document.createElement("p"), value = document.createElement("strong");
    title.textContent = sound ? "SPEED & SOUND" : "VIEWER OPTIONS";
    icon.className = "machine-option-icon";
    icon.textContent = sound ? "♫" : "⚙";
    detail.textContent = sound ? "Approach speed · Song speed · Volume" : "Background · Sensors · Combo · Effects";
    value.textContent = MaiMachineSettings.summary();
    card.append(title, icon, detail, value);
    return card;
  }
  function renderMenu(rebuild) {
    const c = candidate();
    if (!c) return;
    const showingSongs = phase === "songs", ready = phase === "ready", settings = phase === "settings";
    const items = ready ? [null, c, null] : showingSongs ? songs.map(group => group[0]) : choices();
    const index = ready ? readyChoice : showingSongs ? song : diff;
    list.hidden = settings;
    $("machineSettingsPanel").hidden = !settings;
    if (settings) MaiMachineSettings.render($("machineSettingsPanel"));
    else {
      if (rebuild) {
        cards = items.map((item, i) => item ? songCard(item) : optionCard(i === 0));
        list.replaceChildren(...cards);
      }
      cards.forEach((card, i) => {
        const d = i - index, show = Math.abs(d) <= 2;
        if (show && items[i]) cover(card.querySelector(".machine-cover"), items[i]);
        card.style.transform = "translate(-50%,-50%) translateX(" + d * 105 + "%) scale(" + (d === 0 ? 1 : 0.73) + ")";
        card.style.opacity = show ? 1 : 0;
        card.style.zIndex = String(Math.max(0, 4 - Math.abs(d)));
        card.setAttribute("aria-hidden", String(d !== 0));
        card.classList.toggle("selected", d === 0);
      });
    }
    menu.dataset.screen = phase;
    text("machineHeading", settings ? "Game settings" : showingSongs ? "Song select" : ready ? "Track ready" : c.header.CHARTNAME);
    menu.style.setProperty("--tone", tone(c));
    text("machineChoice", settings ? MaiMachineSettings.label() : ready ? "READY" : (index + 1) + " / " + items.length);
    menu.querySelector(".machine-instruction").textContent = settings
      ? "Choose a setting · Upper buttons adjust values or change category · Done saves your options"
      : ready ? "Check your options · Choose Start track when you are ready"
      : "Select a difficulty · Press Next to continue · Back returns to song select";
    monitor(c, settings ? "Game settings" : showingSongs ? "Song select" : ready ? "Track ready" : "Difficulty select",
      "Lv " + c.header.PLAYLEVEL, "DIFFICULTY", c.header.ARTIST);
    controls();
    bloom(true);
  }
  function setPhase(next) {
    if (phase !== next && phase !== "off") MaiCabinet.transition?.();
    if (next === "ready") readyChoice = 1;
    phase = next;
    host.dataset.phase = next;
    lastTop = "";
    const browsing = menus.has(next);
    menu.hidden = !browsing;
    player.classList.toggle("machine-browsing", browsing);
    if (browsing) {
      renderMenu(true);
      menu.classList.remove("entering");
      void menu.offsetWidth;
      menu.classList.add("entering");
    } else controls();
    $("machineResultHint").hidden = next !== "result";
    const summary = $("machineSummary");
    summary.hidden = next !== "result";
    if (next === "result") {
      const counts = chart.statsAt(Infinity, chart.noteCount).counts;
      const table = document.createElement("table");
      const head = document.createElement("thead"),
        headRow = document.createElement("tr");
      for (const label of ["", "CRITICAL PERFECT", "PERFECT", "GREAT", "GOOD", "MISS"]) {
        const cell = document.createElement("th");
        cell.textContent = label;
        headRow.append(cell);
      }
      head.append(headRow);
      table.append(head);
      const body = document.createElement("tbody");
      for (const { name, hit } of counts) {
        const row = document.createElement("tr"),
          title = document.createElement("th");
        title.textContent = name;
        row.append(title);
        for (const value of [hit, 0, 0, 0, 0]) {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        }
        body.append(row);
      }
      table.append(body);
      const timing = document.createElement("div");
      timing.className = "machine-timing";
      for (const label of ["FAST", "LATE"]) {
        const line = document.createElement("div");
        line.textContent = label;
        const value = document.createElement("b");
        value.textContent = "0";
        line.append(value);
        timing.append(line);
      }
      summary.replaceChildren(table, timing);
    }
  }
  function change(c, all) {
    chart = c;
    blockedSampling = false;
    lastBloom = -Infinity;
    if (!enabled || c?.modeId !== "maimai") {
      MaiCabinet.close();
      if (active()) {
        panel.insertBefore(canvas, host);
        host.hidden = true;
        player.classList.remove("machine-mode", "machine-browsing");
        phase = "off";
        host.dataset.phase = phase;
      }
      if (!c || !enabled || library !== all) forgetArt();
      return;
    }
    if (library !== all) {
      forgetArt();
      library = all;
      const groups = new Map();
      for (const item of all)
        if (item.modeId === "maimai") {
          const key = JSON.stringify([item.songFolder, item.header.TITLE]);
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        }
      songs = [...groups.values()].map((group) => group.sort((a, b) => a.slot - b.slot));
    }
    song = songs.findIndex((group) => group.includes(c));
    if (song < 0) return;
    diff = choices().indexOf(c);
    if (!active()) {
      host.hidden = false;
      player.classList.add("machine-mode");
      glass.prepend(canvas);
    }
    setPhase(launching ? "playing" : "difficulty");
    MaiCabinet.open({
      host,
      shell,
      menu,
      canvas,
      monitor: host.querySelector(".machine-monitor"),
      press,
      buttons
    });
    if (!player.hidden && !document.querySelector("dialog[open]")) shell.focus({ preventScroll: true });
  }
  function forgetArt() {
    for (const url of artUrls.values()) URL.revokeObjectURL(url);
    artUrls.clear();
    library = null;
    songs = [];
    cards = [];
    list.replaceChildren();
  }
  function returnToSelect() {
    if (!active()) return;
    api.stop();
    setPhase("difficulty");
    shell.focus({ preventScroll: true });
  }
  async function press(key) {
    const op = action(key);
    if (!op) return;
    const b = buttons[key - 1];
    b.animate?.([{ filter: "brightness(1.5)" }, { filter: "brightness(1)" }], { duration: 180 });
    if (phase === "result") {
      returnToSelect();
      return;
    }
    if (phase === "settings") {
      if (op === "Done" || op === "Back") setPhase("ready");
      else {
        if (op === "Left" || op === "Right") MaiMachineSettings.move(op === "Right" ? 1 : -1);
        else if (op === "Increase" || op === "Decrease") MaiMachineSettings.adjust(op === "Increase" ? 1 : -1);
        else { MaiCabinet.transition?.(); MaiMachineSettings.category(op === "Next category" ? 1 : -1); }
        text("machineChoice", MaiMachineSettings.label());
      }
      return;
    }
    if (op === "Options") {
      MaiMachineSettings.open(readyChoice === 0 ? 0 : 1);
      setPhase("settings");
      return;
    }
    if (op === "Left" || op === "Right") {
      const step = op === "Right" ? 1 : -1;
      if (phase === "songs") {
        song += step;
        diff = 0;
      } else if (phase === "ready") readyChoice += step;
      else diff += step;
      renderMenu(false);
      const top = host.querySelector(".machine-monitor");
      top.classList.remove("changing");
      void top.offsetWidth;
      top.classList.add("changing");
      return;
    }
    if (op === "Back") {
      setPhase(phase === "ready" ? "difficulty" : "songs");
      return;
    }
    if (phase === "songs") {
      setPhase("difficulty");
      return;
    }
    if (phase === "difficulty") {
      setPhase("ready");
      return;
    }
    const chosen = candidate();
    launching = true;
    try {
      if (chosen !== chart) api.select(library.indexOf(chosen));
      else setPhase("playing");
    } finally {
      launching = false;
    }
    api.resize();
    await api.play();
    if (phase === "playing" && chart === chosen && !api.running()) setPhase("ready");
  }
  function buildLights(c) {
    const lanes = {
      button: Array.from({ length: 8 }, () => []),
      wall: Array.from({ length: 8 }, () => [])
    };
    for (const n of c.displayNotes) {
      if (n.mine) continue;
      if (n.kind === "touch" || n.kind === "touchHold") {
        // C is central and has no corresponding outer button. D/E sensors sit
        // between two button directions, so share their wall glow between them.
        if (n.area === "C" || n.key < 1 || n.key > 8) continue;
        const between = n.area === "D" || n.area === "E";
        const hit = { time: n.time, end: n.endTime, color: MaiRenderer.colorOf(n), power: between ? 0.5 : 1 };
        lanes.wall[n.key - 1].push({ ...hit });
        if (between) lanes.wall[(n.key + 6) % 8].push({ ...hit });
      } else if (n.kind === "slide") {
        const last = n.segments.at(-1);
        // Moving slide paths and their associated starting stars share the
        // screen-touch channel, including yellow simultaneous slides.
        if (last) lanes.wall[last.end - 1].push({ time: n.endTime, end: n.endTime, color: MaiRenderer.colorOf(n) });
      } else if (n.slideHead && n.key >= 1 && n.key <= 8) {
        lanes.wall[n.key - 1].push({ time: n.time, end: n.endTime, color: MaiRenderer.colorOf(n) });
      } else if (n.key >= 1 && n.key <= 8)
        lanes.button[n.key - 1].push({ time: n.time, end: n.endTime, color: MaiRenderer.colorOf(n) });
    }
    for (const lane of [...lanes.button, ...lanes.wall]) {
      lane.sort((a, b) => a.time - b.time);
      let busy = -Infinity;
      for (const hit of lane) {
        busy = Math.max(busy, hit.end);
        hit.until = busy;
      }
    }
    lightIndex.set(c, lanes);
    return lanes;
  }
  function sampleLights(c, time, write) {
    const lanes = lightIndex.get(c) || buildLights(c);
    for (const kind of ["button", "wall"]) for (let i = 0; i < 8; i++) {
      const lane = lanes[kind][i],
        n = lane[MaiSimai.upper(lane, time, "time") - 1];
      // Hold the hit color for half a second, then ease back to unlit plastic.
      const release = n ? Math.min(1, Math.max(0, (time - n.until - 0.5) / 0.25)) : 1;
      const level = 1 - release * release * (3 - 2 * release);
      write(i, level * (n?.power ?? 1), n?.color || "#fff3a4", kind);
    }
  }
  function frame(c, time) {
    if (!active() || c !== chart) return false;
    if (menus.has(phase)) return true;
    const end = MaiClear.end(c);
    const done = time >= (end || c.duration);
    if (done && phase !== "result") setPhase("result");
    if (!done && phase === "result") setPhase("playing");
    const passed = MaiSimai.upper(c.hitNotes, time, "time"),
      rate = c.achievement[passed] || 0;
    monitor(
      c,
      done ? "Track complete" : time < 0 ? "Track start" : "Now playing",
      rate.toFixed(4) + "%",
      "Achievement",
      c.header.CHARTNAME + " · Lv " + c.header.PLAYLEVEL + " · " + passed + " / " + c.noteCount
    );
    text("machineMaxCombo", String(passed));
    if (!done) {
      sampleLights(c, time, light);
    }
    return false;
  }
  function bind(callbacks) {
    api = callbacks;
    const scenery = document.createElement("div");
    scenery.className = "machine-scenery";
    scenery.setAttribute("aria-hidden", "true");
    for (const [x, y, size] of [
      [-9, 27, 34],
      [66, 27, 40],
      [-7, 89, 40],
      [74, 91, 33]
    ]) {
      const cloud = document.createElement("i");
      cloud.className = "machine-cloud";
      cloud.style.setProperty("--x", x + "%");
      cloud.style.setProperty("--y", y + "%");
      cloud.style.setProperty("--size", size + "%");
      scenery.append(cloud);
    }
    for (let i = 0; i < 32; i++) {
      const sparkle = document.createElement("i");
      sparkle.className = "machine-sparkle";
      sparkle.style.setProperty("--x", ((i * 37 + 9) % 100) + "%");
      sparkle.style.setProperty("--y", ((i * 13 + 12) % 33) + "%");
      sparkle.style.setProperty("--size", 1 + (i % 3) + "%");
      sparkle.style.setProperty("--delay", -(i % 7) / 2 + "s");
      scenery.append(sparkle);
    }
    menu.prepend(scenery);
    host.querySelector(".machine-monitor").prepend(scenery.cloneNode(true));
    const result = document.createElement("span");
    result.id = "machineResultHint";
    result.textContent = "Next · difficulty select";
    result.hidden = true;
    host.querySelector(".machine-ring").after(result);
    for (let i = 0; i < 8; i++) {
      const center = 22.5 + i * 45,
        b = document.createElement("button");
      b.type = "button";
      b.className = "machine-key";
      b.dataset.key = i + 1;
      b.style.clipPath = arc(center - 12.8, center + 12.8, 34.5, 48.4);
      b.style.setProperty("--face", arc(center - 12.2, center + 12.2, 35.0, 48.0));
      b.style.setProperty("--lamp", arc(center - 10, center + 10, 45, 47.7));
      b.style.setProperty("--angle", center + "deg");
      b.style.setProperty("--lamp-x", 50 + 46.5 * Math.sin((center * Math.PI) / 180) + "%");
      b.style.setProperty("--lamp-y", 50 - 46.5 * Math.cos((center * Math.PI) / 180) + "%");
      b.onclick = () => {
        shell.focus({ preventScroll: true });
        press(i + 1);
      };
      const spacer = document.createElement("span");
      spacer.className = "machine-spacer";
      spacer.setAttribute("aria-hidden", "true");
      const angle = i * 45;
      spacer.style.clipPath = arc(angle - 9.2, angle + 9.2, 34.4, 48.4);
      for (const offset of [-7.1, 7.1]) {
        const screw = document.createElement("i"),
          theta = ((angle + offset) * Math.PI) / 180;
        screw.style.left = 50 + 43.1 * Math.sin(theta) + "%";
        screw.style.top = 50 - 43.1 * Math.cos(theta) + "%";
        spacer.append(screw);
      }
      ring.append(spacer, b);
      buttons.push(b);
    }
    enabled = localStorage.getItem("vsrg-mai-machine") === "on";
    const settings = [$("maiMachineStartSetting"), $("maiMachineSetting")];
    for (const el of settings) {
      el.checked = enabled;
      el.onchange = () => {
        enabled = el.checked;
        settings.forEach((s) => (s.checked = enabled));
        localStorage.setItem("vsrg-mai-machine", enabled ? "on" : "off");
        if (enabled && api.chart()?.modeId === "maimai") api.stop();
        change(api.chart(), api.library());
        api.resize();
      };
    }
    document.addEventListener(
      "keydown",
      (e) => {
        if (
          !active() ||
          player.hidden ||
          e.ctrlKey ||
          e.altKey ||
          e.metaKey ||
          document.querySelector("dialog[open]") ||
          e.target.closest?.("input,select,textarea,[contenteditable=true],button:not(.machine-key)")
        )
          return;
        if (phase === "playing") {
          if (e.code !== "Escape") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          returnToSelect();
          return;
        }
        const number = /^(Digit|Numpad)([1-8])$/.exec(e.code);
        const focused = e.target.closest?.(".machine-key");
        const key = number
          ? Number(number[2])
          : {
              ArrowLeft: 6,
              ArrowRight: 3,
              ArrowUp: phase === "settings" ? 1 : 0,
              ArrowDown: phase === "settings" ? 8 : 0,
              PageUp: phase === "settings" ? 7 : 0,
              PageDown: phase === "settings" ? 2 : 0,
              Enter: focused ? Number(focused.dataset.key) : 4,
              Space: focused ? Number(focused.dataset.key) : 4,
              Escape: 5,
              Backspace: 5
            }[e.code];
        if (!key) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) press(key);
      },
      true
    );
  }
  window.MaiMachine = {
    sampleLights,
    bind,
    change,
    frame,
    active,
    returnToSelect,
    afterDraw: () => {
      if (host.classList.contains("machine-model-active")) MaiCabinet.draw();
      else bloom();
    }
  };
})();
