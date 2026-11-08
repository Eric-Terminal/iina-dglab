"use strict";
(() => {
  // src/shared.ts
  var SAMPLE_MS = 100;
  var STALE_MS = 350;
  var FILTER_LABEL = "iina_dglab";
  var ASTATS_FILTER = "astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level+Zero_crossings_rate:measure_overall=RMS_level+Peak_level";
  var AUDIO_FILTER = `@${FILTER_LABEL}:lavfi=[${ASTATS_FILTER}]`;
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

  // src/audio-timing.ts
  var AudioTimeline = class {
    constructor() {
      this.text = "";
      this.pending = null;
      this.frames = [];
    }
    reset() {
      this.text = "";
      this.pending = null;
      this.frames = [];
    }
    append(chunk, sampleRate) {
      this.text += chunk;
      let newline;
      while ((newline = this.text.indexOf("\n")) !== -1) {
        const line = this.text.slice(0, newline).trim();
        this.text = this.text.slice(newline + 1);
        const header = /^frame:\s*\d+\s+pts:\s*\S+\s+pts_time:\s*([-\d.e+]+)/.exec(line);
        if (header) {
          const pts = Number(header[1]);
          if (!Number.isFinite(pts)) continue;
          if (this.pending) {
            const features = readFeatures(this.pending.metadata, sampleRate);
            if (pts <= this.pending.pts) this.frames = [];
            else if (features) this.frames.push({ start: this.pending.pts, end: pts, features });
          }
          this.pending = { pts, metadata: {} };
        } else if (this.pending) {
          const equals = line.indexOf("=");
          if (equals > 0) this.pending.metadata[line.slice(0, equals)] = line.slice(equals + 1);
        }
      }
      if (this.frames.length > 2e3) this.frames.splice(0, this.frames.length - 2e3);
    }
    at(position, advanceMs, speed) {
      const target = position + advanceMs * speed / 1e3;
      while (this.frames.length && this.frames[0].end < position - 1) this.frames.shift();
      const frame = this.frames.find((frame2) => frame2.start <= target && target < frame2.end);
      return frame && frame.end - frame.start <= 0.25 ? frame.features : null;
    }
  };
  function timingFilter(path) {
    const option = path.replace(/[\\':]/g, "\\$&");
    const escaped = option.replace(/[\\'\[\],;]/g, "\\$&");
    return `@${FILTER_LABEL}:lavfi=[${ASTATS_FILTER},ametadata=mode=print:file=${escaped}:direct=1]`;
  }

  // src/audio-buffer.ts
  var AudioBuffer = class {
    constructor(mpv2) {
      this.mpv = mpv2;
    }
    update(advanceMs) {
      if (advanceMs === 0 && this.original === void 0) return false;
      const current = this.mpv.getNumber("audio-buffer");
      if (!Number.isFinite(current)) throw new Error("\u65E0\u6CD5\u8BFB\u53D6\u64AD\u653E\u5668\u7684\u97F3\u9891\u7F13\u51B2\u8BBE\u7F6E");
      if (this.original === void 0 || current !== this.applied) this.original = current;
      const desired = advanceMs > 0 ? Math.max(this.original, advanceMs / 1e3 + 0.25) : this.original;
      if (desired !== current) {
        this.mpv.set("audio-buffer", desired);
        if (this.mpv.getNumber("audio-buffer") !== desired) throw new Error("\u65E0\u6CD5\u8C03\u6574\u97F3\u9891\u9884\u8BFB\u7F13\u51B2");
      }
      this.applied = desired;
      if (advanceMs === 0) {
        this.original = void 0;
        this.applied = void 0;
      }
      return desired !== current;
    }
    restore() {
      this.update(0);
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

  // src/main.ts
  var { mpv, event, core, menu, file, utils, preferences, global: hub } = iina;
  setLanguage(preferences.get("language"));
  var capturing = false;
  var seekUntil = 0;
  var lastPosition = -1;
  var lastProgressAt = 0;
  var lastFilterAttempt = -Infinity;
  var filterError = "";
  var stats;
  var statsPath;
  var timeline = new AudioTimeline();
  var audioBuffer = new AudioBuffer(mpv);
  function closeStats() {
    stats?.close();
    stats = void 0;
    if (statsPath && file.exists(statsPath)) file.delete(statsPath);
    statsPath = void 0;
    timeline.reset();
  }
  function installFilter() {
    if (!capturing || core.status.idle) return;
    const filters = mpv.getNative("af") || [];
    const existing = filters.find((filter) => filter.label === FILTER_LABEL);
    if (existing && stats) {
      filterError = existing.enabled === false ? "\u97F3\u9891\u7EDF\u8BA1\u6EE4\u955C\u88AB\u7981\u7528\uFF0C\u8BF7\u5728 IINA \u4E2D\u542F\u7528\u5B83" : "";
      return;
    }
    if (Date.now() - lastFilterAttempt < 1e3) return;
    lastFilterAttempt = Date.now();
    try {
      if (existing) removeFilter();
      closeStats();
      statsPath = `@tmp/audio-stats-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
      file.write(statsPath, "");
      stats = file.handle(statsPath, "read");
      if (!stats) throw new Error("\u65E0\u6CD5\u6253\u5F00\u97F3\u9891\u7EDF\u8BA1\u6587\u4EF6");
      mpv.command("af", ["add", timingFilter(utils.resolvePath(statsPath))]);
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
  function readStats(sampleRate) {
    if (!stats) return;
    const offset = stats.offset();
    stats.seekToEnd();
    const end = stats.offset();
    if (end < offset) {
      timeline.reset();
      stats.seekTo(0);
    } else stats.seekTo(offset);
    if (end > 32 * 1024 * 1024) {
      removeFilter();
      closeStats();
      lastFilterAttempt = -Infinity;
      installFilter();
      return;
    }
    for (let count = 0; count < 32; count++) {
      const bytes = stats.read(8192);
      if (!bytes?.length) break;
      timeline.append(String.fromCharCode(...bytes), sampleRate);
      if (bytes.length < 8192) break;
    }
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
    const empty = { running: false, reason, rmsDb: null, peakDb: null, zcr: null };
    const sample = { at, title: core.status.title || "IINA", ...empty, preview: { ...empty } };
    if (!reason) {
      const params = mpv.getNative("audio-params");
      if (!params?.samplerate) sample.reason = "\u5F53\u524D\u97F3\u8F68\u672A\u63D0\u4F9B PCM \u97F3\u9891\uFF0C\u8BF7\u68C0\u67E5\u97F3\u8F68\u9009\u62E9\u4E0E\u97F3\u9891\u76F4\u901A\u8BBE\u7F6E";
      else {
        installFilter();
        try {
          const audioPosition = mpv.getNative("audio-pts");
          if (typeof audioPosition !== "number" || !Number.isFinite(audioPosition)) {
            sample.reason = "\u6B63\u5728\u7B49\u5F85\u97F3\u9891\u64AD\u653E\u65F6\u949F";
            sample.preview.reason = sample.reason;
            hub.postMessage("audio", sample);
            return;
          }
          const saved = preferences.get("settings");
          const advance = typeof saved?.advanceMs === "number" && Number.isFinite(saved.advanceMs) ? Math.max(0, Math.min(1e3, saved.advanceMs)) : 0;
          if (audioBuffer.update(advance)) {
            timeline.reset();
            stats?.seekToEnd();
            sample.reason = "\u6B63\u5728\u8C03\u6574\u97F3\u9891\u9884\u8BFB\u7F13\u51B2";
            sample.preview.reason = sample.reason;
            hub.postMessage("audio", sample);
            return;
          }
          readStats(params.samplerate);
          const speed = mpv.getNumber("speed");
          const current = speed > 0 ? timeline.at(audioPosition, 0, speed) : null;
          if (!filterError && current) Object.assign(sample.preview, current, { running: true });
          else sample.preview.reason = filterError || "\u6B63\u5728\u7B49\u5F85\u97F3\u9891\u7EDF\u8BA1\uFF0C\u8BF7\u4FDD\u6301\u64AD\u653E";
          const features = speed > 0 ? timeline.at(audioPosition, advance, speed) : null;
          if (!filterError && features) Object.assign(sample, features, { running: true });
          else sample.reason = filterError || (advance > 0 ? "\u97F3\u9891\u9884\u8BFB\u4E0D\u8DB3\uFF0C\u8BF7\u51CF\u5C0F\u63D0\u524D\u91CF\u6216\u7B49\u5F85\u7F13\u51B2" : "\u6B63\u5728\u7B49\u5F85\u97F3\u9891\u7EDF\u8BA1\uFF0C\u8BF7\u4FDD\u6301\u64AD\u653E");
        } catch (error) {
          sample.reason = `\u65E0\u6CD5\u8BFB\u53D6\u97F3\u9891\u7EDF\u8BA1\uFF1A${String(error)}`;
        }
      }
    }
    if (!sample.preview.running && !sample.preview.reason) sample.preview.reason = sample.reason;
    hub.postMessage("audio", sample);
  }
  function capture(enabled) {
    if (capturing === enabled) {
      if (enabled) {
        installFilter();
        publish();
      }
      return;
    }
    capturing = enabled;
    lastPosition = -1;
    lastProgressAt = Date.now();
    lastFilterAttempt = -Infinity;
    if (enabled) {
      installFilter();
      publish();
    } else {
      removeFilter();
      closeStats();
      audioBuffer.restore();
    }
  }
  hub.onMessage("capture", ({ enabled }) => capture(enabled));
  function updateMenu() {
    menu.removeAllItems();
    menu.addItem(menu.item(t("\u6253\u5F00\u97F3\u9891\u8054\u52A8\uFF08\u4F7F\u7528\u5F53\u524D\u7A97\u53E3\uFF09"), () => {
      hub.postMessage("select-source", { title: core.status.title || "IINA" });
      capture(true);
    }));
    menu.addItem(menu.item(t("\u505C\u6B62\u90CA\u72FC\u8F93\u51FA"), () => hub.postMessage("emergency-stop", {}), { keyBinding: "Ctrl+Alt+ESC" }));
  }
  updateMenu();
  hub.onMessage("language", (data) => {
    setLanguage(data.language, data.locale);
    updateMenu();
  });
  event.on("iina.file-loaded", () => {
    if (!capturing) return;
    hub.postMessage("source-reset", { reason: "\u5A92\u4F53\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8" });
    seekUntil = Date.now() + 250;
    removeFilter();
    closeStats();
    lastFilterAttempt = -Infinity;
    installFilter();
    publish();
  });
  event.on("mpv.seek", () => {
    seekUntil = Date.now() + 250;
    timeline.reset();
    stats?.seekToEnd();
    publish("\u6B63\u5728\u5B9A\u4F4D");
  });
  event.on("mpv.playback-restart", () => {
    seekUntil = Date.now() + 150;
  });
  event.on("mpv.end-file", () => {
    if (!capturing) return;
    publish("\u64AD\u653E\u5DF2\u7ED3\u675F");
    hub.postMessage("source-reset", { reason: "\u64AD\u653E\u5DF2\u7ED3\u675F" });
    removeFilter();
    closeStats();
    audioBuffer.restore();
  });
  event.on("mpv.shutdown", () => {
    if (capturing) hub.postMessage("source-reset", { reason: "\u64AD\u653E\u7A97\u53E3\u5DF2\u5173\u95ED" });
    capturing = false;
    closeStats();
  });
  setInterval(() => publish(), SAMPLE_MS);
})();
