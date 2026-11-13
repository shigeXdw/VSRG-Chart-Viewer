(function () {
  "use strict";
  // These are views of the existing controls, not a second settings store.
  const groups = [
    { name: "Speed & sound", items: [
      ["maiSpeed", "Approach speed", "Note travel speed", "×", 1],
      ["songSpeed", "Song speed", "Audio and chart playback rate", "%", 1],
      ["volume", "Volume", "Song and hit sound volume", "%", 100],
      ["pitchWithSpeed", "Pitch with speed", "Change pitch with playback speed"],
      ["keysounds", "Hitsounds", "Autoplay note and slide sounds"]
    ] },
    { name: "Playfield", items: [
      ["maiBlur", "Background blur", "Soften the background media", "px", 1],
      ["maiDarkness", "Background darkness", "Keep the chart readable", "%", 1],
      ["maiSensors", "Sensor visibility", "Screen sensor outlines", "%", 1]
    ] },
    { name: "Display", items: [
      ["maiComboOpacity", "Combo opacity", "Transparency of the center counter", "%", 1],
      ["maiEffects", "Hit effects", "Judgment flashes and particles"],
      ["maiExtraInfo", "Extra info", "Detailed chart statistics"]
    ] }
  ];
  let category = 0, index = 0, root, renderedGroup = -1, cards = [];
  const current = () => groups[category].items[index];
  function explanation(id) {
    const input = document.getElementById(id);
    switch (id) {
      case "maiSpeed": return ["NOTE TRAVEL", "Speed " + input.value, "Higher values shorten the approach"];
      case "songSpeed": return ["PLAYBACK RATE", (Number(input.value) / 100).toFixed(2) + "×",
        Number(input.value) === 100 ? "Original tempo" : Number(input.value) > 100 ? "Faster playback" : "Slower playback"];
      case "pitchWithSpeed": return ["AUDIO PITCH", input.checked ? "Follows speed" : "Preserved",
        input.checked ? "Pitch changes with the song speed" : "Keep the original pitch"];
      case "keysounds": return ["NOTE AUDIO", input.checked ? "Sounds on" : "Muted",
        input.checked ? "Tap, hold and slide cues" : "Song audio only"];
      case "maiEffects": return ["JUDGMENT EFFECTS", input.checked ? "Visible" : "Hidden", "Flashes and hit particles"];
      case "maiExtraInfo": return ["SIDE STATISTICS", input.checked ? "Shown" : "Hidden", "Rates and note totals beside the field"];
      default: return null;
    }
  }
  function value(item) {
    const input = document.getElementById(item[0]);
    if (input.type === "checkbox") return input.checked ? "ON" : "OFF";
    return Number((Number(input.value) * item[4]).toFixed(2)) + (item[3] || "");
  }
  function render(element = root) {
    root = element;
    if (!root) return;
    if (renderedGroup !== category) {
      renderedGroup = category;
      const tabs = document.createElement("div");
      tabs.className = "machine-setting-tabs";
      groups.forEach((group, i) => {
        const tab = document.createElement("span");
        tab.textContent = group.name;
        tab.classList.toggle("selected", i === category);
        tabs.append(tab);
      });
      const carousel = document.createElement("div");
      carousel.className = "machine-setting-carousel";
      cards = groups[category].items.map(item => {
        const card = document.createElement("section");
        card.className = "machine-setting-card";
        const title = document.createElement("h3"), description = document.createElement("p");
        title.textContent = item[1]; description.textContent = item[2];
        const preview = document.createElement("div");
        preview.className = "machine-setting-preview";
        preview.dataset.setting = item[0];
        preview.setAttribute("aria-hidden", "true");
        if (explanation(item[0])) {
          preview.classList.add("machine-setting-explanation");
          preview.append(document.createElement("small"), document.createElement("strong"), document.createElement("span"));
        }
        const output = document.createElement("output");
        output.setAttribute("aria-label", item[1]);
        const arrows = document.createElement("div");
        arrows.className = "machine-setting-adjust";
        arrows.innerHTML = '<span>◀ −</span><span>＋ ▶</span>';
        card.append(title, preview, description, output, arrows);
        carousel.append(card);
        return card;
      });
      const help = document.createElement("div");
      help.className = "machine-setting-help";
      help.textContent = "◀ / ▶ choose · ↑ / ↓ adjust · PgUp / PgDn category · Enter done";
      const ringActions = document.createElement("div");
      ringActions.className = "machine-setting-ring-actions";
      for (const label of ["− Value", "+ Value", "‹ Category", "Category ›"]) {
        const control = document.createElement("span");
        control.textContent = label.includes("Category") ? (label.startsWith("‹") ? "‹" : "›") : label;
        control.title = label;
        ringActions.append(control);
      }
      root.replaceChildren(tabs, carousel, help, ringActions);
    }
    cards.forEach((card, i) => {
      const item = groups[category].items[i], input = document.getElementById(item[0]), d = i - index;
      card.style.transform = `translate(-50%, -50%) translateX(${d * 104}%) scale(${d === 0 ? 1 : 0.73})`;
      card.style.opacity = Math.abs(d) <= 2 ? 1 : 0;
      card.style.zIndex = String(5 - Math.abs(d));
      card.classList.toggle("selected", d === 0);
      card.classList.toggle("unavailable", input.disabled);
      card.setAttribute("aria-hidden", String(d !== 0));
      card.querySelector("output").textContent = value(item);
      card.querySelector("p").textContent = input.disabled ? "Available when this chart has background media" : item[2];
      const ratio = input.type === "checkbox" ? Number(input.checked)
        : (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
      card.style.setProperty("--setting-value", ratio);
      const detail = explanation(item[0]);
      if (detail) {
        const fields = card.querySelector(".machine-setting-preview").children;
        detail.forEach((content, j) => { fields[j].textContent = content; });
      }
    });
  }
  function adjust(direction) {
    const input = document.getElementById(current()[0]);
    if (input.disabled) return;
    if (input.type === "checkbox") input.checked = !input.checked;
    else {
      const step = Number(input.step) || 1;
      input.value = String(Math.min(Number(input.max), Math.max(Number(input.min),
        Number((Number(input.value) + direction * step).toFixed(4)))));
    }
    // Reuse audio/renderer callbacks, output formatting and localStorage binding.
    input.dispatchEvent(new Event(input.type === "checkbox" ? "change" : "input", { bubbles: true }));
    render();
  }
  for (const event of ["input", "change"]) document.addEventListener(event, e => {
    if (groups.some(g => g.items.some(item => item[0] === e.target.id))) render();
  });
  window.MaiMachineSettings = {
    render, adjust,
    open(group = 0) { category = group; index = 0; renderedGroup = -1; },
    move(step) { index = (index + step + groups[category].items.length) % groups[category].items.length; render(); },
    category(step) { category = (category + step + groups.length) % groups.length; index = 0; render(); },
    label: () => groups[category].name,
    summary: () => `Speed ${value(groups[0].items[0])} · Effects ${value(groups[2].items[1])}`
  };
})();
