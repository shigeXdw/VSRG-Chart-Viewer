(function () {
  "use strict";
  function bind(snapshot) {
    const byId = id => document.getElementById("maiExport" + id);
    const panel = byId("Panel"), handle = byId("Handle"), start = byId("Start");
    const status = byId("Status"), percent = byId("Percent"), bar = byId("Progress");
    const save = byId("Save"), action = byId("Action");
    let controller, download, drag;
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
      panel.hidden = false; start.disabled = true;
      controller = new AbortController();
      action.textContent = "Cancel"; action.disabled = false;
      progress(0, "Preparing");
      try {
        const job = snapshot();
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
        controller = null; start.disabled = false; action.disabled = false; action.textContent = "Close";
        if (panel.style.left) position(panel.offsetLeft, panel.offsetTop);
      }
    });
  }
  window.MaiExportUI = {bind};
})();
