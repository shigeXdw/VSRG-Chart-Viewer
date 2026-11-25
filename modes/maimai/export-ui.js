(function () {
  "use strict";
  function bind(snapshot) {
    const byId = id => document.getElementById("maiExport" + id);
    const panel = byId("Panel"), handle = byId("Handle"), start = byId("Start");
    const status = byId("Status"), percent = byId("Percent"), bar = byId("Progress");
    const save = byId("Save"), action = byId("Action");
    const camera = byId("Camera");
    camera.value = localStorage.getItem("vsrg-mai-export-camera") || "auto";
    if (!camera.value) camera.value = "auto";
    const cameraControl = id => document.getElementById("maiCamera" + id);
    const cabinet = document.getElementById("maiMachine");
    const tools = cameraControl("Tools"), previewButton = cameraControl("Preview");
    const antialias = cameraControl("AA"), render = cameraControl("Render"), grid = cameraControl("Grid");
    const settings = cameraControl("Settings"), settingsToggle = cameraControl("SettingsToggle");
    const settingsPanel = cameraControl("SettingsPanel");
    const gridKey = "vsrg-mai-camera-grid";
    let showGrid = localStorage.getItem(gridKey) === "on";
    const preferencesKey = "vsrg-mai-camera-options";
    let preferences = {};
    try { preferences = JSON.parse(localStorage.getItem(preferencesKey)) || {}; }
    catch { /* Invalid saved options use the preset defaults. */ }
    if (typeof preferences !== "object" || Array.isArray(preferences)) preferences = {};
    let controller, download, drag, previewing = false;
    function cameraId(machine = MaiMachine.active()) {
      return camera.value === "auto" ? (machine ? "left" : "flat") : camera.value;
    }
    function smoothing(id) {
      return preferences[id]?.antialias !== false;
    }
    function setSettingsOpen(open) {
      settingsPanel.hidden = !open;
      settingsToggle.setAttribute("aria-expanded", String(open));
    }
    function setToggle(button, on) {
      button.setAttribute("aria-pressed", String(on));
      button.lastElementChild.textContent = on ? "On" : "Off";
    }
    settingsToggle.addEventListener("click", () => setSettingsOpen(settingsPanel.hidden));
    settings.addEventListener("keydown", event => {
      if (event.key !== "Escape" || settingsPanel.hidden) return;
      event.preventDefault();
      setSettingsOpen(false);
      settingsToggle.focus();
    });
    document.addEventListener("pointerdown", event => {
      if (!settingsPanel.hidden && !settings.contains(event.target)) setSettingsOpen(false);
    }, true);
    grid.addEventListener("click", () => {
      showGrid = !showGrid;
      localStorage.setItem(gridKey, showGrid ? "on" : "off");
      tools.classList.toggle("has-thirds-grid", showGrid);
      setToggle(grid, showGrid);
      MaiCabinet.showPreviewGuides();
    });
    tools.classList.toggle("has-thirds-grid", showGrid);
    setToggle(grid, showGrid);
    function describeCamera() {
      const id = cameraId();
      const preset = MaiCabinet.presets[id];
      const dimensions = preset ? preset.width + "×" + preset.height : "1920×1080";
      start.textContent = "Export MP4 · " + dimensions + " · 60 FPS";
      if (!preset || cabinet.hidden) previewing = false;
      previewButton.hidden = !preset || previewing;
      tools.hidden = !previewing;
      if (!previewing) {
        setSettingsOpen(false);
        MaiCabinet.setPreview(null);
        return;
      }
      const ratio = preset.width < preset.height ? "9:16" : "16:9";
      cameraControl("Size").value = ratio + " · " + dimensions;
      setToggle(antialias, smoothing(id));
      MaiCabinet.setPreview(id, smoothing(id));
    }
    function showPreview() {
      if (!MaiCabinet.presets[cameraId()]) return;
      if (!MaiMachine.active()) document.getElementById("maiMachineSetting").click();
      previewing = MaiMachine.active();
      describeCamera();
    }
    camera.addEventListener("change", () => {
      setSettingsOpen(false);
      localStorage.setItem("vsrg-mai-export-camera", camera.value);
      if (MaiCabinet.presets[camera.value]) showPreview();
      else {
        previewing = false;
        describeCamera();
      }
    });
    previewButton.addEventListener("click", showPreview);
    cameraControl("Close").addEventListener("click", () => {
      previewing = false;
      describeCamera();
      cabinet.focus({ preventScroll: true });
    });
    cameraControl("Reset").addEventListener("click", () => MaiCabinet.resetPreview());
    cameraControl("ZoomIn").addEventListener("click", () => MaiCabinet.zoomPreview(true));
    cameraControl("ZoomOut").addEventListener("click", () => MaiCabinet.zoomPreview(false));
    antialias.addEventListener("click", () => {
      const id = cameraId();
      preferences[id] = { antialias: !smoothing(id) };
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      describeCamera();
    });
    render.addEventListener("click", () => start.click());
    new MutationObserver(describeCamera).observe(cabinet, {attributes:true, attributeFilter:["hidden"]});
    describeCamera();
    function release() {
      if (download) URL.revokeObjectURL(download);
      download = null;
      save.removeAttribute("href"); save.hidden = true;
    }
    function progress(value, message) {
      bar.value = value;
      percent.value = Math.floor(value * 100) + "%";
      if (status.textContent !== message) status.textContent = message;
    }
    function position(x, y) {
      const margin = 8;
      panel.style.left = Math.max(margin, Math.min(innerWidth - panel.offsetWidth - margin, x)) + "px";
      panel.style.top = Math.max(margin, Math.min(innerHeight - panel.offsetHeight - margin, y)) + "px";
      panel.style.bottom = "auto"; panel.style.right = "auto";
    }
    handle.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      const rect = panel.getBoundingClientRect();
      drag = { id:event.pointerId, x:event.clientX - rect.left, y:event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (drag?.id === event.pointerId) position(event.clientX - drag.x, event.clientY - drag.y);
    });
    handle.addEventListener("lostpointercapture", () => { drag = null; });
    window.addEventListener("resize", () => {
      if (!panel.hidden && panel.style.left) position(panel.offsetLeft, panel.offsetTop);
    });
    action.addEventListener("click", () => {
      if (controller) {
        controller.abort();
        status.textContent = "Canceling…";
        action.disabled = true;
      } else { release(); panel.hidden = true; }
    });
    start.addEventListener("click", async () => {
      if (controller) return;
      release();
      panel.hidden = false; start.disabled = render.disabled = true; camera.disabled = true;
      controller = new AbortController();
      action.textContent = "Cancel"; action.disabled = false;
      progress(0, "Preparing");
      try {
        const job = snapshot();
        const selected = cameraId(job.machine);
        job.machineCamera = selected === "flat" ? null : selected;
        if (job.machineCamera) {
          job.machineLightOptions = MaiMachineSettings.buttonLights();
          job.machineCameraOptions = {
            antialias: smoothing(selected), pose: MaiCabinet.capturePreview(selected)
          };
        }
        const blob = await MaiExport.render(job, controller.signal, progress);
        controller.signal.throwIfAborted();
        download = URL.createObjectURL(blob);
        save.href = download;
        const name = job.chart.header.TITLE + " - " + job.chart.header.CHARTNAME;
        save.download = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 160) + ".mp4";
        save.hidden = false;
        progress(1, "Ready");
      } catch (error) {
        status.textContent = controller.signal.aborted ? "Canceled" : (error.message || String(error));
      } finally {
        controller = null; start.disabled = render.disabled = false; camera.disabled = false; action.disabled = false; action.textContent = "Close";
        if (panel.style.left) position(panel.offsetLeft, panel.offsetTop);
      }
    });
  }
  window.MaiExportUI = {bind};
})();
