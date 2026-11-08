"use strict";
(() => {
  // src/shared.ts
  var STALE_MS = 350;
  var OFFICIAL_SERVER = "wss://trex.dungeon-lab.cn/v4";
  var FILTER_LABEL = "iina_dglab";
  var AUDIO_FILTER = `@${FILTER_LABEL}:lavfi=[astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level+Zero_crossings_rate:measure_overall=RMS_level+Peak_level]`;
  var DEFAULT_SETTINGS = {
    metric: "hybrid",
    adaptiveGate: true,
    gateDb: -38,
    ceilingDb: -5,
    gamma: 1.1,
    zcrLow: 0.02,
    zcrHigh: 0.22,
    frequencyLow: 10,
    frequencyHigh: 100,
    modulationMax: 100,
    capA: 0,
    capB: 0,
    channelA: true,
    channelB: true
  };
  function validateSettings(value) {
    if (!value || typeof value !== "object") throw new Error("\u53C2\u6570\u683C\u5F0F\u65E0\u6548\u3002");
    const s = value;
    const ranges = [
      ["gateDb", -90, -1],
      ["ceilingDb", -60, 0],
      ["gamma", 0.2, 3],
      ["zcrLow", 0, 1],
      ["zcrHigh", 0, 1],
      ["frequencyLow", 10, 100],
      ["frequencyHigh", 10, 100],
      ["modulationMax", 0, 100],
      ["capA", 0, 200],
      ["capB", 0, 200]
    ];
    for (const [key, min, max] of ranges) {
      const n = s[key];
      if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
        throw new Error(`\u53C2\u6570 ${key} \u5FC5\u987B\u5728 ${min}\uFF5E${max} \u4E4B\u95F4\u3002`);
      }
    }
    if (s.gateDb >= s.ceilingDb) throw new Error("\u566A\u58F0\u95E8\u9650\u5FC5\u987B\u4F4E\u4E8E\u6EE1\u5E45\u7535\u5E73\u3002");
    if (s.zcrLow >= s.zcrHigh) throw new Error("\u8FC7\u96F6\u7387\u4E0B\u754C\u5FC5\u987B\u5C0F\u4E8E\u4E0A\u754C\u3002");
    if (s.frequencyLow > s.frequencyHigh) throw new Error("\u9891\u7387\u7F16\u7801\u4E0B\u754C\u4E0D\u80FD\u5927\u4E8E\u4E0A\u754C\u3002");
    if (!["hybrid", "rms", "peak"].includes(s.metric) || typeof s.adaptiveGate !== "boolean" || typeof s.channelA !== "boolean" || typeof s.channelB !== "boolean") {
      throw new Error("\u7535\u5E73\u6A21\u5F0F\u6216\u901A\u9053\u9009\u9879\u65E0\u6548\u3002");
    }
    return { ...s, capA: Math.floor(s.capA), capB: Math.floor(s.capB) };
  }

  // src/global.ts
  var { global: hub, standaloneWindow: window, menu, preferences, console: log } = iina;
  var windowAPI = window;
  var supportsWindowTracking = typeof windowAPI.isOpen === "function";
  var selectedPlayer;
  var sourceTitle = "\u8BF7\u4ECE\u64AD\u653E\u7A97\u53E3\u7684\u63D2\u4EF6\u83DC\u5355\u9009\u62E9\u97F3\u6E90";
  var lastSample;
  var uiReady = false;
  var windowWasOpen = false;
  var settings = { ...DEFAULT_SETTINGS };
  try {
    const stored = preferences.get("settings");
    if (stored) settings = validateSettings(stored);
  } catch {
    log.warn("\u5DF2\u5FFD\u7565\u65E0\u6548\u7684\u5DF2\u4FDD\u5B58\u53C2\u6570\u3002");
  }
  var savedServer = preferences.get("server");
  var server = typeof savedServer === "string" ? savedServer : OFFICIAL_SERVER;
  window.loadFile("dist/ui.html");
  window.setProperty({ title: "\u97F3\u9891\u8054\u52A8", resizable: true });
  window.setFrame(820, 840);
  function initializeUI() {
    window.postMessage("init", { settings, server, sourceTitle, hasSource: !!selectedPlayer, supportsWindowTracking });
    if (lastSample && Date.now() - lastSample.at <= STALE_MS) window.postMessage("audio", lastSample);
  }
  function open() {
    window.open();
    if (uiReady) initializeUI();
  }
  function stop(reason) {
    window.postMessage("stop", { reason });
  }
  menu.addItem(menu.item("\u6253\u5F00\u97F3\u9891\u8054\u52A8\u63A7\u5236\u53F0", open));
  menu.addItem(menu.item("\u505C\u6B62\u90CA\u72FC\u8F93\u51FA", () => stop("\u5DF2\u624B\u52A8\u505C\u6B62")));
  hub.onMessage("select-source", (data, player) => {
    if (!player) return;
    stop("\u97F3\u6E90\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8");
    hub.postMessage(null, "capture", { enabled: false });
    selectedPlayer = player;
    sourceTitle = data.title;
    lastSample = void 0;
    hub.postMessage(player, "capture", { enabled: true });
    open();
  });
  hub.onMessage("audio", (sample, player) => {
    if (player !== selectedPlayer) return;
    lastSample = sample;
    sourceTitle = sample.title;
    if (uiReady) window.postMessage("audio", sample);
  });
  hub.onMessage("source-reset", (data, player) => {
    if (player === selectedPlayer) {
      lastSample = void 0;
      stop(data.reason);
    }
  });
  hub.onMessage("emergency-stop", () => stop("\u5DF2\u901A\u8FC7\u5FEB\u6377\u952E\u505C\u6B62"));
  window.onMessage("ready", () => {
    uiReady = true;
    initializeUI();
  });
  window.onMessage("save", (data) => {
    try {
      settings = validateSettings(data.settings);
      server = data.server;
      preferences.set("settings", settings);
      preferences.set("server", server);
      preferences.sync();
    } catch (error) {
      window.postMessage("error", { message: String(error) });
    }
  });
  setInterval(() => {
    const visible = windowAPI.isOpen?.() ?? false;
    if (windowWasOpen && !visible) stop("\u63A7\u5236\u7A97\u53E3\u5DF2\u5173\u95ED");
    windowWasOpen = visible;
    if (lastSample && Date.now() - lastSample.at > STALE_MS) {
      lastSample = void 0;
      stop("\u97F3\u9891\u91C7\u6837\u5DF2\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8");
    }
  }, 100);
})();
