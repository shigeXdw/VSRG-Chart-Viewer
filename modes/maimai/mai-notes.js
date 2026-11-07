(function () {
  "use strict";
  const origin = "https://mai-notes.com";
  const playerPath = /^\/player\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/?$/i;
  const groups = { level: "Level", version: "Version", genre: "Genre", kana: "Title" };
  const difficulties = [
    ["bas", "BASIC", "#56bf78"], ["adv", "ADVANCED", "#f4b354"],
    ["exp", "EXPERT", "#fe606f"], ["mas", "MASTER", "#aa6fff"], ["remas", "Re:MASTER", "#e398e2"]
  ];

  function pathFor(href, pattern) {
    if (!href) return "";
    try {
      const url = new URL(href, origin);
      if (url.origin === origin && !url.username && !url.password && pattern.test(url.pathname)) return url.pathname;
    } catch { /* Unusable source link. */ }
    return "";
  }

  async function page(path, signal) {
    const response = await fetch(origin + path, { signal, credentials: "omit", redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("Mai Notes returned HTTP " + response.status + ".");
    // Inspect inert markup. Nothing from the source page is attached to the viewer DOM.
    const template = document.createElement("template");
    template.innerHTML = await response.text();
    return template.content;
  }

  function chartFile(doc, path) {
    const data = doc.querySelector("#songInfoSection")?.dataset;
    const notes = doc.querySelector("textarea#simaiInput")?.value.trim();
    if (!data?.songTitle || data.chartId?.toLowerCase() !== path.split("/")[2].toLowerCase() || !notes || /^\s*&\w+\s*=/m.test(notes))
      throw new Error("This page has no readable Simai chart.");
    const names = ["EASY", "BASIC", "ADVANCED", "EXPERT", "MASTER", "RE:MASTER", "UTAGE"];
    const difficulty = (data.difficulty || "").toUpperCase().replace(/\s+/g, "");
    const slot = names.indexOf(difficulty) + 1;
    if (!slot) throw new Error("Unsupported Mai Notes difficulty: " + data.difficulty);
    const single = value => (value || "").replace(/[\r\n]+/g, " ").trim();
    const text = [
      "&title=" + single(data.songTitle), "&artist=" + single(data.songArtist),
      "&des=" + single(data.designer), "&lv_" + slot + "=" + single(data.level),
      "&inote_" + slot + "=" + (Number(data.bpm) > 0 ? "(" + Number(data.bpm) + ")" : "") + notes
    ].join("\n");
    return new File([text], "maidata.txt", { type: "text/plain" });
  }

  function bind(openChart) {
    for (const logo of document.querySelectorAll(".mai-notes-logo")) {
      const showLogo = () => {
        logo.hidden = !logo.naturalWidth;
        logo.nextElementSibling.hidden = !logo.hidden;
      };
      logo.addEventListener("load", showLogo);
      if (logo.complete) showLogo();
    }
    const el = id => document.getElementById("maiNotes" + id);
    const dialog = el("Dialog"), list = el("List"), status = el("Status"), back = el("Back"), filter = el("Filter");
    const tools = el("Tools"), sort = el("Sort");
    let request, categories, selected = "", songs = [];
    const button = (label, click) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.addEventListener("click", click);
      return b;
    };
    async function run(message, action) {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      status.textContent = message;
      const timeout = setTimeout(() => controller.abort("timeout"), 20000);
      try {
        await action(controller.signal);
      } catch (e) {
        if (request !== controller || !dialog.open) return;
        status.textContent = controller.signal.reason === "timeout" ? "Mai Notes timed out. Try again."
          : e instanceof TypeError ? "Could not reach Mai Notes. Check your connection and try again." : e.message;
      } finally {
        clearTimeout(timeout);
        if (request === controller) request = null;
      }
    }
    function importChart(path) {
      run("Importing chart…", async signal => {
        if (!path) throw new Error("Paste a mai-notes.com/player/ chart link.");
        const file = chartFile(await page(path, signal), path);
        const [chart] = await PlayerModes.parse(file, { chartPath: file.name, files: new Map() });
        if (signal.aborted || !dialog.open) return;
        if (!chart.noteCount) throw new Error("This difficulty has no playable notes.");
        openChart(file, chart);
        dialog.close();
      });
    }
    function readSongs(doc) {
      return Array.from(doc.querySelectorAll(".song-card"), card => {
        const title = card.querySelector(".song-title")?.textContent.trim();
        const rows = Array.from(card.querySelectorAll(".type-row"), row => ({
          type: row.querySelector(".type-badge")?.textContent.trim() || "",
          charts: Array.from(row.querySelectorAll(".diff-btn"), node => ({
            level: node.textContent.trim(), path: pathFor(node.getAttribute("href"), playerPath),
            diff: difficulties.find(([key]) => node.classList.contains("diff-" + key))
          }))
        }));
        return { title, rows };
      }).filter(song => song.title && song.rows.length);
    }
    function renderSongs() {
      list.replaceChildren();
      const query = filter.value.trim().toLocaleLowerCase();
      const visible = songs.filter(song => song.title.toLocaleLowerCase().includes(query));
      if (sort.value !== "source") {
        const direction = sort.value === "asc" ? 1 : -1;
        visible.sort((a, b) => direction * a.title.localeCompare(b.title, "ja"));
      }
      status.textContent = selected + " · " + visible.length + (visible.length === 1 ? " song" : " songs");
      const fragment = document.createDocumentFragment();
      for (const {title, rows} of visible) {
        const card = document.createElement("div");
        card.className = "mai-library-song";
        const available = rows.flatMap(row => row.charts).filter(c => c.path);
        const preferred = available.find(c => selected === "Level " + c.level) || available.at(-1);
        const titleButton = button(title, () => importChart(preferred.path));
        titleButton.disabled = !preferred;
        if (preferred) titleButton.title = "Import " + (preferred.diff?.[1] || "") + " " + preferred.level;
        card.append(titleButton);
        for (const row of rows) {
          const strip = document.createElement("div"), type = document.createElement("small");
          strip.className = "mai-library-diffs"; type.textContent = row.type; strip.append(type);
          for (const chart of row.charts) {
            const b = button(chart.level, () => importChart(chart.path));
            b.disabled = !chart.path;
            b.title = [title, row.type, chart.diff?.[1], chart.level].filter(Boolean).join(" · ");
            b.setAttribute("aria-label", b.title);
            if (chart.diff) b.style.setProperty("--mai-diff", chart.diff[2]);
            strip.append(b);
          }
          card.append(strip);
        }
        fragment.append(card);
      }
      list.append(fragment);
    }
    function showGroup(group) {
      run("Loading " + group.name + "…", async signal => {
        const doc = await page(group.path, signal);
        if (signal.aborted) return;
        const items = readSongs(doc);
        if (!items.length && !doc.querySelector("#chartList")) throw new Error("This category could not be read.");
        songs = items; selected = group.name;
        back.hidden = tools.hidden = false; filter.value = "";
        renderSongs();
        filter.focus();
        dialog.querySelector(".mai-library-body").scrollTop = 0;
      });
    }
    function showCategories() {
      run("Loading categories…", async signal => {
        if (!categories) {
          const doc = await page("/", signal);
          if (signal.aborted) return;
          const found = [];
          for (const link of doc.querySelectorAll("a[href]")) {
            const path = pathFor(link.getAttribute("href"), /^\/(level|version|genre|kana)\/[\w-]+\/?$/);
            if (!path) continue;
            const kind = path.split("/")[1], label = link.textContent.trim();
            found.push({ path, kind, label, name: kind === "level" ? "Level " + label : label });
          }
          if (!found.length) throw new Error("Mai Notes did not return any chart categories.");
          categories = found;
        }
        status.textContent = ""; back.hidden = tools.hidden = true;
        list.replaceChildren(); songs = [];
        for (const [kind, title] of Object.entries(groups)) {
          const items = categories.filter(g => g.kind === kind);
          if (!items.length) continue;
          const heading = document.createElement("h3"), grid = document.createElement("div");
          heading.textContent = title; grid.className = "mai-library-grid";
          for (const item of items) grid.append(button(item.label, () => showGroup(item)));
          list.append(heading, grid);
        }
        dialog.querySelector(".mai-library-body").scrollTop = 0;
      });
    }
    back.addEventListener("click", showCategories);
    filter.addEventListener("input", renderSongs);
    sort.addEventListener("change", renderSongs);
    el("Cancel").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { request?.abort(); request = null; });
    el("Form").addEventListener("submit", e => {
      e.preventDefault(); importChart(pathFor(el("Url").value.trim(), playerPath));
    });
    return () => { dialog.showModal(); showCategories(); };
  }
  window.MaiNotes = { bind };
})();
