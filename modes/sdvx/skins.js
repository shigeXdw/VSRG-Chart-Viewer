(function () {
  "use strict";
  // Files outside this list can make up most of a skin (scripts, fonts, audio,
  // result screens). Only gameplay art is decoded or saved in the browser.
  const paths = {
    track: "track",
    bt: "button",
    fx: "fxbutton",
    btHold: "buttonhold",
    fxHold: "fxbuttonhold",
    laserL: "laser_l",
    laserR: "laser_r",
    entryL: "laser_entry_l",
    entryR: "laser_entry_r",
    exitL: "laser_exit_l",
    exitR: "laser_exit_r",
    tick: "tick",
    bg: "bg",
    console: ["gameplay/console/base", "console/console"],
    banner: ["gameplay/banner/base", "fill_top"],
    score: "gameplay/score_panel/bg",
    crit: "gameplay/crit_line/base",
    strip: "crit_anim",
    cap: "crit_cap",
    capBack: "crit_cap_back",
    pointer: ["gameplay/crit_line/cursor", "pointer"],
    pointerTop: ["gameplay/crit_line/cursor_top", "pointer_overlay"],
    chain: "gameplay/chain/label",
    songPanel: "gameplay/song_panel/bg_left",
    songStrip: "gameplay/song_panel/bg_right",
    gauge: "gameplay/gauges/effective/gauge_back",
    gaugeFill: "gameplay/gauges/effective/gauge_fill_fail",
    gaugePass: "gameplay/gauges/effective/gauge_fill_pass",
    hits: "scorehit",
    critical: "score2"
  };
  for (const [i, suffix] of ["bta", "btb", "btc", "btd", "fxl", "fxr", "voll", "volr"].entries())
    paths["glow" + i] = ["gameplay/console/glow_" + suffix, "console/glow_" + suffix];
  for (const side of ["left", "right"])
    paths[side + "Detail"] = ["gameplay/console/detail_" + side, "console/detail_" + side];

  for (let i = 0; i < 18; i++)
    paths["hit" + i] = "gameplay/hit_animation_frames/critical_taps/" + (i + 1);
  for (let i = 0; i < 12; i++)
    paths["hold" + i] = "gameplay/hit_animation_frames/hold_critical/" + String(i * 12).padStart(4, "0");
  for (let i = 0; i < 12; i++)
    paths["laserHit" + i] =
      "gameplay/hit_animation_frames/laser_critical/" + String(i * 6).padStart(3, "0");
  for (const side of ["left", "right"])
    for (const layer of ["base", "top", "text"])
      paths[side + "Alert" + layer] = "gameplay/laser_alert/" + side + "/" + layer;
  function collect(files) {
    const candidates = new Map();
    for (const f of files) {
      const path = (f.webkitRelativePath || f.name).replaceAll("\\", "/"),
        lower = path.toLowerCase();
      const at = lower.lastIndexOf("textures/");
      if (at < 0 || (at && lower[at - 1] !== "/")) continue;
      const root = path.slice(0, at).replace(/\/$/, "");
      if (!candidates.has(root)) candidates.set(root, new Map());
      candidates.get(root).set(lower.slice(at + 9), f);
    }
    const roots = [...candidates].filter(([, files]) =>
      ["track.png", "button.png", "fxbutton.png", "laser_l.png", "laser_r.png"].some((p) => files.has(p))
    );
    if (roots.length !== 1)
      throw Error(
        roots.length
          ? "Choose one skin folder from the collection."
          : "Choose a USC skin folder or its textures folder. Expected track.png, button.png or laser_l.png."
      );
    const [root, assets] = roots[0],
      blobs = {};
    for (const [name, choices] of Object.entries(paths))
      for (const base of [].concat(choices)) {
        const file = assets.get(base + ".png");
        if (file) {
          blobs[name] = file;
          break;
        }
      }
    return {
      name: root.split("/").at(-1) || "Local textures",
      gear: assets.has("gameplay/console/base.png") || assets.has("gameplay/crit_line/base.png"),
      blobs
    };
  }
  const colors = [
    [31, 212, 255],
    [255, 37, 155]
  ];
  function tinted(image, side, mask) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
      p = pixels.data,
      color = colors[side];
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i] / 255,
        g = p[i + 1] / 255,
        b = p[i + 2] / 255;
      for (let ch = 0; ch < 3; ch++) {
        if (mask === "track") p[i + ch] = g * 205 + r * colors[1][ch] + b * colors[0][ch];
        else if (mask === "encoded") p[i + ch] = color[ch] * g * (1 - b) + 255 * b + r * 150;
        else p[i + ch] = Math.max(r, g, b) * color[ch];
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }
  // Some skins pad the far end with transparent rows. Sample the playable lanes
  // to find the solid longitudinal band, retaining transparency across the width.
  function playableTrack(image) {
    const scan = document.createElement("canvas");
    scan.width = 16;
    scan.height = image.height;
    const ctx = scan.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(
      image,
      image.width / 6,
      0,
      (image.width * 2) / 3,
      image.height,
      0,
      0,
      scan.width,
      scan.height
    );
    const pixels = ctx.getImageData(0, 0, scan.width, scan.height).data;
    const alpha = new Uint16Array(image.height);
    let peak = 0;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < scan.width; x++) alpha[y] += pixels[4 * (y * scan.width + x) + 3];
      peak = Math.max(peak, alpha[y]);
    }
    const threshold = peak * 0.98;
    let start = 0,
      end = image.height - 1;
    while (start < end && alpha[start] < threshold) start++;
    while (end > start && alpha[end] < threshold) end--;
    if (start === 0 && end === image.height - 1) return image;
    const out = document.createElement("canvas");
    out.width = image.width;
    out.height = end - start + 1;
    out
      .getContext("2d")
      .drawImage(image, 0, start, image.width, out.height, 0, 0, out.width, out.height);
    return out;
  }
  async function decode(source) {
    const images = {},
      bad = [];
    try {
      for (const [key, blob] of Object.entries(source.blobs)) {
        try {
          const frame = /^(hit|hold|laserHit)\d+$/.test(key);
          const bitmap = frame
            ? await createImageBitmap(blob, { resizeWidth: 200, resizeHeight: 200 })
            : await createImageBitmap(blob);
          images[key] = bitmap;
        } catch {
          bad.push(key);
        }
      }
      if (!["track", "bt", "fx", "laserL", "laserR"].some((k) => images[k]))
        throw Error("The gameplay textures could not be decoded.");
      if (images.track)
        images.trackSurface = playableTrack(
          source.gear ? images.track : tinted(images.track, 0, "track")
        );
      for (let side = 0; side < 2; side++) {
        const img = images[side ? "laserR" : "laserL"];
        if (img) images["laser" + side] = tinted(img, side, source.gear ? "encoded" : "mono");
        if (images.pointer) images["cursor" + side] = tinted(images.pointer, side, "mono");
        const detail = images[side ? "rightDetail" : "leftDetail"];
        if (detail) images["detail" + side] = tinted(detail, side, "mono");
      }
      return { name: source.name, gear: source.gear, images, bad };
    } catch (e) {
      release({ images });
      throw e;
    }
  }
  function release(skin) {
    for (const im of new Set(Object.values(skin?.images || {}))) im.close?.();
  }

  // Keep a single local skin; the File objects survive a page reload in IndexedDB.
  let database;
  function db() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const req = indexedDB.open("vsrg-ksh-skin", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("skins");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    return database;
  }
  async function storage(action, value) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction("skins", action === "read" ? "readonly" : "readwrite"),
        s = tx.objectStore("skins");
      const req =
        action === "read"
          ? s.get("selected")
          : action === "save"
            ? s.put(value, "selected")
            : s.delete("selected");
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error);
    });
  }
  let selected = null,
    version = 0;
  function bind(redraw) {
    const input = document.getElementById("kshSkinInput"),
      status = document.getElementById("kshSkinStatus");
    const reset = document.getElementById("kshSkinReset");
    function swap(next) {
      release(selected);
      selected = next;
      status.textContent = next
        ? next.name + (next.bad.length ? " · " + next.bad.length + " unreadable textures" : "")
        : "Standalone";
      reset.hidden = !next;
      redraw();
    }
    async function restore() {
      const id = version;
      try {
        const source = await storage("read");
        if (!source || id !== version) return;
        const skin = await decode(source);
        if (id !== version) {
          release(skin);
          return;
        }
        swap(skin);
      } catch {
        /* Local storage may be unavailable on file URLs or in private windows. */
      }
    }
    document.getElementById("kshSkinLoad").onclick = () => input.click();
    input.onchange = async () => {
      if (!input.files.length) return;
      const id = ++version,
        files = Array.from(input.files);
      input.value = "";
      try {
        const source = collect(files);
        status.textContent = "Loading " + source.name + "…";
        const skin = await decode(source);
        if (id !== version) {
          release(skin);
          return;
        }
        swap(skin);
        try {
          await storage("save", source);
        } catch {
          if (id === version) status.textContent += " · this session only";
        }
      } catch (e) {
        if (id === version) status.textContent = (selected?.name || "Standalone") + " · " + e.message;
      }
    };
    reset.onclick = async () => {
      const id = ++version;
      swap(null);
      try {
        await storage("clear");
      } catch {
        if (id === version) status.textContent = "Standalone · local storage unavailable";
      }
    };
    restore();
  }
  window.KshSkins = {
    bind,
    get current() {
      return selected;
    }
  };
})();
