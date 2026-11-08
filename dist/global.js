"use strict";
(() => {
  // src/shared.ts
  var STALE_MS = 350;
  var OFFICIAL_SERVER = "wss://trex.dungeon-lab.cn/v4";
  var FILTER_LABEL = "iina_dglab";
  var ASTATS_FILTER = "astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level+Zero_crossings_rate:measure_overall=RMS_level+Peak_level";
  var AUDIO_FILTER = `@${FILTER_LABEL}:lavfi=[${ASTATS_FILTER}]`;
  var DEFAULT_SETTINGS = {
    advanceMs: 0,
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
      ["advanceMs", 0, 1e3],
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

  // src/local-relay.ts
  var LocalRelay = class {
    constructor(api) {
      this.api = api;
      this.info = null;
      this.starting = null;
      this.generation = 0;
      this.keepingAlive = false;
    }
    start(nodePath2, scriptPath) {
      if (this.info) return Promise.resolve(this.info.url);
      if (this.starting) return this.starting;
      const generation = ++this.generation;
      const attempt = async () => {
        const candidates = nodePath2.trim() ? [nodePath2.trim()] : ["/opt/homebrew/bin/node", "/usr/local/bin/node"];
        const node = candidates.find((path) => path.startsWith("/") && this.api.utils.fileInPath(path));
        if (!node) throw new Error("\u672A\u627E\u5230 Node.js\u3002\u8BF7\u5B89\u88C5 Node.js 22+\uFF0C\u6216\u5728\u8FDE\u63A5\u8BBE\u7F6E\u4E2D\u586B\u5199 node \u7684\u7EDD\u5BF9\u8DEF\u5F84\u3002");
        if (!scriptPath.startsWith("/") || !scriptPath.endsWith("/dist/relay.cjs") || !this.api.utils.fileInPath(scriptPath)) {
          throw new Error("\u627E\u4E0D\u5230\u63D2\u4EF6\u5185\u7684\u672C\u5730\u4E2D\u7EE7\u7A0B\u5E8F\uFF0C\u8BF7\u91CD\u65B0\u5B89\u88C5\u63D2\u4EF6\u3002");
        }
        const result = await this.api.utils.exec(node, [scriptPath, "--launch"]);
        if (result.status !== 0) throw new Error(result.stderr.trim() || "\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u5931\u8D25\u3002");
        const info = JSON.parse(result.stdout.trim());
        if (!/^ws:\/\/127\.0\.0\.1:\d+\/v4\/[a-f0-9]+$/.test(info.url)) throw new Error("\u672C\u5730\u4E2D\u7EE7\u8FD4\u56DE\u4E86\u65E0\u6548\u7684\u8FDE\u63A5\u5730\u5740\u3002");
        if (generation !== this.generation) {
          await this.post(info.shutdownUrl);
          throw new Error("\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u5DF2\u53D6\u6D88\u3002");
        }
        this.info = info;
        return info.url;
      };
      this.starting = attempt().finally(() => {
        this.starting = null;
      });
      return this.starting;
    }
    async stop() {
      this.generation++;
      const info = this.info;
      this.info = null;
      if (info) {
        try {
          await this.post(info.shutdownUrl);
        } catch {
        }
      }
    }
    async keepAlive() {
      if (!this.info || this.keepingAlive) return;
      this.keepingAlive = true;
      try {
        await this.post(this.info.leaseUrl);
      } finally {
        this.keepingAlive = false;
      }
    }
    async post(url) {
      const response = await this.api.http.post(url, { headers: {}, params: {}, data: {} });
      if (response.statusCode !== 204) throw new Error("\u672C\u5730\u4E2D\u7EE7\u5DF2\u5931\u53BB\u54CD\u5E94\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002");
    }
  };

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
    if (stored) settings = validateSettings({ ...DEFAULT_SETTINGS, ...stored });
  } catch {
    log.warn("\u5DF2\u5FFD\u7565\u65E0\u6548\u7684\u5DF2\u4FDD\u5B58\u53C2\u6570\u3002");
  }
  var savedServer = preferences.get("server");
  var server = typeof savedServer === "string" ? savedServer : OFFICIAL_SERVER;
  var connectionMode = preferences.get("connectionMode") === "local" ? "local" : "remote";
  var nodePath = String(preferences.get("nodePath") || "");
  var relay = new LocalRelay(iina);
  var relayGeneration = 0;
  window.loadFile("dist/ui.html");
  window.setProperty({ title: "\u97F3\u9891\u8054\u52A8", resizable: true });
  window.setFrame(820, 840);
  function initializeUI() {
    window.postMessage("init", { settings, server, connectionMode, nodePath, sourceTitle, hasSource: !!selectedPlayer, supportsWindowTracking });
    if (lastSample && Date.now() - lastSample.at <= STALE_MS) window.postMessage("audio", lastSample);
  }
  function open() {
    window.open();
    if (selectedPlayer) hub.postMessage(selectedPlayer, "capture", { enabled: true });
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
    if (selectedPlayer && selectedPlayer !== player) hub.postMessage(selectedPlayer, "capture", { enabled: false });
    selectedPlayer = player;
    sourceTitle = data.title;
    lastSample = void 0;
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
      connectionMode = data.connectionMode === "local" ? "local" : "remote";
      nodePath = data.nodePath.trim();
      preferences.set("connectionMode", connectionMode);
      preferences.set("nodePath", nodePath);
      preferences.sync();
    } catch (error) {
      window.postMessage("error", { message: String(error) });
    }
  });
  window.onMessage("local-start", async (data) => {
    const generation = ++relayGeneration;
    try {
      const url = await relay.start(data.nodePath, data.scriptPath);
      if (generation === relayGeneration) window.postMessage("local-result", { url });
    } catch (error) {
      if (generation === relayGeneration) window.postMessage("local-result", { error: String(error) });
    }
  });
  window.onMessage("local-stop", () => {
    relayGeneration++;
    void relay.stop();
  });
  setInterval(() => {
    const generation = relayGeneration;
    if (!windowAPI.isOpen?.()) return;
    void relay.keepAlive().catch(() => {
      if (generation !== relayGeneration) return;
      relayGeneration++;
      window.postMessage("disconnect", { reason: "\u672C\u5730\u4E2D\u7EE7\u5DF2\u5931\u53BB\u54CD\u5E94\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5" });
      void relay.stop();
    });
  }, 2e3);
  setInterval(() => {
    const visible = windowAPI.isOpen?.() ?? false;
    if (windowWasOpen && !visible) {
      window.postMessage("disconnect", { reason: "\u63A7\u5236\u7A97\u53E3\u5DF2\u5173\u95ED" });
      if (selectedPlayer) hub.postMessage(selectedPlayer, "capture", { enabled: false });
      lastSample = void 0;
      const generation = ++relayGeneration;
      setTimeout(() => {
        if (generation === relayGeneration) void relay.stop();
      }, 1500);
    }
    windowWasOpen = visible;
    if (lastSample && Date.now() - lastSample.at > STALE_MS) {
      lastSample = void 0;
      window.postMessage("audio-stale", {});
    }
  }, 100);
})();
