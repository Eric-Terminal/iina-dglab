"use strict";
(() => {
  // src/shared.ts
  var SAMPLE_MS = 100;
  var STALE_MS = 350;
  var FILTER_LABEL = "iina_dglab";
  var AUDIO_FILTER = `@${FILTER_LABEL}:lavfi=[astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level+Zero_crossings_rate:measure_overall=RMS_level+Peak_level]`;
  var clamp = (n, low, high) => Math.max(low, Math.min(high, n));

  // src/audio.ts
  function level(value) {
    if (value === "-inf" || value === "-Infinity") return -120;
    if (typeof value !== "number" && typeof value !== "string") return NaN;
    if (value === "") return NaN;
    const n = Number(value);
    return n === -Infinity ? -120 : n;
  }
  function readFeatures(meta, sampleRate) {
    if (!meta || typeof meta !== "object" || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
    const fields = meta;
    const rmsDb = level(fields["lavfi.astats.Overall.RMS_level"]);
    const peakDb = level(fields["lavfi.astats.Overall.Peak_level"]);
    if (!Number.isFinite(rmsDb) || !Number.isFinite(peakDb)) return null;
    let weightedZcr = 0;
    let energy = 0;
    for (const key of Object.keys(fields)) {
      const match = /^lavfi\.astats\.(\d+)\.Zero_crossings_rate$/.exec(key);
      if (!match) continue;
      const zcr = Number(fields[key]);
      const channelDb = level(fields[`lavfi.astats.${match[1]}.RMS_level`]);
      if (!Number.isFinite(zcr) || zcr < 0 || zcr > 1 || !Number.isFinite(channelDb)) return null;
      const weight = Math.pow(10, channelDb / 10);
      weightedZcr += zcr * weight;
      energy += weight;
    }
    if (!energy) return null;
    return { rmsDb, peakDb, zcr: clamp(weightedZcr / energy * sampleRate / 48e3, 0, 1) };
  }

  // src/main.ts
  var { mpv, event, core, menu, global: hub } = iina;
  var capturing = false;
  var seekUntil = 0;
  var lastPosition = -1;
  var lastProgressAt = 0;
  var lastFilterAttempt = -Infinity;
  var filterError = "";
  function installFilter() {
    if (!capturing || core.status.idle) return;
    const filters = mpv.getNative("af") || [];
    const existing = filters.find((filter) => filter.label === FILTER_LABEL);
    if (existing) {
      filterError = existing.enabled === false ? "\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u88AB\u7981\u7528\uFF0C\u8BF7\u5728 IINA \u4E2D\u542F\u7528\u5B83" : "";
      return;
    }
    if (Date.now() - lastFilterAttempt < 1e3) return;
    lastFilterAttempt = Date.now();
    try {
      mpv.command("af", ["add", AUDIO_FILTER]);
      const added = mpv.getNative("af") || [];
      filterError = added.some((filter) => filter.label === FILTER_LABEL) ? "" : "\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u6302\u8F7D\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63D2\u4EF6\u5F00\u53D1\u8005\u5DE5\u5177";
    } catch (error) {
      filterError = `\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u6302\u8F7D\u5931\u8D25\uFF1A${String(error)}`;
    }
  }
  function removeFilter() {
    const filters = mpv.getNative("af") || [];
    if (filters.some((filter) => filter.label === FILTER_LABEL)) mpv.command("af", ["remove", `@${FILTER_LABEL}`]);
  }
  function publish(reasonOverride) {
    if (!capturing) return;
    const at = Date.now();
    const position = mpv.getNative("time-pos");
    if (typeof position === "number" && position !== lastPosition) {
      lastPosition = position;
      lastProgressAt = at;
    }
    let reason = reasonOverride || "";
    if (!reason && core.status.idle) reason = "\u5C1A\u672A\u64AD\u653E\u5A92\u4F53";
    if (!reason && mpv.getFlag("pause")) reason = "\u64AD\u653E\u5DF2\u6682\u505C";
    if (!reason && (mpv.getFlag("mute") || mpv.getNumber("volume") <= 0)) reason = "\u64AD\u653E\u5668\u5DF2\u9759\u97F3";
    if (!reason && (mpv.getFlag("paused-for-cache") || mpv.getFlag("seeking") || at < seekUntil)) reason = "\u6B63\u5728\u7F13\u51B2\u6216\u5B9A\u4F4D";
    if (!reason && mpv.getFlag("eof-reached")) reason = "\u64AD\u653E\u5DF2\u7ED3\u675F";
    if (!reason && (typeof position !== "number" || at - lastProgressAt > STALE_MS)) reason = "\u64AD\u653E\u8FDB\u5EA6\u672A\u66F4\u65B0";
    const sample = { at, title: core.status.title || "IINA", running: false, reason, rmsDb: null, peakDb: null, zcr: null };
    if (!reason) {
      const params = mpv.getNative("audio-params");
      if (!params?.samplerate) sample.reason = "\u5F53\u524D\u97F3\u8F68\u672A\u63D0\u4F9B PCM \u97F3\u9891\uFF0C\u8BF7\u68C0\u67E5\u97F3\u8F68\u9009\u62E9\u4E0E\u97F3\u9891\u76F4\u901A\u8BBE\u7F6E";
      else {
        installFilter();
        const features = readFeatures(mpv.getNative(`af-metadata/${FILTER_LABEL}`), params.samplerate);
        if (!filterError && features) Object.assign(sample, features, { running: true });
        else sample.reason = filterError || "\u6B63\u5728\u7B49\u5F85\u97F3\u9891\u7EDF\u8BA1\uFF0C\u8BF7\u4FDD\u6301\u64AD\u653E";
      }
    }
    hub.postMessage("audio", sample);
  }
  function capture(enabled) {
    capturing = enabled;
    lastPosition = -1;
    lastProgressAt = Date.now();
    lastFilterAttempt = -Infinity;
    if (enabled) {
      installFilter();
      publish();
    } else removeFilter();
  }
  hub.onMessage("capture", ({ enabled }) => capture(enabled));
  menu.addItem(menu.item("\u6253\u5F00\u97F3\u9891\u8054\u52A8\uFF08\u4F7F\u7528\u5F53\u524D\u7A97\u53E3\uFF09", () => {
    hub.postMessage("select-source", { title: core.status.title || "IINA" });
    capture(true);
  }));
  menu.addItem(menu.item("\u505C\u6B62\u90CA\u72FC\u8F93\u51FA", () => hub.postMessage("emergency-stop", {}), { keyBinding: "Ctrl+Alt+ESC" }));
  event.on("iina.file-loaded", () => {
    if (!capturing) return;
    hub.postMessage("source-reset", { reason: "\u5A92\u4F53\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8" });
    seekUntil = Date.now() + 250;
    lastFilterAttempt = -Infinity;
    installFilter();
    publish();
  });
  event.on("mpv.seek", () => {
    seekUntil = Date.now() + 250;
    publish("\u6B63\u5728\u5B9A\u4F4D");
  });
  event.on("mpv.playback-restart", () => {
    seekUntil = Date.now() + 150;
  });
  event.on("mpv.end-file", () => {
    if (!capturing) return;
    publish("\u64AD\u653E\u5DF2\u7ED3\u675F");
    hub.postMessage("source-reset", { reason: "\u64AD\u653E\u5DF2\u7ED3\u675F" });
  });
  event.on("mpv.shutdown", () => {
    if (capturing) hub.postMessage("source-reset", { reason: "\u64AD\u653E\u7A97\u53E3\u5DF2\u5173\u95ED" });
    capturing = false;
  });
  setInterval(() => publish(), SAMPLE_MS);
})();
