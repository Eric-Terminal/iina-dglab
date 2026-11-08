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
    frequencyBalance: 0,
    pulseBalance: 0,
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
      ["frequencyBalance", 0, 255],
      ["pulseBalance", 0, 255],
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
    return { ...s, capA: Math.floor(s.capA), capB: Math.floor(s.capB), frequencyBalance: Math.floor(s.frequencyBalance), pulseBalance: Math.floor(s.pulseBalance) };
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

  // src/bluetooth-helper.ts
  var BluetoothHelper = class {
    constructor(api) {
      this.api = api;
      this.url = null;
      this.session = null;
      this.generation = 0;
      this.starting = false;
      this.polling = false;
    }
    async start(appPath) {
      if (this.starting || this.url) throw new Error("\u84DD\u7259\u52A9\u624B\u5DF2\u542F\u52A8");
      if (!appPath.startsWith("/") || !appPath.endsWith("/dist/CoyoteBluetooth.app") || !this.api.file.exists(`${appPath}/Contents/MacOS/CoyoteBluetooth`)) {
        throw new Error("\u627E\u4E0D\u5230\u84DD\u7259\u52A9\u624B\uFF0C\u8BF7\u91CD\u65B0\u5B89\u88C5\u63D2\u4EF6\u3002");
      }
      const generation = ++this.generation;
      this.starting = true;
      const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const handshake = `@tmp/bluetooth-${session}.json`;
      try {
        const result = await this.api.utils.exec("/usr/bin/open", ["-n", "-g", appPath, "--args", "--handshake", this.api.utils.resolvePath(handshake)]);
        if (result.status !== 0) throw new Error("\u84DD\u7259\u52A9\u624B\u65E0\u6CD5\u542F\u52A8\uFF0C\u8BF7\u68C0\u67E5 macOS \u7684\u9690\u79C1\u4E0E\u5B89\u5168\u6027\u8BBE\u7F6E\u3002");
        const deadline = Date.now() + 7e3;
        while (!this.api.file.exists(handshake) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
        if (!this.api.file.exists(handshake)) throw new Error("\u84DD\u7259\u52A9\u624B\u542F\u52A8\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5 macOS \u662F\u5426\u963B\u6B62\u4E86\u52A9\u624B\u542F\u52A8\u3002");
        const info = JSON.parse(this.api.file.read(handshake) || "{}");
        if (!info.url || !/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}$/.test(info.url)) throw new Error("\u84DD\u7259\u52A9\u624B\u672A\u80FD\u542F\u52A8\u672C\u5730\u8FDE\u63A5\u3002");
        if (generation !== this.generation) {
          await this.post(info.url, "shutdown", {});
          throw new Error("\u84DD\u7259\u8FDE\u63A5\u5DF2\u53D6\u6D88");
        }
        this.url = info.url;
        this.session = session;
        const status = await this.post(info.url, "status", {});
        if (generation !== this.generation) throw new Error("\u84DD\u7259\u8FDE\u63A5\u5DF2\u53D6\u6D88");
        return { session, status };
      } catch (error) {
        if (generation === this.generation) await this.stop();
        throw error;
      } finally {
        this.starting = false;
        if (this.api.file.exists(handshake)) this.api.file.delete(handshake);
      }
    }
    async request(session, method, params) {
      if (!this.url || session !== this.session) throw new Error("\u84DD\u7259\u4F1A\u8BDD\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5");
      if (!["scan", "connect", "configure", "intensity", "pulse", "clear", "status", "disconnect"].includes(method)) throw new Error("\u65E0\u6548\u7684\u84DD\u7259\u8BF7\u6C42");
      return this.post(this.url, method, params);
    }
    async poll() {
      if (!this.url || !this.session || this.polling) return null;
      const session = this.session, url = this.url;
      this.polling = true;
      try {
        const status = await this.post(url, "status", {});
        return session === this.session ? { session, status } : null;
      } catch (error) {
        if (session !== this.session) return null;
        throw error;
      } finally {
        this.polling = false;
      }
    }
    async keepAlive() {
      const url = this.url;
      if (!url) return;
      try {
        await this.post(url, "lease", {});
      } catch (error) {
        if (url === this.url) throw error;
      }
    }
    async stop() {
      this.generation++;
      const url = this.url;
      this.url = null;
      this.session = null;
      if (url) {
        try {
          await this.post(url, "shutdown", {});
        } catch {
        }
      }
    }
    async post(url, method, params) {
      let timer;
      try {
        const response = await Promise.race([
          this.api.http.post(url, { headers: { "Content-Type": "application/json" }, params: {}, data: { method, params } }),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("\u84DD\u7259\u52A9\u624B\u54CD\u5E94\u8D85\u65F6")), 2500);
          })
        ]);
        if (response.statusCode !== 200) throw new Error("\u84DD\u7259\u52A9\u624B\u8FDE\u63A5\u5931\u8D25");
        const data = JSON.parse(response.text);
        if (data.error) throw new Error(`bluetooth:${data.error}`);
        return data.result;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  };

  // src/i18n.ts
  var english = {
    "\u90CA\u72FC\u97F3\u9891\u8054\u52A8": "Coyote Audio Link",
    "\u97F3\u9891\u8054\u52A8": "Audio Link",
    "\u84DD\u7259\u76F4\u8FDE \xB7 \u65E0\u9700 App": "Direct Bluetooth \xB7 No app",
    "\u9644\u8FD1\u7684\u90CA\u72FC 3.0": "Nearby Coyote 3.0 devices",
    "\u70B9\u51FB\u626B\u63CF\u8BBE\u5907": "Click Scan devices",
    "\u91CD\u65B0\u626B\u63CF": "Scan again",
    "\u8FDE\u63A5\u8BBE\u5907": "Connect device",
    "\u626B\u63CF\u8BBE\u5907": "Scan devices",
    "\u9009\u62E9\u9644\u8FD1\u8BBE\u5907": "Select a nearby device",
    "\u5C1A\u672A\u53D1\u73B0\u8BBE\u5907": "No devices found yet",
    "\u7B49\u5F85\u84DD\u7259\u8BBE\u5907\u8FDE\u63A5": "Waiting for Bluetooth device",
    "\u6B63\u5728\u626B\u63CF": "Scanning",
    "\u8BF7\u9009\u62E9\u8BBE\u5907": "Select a device",
    "\u84DD\u7259\u5DF2\u8FDE\u63A5": "Bluetooth connected",
    "\u6B63\u5728\u65AD\u5F00": "Disconnecting",
    "\u84DD\u7259\u8FDE\u63A5\u5F02\u5E38": "Bluetooth error",
    "\u901A\u8FC7\u8FD9\u53F0 Mac \u7684\u84DD\u7259\u8FDE\u63A5\u90CA\u72FC 3.0\uFF0C\u65E0\u9700\u5B98\u65B9 App \u6216\u4E2D\u7EE7\u3002": "Connect Coyote 3.0 through this Mac\u2019s Bluetooth. No official app or relay required.",
    "\u8BF7\u5148\u65AD\u5F00\u5B98\u65B9 App \u5BF9\u8BBE\u5907\u7684\u84DD\u7259\u8FDE\u63A5\uFF0C\u5E76\u5141\u8BB8\u84DD\u7259\u52A9\u624B\u8BBF\u95EE\u84DD\u7259\u3002\u8FDE\u63A5\u540E\u9700\u624B\u52A8\u5F00\u542F\u8054\u52A8\u3002": "Disconnect the device from the official app first and allow Bluetooth access for the helper. Enable Audio Link manually after connecting.",
    "\u76F4\u8FDE\u8BBE\u5907\u6821\u51C6": "Direct connection calibration",
    "\u9891\u7387\u5E73\u8861": "Frequency balance",
    "\u8109\u5BBD\u5E73\u8861": "Pulse-width balance",
    "\u4E24\u901A\u9053\u5171\u7528\u8FD9\u7EC4\u6821\u51C6\uFF0C\u9ED8\u8BA4\u5747\u4E3A 0\u3002\u76F4\u8FDE\u4F1A\u5199\u5165\u63D2\u4EF6\u7684\u901A\u9053\u4E0A\u9650\u4E0E\u6821\u51C6\uFF0C\u8BBE\u5907\u4F1A\u4FDD\u5B58\u8FD9\u4E9B\u503C\u3002": "Both channels use these values, initially 0. Direct connection writes the plugin\u2019s intensity limits and calibration to the device, which stores them.",
    "\u76F4\u8FDE\u4F7F\u7528\u63D2\u4EF6\u8BBE\u7F6E\u7684\u901A\u9053\u4E0A\u9650\uFF1B\u9996\u6B21\u8FDE\u63A5\u4FDD\u6301\u96F6\u8F93\u51FA\u3002": "Direct connection uses the plugin\u2019s intensity limits. Connecting keeps output at zero.",
    "\u7535\u91CF {value}%": "Battery {value}%",
    "\u8BBE\u5907\u5F53\u524D {value} / \u4E0A\u9650 {limit}": "Device intensity {value} / limit {limit}",
    "\u8BF7\u5728 IINA \u63D2\u4EF6\u7A97\u53E3\u4E2D\u542F\u52A8\u84DD\u7259\u76F4\u8FDE\u3002": "Start direct Bluetooth from the IINA plugin window.",
    "\u84DD\u7259\u52A9\u624B\u5DF2\u542F\u52A8": "The Bluetooth helper is already running",
    "\u627E\u4E0D\u5230\u84DD\u7259\u52A9\u624B\uFF0C\u8BF7\u91CD\u65B0\u5B89\u88C5\u63D2\u4EF6\u3002": "The Bluetooth helper is missing. Reinstall the plugin.",
    "\u84DD\u7259\u52A9\u624B\u65E0\u6CD5\u542F\u52A8\uFF0C\u8BF7\u68C0\u67E5 macOS \u7684\u9690\u79C1\u4E0E\u5B89\u5168\u6027\u8BBE\u7F6E\u3002": "The Bluetooth helper could not launch. Check macOS Privacy & Security settings.",
    "\u84DD\u7259\u52A9\u624B\u542F\u52A8\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5 macOS \u662F\u5426\u963B\u6B62\u4E86\u52A9\u624B\u542F\u52A8\u3002": "Bluetooth helper startup timed out. Check whether macOS blocked its launch.",
    "\u84DD\u7259\u52A9\u624B\u672A\u80FD\u542F\u52A8\u672C\u5730\u8FDE\u63A5\u3002": "The Bluetooth helper could not start its local connection.",
    "\u84DD\u7259\u8FDE\u63A5\u5DF2\u53D6\u6D88": "Bluetooth connection cancelled",
    "\u84DD\u7259\u4F1A\u8BDD\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5": "Bluetooth session ended. Reconnect.",
    "\u65E0\u6548\u7684\u84DD\u7259\u8BF7\u6C42": "Invalid Bluetooth request",
    "\u84DD\u7259\u52A9\u624B\u54CD\u5E94\u8D85\u65F6": "Bluetooth helper response timed out",
    "\u84DD\u7259\u52A9\u624B\u8FDE\u63A5\u5931\u8D25": "Bluetooth helper connection failed",
    "\u8BF7\u5728\u7CFB\u7EDF\u8BBE\u7F6E\u4E2D\u5141\u8BB8\u90CA\u72FC\u84DD\u7259\u52A9\u624B\u8BBF\u95EE\u84DD\u7259\u3002": "Allow Coyote Bluetooth to access Bluetooth in System Settings.",
    "\u84DD\u7259\u5DF2\u5173\u95ED\uFF0C\u8BF7\u6253\u5F00\u8FD9\u53F0 Mac \u7684\u84DD\u7259\u3002": "Bluetooth is off. Turn on Bluetooth on this Mac.",
    "\u8FD9\u53F0 Mac \u65E0\u6CD5\u4F7F\u7528\u4F4E\u529F\u8017\u84DD\u7259\u3002": "Bluetooth Low Energy is unavailable on this Mac.",
    "\u84DD\u7259\u6B63\u5728\u91CD\u7F6E\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002": "Bluetooth is resetting. Reconnect.",
    "\u84DD\u7259\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002": "Bluetooth is not ready. Try again shortly.",
    "\u8BBE\u5907\u5DF2\u8FDE\u63A5\uFF0C\u8BF7\u5148\u65AD\u5F00\u3002": "A device is already connected. Disconnect it first.",
    "\u672A\u627E\u5230\u6240\u9009\u8BBE\u5907\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u3002": "The selected device was not found. Scan again.",
    "\u8BBE\u5907\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u786E\u8BA4\u8BBE\u5907\u5DF2\u5F00\u673A\u4E14\u672A\u88AB\u5176\u4ED6 App \u5360\u7528\u3002": "Connection failed. Make sure the device is on and disconnected from other apps.",
    "\u8FDE\u63A5\u8BBE\u5907\u8D85\u65F6\uFF0C\u8BF7\u65AD\u5F00\u5176\u4ED6 App \u540E\u91CD\u8BD5\u3002": "Device connection timed out. Disconnect other apps and try again.",
    "\u8BBE\u5907\u672A\u63D0\u4F9B\u90CA\u72FC 3.0 \u6240\u9700\u7684\u84DD\u7259\u670D\u52A1\u3002": "The device does not provide the required Coyote 3.0 Bluetooth services.",
    "\u65E0\u6CD5\u8BA2\u9605\u8BBE\u5907\u786E\u8BA4\u901A\u77E5\u3002": "Could not subscribe to device acknowledgements.",
    "\u8BBE\u5907\u672A\u786E\u8BA4\u5F52\u96F6\uFF0C\u8FDE\u63A5\u5DF2\u505C\u6B62\u3002": "The device did not confirm zero intensity. Connection stopped.",
    "\u8BBE\u5907\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u5148\u8FDE\u63A5\u3002": "The device is not ready. Connect it first.",
    "\u8BBE\u5907\u5F3A\u5EA6\u786E\u8BA4\u8D85\u65F6\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002": "Device intensity acknowledgement timed out. Direct connection stopped.",
    "\u84DD\u7259\u5199\u5165\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002": "Bluetooth write failed. Direct connection stopped.",
    "\u84DD\u7259\u5199\u5165\u8D85\u65F6\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002": "Bluetooth write timed out. Direct connection stopped.",
    "\u84DD\u7259\u5199\u5165\u961F\u5217\u62E5\u585E\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002": "The Bluetooth write queue is congested. Direct connection stopped.",
    "\u76F4\u8FDE\u53C2\u6570\u65E0\u6548": "Invalid direct connection settings",
    "\u6CE2\u5F62\u6570\u636E\u65E0\u6548": "Invalid waveform data",
    "\u84DD\u7259\u547D\u4EE4\u53C2\u6570\u65E0\u6548": "Invalid Bluetooth command parameters",
    "\u84DD\u7259\u52A9\u624B\u6B63\u5728\u9000\u51FA": "The Bluetooth helper is shutting down",
    "\u8BED\u8A00": "Language",
    "\u8DDF\u968F\u7CFB\u7EDF": "System default",
    "\u672A\u8FDE\u63A5": "Disconnected",
    "\u6B63\u5728\u8FDE\u63A5": "Connecting",
    "\u8FDE\u63A5\u4E2D\u2026": "Connecting\u2026",
    "\u7B49\u5F85 App \u914D\u5BF9": "Waiting for app pairing",
    "App \u5DF2\u8FDE\u63A5": "App connected",
    "\u8FDE\u63A5\u5DF2\u65AD\u5F00": "Connection lost",
    "\u8FDE\u63A5\u90CA\u72FC": "Connect Coyote",
    "\u8FDE\u63A5 App": "Connect app",
    "\u65AD\u5F00\u8FDE\u63A5": "Disconnect",
    "\u8FDE\u63A5\u540E\uFF0C\u7528\u5B98\u65B9 App \u7684 Socket \u63A7\u5236\u626B\u7801\u6216\u7C98\u8D34\u5730\u5740\u914D\u5BF9\u3002": "Pair through Socket Control in the official app using the QR code or address.",
    "\u8FDE\u63A5\u540E\uFF0C\u5C06 Socket \u5730\u5740\u7C98\u8D34\u5230\u540C\u4E00\u53F0 Mac \u7684\u5B98\u65B9 App\u3002": "Paste the Socket address into the official app on this Mac.",
    "\u8FDE\u63A5\u5730\u5740": "Connection address",
    "\u914D\u5BF9\u4E8C\u7EF4\u7801\u4E0E\u8FDE\u63A5\u5730\u5740": "Pairing QR code and address",
    "\u672C\u673A\u8FDE\u63A5\u5730\u5740": "Local connection address",
    "DG-LAB 4 \u2192 Socket \u63A7\u5236 \u2192 \u8FDE\u63A5\u670D\u52A1\u5668": "DG-LAB 4 \u2192 Socket Control \u2192 Connect to server",
    "\u590D\u5236\u4E0B\u65B9\u5730\u5740\u5230\u540C\u4E00\u53F0 Mac \u7684 App\u3002": "Copy this address into the app on this Mac.",
    "\u590D\u5236\u4E0B\u65B9\u5730\u5740\u5230\u540C\u4E00\u53F0 Mac \u7684 App\u3002\u91CD\u65B0\u8FDE\u63A5\u540E\u9700\u4F7F\u7528\u65B0\u5730\u5740\u3002": "Copy this address into the app on this Mac. Reconnecting creates a new address.",
    "\u624B\u673A\u53EF\u626B\u7801\uFF1B\u684C\u9762 App \u53EF\u590D\u5236\u4E0B\u65B9\u5730\u5740\u3002": "Scan with your phone, or paste the address into the desktop app.",
    "Socket \u5730\u5740": "Socket address",
    "\u590D\u5236": "Copy",
    "\u5DF2\u590D\u5236": "Copied",
    "\u8BF7\u6309 \u2318C": "Press \u2318C",
    "\u8FDE\u63A5\u65B9\u5F0F": "Connection method",
    "\u8FDC\u7A0B\u670D\u52A1\u5668 \xB7 \u5B98\u65B9\u6216\u81EA\u5EFA": "Via app \xB7 Remote server",
    "\u672C\u673A\u4E2D\u7EE7 \xB7 \u540C\u4E00\u53F0 Mac": "Via app \xB7 Local relay",
    "\u8FDE\u63A5\u8BBE\u7F6E": "Connection settings",
    "\u81EA\u52A8\u542F\u52A8\u672C\u673A\u4E2D\u7EE7\uFF0C\u9700\u8981 Node.js 22+\u3002\u4EC5\u63A5\u53D7\u8FD9\u53F0 Mac \u7684\u8FDE\u63A5\u3002": "Starts a local relay using Node.js 22+. Accepts connections from this Mac only.",
    "Node.js \u8DEF\u5F84\uFF08\u7559\u7A7A\u81EA\u52A8\u67E5\u627E\uFF09": "Node.js path (leave blank to detect)",
    "V4 WebSocket \u5730\u5740": "V4 WebSocket URL",
    "\u9ED8\u8BA4\u4F7F\u7528\u5B98\u65B9\u4E2D\u7EE7\uFF0C\u4E5F\u53EF\u586B\u5199\u81EA\u5EFA V4 \u670D\u52A1\u5730\u5740\u3002": "Uses the official relay by default. You can enter your own V4 server URL.",
    "\u8F93\u51FA\u8BBE\u5907": "Output device",
    "\u7B49\u5F85 App \u8FDE\u63A5": "Waiting for app",
    "\u7B49\u5F85 App \u4E2D\u7684\u90CA\u72FC 3.0 \u8BBE\u5907": "Waiting for Coyote 3.0 in the app",
    "\u9009\u62E9\u8F93\u51FA\u8BBE\u5907": "Select a device",
    "\u79BB\u7EBF": "Offline",
    "\u5F53\u524D\u97F3\u6E90": "Audio source",
    "\u7B49\u5F85\u97F3\u9891": "Waiting for audio",
    "\u4ECE\u64AD\u653E\u7A97\u53E3\u7684\u63D2\u4EF6\u83DC\u5355\u9009\u62E9\u300C\u6253\u5F00\u97F3\u9891\u8054\u52A8\u300D\u3002": "Choose \u201COpen Audio Link\u201D from the playback window\u2019s Plugins menu.",
    "\u8BF7\u4ECE\u64AD\u653E\u7A97\u53E3\u7684\u63D2\u4EF6\u83DC\u5355\u9009\u62E9\u97F3\u6E90": "Select a source from the playback window\u2019s Plugins menu",
    "\u6700\u8FD1\u5341\u4E8C\u79D2\u7684\u97F3\u9891\u7535\u5E73": "Audio levels over the last twelve seconds",
    "App \u914D\u5BF9\u4E8C\u7EF4\u7801": "App pairing QR code",
    "\u5CF0\u503C": "Peak",
    "\u8FC7\u96F6\u7387": "Zero-crossing rate",
    "48 kHz \u6807\u5EA6": "Normalized to 48 kHz",
    "\u6CE2\u5F62\u9884\u89C8": "Waveform level",
    "\u9884\u89C8\u8DDF\u968F\u5F53\u524D\u64AD\u653E\u65F6\u95F4\uFF1B\u63D0\u524D\u91CF\u4EC5\u7528\u4E8E\u8BBE\u5907\u8F93\u51FA\u3002": "Preview follows the current playback time. Advance applies only to device output.",
    "\u6620\u5C04\u4E0E\u901A\u9053": "Mapping and channels",
    "\u53C2\u6570\u5DF2\u5E94\u7528": "Settings applied",
    "\u4FEE\u6539\u5C1A\u672A\u5E94\u7528": "Unsaved changes",
    "\u7535\u5E73\u6765\u6E90": "Level source",
    "\u52A8\u6001\u6DF7\u5408 \xB7 \u54CD\u5EA6\u4E0E\u8D77\u97F3": "Dynamic \xB7 Level and onset",
    "RMS \xB7 \u5E73\u5747\u54CD\u5EA6": "RMS \xB7 Average level",
    "Peak \xB7 \u77AC\u65F6\u5CF0\u503C": "Peak \xB7 Instantaneous level",
    "\u566A\u58F0\u95E8\u9650": "Noise gate",
    "\u6EE1\u5E45\u7535\u5E73": "Full-scale level",
    "\u6CE2\u5F62\u63D0\u524D\u91CF": "Waveform advance",
    "\u9ED8\u8BA4 0\u3002\u586B 100 \u8868\u793A\u63D0\u524D 100 ms\uFF1B\u82E5\u63D0\u793A\u9884\u8BFB\u4E0D\u8DB3\uFF0C\u8BF7\u51CF\u5C0F\u6570\u503C\u3002": "Default: 0. Enter 100 to advance by 100 ms. Reduce this if audio look-ahead is insufficient.",
    "A \u901A\u9053": "Channel A",
    "B \u901A\u9053": "Channel B",
    "\u5F3A\u5EA6\u4E0A\u9650": "Intensity limit",
    "\u7B49\u5F85 App \u56DE\u4F20\u4E0A\u9650": "Waiting for app limits",
    "\u66F2\u7EBF\u4E0E\u9891\u7387": "Curve and frequency",
    "\u81EA\u9002\u5E94\u5E95\u566A\u95E8\u9650": "Adaptive noise gate",
    "\u54CD\u5E94\u6307\u6570": "Response exponent",
    "\u6CE2\u5F62\u5E45\u5EA6\u4E0A\u9650": "Waveform amplitude limit",
    "\u8FC7\u96F6\u7387\u4E0B\u754C": "ZCR lower bound",
    "\u8FC7\u96F6\u7387\u4E0A\u754C": "ZCR upper bound",
    "\u9AD8\u9891\u7F16\u7801": "High-frequency code",
    "\u4F4E\u9891\u7F16\u7801": "Low-frequency code",
    "\u7F16\u7801\u8D8A\u5C0F\uFF0C\u8109\u51B2\u8D8A\u5BC6\u3002ZCR \u4EC5\u53CD\u6620\u58F0\u97F3\u7279\u5F81\uFF0C\u4E0D\u8BC6\u522B\u58F0\u97F3\u5185\u5BB9\u3002": "Lower codes produce denser pulses. ZCR describes sound characteristics; it does not identify content.",
    "\u5B9E\u9645\u901A\u9053\u5F3A\u5EA6\u4E0D\u4F1A\u8D85\u8FC7 App \u56DE\u4F20\u7684\u4E0A\u9650\u3002": "Channel intensity is limited by the app\u2019s reported limits.",
    "\u5E94\u7528\u53C2\u6570": "Apply settings",
    "\u5C1A\u672A\u5F00\u59CB\u8054\u52A8": "Audio Link is off",
    "\u5F00\u59CB\u8054\u52A8": "Enable Audio Link",
    "\u505C\u6B62\u8F93\u51FA": "Stop output",
    "\u53EF\u4EE5\u5148\u5F00\u542F\u8054\u52A8\u518D\u64AD\u653E\u3002\u6682\u505C\u3001\u9759\u97F3\u3001\u4F4E\u4E8E\u95E8\u9650\u6216\u91C7\u6837\u4E2D\u65AD\u65F6\u5F52\u96F6\uFF0C\u97F3\u9891\u6062\u590D\u540E\u81EA\u52A8\u7EE7\u7EED\u3002\u5173\u95ED\u63A7\u5236\u53F0\u3001\u5207\u6362\u5A92\u4F53\u6216\u65AD\u8FDE\u540E\u9700\u91CD\u65B0\u5F00\u542F\u3002": "You can enable Audio Link before playback. Pausing, muting, quiet audio or missing samples stops output; fresh audio resumes it. Re-enable after closing this window, changing media or disconnecting.",
    "\u6253\u5F00\u97F3\u9891\u8054\u52A8\uFF08\u4F7F\u7528\u5F53\u524D\u7A97\u53E3\uFF09": "Open Audio Link (use this window)",
    "\u6253\u5F00\u97F3\u9891\u8054\u52A8\u63A7\u5236\u53F0": "Open Audio Link controls",
    "\u505C\u6B62\u90CA\u72FC\u8F93\u51FA": "Stop Coyote output",
    "\u5DF2\u624B\u52A8\u505C\u6B62": "Stopped manually",
    "\u97F3\u6E90\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8": "Source changed. Enable Audio Link again.",
    "\u5DF2\u901A\u8FC7\u5FEB\u6377\u952E\u505C\u6B62": "Stopped with keyboard shortcut",
    "\u63A7\u5236\u7A97\u53E3\u5DF2\u5173\u95ED": "Control window closed",
    "\u5DF2\u65AD\u5F00\u8FDE\u63A5": "Disconnected",
    "\u8FDE\u63A5\u53D1\u751F\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5 App": "Connection error. Check the app.",
    "\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u5E76\u5F00\u59CB\u8054\u52A8": "Connection lost. Reconnect and enable Audio Link again.",
    "\u8BF7\u9009\u62E9\u5728\u7EBF\u7684\u90CA\u72FC 3.0\u3002": "Select a connected Coyote 3.0.",
    "\u5F53\u524D IINA \u7F3A\u5C11\u63A7\u5236\u7A97\u53E3\u72B6\u6001\u63A5\u53E3\uFF0C\u8BF7\u5347\u7EA7 IINA \u540E\u4F7F\u7528\u8054\u52A8\u3002": "This IINA version cannot track the control window. Update IINA to use Audio Link.",
    "\u8BF7\u5728 IINA \u7684\u63D2\u4EF6\u63A7\u5236\u7A97\u53E3\u4E2D\u6253\u5F00\u6B64\u9875\u9762\u3002": "Open this page in IINA\u2019s plugin control window.",
    "\u8BF7\u8F93\u5165 V4 \u63A7\u5236\u7AEF ws:// \u6216 wss:// \u5730\u5740\uFF0C\u4E0D\u8981\u5E26\u914D\u5BF9 ID\u3001\u7528\u6237\u540D\u6216\u7247\u6BB5\u3002": "Enter a V4 controller ws:// or wss:// URL without a pairing ID, username or fragment.",
    "\u8BF7\u5728 IINA \u63D2\u4EF6\u7A97\u53E3\u4E2D\u542F\u52A8\u672C\u673A\u4E2D\u7EE7\u3002": "Start the local relay from the IINA plugin window.",
    "\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5 Node.js \u8DEF\u5F84\u3002": "Local relay startup timed out. Check the Node.js path.",
    "\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u5931\u8D25\u3002": "Local relay failed to start.",
    "\u672A\u627E\u5230 Node.js\u3002\u8BF7\u5B89\u88C5 Node.js 22+\uFF0C\u6216\u5728\u8FDE\u63A5\u8BBE\u7F6E\u4E2D\u586B\u5199 node \u7684\u7EDD\u5BF9\u8DEF\u5F84\u3002": "Node.js was not found. Install Node.js 22+ or enter its absolute path in connection settings.",
    "\u627E\u4E0D\u5230\u63D2\u4EF6\u5185\u7684\u672C\u5730\u4E2D\u7EE7\u7A0B\u5E8F\uFF0C\u8BF7\u91CD\u65B0\u5B89\u88C5\u63D2\u4EF6\u3002": "The bundled local relay is missing. Reinstall the plugin.",
    "\u672C\u5730\u4E2D\u7EE7\u8FD4\u56DE\u4E86\u65E0\u6548\u7684\u8FDE\u63A5\u5730\u5740\u3002": "The local relay returned an invalid address.",
    "\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u5DF2\u53D6\u6D88\u3002": "Local relay startup was cancelled.",
    "\u672C\u5730\u4E2D\u7EE7\u5DF2\u5931\u53BB\u54CD\u5E94\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002": "The local relay stopped responding. Reconnect.",
    "\u672C\u5730\u4E2D\u7EE7\u5DF2\u5931\u53BB\u54CD\u5E94\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5": "The local relay stopped responding. Reconnect.",
    "\u8BBE\u5907\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8": "Device changed. Enable Audio Link again.",
    "\u8BBE\u5907\u5DF2\u79BB\u7EBF": "Device disconnected",
    "\u53C2\u6570\u5DF2\u5E94\u7528\uFF0C\u7EE7\u7EED\u8054\u52A8": "Settings applied; Audio Link remains enabled",
    "\u4E0A\u6B21\u505C\u6B62\u64CD\u4F5C\u672A\u83B7\u786E\u8BA4\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u5907\u8FDE\u63A5\u540E\u65AD\u5F00\u5E76\u91CD\u65B0\u8FDE\u63A5\u3002": "The last stop was not acknowledged. Check the device connection, then disconnect and reconnect.",
    "\u8BF7\u5148\u8FDE\u63A5\u5E76\u9009\u62E9\u5728\u7EBF\u7684\u90CA\u72FC 3.0\u3002": "Connect and select an online Coyote 3.0 first.",
    "\u8BF7\u8BBE\u7F6E\u81F3\u5C11\u4E00\u4E2A\u901A\u9053\u7684\u975E\u96F6\u5F3A\u5EA6\u4E0A\u9650\uFF0C\u5E76\u68C0\u67E5\u8BBE\u5907\u901A\u9053\u72B6\u6001\u3002": "Set a positive intensity limit for at least one channel and check its connection limits.",
    "\u8054\u52A8\u5DF2\u5C31\u7EEA": "Audio Link is ready",
    "\u8054\u52A8\u5DF2\u5F00\u542F\uFF0C\u7B49\u5F85\u97F3\u9891": "Audio Link enabled; waiting for audio",
    "\u6240\u9009\u901A\u9053\u4E0D\u53EF\u8F93\u51FA\uFF0C\u8BF7\u68C0\u67E5\u4E0A\u9650\u548C\u9759\u97F3\u72B6\u6001": "Selected channels cannot output. Check intensity limits and mute state.",
    "\u901A\u9053\u72B6\u6001\u5DF2\u6539\u53D8": "Channel state changed",
    "\u6B63\u5728\u8DDF\u968F\u97F3\u9891": "Following audio",
    "\u4F4E\u4E8E\u566A\u58F0\u95E8\u9650": "Below noise gate",
    "\u97F3\u9891\u7EDF\u8BA1\u4E0D\u53EF\u7528": "Audio statistics unavailable",
    "\u8054\u52A8\u5DF2\u5F00\u542F\uFF0C\u7B49\u5F85\u97F3\u9891\u6062\u590D": "Audio Link enabled; waiting for fresh audio",
    "\u5DF2\u505C\u6B62\u8054\u52A8": "Audio Link is off",
    "\u505C\u6B62\u6307\u4EE4\u672A\u83B7\u786E\u8BA4\uFF0C\u8BF7\u68C0\u67E5 App\uFF1B\u672C\u6B21\u6CE2\u5F62\u4E0E\u4E34\u65F6\u5F3A\u5EA6\u4EFB\u52A1\u6709\u65F6\u9650": "Stop was not acknowledged. Check the connection; waveform and temporary intensity tasks have time limits.",
    "\u53C2\u6570\u5C1A\u672A\u5E94\u7528\uFF0C\u8BF7\u5148\u70B9\u300C\u5E94\u7528\u53C2\u6570\u300D\u3002": "Changes are pending. Click \u201CApply settings\u201D.",
    "\u8054\u52A8\u5DF2\u5F00\u542F": "Audio Link enabled",
    "\u6B63\u5728\u51C6\u5907\u2026": "Preparing\u2026",
    "\u8BF7\u5148\u5E94\u7528\u53C2\u6570": "Apply settings first",
    "\u5173\u95ED": "Closed",
    "\u901A\u8FC7": "Open",
    "\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u88AB\u7981\u7528\uFF0C\u8BF7\u5728 IINA \u4E2D\u542F\u7528\u5B83": "The audio statistics filter is disabled. Enable it in IINA.",
    "\u65E0\u6CD5\u6253\u5F00\u97F3\u9891\u7EDF\u8BA1\u6587\u4EF6": "Cannot open the audio statistics file",
    "\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u6302\u8F7D\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63D2\u4EF6\u5F00\u53D1\u8005\u5DE5\u5177": "Could not attach the audio statistics filter. Check the plugin developer tools.",
    "\u5C1A\u672A\u64AD\u653E\u5A92\u4F53": "No media loaded",
    "\u64AD\u653E\u5DF2\u6682\u505C": "Playback paused",
    "\u64AD\u653E\u5668\u5DF2\u9759\u97F3": "Player muted",
    "\u6B63\u5728\u7F13\u51B2\u6216\u5B9A\u4F4D": "Buffering or seeking",
    "\u64AD\u653E\u5DF2\u7ED3\u675F": "Playback ended",
    "\u64AD\u653E\u8FDB\u5EA6\u672A\u66F4\u65B0": "Playback clock has stalled",
    "\u5F53\u524D\u97F3\u8F68\u672A\u63D0\u4F9B PCM \u97F3\u9891\uFF0C\u8BF7\u68C0\u67E5\u97F3\u8F68\u9009\u62E9\u4E0E\u97F3\u9891\u76F4\u901A\u8BBE\u7F6E": "No PCM audio is available. Check the audio track and passthrough settings.",
    "\u6B63\u5728\u7B49\u5F85\u97F3\u9891\u64AD\u653E\u65F6\u949F": "Waiting for the audio playback clock",
    "\u6B63\u5728\u8C03\u6574\u97F3\u9891\u9884\u8BFB\u7F13\u51B2": "Adjusting audio look-ahead buffer",
    "\u97F3\u9891\u9884\u8BFB\u4E0D\u8DB3\uFF0C\u8BF7\u51CF\u5C0F\u63D0\u524D\u91CF\u6216\u7B49\u5F85\u7F13\u51B2": "Insufficient audio look-ahead. Reduce advance or wait for buffering.",
    "\u6B63\u5728\u7B49\u5F85\u97F3\u9891\u7EDF\u8BA1\uFF0C\u8BF7\u4FDD\u6301\u64AD\u653E": "Waiting for audio statistics. Keep playback running.",
    "\u5A92\u4F53\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8": "Media changed. Enable Audio Link again.",
    "\u6B63\u5728\u5B9A\u4F4D": "Seeking",
    "\u64AD\u653E\u7A97\u53E3\u5DF2\u5173\u95ED": "Playback window closed",
    "\u65E0\u6CD5\u8BFB\u53D6\u64AD\u653E\u5668\u7684\u97F3\u9891\u7F13\u51B2\u8BBE\u7F6E": "Cannot read the player\u2019s audio buffer setting",
    "\u65E0\u6CD5\u8C03\u6574\u97F3\u9891\u9884\u8BFB\u7F13\u51B2": "Cannot adjust audio look-ahead buffer",
    "\u53C2\u6570\u683C\u5F0F\u65E0\u6548\u3002": "Invalid settings format.",
    "\u566A\u58F0\u95E8\u9650\u5FC5\u987B\u4F4E\u4E8E\u6EE1\u5E45\u7535\u5E73\u3002": "The noise gate must be below the full-scale level.",
    "\u8FC7\u96F6\u7387\u4E0B\u754C\u5FC5\u987B\u5C0F\u4E8E\u4E0A\u754C\u3002": "The ZCR lower bound must be below the upper bound.",
    "\u9891\u7387\u7F16\u7801\u4E0B\u754C\u4E0D\u80FD\u5927\u4E8E\u4E0A\u754C\u3002": "The lower frequency code cannot exceed the upper code.",
    "\u7535\u5E73\u6A21\u5F0F\u6216\u901A\u9053\u9009\u9879\u65E0\u6548\u3002": "Invalid level mode or channel options.",
    "App \u5F53\u524D {value} / \u4E0A\u9650 {limit}": "App intensity {value} / limit {limit}",
    "\u95E8\u9650 {value} dBFS \xB7 {state}": "Gate {value} dBFS \xB7 {state}",
    "\u53C2\u6570 {name} \u5FC5\u987B\u5728 {min}\uFF5E{max} \u4E4B\u95F4\u3002": "{name} must be between {min} and {max}.",
    "\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u6302\u8F7D\u5931\u8D25\uFF1A{error}": "Could not attach the audio statistics filter: {error}",
    "\u65E0\u6CD5\u8BFB\u53D6\u97F3\u9891\u7EDF\u8BA1\uFF1A{error}": "Cannot read audio statistics: {error}",
    "App \u6307\u4EE4\u5931\u8D25\uFF1A{error}": "Device command failed: {error}",
    "\u8BBE\u7F6E\u4E34\u65F6\u5F3A\u5EA6": "Set temporary intensity",
    "\u53D1\u9001\u6CE2\u5F62": "Send waveform",
    "\u6E05\u9664\u4EFB\u52A1": "Clear tasks",
    "\u5F52\u96F6\u5F3A\u5EA6": "Reset intensity",
    "\u8BBE\u5907\u6307\u4EE4\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u8BE6\u60C5": "Device command failed. See details below.",
    "\u505C\u6B62\u6307\u4EE4\u672A\u83B7\u786E\u8BA4\uFF0C\u8BF7\u65AD\u5F00\u5E76\u91CD\u65B0\u8FDE\u63A5\uFF1B\u8BE6\u60C5\u89C1\u4E0B\u65B9": "Stop was not acknowledged. Disconnect and reconnect; see details below.",
    "\u89E6\u53D1\u539F\u56E0\uFF1A{reason}": "Triggered by: {reason}",
    "{channel} \u901A\u9053 \xB7 {command}\uFF1A{error}": "Channel {channel} \xB7 {command}: {error}",
    "\u7B49\u5F85\u54CD\u5E94\u8D85\u65F6": "Response timed out",
    "\u88AB\u63A7\u65B9\u5DF2\u65AD\u5F00": "The controlled app disconnected",
    "WebSocket \u5DF2\u65AD\u5F00": "WebSocket disconnected",
    "{name}: \u7B49\u5F85\u54CD\u5E94\u8D85\u65F6": "{name}: Response timed out",
    "{name}: \u88AB\u63A7\u65B9\u5DF2\u65AD\u5F00": "{name}: The controlled app disconnected"
  };
  var locale = "zh-CN";
  var bluetoothErrors = {
    "bluetooth-denied": "\u8BF7\u5728\u7CFB\u7EDF\u8BBE\u7F6E\u4E2D\u5141\u8BB8\u90CA\u72FC\u84DD\u7259\u52A9\u624B\u8BBF\u95EE\u84DD\u7259\u3002",
    "bluetooth-off": "\u84DD\u7259\u5DF2\u5173\u95ED\uFF0C\u8BF7\u6253\u5F00\u8FD9\u53F0 Mac \u7684\u84DD\u7259\u3002",
    "bluetooth-unsupported": "\u8FD9\u53F0 Mac \u65E0\u6CD5\u4F7F\u7528\u4F4E\u529F\u8017\u84DD\u7259\u3002",
    "bluetooth-reset": "\u84DD\u7259\u6B63\u5728\u91CD\u7F6E\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
    "bluetooth-unavailable": "\u84DD\u7259\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    "already-connected": "\u8BBE\u5907\u5DF2\u8FDE\u63A5\uFF0C\u8BF7\u5148\u65AD\u5F00\u3002",
    "device-not-found": "\u672A\u627E\u5230\u6240\u9009\u8BBE\u5907\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u3002",
    "device-connect-failed": "\u8BBE\u5907\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u786E\u8BA4\u8BBE\u5907\u5DF2\u5F00\u673A\u4E14\u672A\u88AB\u5176\u4ED6 App \u5360\u7528\u3002",
    "device-connect-timeout": "\u8FDE\u63A5\u8BBE\u5907\u8D85\u65F6\uFF0C\u8BF7\u65AD\u5F00\u5176\u4ED6 App \u540E\u91CD\u8BD5\u3002",
    "device-incompatible": "\u8BBE\u5907\u672A\u63D0\u4F9B\u90CA\u72FC 3.0 \u6240\u9700\u7684\u84DD\u7259\u670D\u52A1\u3002",
    "device-notify-failed": "\u65E0\u6CD5\u8BA2\u9605\u8BBE\u5907\u786E\u8BA4\u901A\u77E5\u3002",
    "device-zero-failed": "\u8BBE\u5907\u672A\u786E\u8BA4\u5F52\u96F6\uFF0C\u8FDE\u63A5\u5DF2\u505C\u6B62\u3002",
    "device-not-ready": "\u8BBE\u5907\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u5148\u8FDE\u63A5\u3002",
    "device-ack-timeout": "\u8BBE\u5907\u5F3A\u5EA6\u786E\u8BA4\u8D85\u65F6\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002",
    "device-write-failed": "\u84DD\u7259\u5199\u5165\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002",
    "device-write-timeout": "\u84DD\u7259\u5199\u5165\u8D85\u65F6\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002",
    "device-write-overflow": "\u84DD\u7259\u5199\u5165\u961F\u5217\u62E5\u585E\uFF0C\u5DF2\u505C\u6B62\u76F4\u8FDE\u3002",
    "invalid-settings": "\u76F4\u8FDE\u53C2\u6570\u65E0\u6548",
    "invalid-frame": "\u6CE2\u5F62\u6570\u636E\u65E0\u6548",
    "invalid-command": "\u84DD\u7259\u547D\u4EE4\u53C2\u6570\u65E0\u6548",
    "unknown-method": "\u65E0\u6548\u7684\u84DD\u7259\u8BF7\u6C42",
    "helper-stopping": "\u84DD\u7259\u52A9\u624B\u6B63\u5728\u9000\u51FA"
  };
  function resolveLanguage(value, systemLocale) {
    if (value === "en" || value === "zh-CN") return value;
    return systemLocale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  }
  function setLanguage(value, systemLocale = Intl.DateTimeFormat().resolvedOptions().locale) {
    locale = resolveLanguage(value, systemLocale);
    return locale;
  }
  var patterns = Object.entries(english).filter(([key]) => key.includes("{")).map(([key, value]) => {
    const fields = [];
    const escaped = key.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_, field) => {
      fields.push(field);
      return "(.*?)";
    });
    return { pattern: new RegExp(`^${escaped}$`), value, fields };
  });
  function t(message) {
    message = message.replace(/bluetooth:([a-z-]+)/g, (source, code) => bluetoothErrors[code] || source);
    if (locale === "zh-CN") return message;
    if (english[message]) return english[message];
    if (message.includes("\n")) return message.split("\n").map(t).join("\n");
    if (message.startsWith("Error: ")) return `Error: ${t(message.slice(7))}`;
    for (const { pattern, value, fields } of patterns) {
      const match = pattern.exec(message);
      if (match) return value.replace(/\{(\w+)\}/g, (_, field) => t(match[fields.indexOf(field) + 1]));
    }
    return message;
  }

  // src/global.ts
  var { global: hub, standaloneWindow: window, menu, preferences, console: log } = iina;
  var windowAPI = window;
  var supportsWindowTracking = typeof windowAPI.isOpen === "function";
  var language = ["zh-CN", "en"].includes(preferences.get("language")) ? preferences.get("language") : "system";
  setLanguage(language);
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
  var connectionMode = ["local", "bluetooth"].includes(preferences.get("connectionMode")) ? preferences.get("connectionMode") : "remote";
  var nodePath = String(preferences.get("nodePath") || "");
  var relay = new LocalRelay(iina);
  var bluetooth = new BluetoothHelper(iina);
  var relayGeneration = 0;
  window.loadFile("dist/ui.html");
  window.setProperty({ title: t("\u97F3\u9891\u8054\u52A8"), resizable: true });
  window.setFrame(820, 840);
  function initializeUI() {
    window.postMessage("init", { language, settings, server, connectionMode, nodePath, sourceTitle, hasSource: !!selectedPlayer, supportsWindowTracking });
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
  function updateMenu() {
    menu.removeAllItems();
    menu.addItem(menu.item(t("\u6253\u5F00\u97F3\u9891\u8054\u52A8\u63A7\u5236\u53F0"), open));
    menu.addItem(menu.item(t("\u505C\u6B62\u90CA\u72FC\u8F93\u51FA"), () => stop("\u5DF2\u624B\u52A8\u505C\u6B62")));
  }
  updateMenu();
  window.onMessage("language", (data) => {
    language = ["zh-CN", "en"].includes(data.language) ? data.language : "system";
    setLanguage(language, data.locale);
    preferences.set("language", language);
    preferences.sync();
    window.setProperty({ title: t("\u97F3\u9891\u8054\u52A8") });
    updateMenu();
    if (selectedPlayer) hub.postMessage(selectedPlayer, "language", { language, locale: data.locale });
  });
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
      connectionMode = ["local", "bluetooth"].includes(data.connectionMode) ? data.connectionMode : "remote";
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
  window.onMessage("bluetooth", async (data) => {
    try {
      let result;
      if (data.method === "start") result = await bluetooth.start(String(data.params.appPath || ""));
      else if (data.method === "stop") {
        await bluetooth.stop();
        result = {};
      } else result = await bluetooth.request(data.session, data.method, data.params);
      window.postMessage("bluetooth-result", { id: data.id, result });
    } catch (error) {
      window.postMessage("bluetooth-result", { id: data.id, error: error instanceof Error ? error.message : String(error) });
    }
  });
  setInterval(() => {
    if (!windowAPI.isOpen?.()) return;
    void bluetooth.poll().then((result) => {
      if (result) window.postMessage("bluetooth-status", result);
    }).catch((error) => {
      window.postMessage("disconnect", { reason: String(error) });
      void bluetooth.stop();
    });
  }, 500);
  setInterval(() => {
    const generation = relayGeneration;
    if (!windowAPI.isOpen?.()) return;
    void bluetooth.keepAlive().catch((error) => {
      window.postMessage("disconnect", { reason: String(error) });
      void bluetooth.stop();
    });
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
        if (generation === relayGeneration) {
          void relay.stop();
          void bluetooth.stop();
        }
      }, 1500);
    }
    windowWasOpen = visible;
    if (lastSample && Date.now() - lastSample.at > STALE_MS) {
      lastSample = void 0;
      window.postMessage("audio-stale", {});
    }
  }, 100);
})();
