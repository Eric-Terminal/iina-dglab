"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/eventemitter3/index.js
  var require_eventemitter3 = __commonJS({
    "node_modules/eventemitter3/index.js"(exports, module) {
      "use strict";
      var has = Object.prototype.hasOwnProperty;
      var prefix = "~";
      function Events() {
      }
      if (Object.create) {
        Events.prototype = /* @__PURE__ */ Object.create(null);
        if (!new Events().__proto__) prefix = false;
      }
      function EE(fn, context, once) {
        this.fn = fn;
        this.context = context;
        this.once = once || false;
      }
      function addListener(emitter, event, fn, context, once) {
        if (typeof fn !== "function") {
          throw new TypeError("The listener must be a function");
        }
        var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
        if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
        else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
        else emitter._events[evt] = [emitter._events[evt], listener];
        return emitter;
      }
      function clearEvent(emitter, evt) {
        if (--emitter._eventsCount === 0) emitter._events = new Events();
        else delete emitter._events[evt];
      }
      function EventEmitter2() {
        this._events = new Events();
        this._eventsCount = 0;
      }
      EventEmitter2.prototype.eventNames = function eventNames() {
        var names = [], events, name;
        if (this._eventsCount === 0) return names;
        for (name in events = this._events) {
          if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
        }
        if (Object.getOwnPropertySymbols) {
          return names.concat(Object.getOwnPropertySymbols(events));
        }
        return names;
      };
      EventEmitter2.prototype.listeners = function listeners(event) {
        var evt = prefix ? prefix + event : event, handlers = this._events[evt];
        if (!handlers) return [];
        if (handlers.fn) return [handlers.fn];
        for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
          ee[i] = handlers[i].fn;
        }
        return ee;
      };
      EventEmitter2.prototype.listenerCount = function listenerCount(event) {
        var evt = prefix ? prefix + event : event, listeners = this._events[evt];
        if (!listeners) return 0;
        if (listeners.fn) return 1;
        return listeners.length;
      };
      EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt]) return false;
        var listeners = this._events[evt], len = arguments.length, args, i;
        if (listeners.fn) {
          if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
          switch (len) {
            case 1:
              return listeners.fn.call(listeners.context), true;
            case 2:
              return listeners.fn.call(listeners.context, a1), true;
            case 3:
              return listeners.fn.call(listeners.context, a1, a2), true;
            case 4:
              return listeners.fn.call(listeners.context, a1, a2, a3), true;
            case 5:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
            case 6:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
          }
          for (i = 1, args = new Array(len - 1); i < len; i++) {
            args[i - 1] = arguments[i];
          }
          listeners.fn.apply(listeners.context, args);
        } else {
          var length = listeners.length, j;
          for (i = 0; i < length; i++) {
            if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
            switch (len) {
              case 1:
                listeners[i].fn.call(listeners[i].context);
                break;
              case 2:
                listeners[i].fn.call(listeners[i].context, a1);
                break;
              case 3:
                listeners[i].fn.call(listeners[i].context, a1, a2);
                break;
              case 4:
                listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                break;
              default:
                if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                  args[j - 1] = arguments[j];
                }
                listeners[i].fn.apply(listeners[i].context, args);
            }
          }
        }
        return true;
      };
      EventEmitter2.prototype.on = function on(event, fn, context) {
        return addListener(this, event, fn, context, false);
      };
      EventEmitter2.prototype.once = function once(event, fn, context) {
        return addListener(this, event, fn, context, true);
      };
      EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt]) return this;
        if (!fn) {
          clearEvent(this, evt);
          return this;
        }
        var listeners = this._events[evt];
        if (listeners.fn) {
          if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
            clearEvent(this, evt);
          }
        } else {
          for (var i = 0, events = [], length = listeners.length; i < length; i++) {
            if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
              events.push(listeners[i]);
            }
          }
          if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
          else clearEvent(this, evt);
        }
        return this;
      };
      EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
        var evt;
        if (event) {
          evt = prefix ? prefix + event : event;
          if (this._events[evt]) clearEvent(this, evt);
        } else {
          this._events = new Events();
          this._eventsCount = 0;
        }
        return this;
      };
      EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
      EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
      EventEmitter2.prefixed = prefix;
      EventEmitter2.EventEmitter = EventEmitter2;
      if ("undefined" !== typeof module) {
        module.exports = EventEmitter2;
      }
    }
  });

  // node_modules/qrcode/lib/can-promise.js
  var require_can_promise = __commonJS({
    "node_modules/qrcode/lib/can-promise.js"(exports, module) {
      module.exports = function() {
        return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
      };
    }
  });

  // node_modules/qrcode/lib/core/utils.js
  var require_utils = __commonJS({
    "node_modules/qrcode/lib/core/utils.js"(exports) {
      var toSJISFunction;
      var CODEWORDS_COUNT = [
        0,
        // Not used
        26,
        44,
        70,
        100,
        134,
        172,
        196,
        242,
        292,
        346,
        404,
        466,
        532,
        581,
        655,
        733,
        815,
        901,
        991,
        1085,
        1156,
        1258,
        1364,
        1474,
        1588,
        1706,
        1828,
        1921,
        2051,
        2185,
        2323,
        2465,
        2611,
        2761,
        2876,
        3034,
        3196,
        3362,
        3532,
        3706
      ];
      exports.getSymbolSize = function getSymbolSize(version) {
        if (!version) throw new Error('"version" cannot be null or undefined');
        if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
        return version * 4 + 17;
      };
      exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
        return CODEWORDS_COUNT[version];
      };
      exports.getBCHDigit = function(data) {
        let digit = 0;
        while (data !== 0) {
          digit++;
          data >>>= 1;
        }
        return digit;
      };
      exports.setToSJISFunction = function setToSJISFunction(f) {
        if (typeof f !== "function") {
          throw new Error('"toSJISFunc" is not a valid function.');
        }
        toSJISFunction = f;
      };
      exports.isKanjiModeEnabled = function() {
        return typeof toSJISFunction !== "undefined";
      };
      exports.toSJIS = function toSJIS(kanji) {
        return toSJISFunction(kanji);
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-level.js
  var require_error_correction_level = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-level.js"(exports) {
      exports.L = { bit: 1 };
      exports.M = { bit: 0 };
      exports.Q = { bit: 3 };
      exports.H = { bit: 2 };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "l":
          case "low":
            return exports.L;
          case "m":
          case "medium":
            return exports.M;
          case "q":
          case "quartile":
            return exports.Q;
          case "h":
          case "high":
            return exports.H;
          default:
            throw new Error("Unknown EC Level: " + string);
        }
      }
      exports.isValid = function isValid(level) {
        return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
      };
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/bit-buffer.js
  var require_bit_buffer = __commonJS({
    "node_modules/qrcode/lib/core/bit-buffer.js"(exports, module) {
      function BitBuffer() {
        this.buffer = [];
        this.length = 0;
      }
      BitBuffer.prototype = {
        get: function(index) {
          const bufIndex = Math.floor(index / 8);
          return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
        },
        put: function(num, length) {
          for (let i = 0; i < length; i++) {
            this.putBit((num >>> length - i - 1 & 1) === 1);
          }
        },
        getLengthInBits: function() {
          return this.length;
        },
        putBit: function(bit) {
          const bufIndex = Math.floor(this.length / 8);
          if (this.buffer.length <= bufIndex) {
            this.buffer.push(0);
          }
          if (bit) {
            this.buffer[bufIndex] |= 128 >>> this.length % 8;
          }
          this.length++;
        }
      };
      module.exports = BitBuffer;
    }
  });

  // node_modules/qrcode/lib/core/bit-matrix.js
  var require_bit_matrix = __commonJS({
    "node_modules/qrcode/lib/core/bit-matrix.js"(exports, module) {
      function BitMatrix(size) {
        if (!size || size < 1) {
          throw new Error("BitMatrix size must be defined and greater than 0");
        }
        this.size = size;
        this.data = new Uint8Array(size * size);
        this.reservedBit = new Uint8Array(size * size);
      }
      BitMatrix.prototype.set = function(row, col, value, reserved) {
        const index = row * this.size + col;
        this.data[index] = value;
        if (reserved) this.reservedBit[index] = true;
      };
      BitMatrix.prototype.get = function(row, col) {
        return this.data[row * this.size + col];
      };
      BitMatrix.prototype.xor = function(row, col, value) {
        this.data[row * this.size + col] ^= value;
      };
      BitMatrix.prototype.isReserved = function(row, col) {
        return this.reservedBit[row * this.size + col];
      };
      module.exports = BitMatrix;
    }
  });

  // node_modules/qrcode/lib/core/alignment-pattern.js
  var require_alignment_pattern = __commonJS({
    "node_modules/qrcode/lib/core/alignment-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      exports.getRowColCoords = function getRowColCoords(version) {
        if (version === 1) return [];
        const posCount = Math.floor(version / 7) + 2;
        const size = getSymbolSize(version);
        const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
        const positions = [size - 7];
        for (let i = 1; i < posCount - 1; i++) {
          positions[i] = positions[i - 1] - intervals;
        }
        positions.push(6);
        return positions.reverse();
      };
      exports.getPositions = function getPositions(version) {
        const coords = [];
        const pos = exports.getRowColCoords(version);
        const posLength = pos.length;
        for (let i = 0; i < posLength; i++) {
          for (let j = 0; j < posLength; j++) {
            if (i === 0 && j === 0 || // top-left
            i === 0 && j === posLength - 1 || // bottom-left
            i === posLength - 1 && j === 0) {
              continue;
            }
            coords.push([pos[i], pos[j]]);
          }
        }
        return coords;
      };
    }
  });

  // node_modules/qrcode/lib/core/finder-pattern.js
  var require_finder_pattern = __commonJS({
    "node_modules/qrcode/lib/core/finder-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      var FINDER_PATTERN_SIZE = 7;
      exports.getPositions = function getPositions(version) {
        const size = getSymbolSize(version);
        return [
          // top-left
          [0, 0],
          // top-right
          [size - FINDER_PATTERN_SIZE, 0],
          // bottom-left
          [0, size - FINDER_PATTERN_SIZE]
        ];
      };
    }
  });

  // node_modules/qrcode/lib/core/mask-pattern.js
  var require_mask_pattern = __commonJS({
    "node_modules/qrcode/lib/core/mask-pattern.js"(exports) {
      exports.Patterns = {
        PATTERN000: 0,
        PATTERN001: 1,
        PATTERN010: 2,
        PATTERN011: 3,
        PATTERN100: 4,
        PATTERN101: 5,
        PATTERN110: 6,
        PATTERN111: 7
      };
      var PenaltyScores = {
        N1: 3,
        N2: 3,
        N3: 40,
        N4: 10
      };
      exports.isValid = function isValid(mask) {
        return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
      };
      exports.from = function from(value) {
        return exports.isValid(value) ? parseInt(value, 10) : void 0;
      };
      exports.getPenaltyN1 = function getPenaltyN1(data) {
        const size = data.size;
        let points = 0;
        let sameCountCol = 0;
        let sameCountRow = 0;
        let lastCol = null;
        let lastRow = null;
        for (let row = 0; row < size; row++) {
          sameCountCol = sameCountRow = 0;
          lastCol = lastRow = null;
          for (let col = 0; col < size; col++) {
            let module2 = data.get(row, col);
            if (module2 === lastCol) {
              sameCountCol++;
            } else {
              if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
              lastCol = module2;
              sameCountCol = 1;
            }
            module2 = data.get(col, row);
            if (module2 === lastRow) {
              sameCountRow++;
            } else {
              if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
              lastRow = module2;
              sameCountRow = 1;
            }
          }
          if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
          if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
        }
        return points;
      };
      exports.getPenaltyN2 = function getPenaltyN2(data) {
        const size = data.size;
        let points = 0;
        for (let row = 0; row < size - 1; row++) {
          for (let col = 0; col < size - 1; col++) {
            const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
            if (last === 4 || last === 0) points++;
          }
        }
        return points * PenaltyScores.N2;
      };
      exports.getPenaltyN3 = function getPenaltyN3(data) {
        const size = data.size;
        let points = 0;
        let bitsCol = 0;
        let bitsRow = 0;
        for (let row = 0; row < size; row++) {
          bitsCol = bitsRow = 0;
          for (let col = 0; col < size; col++) {
            bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
            if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
            bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
            if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
          }
        }
        return points * PenaltyScores.N3;
      };
      exports.getPenaltyN4 = function getPenaltyN4(data) {
        let darkCount = 0;
        const modulesCount = data.data.length;
        for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
        const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
        return k * PenaltyScores.N4;
      };
      function getMaskAt(maskPattern, i, j) {
        switch (maskPattern) {
          case exports.Patterns.PATTERN000:
            return (i + j) % 2 === 0;
          case exports.Patterns.PATTERN001:
            return i % 2 === 0;
          case exports.Patterns.PATTERN010:
            return j % 3 === 0;
          case exports.Patterns.PATTERN011:
            return (i + j) % 3 === 0;
          case exports.Patterns.PATTERN100:
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
          case exports.Patterns.PATTERN101:
            return i * j % 2 + i * j % 3 === 0;
          case exports.Patterns.PATTERN110:
            return (i * j % 2 + i * j % 3) % 2 === 0;
          case exports.Patterns.PATTERN111:
            return (i * j % 3 + (i + j) % 2) % 2 === 0;
          default:
            throw new Error("bad maskPattern:" + maskPattern);
        }
      }
      exports.applyMask = function applyMask(pattern, data) {
        const size = data.size;
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            if (data.isReserved(row, col)) continue;
            data.xor(row, col, getMaskAt(pattern, row, col));
          }
        }
      };
      exports.getBestMask = function getBestMask(data, setupFormatFunc) {
        const numPatterns = Object.keys(exports.Patterns).length;
        let bestPattern = 0;
        let lowerPenalty = Infinity;
        for (let p = 0; p < numPatterns; p++) {
          setupFormatFunc(p);
          exports.applyMask(p, data);
          const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
          exports.applyMask(p, data);
          if (penalty < lowerPenalty) {
            lowerPenalty = penalty;
            bestPattern = p;
          }
        }
        return bestPattern;
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-code.js
  var require_error_correction_code = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-code.js"(exports) {
      var ECLevel = require_error_correction_level();
      var EC_BLOCKS_TABLE = [
        // L  M  Q  H
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        1,
        2,
        2,
        4,
        1,
        2,
        4,
        4,
        2,
        4,
        4,
        4,
        2,
        4,
        6,
        5,
        2,
        4,
        6,
        6,
        2,
        5,
        8,
        8,
        4,
        5,
        8,
        8,
        4,
        5,
        8,
        11,
        4,
        8,
        10,
        11,
        4,
        9,
        12,
        16,
        4,
        9,
        16,
        16,
        6,
        10,
        12,
        18,
        6,
        10,
        17,
        16,
        6,
        11,
        16,
        19,
        6,
        13,
        18,
        21,
        7,
        14,
        21,
        25,
        8,
        16,
        20,
        25,
        8,
        17,
        23,
        25,
        9,
        17,
        23,
        34,
        9,
        18,
        25,
        30,
        10,
        20,
        27,
        32,
        12,
        21,
        29,
        35,
        12,
        23,
        34,
        37,
        12,
        25,
        34,
        40,
        13,
        26,
        35,
        42,
        14,
        28,
        38,
        45,
        15,
        29,
        40,
        48,
        16,
        31,
        43,
        51,
        17,
        33,
        45,
        54,
        18,
        35,
        48,
        57,
        19,
        37,
        51,
        60,
        19,
        38,
        53,
        63,
        20,
        40,
        56,
        66,
        21,
        43,
        59,
        70,
        22,
        45,
        62,
        74,
        24,
        47,
        65,
        77,
        25,
        49,
        68,
        81
      ];
      var EC_CODEWORDS_TABLE = [
        // L  M  Q  H
        7,
        10,
        13,
        17,
        10,
        16,
        22,
        28,
        15,
        26,
        36,
        44,
        20,
        36,
        52,
        64,
        26,
        48,
        72,
        88,
        36,
        64,
        96,
        112,
        40,
        72,
        108,
        130,
        48,
        88,
        132,
        156,
        60,
        110,
        160,
        192,
        72,
        130,
        192,
        224,
        80,
        150,
        224,
        264,
        96,
        176,
        260,
        308,
        104,
        198,
        288,
        352,
        120,
        216,
        320,
        384,
        132,
        240,
        360,
        432,
        144,
        280,
        408,
        480,
        168,
        308,
        448,
        532,
        180,
        338,
        504,
        588,
        196,
        364,
        546,
        650,
        224,
        416,
        600,
        700,
        224,
        442,
        644,
        750,
        252,
        476,
        690,
        816,
        270,
        504,
        750,
        900,
        300,
        560,
        810,
        960,
        312,
        588,
        870,
        1050,
        336,
        644,
        952,
        1110,
        360,
        700,
        1020,
        1200,
        390,
        728,
        1050,
        1260,
        420,
        784,
        1140,
        1350,
        450,
        812,
        1200,
        1440,
        480,
        868,
        1290,
        1530,
        510,
        924,
        1350,
        1620,
        540,
        980,
        1440,
        1710,
        570,
        1036,
        1530,
        1800,
        570,
        1064,
        1590,
        1890,
        600,
        1120,
        1680,
        1980,
        630,
        1204,
        1770,
        2100,
        660,
        1260,
        1860,
        2220,
        720,
        1316,
        1950,
        2310,
        750,
        1372,
        2040,
        2430
      ];
      exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
      exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/galois-field.js
  var require_galois_field = __commonJS({
    "node_modules/qrcode/lib/core/galois-field.js"(exports) {
      var EXP_TABLE = new Uint8Array(512);
      var LOG_TABLE = new Uint8Array(256);
      (function initTables() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
          EXP_TABLE[i] = x;
          LOG_TABLE[x] = i;
          x <<= 1;
          if (x & 256) {
            x ^= 285;
          }
        }
        for (let i = 255; i < 512; i++) {
          EXP_TABLE[i] = EXP_TABLE[i - 255];
        }
      })();
      exports.log = function log(n) {
        if (n < 1) throw new Error("log(" + n + ")");
        return LOG_TABLE[n];
      };
      exports.exp = function exp(n) {
        return EXP_TABLE[n];
      };
      exports.mul = function mul(x, y) {
        if (x === 0 || y === 0) return 0;
        return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
      };
    }
  });

  // node_modules/qrcode/lib/core/polynomial.js
  var require_polynomial = __commonJS({
    "node_modules/qrcode/lib/core/polynomial.js"(exports) {
      var GF = require_galois_field();
      exports.mul = function mul(p1, p2) {
        const coeff = new Uint8Array(p1.length + p2.length - 1);
        for (let i = 0; i < p1.length; i++) {
          for (let j = 0; j < p2.length; j++) {
            coeff[i + j] ^= GF.mul(p1[i], p2[j]);
          }
        }
        return coeff;
      };
      exports.mod = function mod(divident, divisor) {
        let result = new Uint8Array(divident);
        while (result.length - divisor.length >= 0) {
          const coeff = result[0];
          for (let i = 0; i < divisor.length; i++) {
            result[i] ^= GF.mul(divisor[i], coeff);
          }
          let offset = 0;
          while (offset < result.length && result[offset] === 0) offset++;
          result = result.slice(offset);
        }
        return result;
      };
      exports.generateECPolynomial = function generateECPolynomial(degree) {
        let poly = new Uint8Array([1]);
        for (let i = 0; i < degree; i++) {
          poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
        }
        return poly;
      };
    }
  });

  // node_modules/qrcode/lib/core/reed-solomon-encoder.js
  var require_reed_solomon_encoder = __commonJS({
    "node_modules/qrcode/lib/core/reed-solomon-encoder.js"(exports, module) {
      var Polynomial = require_polynomial();
      function ReedSolomonEncoder(degree) {
        this.genPoly = void 0;
        this.degree = degree;
        if (this.degree) this.initialize(this.degree);
      }
      ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
        this.degree = degree;
        this.genPoly = Polynomial.generateECPolynomial(this.degree);
      };
      ReedSolomonEncoder.prototype.encode = function encode(data) {
        if (!this.genPoly) {
          throw new Error("Encoder not initialized");
        }
        const paddedData = new Uint8Array(data.length + this.degree);
        paddedData.set(data);
        const remainder = Polynomial.mod(paddedData, this.genPoly);
        const start = this.degree - remainder.length;
        if (start > 0) {
          const buff = new Uint8Array(this.degree);
          buff.set(remainder, start);
          return buff;
        }
        return remainder;
      };
      module.exports = ReedSolomonEncoder;
    }
  });

  // node_modules/qrcode/lib/core/version-check.js
  var require_version_check = __commonJS({
    "node_modules/qrcode/lib/core/version-check.js"(exports) {
      exports.isValid = function isValid(version) {
        return !isNaN(version) && version >= 1 && version <= 40;
      };
    }
  });

  // node_modules/qrcode/lib/core/regex.js
  var require_regex = __commonJS({
    "node_modules/qrcode/lib/core/regex.js"(exports) {
      var numeric = "[0-9]+";
      var alphanumeric = "[A-Z $%*+\\-./:]+";
      var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
      kanji = kanji.replace(/u/g, "\\u");
      var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
      exports.KANJI = new RegExp(kanji, "g");
      exports.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
      exports.BYTE = new RegExp(byte, "g");
      exports.NUMERIC = new RegExp(numeric, "g");
      exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
      var TEST_KANJI = new RegExp("^" + kanji + "$");
      var TEST_NUMERIC = new RegExp("^" + numeric + "$");
      var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
      exports.testKanji = function testKanji(str) {
        return TEST_KANJI.test(str);
      };
      exports.testNumeric = function testNumeric(str) {
        return TEST_NUMERIC.test(str);
      };
      exports.testAlphanumeric = function testAlphanumeric(str) {
        return TEST_ALPHANUMERIC.test(str);
      };
    }
  });

  // node_modules/qrcode/lib/core/mode.js
  var require_mode = __commonJS({
    "node_modules/qrcode/lib/core/mode.js"(exports) {
      var VersionCheck = require_version_check();
      var Regex = require_regex();
      exports.NUMERIC = {
        id: "Numeric",
        bit: 1 << 0,
        ccBits: [10, 12, 14]
      };
      exports.ALPHANUMERIC = {
        id: "Alphanumeric",
        bit: 1 << 1,
        ccBits: [9, 11, 13]
      };
      exports.BYTE = {
        id: "Byte",
        bit: 1 << 2,
        ccBits: [8, 16, 16]
      };
      exports.KANJI = {
        id: "Kanji",
        bit: 1 << 3,
        ccBits: [8, 10, 12]
      };
      exports.MIXED = {
        bit: -1
      };
      exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
        if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid version: " + version);
        }
        if (version >= 1 && version < 10) return mode.ccBits[0];
        else if (version < 27) return mode.ccBits[1];
        return mode.ccBits[2];
      };
      exports.getBestModeForData = function getBestModeForData(dataStr) {
        if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
        else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
        else if (Regex.testKanji(dataStr)) return exports.KANJI;
        else return exports.BYTE;
      };
      exports.toString = function toString(mode) {
        if (mode && mode.id) return mode.id;
        throw new Error("Invalid mode");
      };
      exports.isValid = function isValid(mode) {
        return mode && mode.bit && mode.ccBits;
      };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "numeric":
            return exports.NUMERIC;
          case "alphanumeric":
            return exports.ALPHANUMERIC;
          case "kanji":
            return exports.KANJI;
          case "byte":
            return exports.BYTE;
          default:
            throw new Error("Unknown mode: " + string);
        }
      }
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/version.js
  var require_version = __commonJS({
    "node_modules/qrcode/lib/core/version.js"(exports) {
      var Utils = require_utils();
      var ECCode = require_error_correction_code();
      var ECLevel = require_error_correction_level();
      var Mode = require_mode();
      var VersionCheck = require_version_check();
      var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
      var G18_BCH = Utils.getBCHDigit(G18);
      function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      function getReservedBitsCount(mode, version) {
        return Mode.getCharCountIndicator(mode, version) + 4;
      }
      function getTotalBitsFromDataArray(segments, version) {
        let totalBits = 0;
        segments.forEach(function(data) {
          const reservedBits = getReservedBitsCount(data.mode, version);
          totalBits += reservedBits + data.getBitsLength();
        });
        return totalBits;
      }
      function getBestVersionForMixedData(segments, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          const length = getTotalBitsFromDataArray(segments, currentVersion);
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      exports.from = function from(value, defaultValue) {
        if (VersionCheck.isValid(value)) {
          return parseInt(value, 10);
        }
        return defaultValue;
      };
      exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid QR Code version");
        }
        if (typeof mode === "undefined") mode = Mode.BYTE;
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (mode === Mode.MIXED) return dataTotalCodewordsBits;
        const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
        switch (mode) {
          case Mode.NUMERIC:
            return Math.floor(usableBits / 10 * 3);
          case Mode.ALPHANUMERIC:
            return Math.floor(usableBits / 11 * 2);
          case Mode.KANJI:
            return Math.floor(usableBits / 13);
          case Mode.BYTE:
          default:
            return Math.floor(usableBits / 8);
        }
      };
      exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
        let seg;
        const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
        if (Array.isArray(data)) {
          if (data.length > 1) {
            return getBestVersionForMixedData(data, ecl);
          }
          if (data.length === 0) {
            return 1;
          }
          seg = data[0];
        } else {
          seg = data;
        }
        return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
      };
      exports.getEncodedBits = function getEncodedBits(version) {
        if (!VersionCheck.isValid(version) || version < 7) {
          throw new Error("Invalid QR Code version");
        }
        let d = version << 12;
        while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
          d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
        }
        return version << 12 | d;
      };
    }
  });

  // node_modules/qrcode/lib/core/format-info.js
  var require_format_info = __commonJS({
    "node_modules/qrcode/lib/core/format-info.js"(exports) {
      var Utils = require_utils();
      var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
      var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
      var G15_BCH = Utils.getBCHDigit(G15);
      exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
        const data = errorCorrectionLevel.bit << 3 | mask;
        let d = data << 10;
        while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
          d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
        }
        return (data << 10 | d) ^ G15_MASK;
      };
    }
  });

  // node_modules/qrcode/lib/core/numeric-data.js
  var require_numeric_data = __commonJS({
    "node_modules/qrcode/lib/core/numeric-data.js"(exports, module) {
      var Mode = require_mode();
      function NumericData(data) {
        this.mode = Mode.NUMERIC;
        this.data = data.toString();
      }
      NumericData.getBitsLength = function getBitsLength(length) {
        return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
      };
      NumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      NumericData.prototype.getBitsLength = function getBitsLength() {
        return NumericData.getBitsLength(this.data.length);
      };
      NumericData.prototype.write = function write(bitBuffer) {
        let i, group, value;
        for (i = 0; i + 3 <= this.data.length; i += 3) {
          group = this.data.substr(i, 3);
          value = parseInt(group, 10);
          bitBuffer.put(value, 10);
        }
        const remainingNum = this.data.length - i;
        if (remainingNum > 0) {
          group = this.data.substr(i);
          value = parseInt(group, 10);
          bitBuffer.put(value, remainingNum * 3 + 1);
        }
      };
      module.exports = NumericData;
    }
  });

  // node_modules/qrcode/lib/core/alphanumeric-data.js
  var require_alphanumeric_data = __commonJS({
    "node_modules/qrcode/lib/core/alphanumeric-data.js"(exports, module) {
      var Mode = require_mode();
      var ALPHA_NUM_CHARS = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        " ",
        "$",
        "%",
        "*",
        "+",
        "-",
        ".",
        "/",
        ":"
      ];
      function AlphanumericData(data) {
        this.mode = Mode.ALPHANUMERIC;
        this.data = data;
      }
      AlphanumericData.getBitsLength = function getBitsLength(length) {
        return 11 * Math.floor(length / 2) + 6 * (length % 2);
      };
      AlphanumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      AlphanumericData.prototype.getBitsLength = function getBitsLength() {
        return AlphanumericData.getBitsLength(this.data.length);
      };
      AlphanumericData.prototype.write = function write(bitBuffer) {
        let i;
        for (i = 0; i + 2 <= this.data.length; i += 2) {
          let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
          value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
          bitBuffer.put(value, 11);
        }
        if (this.data.length % 2) {
          bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
        }
      };
      module.exports = AlphanumericData;
    }
  });

  // node_modules/qrcode/lib/core/byte-data.js
  var require_byte_data = __commonJS({
    "node_modules/qrcode/lib/core/byte-data.js"(exports, module) {
      var Mode = require_mode();
      function ByteData(data) {
        this.mode = Mode.BYTE;
        if (typeof data === "string") {
          this.data = new TextEncoder().encode(data);
        } else {
          this.data = new Uint8Array(data);
        }
      }
      ByteData.getBitsLength = function getBitsLength(length) {
        return length * 8;
      };
      ByteData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      ByteData.prototype.getBitsLength = function getBitsLength() {
        return ByteData.getBitsLength(this.data.length);
      };
      ByteData.prototype.write = function(bitBuffer) {
        for (let i = 0, l = this.data.length; i < l; i++) {
          bitBuffer.put(this.data[i], 8);
        }
      };
      module.exports = ByteData;
    }
  });

  // node_modules/qrcode/lib/core/kanji-data.js
  var require_kanji_data = __commonJS({
    "node_modules/qrcode/lib/core/kanji-data.js"(exports, module) {
      var Mode = require_mode();
      var Utils = require_utils();
      function KanjiData(data) {
        this.mode = Mode.KANJI;
        this.data = data;
      }
      KanjiData.getBitsLength = function getBitsLength(length) {
        return length * 13;
      };
      KanjiData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      KanjiData.prototype.getBitsLength = function getBitsLength() {
        return KanjiData.getBitsLength(this.data.length);
      };
      KanjiData.prototype.write = function(bitBuffer) {
        let i;
        for (i = 0; i < this.data.length; i++) {
          let value = Utils.toSJIS(this.data[i]);
          if (value >= 33088 && value <= 40956) {
            value -= 33088;
          } else if (value >= 57408 && value <= 60351) {
            value -= 49472;
          } else {
            throw new Error(
              "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
            );
          }
          value = (value >>> 8 & 255) * 192 + (value & 255);
          bitBuffer.put(value, 13);
        }
      };
      module.exports = KanjiData;
    }
  });

  // node_modules/dijkstrajs/dijkstra.js
  var require_dijkstra = __commonJS({
    "node_modules/dijkstrajs/dijkstra.js"(exports, module) {
      "use strict";
      var dijkstra = {
        single_source_shortest_paths: function(graph, s, d) {
          var predecessors = {};
          var costs = {};
          costs[s] = 0;
          var open = dijkstra.PriorityQueue.make();
          open.push(s, 0);
          var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
          while (!open.empty()) {
            closest = open.pop();
            u = closest.value;
            cost_of_s_to_u = closest.cost;
            adjacent_nodes = graph[u] || {};
            for (v in adjacent_nodes) {
              if (adjacent_nodes.hasOwnProperty(v)) {
                cost_of_e = adjacent_nodes[v];
                cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
                cost_of_s_to_v = costs[v];
                first_visit = typeof costs[v] === "undefined";
                if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                  costs[v] = cost_of_s_to_u_plus_cost_of_e;
                  open.push(v, cost_of_s_to_u_plus_cost_of_e);
                  predecessors[v] = u;
                }
              }
            }
          }
          if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
            var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
            throw new Error(msg);
          }
          return predecessors;
        },
        extract_shortest_path_from_predecessor_list: function(predecessors, d) {
          var nodes = [];
          var u = d;
          var predecessor;
          while (u) {
            nodes.push(u);
            predecessor = predecessors[u];
            u = predecessors[u];
          }
          nodes.reverse();
          return nodes;
        },
        find_path: function(graph, s, d) {
          var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
          return dijkstra.extract_shortest_path_from_predecessor_list(
            predecessors,
            d
          );
        },
        /**
         * A very naive priority queue implementation.
         */
        PriorityQueue: {
          make: function(opts) {
            var T = dijkstra.PriorityQueue, t2 = {}, key2;
            opts = opts || {};
            for (key2 in T) {
              if (T.hasOwnProperty(key2)) {
                t2[key2] = T[key2];
              }
            }
            t2.queue = [];
            t2.sorter = opts.sorter || T.default_sorter;
            return t2;
          },
          default_sorter: function(a, b) {
            return a.cost - b.cost;
          },
          /**
           * Add a new item to the queue and ensure the highest priority element
           * is at the front of the queue.
           */
          push: function(value, cost) {
            var item = { value, cost };
            this.queue.push(item);
            this.queue.sort(this.sorter);
          },
          /**
           * Return the highest priority element in the queue.
           */
          pop: function() {
            return this.queue.shift();
          },
          empty: function() {
            return this.queue.length === 0;
          }
        }
      };
      if (typeof module !== "undefined") {
        module.exports = dijkstra;
      }
    }
  });

  // node_modules/qrcode/lib/core/segments.js
  var require_segments = __commonJS({
    "node_modules/qrcode/lib/core/segments.js"(exports) {
      var Mode = require_mode();
      var NumericData = require_numeric_data();
      var AlphanumericData = require_alphanumeric_data();
      var ByteData = require_byte_data();
      var KanjiData = require_kanji_data();
      var Regex = require_regex();
      var Utils = require_utils();
      var dijkstra = require_dijkstra();
      function getStringByteLength(str) {
        return unescape(encodeURIComponent(str)).length;
      }
      function getSegments(regex, mode, str) {
        const segments = [];
        let result;
        while ((result = regex.exec(str)) !== null) {
          segments.push({
            data: result[0],
            index: result.index,
            mode,
            length: result[0].length
          });
        }
        return segments;
      }
      function getSegmentsFromString(dataStr) {
        const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
        const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
        let byteSegs;
        let kanjiSegs;
        if (Utils.isKanjiModeEnabled()) {
          byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
          kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
        } else {
          byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
          kanjiSegs = [];
        }
        const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
        return segs.sort(function(s1, s2) {
          return s1.index - s2.index;
        }).map(function(obj) {
          return {
            data: obj.data,
            mode: obj.mode,
            length: obj.length
          };
        });
      }
      function getSegmentBitsLength(length, mode) {
        switch (mode) {
          case Mode.NUMERIC:
            return NumericData.getBitsLength(length);
          case Mode.ALPHANUMERIC:
            return AlphanumericData.getBitsLength(length);
          case Mode.KANJI:
            return KanjiData.getBitsLength(length);
          case Mode.BYTE:
            return ByteData.getBitsLength(length);
        }
      }
      function mergeSegments(segs) {
        return segs.reduce(function(acc, curr) {
          const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
          if (prevSeg && prevSeg.mode === curr.mode) {
            acc[acc.length - 1].data += curr.data;
            return acc;
          }
          acc.push(curr);
          return acc;
        }, []);
      }
      function buildNodes(segs) {
        const nodes = [];
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          switch (seg.mode) {
            case Mode.NUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.ALPHANUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.KANJI:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
              break;
            case Mode.BYTE:
              nodes.push([
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
          }
        }
        return nodes;
      }
      function buildGraph(nodes, version) {
        const table = {};
        const graph = { start: {} };
        let prevNodeIds = ["start"];
        for (let i = 0; i < nodes.length; i++) {
          const nodeGroup = nodes[i];
          const currentNodeIds = [];
          for (let j = 0; j < nodeGroup.length; j++) {
            const node = nodeGroup[j];
            const key2 = "" + i + j;
            currentNodeIds.push(key2);
            table[key2] = { node, lastCount: 0 };
            graph[key2] = {};
            for (let n = 0; n < prevNodeIds.length; n++) {
              const prevNodeId = prevNodeIds[n];
              if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
                graph[prevNodeId][key2] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
                table[prevNodeId].lastCount += node.length;
              } else {
                if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
                graph[prevNodeId][key2] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
              }
            }
          }
          prevNodeIds = currentNodeIds;
        }
        for (let n = 0; n < prevNodeIds.length; n++) {
          graph[prevNodeIds[n]].end = 0;
        }
        return { map: graph, table };
      }
      function buildSingleSegment(data, modesHint) {
        let mode;
        const bestMode = Mode.getBestModeForData(data);
        mode = Mode.from(modesHint, bestMode);
        if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
          throw new Error('"' + data + '" cannot be encoded with mode ' + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
        }
        if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
          mode = Mode.BYTE;
        }
        switch (mode) {
          case Mode.NUMERIC:
            return new NumericData(data);
          case Mode.ALPHANUMERIC:
            return new AlphanumericData(data);
          case Mode.KANJI:
            return new KanjiData(data);
          case Mode.BYTE:
            return new ByteData(data);
        }
      }
      exports.fromArray = function fromArray(array) {
        return array.reduce(function(acc, seg) {
          if (typeof seg === "string") {
            acc.push(buildSingleSegment(seg, null));
          } else if (seg.data) {
            acc.push(buildSingleSegment(seg.data, seg.mode));
          }
          return acc;
        }, []);
      };
      exports.fromString = function fromString(data, version) {
        const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
        const nodes = buildNodes(segs);
        const graph = buildGraph(nodes, version);
        const path = dijkstra.find_path(graph.map, "start", "end");
        const optimizedSegs = [];
        for (let i = 1; i < path.length - 1; i++) {
          optimizedSegs.push(graph.table[path[i]].node);
        }
        return exports.fromArray(mergeSegments(optimizedSegs));
      };
      exports.rawSplit = function rawSplit(data) {
        return exports.fromArray(
          getSegmentsFromString(data, Utils.isKanjiModeEnabled())
        );
      };
    }
  });

  // node_modules/qrcode/lib/core/qrcode.js
  var require_qrcode = __commonJS({
    "node_modules/qrcode/lib/core/qrcode.js"(exports) {
      var Utils = require_utils();
      var ECLevel = require_error_correction_level();
      var BitBuffer = require_bit_buffer();
      var BitMatrix = require_bit_matrix();
      var AlignmentPattern = require_alignment_pattern();
      var FinderPattern = require_finder_pattern();
      var MaskPattern = require_mask_pattern();
      var ECCode = require_error_correction_code();
      var ReedSolomonEncoder = require_reed_solomon_encoder();
      var Version = require_version();
      var FormatInfo = require_format_info();
      var Mode = require_mode();
      var Segments = require_segments();
      function setupFinderPattern(matrix, version) {
        const size = matrix.size;
        const pos = FinderPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || size <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
              if (col + c <= -1 || size <= col + c) continue;
              if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupTimingPattern(matrix) {
        const size = matrix.size;
        for (let r = 8; r < size - 8; r++) {
          const value = r % 2 === 0;
          matrix.set(r, 6, value, true);
          matrix.set(6, r, value, true);
        }
      }
      function setupAlignmentPattern(matrix, version) {
        const pos = AlignmentPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupVersionInfo(matrix, version) {
        const size = matrix.size;
        const bits = Version.getEncodedBits(version);
        let row, col, mod;
        for (let i = 0; i < 18; i++) {
          row = Math.floor(i / 3);
          col = i % 3 + size - 8 - 3;
          mod = (bits >> i & 1) === 1;
          matrix.set(row, col, mod, true);
          matrix.set(col, row, mod, true);
        }
      }
      function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
        const size = matrix.size;
        const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
        let i, mod;
        for (i = 0; i < 15; i++) {
          mod = (bits >> i & 1) === 1;
          if (i < 6) {
            matrix.set(i, 8, mod, true);
          } else if (i < 8) {
            matrix.set(i + 1, 8, mod, true);
          } else {
            matrix.set(size - 15 + i, 8, mod, true);
          }
          if (i < 8) {
            matrix.set(8, size - i - 1, mod, true);
          } else if (i < 9) {
            matrix.set(8, 15 - i - 1 + 1, mod, true);
          } else {
            matrix.set(8, 15 - i - 1, mod, true);
          }
        }
        matrix.set(size - 8, 8, 1, true);
      }
      function setupData(matrix, data) {
        const size = matrix.size;
        let inc = -1;
        let row = size - 1;
        let bitIndex = 7;
        let byteIndex = 0;
        for (let col = size - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (let c = 0; c < 2; c++) {
              if (!matrix.isReserved(row, col - c)) {
                let dark = false;
                if (byteIndex < data.length) {
                  dark = (data[byteIndex] >>> bitIndex & 1) === 1;
                }
                matrix.set(row, col - c, dark);
                bitIndex--;
                if (bitIndex === -1) {
                  byteIndex++;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if (row < 0 || size <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      }
      function createData(version, errorCorrectionLevel, segments) {
        const buffer = new BitBuffer();
        segments.forEach(function(data) {
          buffer.put(data.mode.bit, 4);
          buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
          data.write(buffer);
        });
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
          buffer.put(0, 4);
        }
        while (buffer.getLengthInBits() % 8 !== 0) {
          buffer.putBit(0);
        }
        const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
        for (let i = 0; i < remainingByte; i++) {
          buffer.put(i % 2 ? 17 : 236, 8);
        }
        return createCodewords(buffer, version, errorCorrectionLevel);
      }
      function createCodewords(bitBuffer, version, errorCorrectionLevel) {
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewords = totalCodewords - ecTotalCodewords;
        const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
        const blocksInGroup2 = totalCodewords % ecTotalBlocks;
        const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
        const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
        const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
        const rs = new ReedSolomonEncoder(ecCount);
        let offset = 0;
        const dcData = new Array(ecTotalBlocks);
        const ecData = new Array(ecTotalBlocks);
        let maxDataSize = 0;
        const buffer = new Uint8Array(bitBuffer.buffer);
        for (let b = 0; b < ecTotalBlocks; b++) {
          const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
          dcData[b] = buffer.slice(offset, offset + dataSize);
          ecData[b] = rs.encode(dcData[b]);
          offset += dataSize;
          maxDataSize = Math.max(maxDataSize, dataSize);
        }
        const data = new Uint8Array(totalCodewords);
        let index = 0;
        let i, r;
        for (i = 0; i < maxDataSize; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            if (i < dcData[r].length) {
              data[index++] = dcData[r][i];
            }
          }
        }
        for (i = 0; i < ecCount; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            data[index++] = ecData[r][i];
          }
        }
        return data;
      }
      function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
        let segments;
        if (Array.isArray(data)) {
          segments = Segments.fromArray(data);
        } else if (typeof data === "string") {
          let estimatedVersion = version;
          if (!estimatedVersion) {
            const rawSegments = Segments.rawSplit(data);
            estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
          }
          segments = Segments.fromString(data, estimatedVersion || 40);
        } else {
          throw new Error("Invalid data");
        }
        const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
        if (!bestVersion) {
          throw new Error("The amount of data is too big to be stored in a QR Code");
        }
        if (!version) {
          version = bestVersion;
        } else if (version < bestVersion) {
          throw new Error(
            "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
          );
        }
        const dataBits = createData(version, errorCorrectionLevel, segments);
        const moduleCount = Utils.getSymbolSize(version);
        const modules = new BitMatrix(moduleCount);
        setupFinderPattern(modules, version);
        setupTimingPattern(modules);
        setupAlignmentPattern(modules, version);
        setupFormatInfo(modules, errorCorrectionLevel, 0);
        if (version >= 7) {
          setupVersionInfo(modules, version);
        }
        setupData(modules, dataBits);
        if (isNaN(maskPattern)) {
          maskPattern = MaskPattern.getBestMask(
            modules,
            setupFormatInfo.bind(null, modules, errorCorrectionLevel)
          );
        }
        MaskPattern.applyMask(maskPattern, modules);
        setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
        return {
          modules,
          version,
          errorCorrectionLevel,
          maskPattern,
          segments
        };
      }
      exports.create = function create(data, options) {
        if (typeof data === "undefined" || data === "") {
          throw new Error("No input text");
        }
        let errorCorrectionLevel = ECLevel.M;
        let version;
        let mask;
        if (typeof options !== "undefined") {
          errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
          version = Version.from(options.version);
          mask = MaskPattern.from(options.maskPattern);
          if (options.toSJISFunc) {
            Utils.setToSJISFunction(options.toSJISFunc);
          }
        }
        return createSymbol(data, version, errorCorrectionLevel, mask);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/utils.js
  var require_utils2 = __commonJS({
    "node_modules/qrcode/lib/renderer/utils.js"(exports) {
      function hex2rgba(hex) {
        if (typeof hex === "number") {
          hex = hex.toString();
        }
        if (typeof hex !== "string") {
          throw new Error("Color should be defined as hex string");
        }
        let hexCode = hex.slice().replace("#", "").split("");
        if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
          throw new Error("Invalid hex color: " + hex);
        }
        if (hexCode.length === 3 || hexCode.length === 4) {
          hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
            return [c, c];
          }));
        }
        if (hexCode.length === 6) hexCode.push("F", "F");
        const hexValue = parseInt(hexCode.join(""), 16);
        return {
          r: hexValue >> 24 & 255,
          g: hexValue >> 16 & 255,
          b: hexValue >> 8 & 255,
          a: hexValue & 255,
          hex: "#" + hexCode.slice(0, 6).join("")
        };
      }
      exports.getOptions = function getOptions(options) {
        if (!options) options = {};
        if (!options.color) options.color = {};
        const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
        const width = options.width && options.width >= 21 ? options.width : void 0;
        const scale = options.scale || 4;
        return {
          width,
          scale: width ? 4 : scale,
          margin,
          color: {
            dark: hex2rgba(options.color.dark || "#000000ff"),
            light: hex2rgba(options.color.light || "#ffffffff")
          },
          type: options.type,
          rendererOpts: options.rendererOpts || {}
        };
      };
      exports.getScale = function getScale(qrSize, opts) {
        return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
      };
      exports.getImageWidth = function getImageWidth(qrSize, opts) {
        const scale = exports.getScale(qrSize, opts);
        return Math.floor((qrSize + opts.margin * 2) * scale);
      };
      exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
        const size = qr.modules.size;
        const data = qr.modules.data;
        const scale = exports.getScale(size, opts);
        const symbolSize = Math.floor((size + opts.margin * 2) * scale);
        const scaledMargin = opts.margin * scale;
        const palette = [opts.color.light, opts.color.dark];
        for (let i = 0; i < symbolSize; i++) {
          for (let j = 0; j < symbolSize; j++) {
            let posDst = (i * symbolSize + j) * 4;
            let pxColor = opts.color.light;
            if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
              const iSrc = Math.floor((i - scaledMargin) / scale);
              const jSrc = Math.floor((j - scaledMargin) / scale);
              pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
            }
            imgData[posDst++] = pxColor.r;
            imgData[posDst++] = pxColor.g;
            imgData[posDst++] = pxColor.b;
            imgData[posDst] = pxColor.a;
          }
        }
      };
    }
  });

  // node_modules/qrcode/lib/renderer/canvas.js
  var require_canvas = __commonJS({
    "node_modules/qrcode/lib/renderer/canvas.js"(exports) {
      var Utils = require_utils2();
      function clearCanvas(ctx, canvas, size) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!canvas.style) canvas.style = {};
        canvas.height = size;
        canvas.width = size;
        canvas.style.height = size + "px";
        canvas.style.width = size + "px";
      }
      function getCanvasElement() {
        try {
          return document.createElement("canvas");
        } catch (e) {
          throw new Error("You need to specify a canvas element");
        }
      }
      exports.render = function render2(qrData, canvas, options) {
        let opts = options;
        let canvasEl = canvas;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!canvas) {
          canvasEl = getCanvasElement();
        }
        opts = Utils.getOptions(opts);
        const size = Utils.getImageWidth(qrData.modules.size, opts);
        const ctx = canvasEl.getContext("2d");
        const image = ctx.createImageData(size, size);
        Utils.qrToImageData(image.data, qrData, opts);
        clearCanvas(ctx, canvasEl, size);
        ctx.putImageData(image, 0, 0);
        return canvasEl;
      };
      exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
        let opts = options;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!opts) opts = {};
        const canvasEl = exports.render(qrData, canvas, opts);
        const type = opts.type || "image/png";
        const rendererOpts = opts.rendererOpts || {};
        return canvasEl.toDataURL(type, rendererOpts.quality);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/svg-tag.js
  var require_svg_tag = __commonJS({
    "node_modules/qrcode/lib/renderer/svg-tag.js"(exports) {
      var Utils = require_utils2();
      function getColorAttrib(color, attrib) {
        const alpha = color.a / 255;
        const str = attrib + '="' + color.hex + '"';
        return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
      }
      function svgCmd(cmd, x, y) {
        let str = cmd + x;
        if (typeof y !== "undefined") str += " " + y;
        return str;
      }
      function qrToPath(data, size, margin) {
        let path = "";
        let moveBy = 0;
        let newRow = false;
        let lineLength = 0;
        for (let i = 0; i < data.length; i++) {
          const col = Math.floor(i % size);
          const row = Math.floor(i / size);
          if (!col && !newRow) newRow = true;
          if (data[i]) {
            lineLength++;
            if (!(i > 0 && col > 0 && data[i - 1])) {
              path += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
              moveBy = 0;
              newRow = false;
            }
            if (!(col + 1 < size && data[i + 1])) {
              path += svgCmd("h", lineLength);
              lineLength = 0;
            }
          } else {
            moveBy++;
          }
        }
        return path;
      }
      exports.render = function render2(qrData, options, cb) {
        const opts = Utils.getOptions(options);
        const size = qrData.modules.size;
        const data = qrData.modules.data;
        const qrcodesize = size + opts.margin * 2;
        const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
        const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
        const viewBox = 'viewBox="0 0 ' + qrcodesize + " " + qrcodesize + '"';
        const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
        const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path + "</svg>\n";
        if (typeof cb === "function") {
          cb(null, svgTag);
        }
        return svgTag;
      };
    }
  });

  // node_modules/qrcode/lib/browser.js
  var require_browser = __commonJS({
    "node_modules/qrcode/lib/browser.js"(exports) {
      var canPromise = require_can_promise();
      var QRCode2 = require_qrcode();
      var CanvasRenderer = require_canvas();
      var SvgRenderer = require_svg_tag();
      function renderCanvas(renderFunc, canvas, text, opts, cb) {
        const args = [].slice.call(arguments, 1);
        const argsNum = args.length;
        const isLastArgCb = typeof args[argsNum - 1] === "function";
        if (!isLastArgCb && !canPromise()) {
          throw new Error("Callback required as last argument");
        }
        if (isLastArgCb) {
          if (argsNum < 2) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 2) {
            cb = text;
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 3) {
            if (canvas.getContext && typeof cb === "undefined") {
              cb = opts;
              opts = void 0;
            } else {
              cb = opts;
              opts = text;
              text = canvas;
              canvas = void 0;
            }
          }
        } else {
          if (argsNum < 1) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 1) {
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 2 && !canvas.getContext) {
            opts = text;
            text = canvas;
            canvas = void 0;
          }
          return new Promise(function(resolve, reject) {
            try {
              const data = QRCode2.create(text, opts);
              resolve(renderFunc(data, canvas, opts));
            } catch (e) {
              reject(e);
            }
          });
        }
        try {
          const data = QRCode2.create(text, opts);
          cb(null, renderFunc(data, canvas, opts));
        } catch (e) {
          cb(e);
        }
      }
      exports.create = QRCode2.create;
      exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
      exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
      exports.toString = renderCanvas.bind(null, function(data, _, opts) {
        return SvgRenderer.render(data, opts);
      });
    }
  });

  // node_modules/eventemitter3/index.mjs
  var import_index = __toESM(require_eventemitter3(), 1);
  var eventemitter3_default = import_index.default;

  // node_modules/dglab-kit/dist/index.js
  var types_DGLAB_SOCKET_VERSION = /* @__PURE__ */ (function(DGLAB_SOCKET_VERSION) {
    DGLAB_SOCKET_VERSION["V3"] = "v3";
    DGLAB_SOCKET_VERSION["V4"] = "v4";
    return DGLAB_SOCKET_VERSION;
  })({});
  var types_DGLAB_SOCKET_STATE = /* @__PURE__ */ (function(DGLAB_SOCKET_STATE) {
    DGLAB_SOCKET_STATE["Idle"] = "idle";
    DGLAB_SOCKET_STATE["Connecting"] = "connecting";
    DGLAB_SOCKET_STATE["WaitingForPeer"] = "waiting_for_peer";
    DGLAB_SOCKET_STATE["Paired"] = "paired";
    DGLAB_SOCKET_STATE["Disconnected"] = "disconnected";
    return DGLAB_SOCKET_STATE;
  })({});
  var types_DglabSocketDeviceType = /* @__PURE__ */ (function(DglabSocketDeviceType) {
    DglabSocketDeviceType["COYOTE_020"] = "COYOTE_020";
    DglabSocketDeviceType["COYOTE_030"] = "COYOTE_030";
    DglabSocketDeviceType["BMTR_1"] = "BMTR_1";
    DglabSocketDeviceType["OVC_1"] = "OVC_1";
    return DglabSocketDeviceType;
  })({});
  var createNamedError = (name, message) => {
    const error = new Error(message);
    error.name = `DGLAB-${name}`;
    return error;
  };
  var isRecord = (value) => "object" == typeof value && null !== value && !Array.isArray(value);
  var DEFAULT_CONNECT_TIMEOUT = 8e3;
  var DglabSocketBase = class extends eventemitter3_default {
    options;
    socket;
    manualSender;
    activeConnect;
    connectTimer;
    cleanups = [];
    currentState = types_DGLAB_SOCKET_STATE.Idle;
    socketGeneration = 0;
    constructor(options = {}) {
      super();
      this.options = options;
    }
    get state() {
      return this.currentState;
    }
    connect() {
      const activeResult = this.getConnectedResult();
      if (activeResult) return Promise.resolve(activeResult);
      if (this.activeConnect) return this.activeConnect.promise;
      this.setState(types_DGLAB_SOCKET_STATE.Connecting);
      let resolve;
      let reject;
      const promise = new Promise((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
      });
      const activeConnect = {
        promise,
        resolve,
        reject
      };
      this.activeConnect = activeConnect;
      this.connectTimer = setTimeout(() => {
        if (this.activeConnect !== activeConnect) return;
        this.rejectActiveConnect(createNamedError("socket-connect-timeout", "\u8FDE\u63A5\u8D85\u65F6"));
        const socket2 = activeConnect.socket;
        if (socket2 && this.socket === socket2) try {
          this.handleSocketClose(1e3, "connect_timeout");
        } finally {
          socket2.close(1e3, "connect_timeout");
        }
      }, this.connectTimeout());
      try {
        activeConnect.socket = this.openSocket();
      } catch (error) {
        this.rejectActiveConnect(error instanceof Error ? error : createNamedError("socket-connect", String(error)));
        throw error;
      }
      return activeConnect.promise;
    }
    setSender(sender) {
      this.manualSender = sender;
      return this;
    }
    sendRaw(data) {
      if (!("string" == typeof data || data instanceof ArrayBuffer || ArrayBuffer.isView(data))) throw createNamedError("socket-send-error", "\u539F\u59CB\u6D88\u606F\u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6216\u4E8C\u8FDB\u5236");
      const outgoing = data;
      if (this.manualSender) return void this.manualSender(outgoing);
      if (!this.socket || !(void 0 === this.socket.readyState || 1 === this.socket.readyState)) throw createNamedError("socket-send", "WebSocket \u5C1A\u672A\u8FDE\u63A5");
      this.socket.send(outgoing);
    }
    sendFrame(frame) {
      this.sendRaw(JSON.stringify(frame));
    }
    disconnect(code, reason) {
      this.rejectActiveConnect(createNamedError("socket-connect-cancelled", "\u8FDE\u63A5\u5DF2\u53D6\u6D88"));
      this.setState(types_DGLAB_SOCKET_STATE.Disconnected);
      const socket2 = this.socket;
      if (!socket2) return;
      try {
        this.handleSocketClose(code, reason);
      } finally {
        socket2.close(code, reason);
      }
    }
    handleSocketOpen(event) {
      this.dispatch("open", event);
    }
    handleSocketMessage(data) {
      let text;
      if ("string" == typeof data) text = data;
      else if (data instanceof ArrayBuffer) text = new TextDecoder().decode(data);
      else if (ArrayBuffer.isView(data)) {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        text = new TextDecoder().decode(bytes);
      } else text = data && "function" == typeof data.toString ? data.toString() : String(data);
      this.dispatch("message", text, data);
      this.handleProtocolMessage(text, data);
    }
    handleSocketClose(eventOrCode, reasonValue) {
      if (!this.socket && !this.activeConnect) return;
      let closeEvent;
      if (isRecord(eventOrCode)) closeEvent = {
        code: "number" == typeof eventOrCode.code ? eventOrCode.code : 0,
        reason: "string" == typeof eventOrCode.reason ? eventOrCode.reason : "",
        wasClean: "boolean" == typeof eventOrCode.wasClean ? eventOrCode.wasClean : false,
        event: eventOrCode
      };
      else {
        const reason = "string" == typeof reasonValue ? reasonValue : reasonValue && "function" == typeof reasonValue.toString ? reasonValue.toString() : "";
        closeEvent = {
          code: "number" == typeof eventOrCode ? eventOrCode : 0,
          reason,
          wasClean: false,
          event: eventOrCode
        };
      }
      if (this.activeConnect) this.rejectActiveConnect(createNamedError("socket-connect-closed", "\u8FDE\u63A5\u5B8C\u6210\u524D\u5DF2\u5173\u95ED"));
      this.setState(types_DGLAB_SOCKET_STATE.Disconnected);
      this.socket = void 0;
      this.socketGeneration += 1;
      this.detachListeners();
      this.onSocketClosed(closeEvent);
      this.dispatch("close", closeEvent);
    }
    handleSocketError(error) {
      this.dispatch("error", error);
    }
    openSocket() {
      if (this.socket && (0 === this.socket.readyState || 1 === this.socket.readyState)) return this.socket;
      if (!this.options.url) {
        this.socket = {
          readyState: 1,
          send: (data) => {
            if (this.manualSender) return void this.manualSender(data);
            throw createNamedError("socket-send", "\u624B\u52A8\u6A21\u5F0F\u672A\u7ED1\u5B9A\u53D1\u9001\u51FD\u6570");
          },
          close: () => void 0
        };
        return this.socket;
      }
      const socket2 = new WebSocket(this.options.url, this.options.protocols);
      this.attachInternalSocket(socket2);
      return socket2;
    }
    setState(state) {
      if (state === this.currentState) return;
      const previous = this.currentState;
      this.currentState = state;
      this.dispatch("state", state, previous);
    }
    connectTimeout() {
      return this.options.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    }
    dispatch(event, ...args) {
      const emit = this.emit.bind(this);
      return emit(event, ...args);
    }
    resolveActiveConnect(result) {
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = void 0;
      this.activeConnect?.resolve(result);
      this.activeConnect = void 0;
    }
    rejectActiveConnect(error) {
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = void 0;
      this.activeConnect?.reject(error);
      this.activeConnect = void 0;
    }
    onSocketClosed(_event) {
    }
    attachInternalSocket(socket2) {
      this.detachListeners();
      this.socket = socket2;
      const generation = ++this.socketGeneration;
      this.cleanups = [
        this.listenSocket(socket2, "open", (event) => {
          if (!this.isCurrentSocket(socket2, generation)) return;
          this.handleSocketOpen(event);
        }),
        this.listenSocket(socket2, "message", (...args) => {
          if (!this.isCurrentSocket(socket2, generation)) return;
          const [first] = args;
          const data = isRecord(first) && "data" in first ? first.data : first;
          this.handleSocketMessage(data);
        }),
        this.listenSocket(socket2, "close", (...args) => {
          if (!this.isCurrentSocket(socket2, generation)) return;
          this.handleSocketClose(...args);
        }),
        this.listenSocket(socket2, "error", (error) => {
          if (!this.isCurrentSocket(socket2, generation)) return;
          this.handleSocketError(error);
        })
      ];
    }
    isCurrentSocket(socket2, generation) {
      return this.socket === socket2 && this.socketGeneration === generation;
    }
    detachListeners() {
      for (const cleanup of this.cleanups) cleanup();
      this.cleanups = [];
    }
    listenSocket(socket2, eventName, listener) {
      if ("function" == typeof socket2.addEventListener) {
        const handler2 = (event) => listener(event);
        socket2.addEventListener(eventName, handler2);
        return () => socket2.removeEventListener?.(eventName, handler2);
      }
      if ("function" == typeof socket2.on) {
        socket2.on(eventName, listener);
        return () => {
          if ("function" == typeof socket2.off) return void socket2.off(eventName, listener);
          socket2.removeListener?.(eventName, listener);
        };
      }
      const key2 = `on${eventName}`;
      const previous = socket2[key2];
      const handler = (...args) => {
        previous?.(...args);
        listener(...args);
      };
      Object.assign(socket2, {
        [key2]: handler
      });
      return () => {
        if (socket2[key2] === handler) Object.assign(socket2, {
          [key2]: previous
        });
      };
    }
  };
  var DglabSocketV3 = class extends DglabSocketBase {
    _targetId;
    pairedTargetId;
    device;
    get targetId() {
      return this._targetId;
    }
    get pairedClientId() {
      return this.pairedTargetId;
    }
    send(data) {
      if (!this._targetId || !this.pairedTargetId) throw createNamedError("socket-target", "V3 \u5C1A\u672A\u5B8C\u6210\u914D\u5BF9");
      this.sendFrame({
        ...data,
        clientId: this._targetId,
        targetId: this.pairedTargetId
      });
    }
    addStrength(channel, step = 1) {
      const type = step >= 0 ? 2 : 1;
      const count = Math.max(1, Math.abs(step));
      if (count > 200) throw createNamedError("socket-v3", "\u5355\u6B21\u8C03\u6574\u5F3A\u5EA6\u8FC7\u5927");
      for (let index = 0; index < count; index += 1) this.send({
        type,
        channel,
        message: "set channel"
      });
    }
    reduceStrength(channel, step = 1) {
      this.addStrength(channel, -step);
    }
    setStrength(channel, strength) {
      this.send({
        type: 3,
        channel,
        strength,
        message: "set channel"
      });
    }
    clearPulse(channel) {
      this.send({
        type: 4,
        channel,
        message: "clear"
      });
    }
    sendPulse(options) {
      const payload = Array.isArray(options.data) ? JSON.stringify(options.data) : options.data;
      this.send({
        type: "clientMsg",
        channel: options.channel,
        time: options.time,
        message: `${options.channel}:${payload}`
      });
    }
    handleProtocolMessage(text, _raw) {
      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        this.dispatch("data", text);
        return;
      }
      this.dispatch("frame", frame);
      switch (frame.type) {
        case "bind":
          if ("string" != typeof frame.clientId) break;
          if (!("targetId" in frame) || "" === frame.targetId) return void this.handleInitialBind(frame.clientId);
          if ("string" == typeof frame.targetId && "200" === frame.message) return void this.handlePairBind(frame.targetId);
          break;
        case "break":
          this.pairedTargetId = void 0;
          this.device = void 0;
          this.setState(types_DGLAB_SOCKET_STATE.WaitingForPeer);
          if ("string" == typeof frame.targetId) {
            this.dispatchDevice({
              type: types_DglabSocketDeviceType.COYOTE_030,
              removed: true
            }, frame.targetId);
            this.dispatch("client-disconnected", frame.targetId);
          }
          return;
        case "msg":
        case 4:
          this.handleForwardMessage(frame);
          return;
        case "error":
          this.handleSocketError(createNamedError("socket-v3-server", "string" == typeof frame.message ? frame.message : "V3 \u670D\u52A1\u7AEF\u9519\u8BEF"));
          return;
      }
      this.dispatch("data", "message" in frame ? frame.message : frame, "targetId" in frame && "string" == typeof frame.targetId ? frame.targetId : void 0);
    }
    onSocketClosed() {
      this._targetId = void 0;
      this.pairedTargetId = void 0;
      this.device = void 0;
    }
    getConnectedResult() {
      if (!this._targetId) return;
      return {
        targetId: this._targetId
      };
    }
    handleInitialBind(clientId) {
      this._targetId = clientId;
      this.setState(types_DGLAB_SOCKET_STATE.WaitingForPeer);
      this.resolveActiveConnect({
        targetId: clientId
      });
    }
    handlePairBind(targetId) {
      this.pairedTargetId = targetId;
      this.setState(types_DGLAB_SOCKET_STATE.Paired);
      this.device = this.createDevice();
      this.dispatchDevice(this.device, targetId);
      this.dispatch("client-attached", targetId);
    }
    handleForwardMessage(frame) {
      if ("message" in frame && "string" == typeof frame.message) {
        const action = this.parseActionMessage(frame.message);
        if (void 0 !== action) this.dispatch("action", action);
        const device = this.parseDeviceMessage(frame.message);
        if (device) this.dispatchDevice(device);
      }
      this.dispatch("data", "message" in frame ? frame.message : frame, "targetId" in frame && "string" == typeof frame.targetId ? frame.targetId : void 0);
    }
    parseActionMessage(message) {
      const match = /^feedback-(\d+)$/.exec(message);
      if (!match) return;
      return Number(match[1]);
    }
    parseDeviceMessage(message) {
      const match = /^strength-(\d+)\+(\d+)\+(\d+)\+(\d+)$/.exec(message);
      if (!match || !this.pairedTargetId) return;
      const [, aStrength, bStrength, aSoftLimit, bSoftLimit] = match;
      const nextProps = {
        strength: {
          A: Number(aStrength),
          B: Number(bStrength)
        },
        softLimit: {
          A: Number(aSoftLimit),
          B: Number(bSoftLimit)
        }
      };
      const previousProps = this.device?.props;
      const props = {};
      if (previousProps?.strength?.A !== nextProps.strength?.A) props.strength = {
        ...props.strength ?? {},
        A: nextProps.strength?.A
      };
      if (previousProps?.strength?.B !== nextProps.strength?.B) props.strength = {
        ...props.strength ?? {},
        B: nextProps.strength?.B
      };
      if (previousProps?.softLimit?.A !== nextProps.softLimit?.A) props.softLimit = {
        ...props.softLimit ?? {},
        A: nextProps.softLimit?.A
      };
      if (previousProps?.softLimit?.B !== nextProps.softLimit?.B) props.softLimit = {
        ...props.softLimit ?? {},
        B: nextProps.softLimit?.B
      };
      this.device = {
        ...this.device ?? this.createDevice(),
        props: nextProps
      };
      return Object.keys(props).length > 0 ? {
        type: types_DglabSocketDeviceType.COYOTE_030,
        props
      } : void 0;
    }
    dispatchDevice(device, clientId = this.pairedTargetId) {
      if (!clientId) return;
      this.dispatch("device", device, clientId);
    }
    createDevice() {
      return {
        type: types_DglabSocketDeviceType.COYOTE_030
      };
    }
  };
  var V4Client = class _V4Client {
    clientId;
    devices;
    constructor(clientId, devices = []) {
      this.clientId = clientId;
      this.devices = devices;
    }
    getDevice(slotId) {
      return this.devices.find((device) => device.slotId === slotId);
    }
    dispatch(data) {
      if (this.updateDevicesFromEvent(data)) return true;
      if (!_V4Client.isRpcResponse(data)) return false;
      return this.updateDevicesFromResponse(data.result);
    }
    replaceDevices(devices) {
      this.devices.splice(0, this.devices.length, ...devices);
    }
    upsertDevice(device) {
      const index = this.findDeviceIndex(device.slotId);
      if (-1 === index) return void this.devices.push(device);
      this.devices[index] = device;
    }
    removeDevice(slotId) {
      const index = this.findDeviceIndex(slotId);
      if (-1 === index) return;
      this.devices.splice(index, 1);
    }
    patchDevices(added, removed) {
      for (const device of added) this.upsertDevice(device);
      for (const slotId of removed) this.removeDevice(slotId);
    }
    patchSlots(slots) {
      for (const slot of slots) {
        const index = this.findDeviceIndex(slot.slotId);
        if (-1 === index) continue;
        const current = this.devices[index];
        this.devices[index] = {
          ...current,
          props: this.mergePatch(current.props ?? {}, slot.props ?? {}),
          slotState: this.mergePatch(current.slotState ?? {}, slot.slotState ?? {})
        };
      }
    }
    destroy() {
      this.devices.splice(0, this.devices.length);
    }
    updateDevicesFromEvent(data) {
      if (!_V4Client.isEventPayload(data)) return false;
      if ("devices.snapshot" === data.ev) {
        this.replaceDevices(data.devices);
        return true;
      }
      if ("devices.patch" === data.ev) {
        this.patchDevices(data.added ?? [], data.removed ?? []);
        return true;
      }
      if ("slots.patch" === data.ev) {
        this.patchSlots(data.slots ?? []);
        return true;
      }
      return false;
    }
    updateDevicesFromResponse(result) {
      if (!_V4Client.hasDevicesResult(result)) return false;
      this.replaceDevices(result.devices);
      return true;
    }
    findDeviceIndex(slotId) {
      return this.devices.findIndex((device) => device.slotId === slotId);
    }
    static isRpcResponse(data) {
      return isRecord(data) && "resp" === data.t;
    }
    static isEventPayload(data) {
      return isRecord(data) && "ev" === data.t && "string" == typeof data.ev;
    }
    static hasDevicesResult(result) {
      return isRecord(result) && Array.isArray(result.devices);
    }
    mergePatch(current, patch) {
      if (!isRecord(current) || !isRecord(patch)) return patch;
      const next = {
        ...current
      };
      for (const [key2, value] of Object.entries(patch)) next[key2] = this.mergePatch(current[key2], value);
      return next;
    }
  };
  var DEFAULT_RESPONSE_TIMEOUT = 8e3;
  var V4Rpc = class _V4Rpc {
    pending = /* @__PURE__ */ new Map();
    sendFrame;
    options;
    requestIdCounter = 0;
    constructor(sendFrame, options = {}) {
      this.sendFrame = sendFrame;
      this.options = options;
    }
    createRequest(method, data) {
      return {
        t: "req",
        reqId: this.createRequestId(),
        m: method,
        data
      };
    }
    send(clientId, data, options) {
      if (!clientId) throw createNamedError("socket-clientId", "\u53D1\u9001\u534F\u8BAE\u6570\u636E\u9700\u8981\u6307\u5B9A clientId");
      let requestId;
      try {
        const existingRequestId = _V4Rpc.getRequestId(data);
        requestId = existingRequestId ?? this.createRequestId();
        let payload;
        if (isRecord(data)) {
          const request = {
            ...data,
            reqId: requestId
          };
          delete request.requestId;
          payload = request;
        } else payload = {
          t: "req",
          reqId: requestId,
          m: "custom",
          data
        };
        const waitableRequestId = _V4Rpc.getRequestId(payload);
        let entry;
        if (void 0 !== waitableRequestId) {
          const key2 = this.pendingKey(clientId, waitableRequestId);
          let resolve;
          let reject;
          const promise2 = new Promise((innerResolve, innerReject) => {
            resolve = innerResolve;
            reject = innerReject;
          });
          const pending = {
            clientId,
            requestId: waitableRequestId,
            promise: promise2,
            resolve,
            reject,
            settled: false
          };
          pending.timer = setTimeout(() => {
            this.pending.delete(key2);
            this.rejectPending(pending, createNamedError("socket-response-timeout", "\u7B49\u5F85\u54CD\u5E94\u8D85\u65F6"));
          }, this.responseTimeout(options));
          entry = pending;
          this.pending.set(key2, pending);
        }
        let error = void 0 === waitableRequestId ? createNamedError("socket-command", "\u5F53\u524D\u6D88\u606F\u6CA1\u6709\u53EF\u7B49\u5F85\u54CD\u5E94") : void 0;
        try {
          this.sendFrame({
            type: "message",
            clientId,
            data: payload
          });
        } catch (sendError) {
          error = sendError;
          if (entry && void 0 !== waitableRequestId) {
            this.pending.delete(this.pendingKey(clientId, waitableRequestId));
            this.rejectPending(entry, sendError);
          }
        }
        const promise = entry?.promise ?? Promise.reject(error);
        Object.assign(promise, {
          requestId,
          clientId
        });
        return promise;
      } catch (error) {
        const promise = Promise.reject(error);
        Object.assign(promise, {
          requestId,
          clientId
        });
        return promise;
      }
    }
    sendOperate(clientId, data, options) {
      const timeout = this.operateResponseTimeout(data, options);
      return this.send(clientId, this.createRequest("device.op", data), void 0 === timeout ? void 0 : {
        timeout
      });
    }
    resolveResponse(clientId, response) {
      const requestId = _V4Rpc.getRequestId(response);
      if (!requestId) return;
      const key2 = this.pendingKey(clientId, requestId);
      const entry = this.pending.get(key2);
      if (!entry) return;
      this.pending.delete(key2);
      if (response.error) return void this.rejectPending(entry, createNamedError("socket-v4-response", response.error ?? "V4 \u6307\u4EE4\u6267\u884C\u5931\u8D25"));
      if (entry.settled) return;
      entry.settled = true;
      if (entry.timer) clearTimeout(entry.timer);
      entry.resolve(response.result);
    }
    rejectClientPending(clientId) {
      for (const [key2, entry] of this.pending) if (entry.clientId === clientId) {
        this.pending.delete(key2);
        this.rejectPending(entry, createNamedError("socket-disconnected", "\u88AB\u63A7\u65B9\u5DF2\u65AD\u5F00"));
      }
    }
    rejectAllPending(error) {
      for (const [, entry] of this.pending) this.rejectPending(entry, error);
      this.pending.clear();
    }
    static isResponse(data) {
      return isRecord(data) && "resp" === data.t;
    }
    static getRequestId(data) {
      if (!isRecord(data)) return;
      if ("string" == typeof data.requestId) return data.requestId;
      if ("string" == typeof data.reqId) return data.reqId;
    }
    createRequestId() {
      this.requestIdCounter += 1;
      return this.requestIdCounter.toString();
    }
    responseTimeout(options) {
      return options?.timeout ?? this.options.responseTimeout ?? DEFAULT_RESPONSE_TIMEOUT;
    }
    operateResponseTimeout(data, options) {
      if (options?.timeout !== void 0) return options.timeout;
      if (void 0 !== this.options.responseTimeout) return;
      return void 0 !== data.d && data.d > DEFAULT_RESPONSE_TIMEOUT ? data.d + 1e3 : void 0;
    }
    pendingKey(clientId, requestId) {
      return `${clientId}\0${requestId}`;
    }
    rejectPending(entry, error) {
      if (entry.settled) return;
      entry.settled = true;
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(error);
    }
  };
  var types_V4ActionType = /* @__PURE__ */ (function(V4ActionType) {
    V4ActionType[V4ActionType["AppendPulseData"] = 0] = "AppendPulseData";
    V4ActionType[V4ActionType["AddIntensity"] = 3] = "AddIntensity";
    V4ActionType[V4ActionType["SetTempIntensity"] = 4] = "SetTempIntensity";
    V4ActionType[V4ActionType["SetIntensity"] = 7] = "SetIntensity";
    return V4ActionType;
  })({});
  var DEVICE_PATCH_UNCHANGED = Symbol("device-patch-unchanged");
  var SERVER_PING_INTERVAL = 2e3;
  var MAX_MISSED_SERVER_PONGS = 3;
  var DglabSocketV4 = class extends DglabSocketBase {
    _targetId;
    clientMap = /* @__PURE__ */ new Map();
    rpc = new V4Rpc((frame) => this.sendFrame(frame), this.options);
    serverPingTimer;
    missedServerPongs = 0;
    get targetId() {
      return this._targetId;
    }
    get clientIds() {
      return [
        ...this.clientMap.keys()
      ];
    }
    get clients() {
      return [
        ...this.clientMap.values()
      ];
    }
    getClient(clientId) {
      return this.clientMap.get(clientId);
    }
    async requestDevices(clientId) {
      const request = this.rpc.createRequest("devices.get");
      const result = await this.rpc.send(clientId, request);
      const client = this.ensureClient(clientId);
      if (client.dispatch({
        t: "resp",
        result
      })) this.dispatch("devices", client.devices, client.clientId);
      return result;
    }
    send(clientId, data, options) {
      return this.rpc.send(clientId, data, options);
    }
    ping(clientId, options) {
      return this.rpc.send(clientId, this.rpc.createRequest("ping"), options);
    }
    disconnect(code, reason) {
      this.stopServerPing();
      super.disconnect(code, reason);
    }
    addIntensity(clientId, slotId, channel, value, options) {
      return this.rpc.sendOperate(clientId, {
        ...this.createOperateBase(slotId, channel, options),
        t: types_V4ActionType.AddIntensity,
        v: value
      }, options);
    }
    reduceStrength(clientId, slotId, channel, value, options) {
      return this.addIntensity(clientId, slotId, channel, -value, options);
    }
    setTempIntensity(clientId, slotId, channel, value, duration, options) {
      return this.rpc.sendOperate(clientId, {
        ...this.createOperateBase(slotId, channel, options),
        t: types_V4ActionType.SetTempIntensity,
        v: value,
        d: duration
      }, options);
    }
    resetIntensity(clientId, slotId, channel, options) {
      return this.rpc.sendOperate(clientId, {
        ...this.createOperateBase(slotId, channel, options),
        t: types_V4ActionType.SetIntensity,
        v: 0
      }, options);
    }
    sendPulse(clientId, slotId, channel, duration, frames, options) {
      return this.rpc.sendOperate(clientId, {
        ...this.createOperateBase(slotId, channel, options),
        t: types_V4ActionType.AppendPulseData,
        d: duration,
        v: frames,
        ver: options?.version,
        seq: options?.seq
      }, options);
    }
    clearPulse(clientId, slotId, channel) {
      return this.clearOperate(clientId, {
        slotId,
        channel
      });
    }
    clearOperate(clientId, options) {
      const data = options && "slotId" in options && options.slotId ? {
        s: options.slotId,
        c: options.channel
      } : void 0;
      return this.rpc.send(clientId, this.rpc.createRequest("device.op.clear", data));
    }
    handleProtocolMessage(text, _raw) {
      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        return;
      }
      if (!frame) return;
      this.dispatch("frame", frame);
      switch (frame.type) {
        case "hello":
          this.handleHello(frame);
          return;
        case "client_attached": {
          this.setState(types_DGLAB_SOCKET_STATE.Paired);
          const clientId = frame.clientId;
          this.ensureClient(clientId);
          this.dispatch("client-attached", clientId);
          return;
        }
        case "client_disconnected": {
          const clientId = frame.clientId;
          this.detachClient(clientId);
          this.rpc.rejectClientPending(clientId);
          if (0 === this.clientMap.size) this.setState(types_DGLAB_SOCKET_STATE.WaitingForPeer);
          this.dispatch("client-disconnected", clientId);
          return;
        }
        case "message":
          this.handleMessage(frame);
          return;
        case "pong":
          this.missedServerPongs = 0;
          return;
        case "idle_timeout":
          this.handleSocketError(createNamedError("socket-idle-timeout", "\u63A7\u5236\u65B9\u7A7A\u95F2\u8D85\u65F6"));
          return;
        case "error":
          this.handleSocketError(createNamedError("socket-v4-server", frame.message ?? frame.code));
      }
    }
    onSocketClosed() {
      this.stopServerPing();
      this._targetId = void 0;
      for (const client of this.clientMap.values()) client.destroy();
      this.clientMap.clear();
      this.rpc.rejectAllPending(createNamedError("socket-disconnected", "WebSocket \u5DF2\u65AD\u5F00"));
    }
    getConnectedResult() {
      if (!this._targetId) return;
      return {
        targetId: this._targetId
      };
    }
    handleHello(frame) {
      this._targetId = frame.clientId;
      this.setState(types_DGLAB_SOCKET_STATE.WaitingForPeer);
      this.startServerPing();
      this.resolveActiveConnect({
        targetId: frame.clientId
      });
    }
    detachClient(clientId) {
      const client = this.clientMap.get(clientId);
      client?.destroy();
      this.clientMap.delete(clientId);
    }
    startServerPing() {
      this.stopServerPing();
      this.missedServerPongs = 0;
      this.serverPingTimer = setInterval(() => {
        this.sendServerPing();
      }, SERVER_PING_INTERVAL);
    }
    stopServerPing() {
      if (this.serverPingTimer) clearInterval(this.serverPingTimer);
      this.serverPingTimer = void 0;
      this.missedServerPongs = 0;
    }
    sendServerPing() {
      if (this.missedServerPongs >= MAX_MISSED_SERVER_PONGS) return void this.disconnectForServerPingTimeout();
      try {
        this.sendFrame({
          type: "ping"
        });
        this.missedServerPongs += 1;
      } catch (error) {
        this.handleSocketError(error);
        this.disconnectForServerPingTimeout();
      }
    }
    disconnectForServerPingTimeout() {
      this.stopServerPing();
      this.handleSocketError(createNamedError("socket-ping-timeout", "\u670D\u52A1\u7AEF ping \u8D85\u65F6"));
      const socket2 = this.socket;
      this.handleSocketClose(1e3, "ping_timeout");
      socket2?.close(1e3, "ping_timeout");
    }
    handleMessage(frame) {
      const data = frame.data;
      this.dispatch("data", data, frame.clientId);
      if (this.isCustomActionEvent(data)) this.dispatch("action", data.action);
      const client = this.clientMap.get(frame.clientId);
      for (const event of this.createDeviceEvents(data, client)) this.dispatch("device", event, frame.clientId);
      if (client?.dispatch(data)) this.dispatch("devices", client.devices, client.clientId);
      if (!V4Rpc.isResponse(data)) return;
      this.rpc.resolveResponse(frame.clientId, data);
    }
    ensureClient(clientId) {
      let client = this.clientMap.get(clientId);
      if (!client) {
        client = new V4Client(clientId);
        this.clientMap.set(clientId, client);
      }
      return client;
    }
    createDeviceEvents(data, client) {
      if (!this.isEventRecord(data)) return [];
      if ("devices.snapshot" === data.ev) {
        const devices = Array.isArray(data.devices) ? data.devices : [];
        const changed = devices.map((device) => this.createDeviceUpsertEvent(device, client)).filter((event) => void 0 !== event);
        const nextSlotIds = new Set(devices.map((device) => device.slotId));
        const removed = client?.devices.filter((device) => !nextSlotIds.has(device.slotId)).map((device) => ({
          slotId: device.slotId,
          removed: true
        })) ?? [];
        return [
          ...changed,
          ...removed
        ];
      }
      if ("devices.patch" === data.ev) {
        const added = Array.isArray(data.added) ? data.added : [];
        const removed = Array.isArray(data.removed) ? data.removed : [];
        return [
          ...added.map((device) => this.createDeviceUpsertEvent(device, client)).filter((event) => void 0 !== event),
          ...removed.map((slotId) => ({
            slotId,
            removed: true
          }))
        ];
      }
      if ("slots.patch" === data.ev) return Array.isArray(data.slots) ? data.slots : [];
      return [];
    }
    createDeviceUpsertEvent(device, client) {
      const previous = client?.getDevice(device.slotId);
      if (!previous) return device;
      const event = {
        slotId: device.slotId
      };
      if (previous.name !== device.name) event.name = device.name;
      if (previous.type !== device.type) event.type = device.type;
      const propsPatch = this.createPatchValue(previous.props, device.props);
      if (propsPatch !== DEVICE_PATCH_UNCHANGED) event.props = propsPatch;
      const slotStatePatch = this.createPatchValue(previous.slotState, device.slotState);
      if (slotStatePatch !== DEVICE_PATCH_UNCHANGED) event.slotState = slotStatePatch;
      return Object.keys(event).length > 1 ? event : void 0;
    }
    createPatchValue(previous, next) {
      if (this.isEqualValue(previous, next)) return DEVICE_PATCH_UNCHANGED;
      if (!isRecord(previous) || !isRecord(next)) return next;
      const patch = {};
      const keys = /* @__PURE__ */ new Set([
        ...Object.keys(previous),
        ...Object.keys(next)
      ]);
      for (const key2 of keys) {
        const value = key2 in next ? next[key2] : void 0;
        const childPatch = this.createPatchValue(previous[key2], value);
        if (childPatch !== DEVICE_PATCH_UNCHANGED) patch[key2] = childPatch;
      }
      return Object.keys(patch).length > 0 ? patch : DEVICE_PATCH_UNCHANGED;
    }
    isEqualValue(left, right) {
      if (Object.is(left, right)) return true;
      return JSON.stringify(left) === JSON.stringify(right);
    }
    isEventRecord(data) {
      return "object" == typeof data && null !== data && "t" in data && "ev" === data.t && "ev" in data && "string" == typeof data.ev;
    }
    isCustomActionEvent(data) {
      return this.isEventRecord(data) && "custom.action" === data.ev && "number" == typeof data.action;
    }
    createOperateBase(slotId, channel, options) {
      return {
        s: slotId,
        c: channel,
        p: options?.priority,
        im: options?.immediate
      };
    }
  };
  var socketEvents = [
    "message",
    "state",
    "open",
    "close",
    "error",
    "frame",
    "data",
    "action",
    "device",
    "devices",
    "client-attached",
    "client-disconnected"
  ];
  var DglabSocketImpl = class extends eventemitter3_default {
    adapter;
    adapterEventCleanups = [];
    constructor(options = {}) {
      super();
      const version = options.version ?? types_DGLAB_SOCKET_VERSION.V4;
      this.adapter = version === types_DGLAB_SOCKET_VERSION.V3 ? new DglabSocketV3(options) : new DglabSocketV4(options);
      this.forwardAdapterEvents();
    }
    get state() {
      return this.adapter.state;
    }
    connect() {
      return this.adapter.connect();
    }
    send(clientIdOrData, data, options) {
      if (this.adapter instanceof DglabSocketV3) return void this.adapter.send(clientIdOrData);
      return this.adapter.send(clientIdOrData, data, options);
    }
    disconnect(code, reason) {
      this.adapter.disconnect(code, reason);
    }
    destroy(code, reason) {
      try {
        this.disconnect(code, reason);
      } finally {
        for (const cleanup of this.adapterEventCleanups) cleanup();
        this.adapterEventCleanups.length = 0;
        this.adapter.removeAllListeners();
        this.removeAllListeners();
      }
    }
    setSender(sender) {
      this.adapter.setSender(sender);
      return this;
    }
    sendRaw(data) {
      this.adapter.sendRaw(data);
    }
    handleMessage(data) {
      this.adapter.handleSocketMessage(data);
    }
    handleOpen(event) {
      this.adapter.handleSocketOpen(event);
    }
    handleClose(eventOrCode, reason) {
      this.adapter.handleSocketClose(eventOrCode, reason);
    }
    handleError(error) {
      this.adapter.handleSocketError(error);
    }
    createAdapterProxy() {
      return new Proxy(this, {
        get: (target, property, receiver) => {
          if (property in target) return Reflect.get(target, property, receiver);
          if (property in target.adapter) {
            const value = Reflect.get(target.adapter, property, target.adapter);
            return "function" == typeof value ? value.bind(target.adapter) : value;
          }
        },
        has: (target, property) => property in target || property in target.adapter,
        set: (target, property, value, receiver) => {
          if (!(property in target) && property in target.adapter) {
            const success = Reflect.set(target.adapter, property, value, target.adapter);
            if (!success) throw new TypeError(`\u65E0\u6CD5\u8BBE\u7F6E\u53EA\u8BFB SOCKET \u5C5E\u6027: ${String(property)}`);
            return true;
          }
          return Reflect.set(target, property, value, receiver);
        },
        deleteProperty: (target, property) => {
          if (property in target) return Reflect.deleteProperty(target, property);
          if (property in target.adapter) throw new TypeError(`\u65E0\u6CD5\u5220\u9664\u53EA\u8BFB SOCKET \u5C5E\u6027: ${String(property)}`);
          return Reflect.deleteProperty(target, property);
        }
      });
    }
    forwardAdapterEvents() {
      for (const event of socketEvents) this.forwardAdapterEvent(event);
    }
    forwardAdapterEvent(event) {
      const listener = (...args) => {
        const emit = this.emit.bind(this);
        emit(event, ...args);
      };
      this.adapter.on(event, listener);
      this.adapterEventCleanups.push(() => this.adapter.off(event, listener));
    }
  };
  var DglabSocket = new Proxy(DglabSocketImpl, {
    construct(target, args, newTarget) {
      const instance = Reflect.construct(target, args, newTarget);
      return instance.createAdapterProxy();
    }
  });

  // src/ui.ts
  var import_qrcode = __toESM(require_browser(), 1);

  // src/shared.ts
  var SAMPLE_MS = 100;
  var STALE_MS = 350;
  var RESPONSE_TIMEOUT_MS = 2e3;
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
    for (const [key2, min, max] of ranges) {
      const n = s[key2];
      if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
        throw new Error(`\u53C2\u6570 ${key2} \u5FC5\u987B\u5728 ${min}\uFF5E${max} \u4E4B\u95F4\u3002`);
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
  var clamp = (n, low, high) => Math.max(low, Math.min(high, n));

  // src/audio.ts
  var ZERO_WAVE = "0A0A0A0A00000000";
  function makeWave(features, settings) {
    const db = settings.metric === "peak" ? features.peakDb : features.rmsDb;
    if (!Number.isFinite(db) || !Number.isFinite(features.zcr) || db <= settings.gateDb) {
      return { hex: ZERO_WAVE, intensity: 0, frequency: 10, db, gated: true, gateDb: settings.gateDb };
    }
    const volume = clamp((db - settings.gateDb) / (settings.ceilingDb - settings.gateDb), 0, 1);
    const intensity = Math.floor(Math.pow(volume, settings.gamma) * settings.modulationMax);
    const zcr = clamp((features.zcr - settings.zcrLow) / (settings.zcrHigh - settings.zcrLow), 0, 1);
    const frequency = Math.round(settings.frequencyHigh - zcr * (settings.frequencyHigh - settings.frequencyLow));
    return {
      hex: encodeWave(frequency, intensity),
      intensity,
      frequency,
      db,
      gated: intensity === 0,
      gateDb: settings.gateDb
    };
  }
  function encodeWave(frequency, intensity) {
    const hex = (n) => clamp(Math.round(n), 0, 100).toString(16).padStart(2, "0").toUpperCase();
    return hex(frequency).repeat(4) + [0.7, 0.85, 1, 0.9].map((gain) => hex(intensity * gain)).join("");
  }
  var AudioMapper = class {
    constructor() {
      this.history = [];
      this.crossings = [];
      this.gateOpen = false;
      this.previousRms = null;
      this.intensity = 0;
      this.smoothedZcr = null;
      this.effectiveGate = null;
      this.lastAt = null;
    }
    reset() {
      this.history = [];
      this.crossings = [];
      this.gateOpen = false;
      this.previousRms = null;
      this.intensity = 0;
      this.smoothedZcr = null;
      this.effectiveGate = null;
      this.lastAt = null;
    }
    next(features, settings, at) {
      if (![features.rmsDb, features.peakDb, features.zcr, at].every(Number.isFinite)) {
        this.reset();
        return { hex: ZERO_WAVE, intensity: 0, frequency: 10, db: -120, gateDb: settings.gateDb, gated: true };
      }
      const dt = this.lastAt === null ? 100 : clamp(at - this.lastAt, 0, 350);
      this.lastAt = at;
      const rise = this.previousRms === null ? 0 : Math.max(0, features.rmsDb - this.previousRms);
      const peakWeight = 0.15 + 0.3 * clamp(rise / 12, 0, 1);
      this.previousRms = features.rmsDb;
      const db = settings.metric === "hybrid" ? features.rmsDb + Math.max(0, features.peakDb - features.rmsDb) * peakWeight : settings.metric === "peak" ? features.peakDb : features.rmsDb;
      this.history.push({ at, db });
      this.history = this.history.filter((item) => at - item.at <= 8e3).slice(-100);
      let targetGate = settings.gateDb;
      if (settings.adaptiveGate && this.history.length >= 20) {
        const sorted = this.history.map((item) => item.db).sort((a, b) => a - b);
        const floor = sorted[Math.floor((sorted.length - 1) * 0.2)];
        targetGate = Math.min(settings.ceilingDb - 3, settings.gateDb + 12, Math.max(settings.gateDb, floor + 6));
        targetGate = Math.max(settings.gateDb, targetGate);
      }
      const priorGate = this.effectiveGate ?? settings.gateDb;
      this.effectiveGate = priorGate + clamp(targetGate - priorGate, -dt * 3e-3, dt * 3e-3);
      const gateDb = this.effectiveGate;
      const openThreshold = Math.min(settings.ceilingDb, gateDb + 2);
      this.gateOpen = this.gateOpen ? db > gateDb : db >= openThreshold;
      this.crossings.push(features.zcr);
      if (this.crossings.length > 3) this.crossings.shift();
      const sortedZcr = [...this.crossings].sort((a, b) => a - b);
      const median = sortedZcr[Math.floor(sortedZcr.length / 2)];
      this.smoothedZcr = this.smoothedZcr === null ? median : this.smoothedZcr + (median - this.smoothedZcr) * (1 - Math.exp(-dt / 120));
      const wave = makeWave({ rmsDb: db, peakDb: db, zcr: this.smoothedZcr }, { ...settings, metric: "rms", gateDb });
      if (!this.gateOpen || wave.gated) {
        this.intensity = 0;
        return { ...wave, hex: ZERO_WAVE, intensity: 0, gated: true };
      }
      const timeConstant = wave.intensity > this.intensity ? 35 : 90;
      this.intensity += (wave.intensity - this.intensity) * (1 - Math.exp(-dt / timeConstant));
      const intensity = Math.min(settings.modulationMax, Math.round(this.intensity));
      return { ...wave, intensity, hex: encodeWave(wave.frequency, intensity), gated: intensity === 0 };
    }
  };

  // src/controller.ts
  function channelLimit(target, channel) {
    const state = target.device.slotState;
    const info = state?.[channel === 0 ? "channelA" : "channelB"];
    if (!info || info.isMuted || typeof info.intensityMax !== "number" || !Number.isFinite(info.intensityMax)) return 0;
    return Math.max(0, Math.min(200, Math.floor(info.intensityMax)));
  }
  function isConnected(target) {
    return target.device.type === "COYOTE_030" && target.device.slotState?.hasDevice === true && target.device.props?.connectState !== "disconnected";
  }
  var AudioController = class {
    constructor(transport2, changed, now = Date.now) {
      this.armed = false;
      this.starting = false;
      this.target = null;
      this.settings = { ...DEFAULT_SETTINGS };
      this.sample = null;
      this.wave = null;
      this.previewWave = null;
      this.reason = "\u5C1A\u672A\u5F00\u59CB\u8054\u52A8";
      this.failure = null;
      this.generation = 0;
      this.busy = false;
      this.outputting = false;
      this.lastSentAt = -Infinity;
      this.ownedChannels = /* @__PURE__ */ new Set();
      this.stopping = Promise.resolve();
      this.stopFailed = false;
      this.mapper = new AudioMapper();
      this.previewMapper = new AudioMapper();
      this.transport = transport2;
      this.changed = changed;
      this.now = now;
    }
    setTarget(target) {
      const same = target && this.target && target.clientId === this.target.clientId && target.device.slotId === this.target.device.slotId;
      if (!same) void this.stop("\u8BBE\u5907\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u8054\u52A8");
      this.target = target;
      if (!same) {
        this.stopFailed = false;
        this.failure = null;
      }
      if (target && !isConnected(target)) void this.stop("\u8BBE\u5907\u5DF2\u79BB\u7EBF");
      this.changed();
    }
    configure(settings) {
      const valid = validateSettings(settings);
      const mappingKeys = ["metric", "adaptiveGate", "gateDb", "ceilingDb", "gamma", "zcrLow", "zcrHigh", "frequencyLow", "frequencyHigh", "modulationMax"];
      if (mappingKeys.some((key2) => valid[key2] !== this.settings[key2])) {
        this.previewMapper.reset();
        this.previewWave = null;
      }
      const keepArmed = this.armed;
      this.settings = valid;
      this.mapper.reset();
      this.wave = null;
      void this.silence(keepArmed ? "\u53C2\u6570\u5DF2\u5E94\u7528\uFF0C\u7EE7\u7EED\u8054\u52A8" : "\u53C2\u6570\u5DF2\u5E94\u7528", !keepArmed);
      this.changed();
    }
    async start() {
      if (this.starting || this.armed) return;
      this.starting = true;
      const generation = ++this.generation;
      this.changed();
      try {
        await this.stopping;
        if (generation !== this.generation) return;
        this.busy = false;
        if (this.stopFailed) throw new Error("\u4E0A\u6B21\u505C\u6B62\u64CD\u4F5C\u672A\u83B7\u786E\u8BA4\uFF0C\u8BF7\u68C0\u67E5 App \u540E\u65AD\u5F00\u5E76\u91CD\u65B0\u8FDE\u63A5\u3002");
        if (!this.target || !isConnected(this.target)) throw new Error("\u8BF7\u5148\u8FDE\u63A5 App \u5E76\u9009\u62E9\u5728\u7EBF\u7684\u90CA\u72FC 3.0\u3002");
        if (!this.channels().length) throw new Error("\u8BF7\u8BBE\u7F6E\u81F3\u5C11\u4E00\u4E2A\u901A\u9053\u7684\u5F3A\u5EA6\u4E0A\u9650\uFF0C\u5E76\u786E\u8BA4 App \u5DF2\u56DE\u4F20\u975E\u96F6\u4E0A\u9650\u3002");
        this.armed = true;
        this.failure = null;
        this.reason = this.isFresh() ? "\u8054\u52A8\u5DF2\u5C31\u7EEA" : "\u8054\u52A8\u5DF2\u5F00\u542F\uFF0C\u7B49\u5F85\u97F3\u9891";
      } finally {
        this.starting = false;
        this.changed();
      }
    }
    channels() {
      if (!this.target) return [];
      const result = [];
      for (const c of [0, 1]) {
        const enabled = c === 0 ? this.settings.channelA : this.settings.channelB;
        const cap = Math.min(c === 0 ? this.settings.capA : this.settings.capB, channelLimit(this.target, c));
        if (enabled && cap > 0) result.push([c, cap]);
      }
      return result;
    }
    hasRecentSample() {
      return !!this.sample && this.now() - this.sample.at >= 0 && this.now() - this.sample.at <= STALE_MS;
    }
    isFresh() {
      return !!this.sample?.running && this.hasRecentSample();
    }
    accept(sample) {
      this.sample = sample;
      const preview = sample.preview;
      const previewValid = preview.running && this.hasRecentSample() && [preview.rmsDb, preview.peakDb, preview.zcr].every((n) => typeof n === "number" && Number.isFinite(n));
      if (!previewValid) this.previewMapper.reset();
      this.previewWave = previewValid ? this.previewMapper.next({ rmsDb: preview.rmsDb, peakDb: preview.peakDb, zcr: preview.zcr }, this.settings, sample.at) : null;
      const valid = [sample.rmsDb, sample.peakDb, sample.zcr].every((n) => typeof n === "number" && Number.isFinite(n));
      if (!sample.running || !valid || !this.isFresh()) this.mapper.reset();
      this.wave = sample.running && valid && this.isFresh() ? this.mapper.next({ rmsDb: sample.rmsDb, peakDb: sample.peakDb, zcr: sample.zcr }, this.settings, sample.at) : null;
      this.changed();
      if (!this.armed) return;
      if (!this.target || !isConnected(this.target)) {
        void this.stop("\u8BBE\u5907\u5DF2\u79BB\u7EBF");
        return;
      }
      if (!this.isFresh() || !this.wave || this.wave.gated) {
        void this.silence(sample.reason || (this.wave?.gated ? "\u4F4E\u4E8E\u566A\u58F0\u95E8\u9650" : "\u97F3\u9891\u7EDF\u8BA1\u4E0D\u53EF\u7528"), false);
        return;
      }
      const channels = this.channels();
      if (!channels.length) {
        void this.stop("\u6240\u9009\u901A\u9053\u4E0D\u53EF\u8F93\u51FA\uFF0C\u8BF7\u68C0\u67E5 App \u4E0A\u9650\u548C\u9759\u97F3\u72B6\u6001");
        return;
      }
      if ([...this.ownedChannels].some((c) => !channels.some(([active]) => c === active))) {
        void this.silence("\u901A\u9053\u72B6\u6001\u5DF2\u6539\u53D8", false);
        return;
      }
      if (this.busy || this.now() - this.lastSentAt < SAMPLE_MS - 5) return;
      this.lastSentAt = this.now();
      this.busy = true;
      this.outputting = true;
      const generation = this.generation;
      const { clientId, device } = this.target;
      const requests = [];
      for (const [channel, cap] of channels) {
        this.ownedChannels.add(channel);
        requests.push(this.command("\u8BBE\u7F6E\u4E34\u65F6\u5F3A\u5EA6", channel, this.transport.setTempIntensity(clientId, device.slotId, channel, cap, 250, { immediate: true, timeout: RESPONSE_TIMEOUT_MS })));
        requests.push(this.command("\u53D1\u9001\u6CE2\u5F62", channel, this.transport.sendPulse(clientId, device.slotId, channel, SAMPLE_MS, [this.wave.hex], { immediate: true, timeout: RESPONSE_TIMEOUT_MS })));
      }
      this.reason = "\u6B63\u5728\u8DDF\u968F\u97F3\u9891";
      void Promise.all(requests).catch((error) => {
        if (generation === this.generation) {
          this.failure = error instanceof Error ? error.message : String(error);
          void this.stop("\u8BBE\u5907\u6307\u4EE4\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u8BE6\u60C5");
        }
      }).finally(() => {
        if (generation === this.generation) this.busy = false;
        this.changed();
      });
    }
    watchdog() {
      if (!this.sample || this.hasRecentSample()) return;
      this.sample = null;
      this.wave = null;
      this.mapper.reset();
      this.previewWave = null;
      this.previewMapper.reset();
      if (this.armed) void this.silence("\u8054\u52A8\u5DF2\u5F00\u542F\uFF0C\u7B49\u5F85\u97F3\u9891\u6062\u590D", false);
      else this.changed();
    }
    stop(reason = "\u5DF2\u505C\u6B62\u8054\u52A8") {
      this.mapper.reset();
      return this.silence(reason, true);
    }
    command(name, channel, request) {
      return request.catch((error) => {
        const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        throw new Error(`${channel === 0 ? "A" : "B"} \u901A\u9053 \xB7 ${name}\uFF1A${detail}`);
      });
    }
    silence(reason, disarm) {
      if (disarm) {
        this.armed = false;
        this.generation++;
        this.busy = false;
      }
      this.reason = reason;
      if (!this.outputting || !this.target) {
        this.changed();
        return this.stopping;
      }
      this.outputting = false;
      this.generation++;
      this.busy = true;
      const generation = this.generation;
      const { clientId, device } = this.target;
      const requests = [];
      for (const channel of this.ownedChannels) {
        requests.push(this.command("\u6E05\u9664\u4EFB\u52A1", channel, this.transport.clearOperate(clientId, { slotId: device.slotId, channel })));
        requests.push(this.command("\u5F52\u96F6\u5F3A\u5EA6", channel, this.transport.resetIntensity(clientId, device.slotId, channel, { timeout: RESPONSE_TIMEOUT_MS })));
      }
      this.ownedChannels.clear();
      this.stopping = Promise.allSettled(requests).then((results) => {
        const failed = results.some((result) => result.status === "rejected");
        if (this.target?.clientId === clientId && this.target.device.slotId === device.slotId) this.stopFailed = failed;
        if (generation !== this.generation) return;
        this.busy = false;
        if (failed) {
          this.armed = false;
          const details = results.filter((result) => result.status === "rejected").map((result) => result.reason.message);
          this.failure = [this.failure || `\u89E6\u53D1\u539F\u56E0\uFF1A${reason}`, ...details].join("\n");
          this.reason = "\u505C\u6B62\u6307\u4EE4\u672A\u83B7\u786E\u8BA4\uFF0C\u8BF7\u65AD\u5F00\u5E76\u91CD\u65B0\u8FDE\u63A5\uFF1B\u8BE6\u60C5\u89C1\u4E0B\u65B9";
        }
        this.changed();
      });
      this.changed();
      return this.stopping;
    }
  };

  // src/i18n.ts
  var english = {
    "\u90CA\u72FC\u97F3\u9891\u8054\u52A8": "Coyote Audio Link",
    "\u97F3\u9891\u8054\u52A8": "Audio Link",
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
    "\u4E0A\u6B21\u505C\u6B62\u64CD\u4F5C\u672A\u83B7\u786E\u8BA4\uFF0C\u8BF7\u68C0\u67E5 App \u540E\u65AD\u5F00\u5E76\u91CD\u65B0\u8FDE\u63A5\u3002": "The last stop was not acknowledged. Check the device connection, then disconnect and reconnect.",
    "\u8BF7\u5148\u8FDE\u63A5 App \u5E76\u9009\u62E9\u5728\u7EBF\u7684\u90CA\u72FC 3.0\u3002": "Connect and select an online Coyote 3.0 first.",
    "\u8BF7\u8BBE\u7F6E\u81F3\u5C11\u4E00\u4E2A\u901A\u9053\u7684\u5F3A\u5EA6\u4E0A\u9650\uFF0C\u5E76\u786E\u8BA4 App \u5DF2\u56DE\u4F20\u975E\u96F6\u4E0A\u9650\u3002": "Set a positive intensity limit for at least one channel and check its connection limits.",
    "\u8054\u52A8\u5DF2\u5C31\u7EEA": "Audio Link is ready",
    "\u8054\u52A8\u5DF2\u5F00\u542F\uFF0C\u7B49\u5F85\u97F3\u9891": "Audio Link enabled; waiting for audio",
    "\u6240\u9009\u901A\u9053\u4E0D\u53EF\u8F93\u51FA\uFF0C\u8BF7\u68C0\u67E5 App \u4E0A\u9650\u548C\u9759\u97F3\u72B6\u6001": "Selected channels cannot output. Check intensity limits and mute state.",
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
  function resolveLanguage(value, systemLocale) {
    if (value === "en" || value === "zh-CN") return value;
    return systemLocale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  }
  function setLanguage(value, systemLocale = Intl.DateTimeFormat().resolvedOptions().locale) {
    locale = resolveLanguage(value, systemLocale);
    return locale;
  }
  function getLocale() {
    return locale;
  }
  var patterns = Object.entries(english).filter(([key2]) => key2.includes("{")).map(([key2, value]) => {
    const fields = [];
    const escaped = key2.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_, field) => {
      fields.push(field);
      return "(.*?)";
    });
    return { pattern: new RegExp(`^${escaped}$`), value, fields };
  });
  function t(message) {
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
  function bindDocumentLanguage(document2) {
    const texts = [];
    const attributes = [];
    const walker = document2.createTreeWalker(document2.documentElement, 4);
    let node;
    while (node = walker.nextNode()) {
      if (node.parentElement?.matches("script,style")) continue;
      if (node.textContent?.trim()) texts.push({ node, value: node.textContent });
    }
    for (const element of Array.from(document2.querySelectorAll("[aria-label],[title],[placeholder]"))) {
      for (const name of ["aria-label", "title", "placeholder"]) {
        const value = element.getAttribute(name);
        if (value) attributes.push({ node: element, name, value });
      }
    }
    return () => {
      document2.documentElement.lang = locale;
      for (const { node: node2, value } of texts) if (node2.isConnected) node2.nodeValue = value.replace(/\S[\s\S]*\S|\S/, (text) => t(text));
      for (const { node: node2, name, value } of attributes) node2.setAttribute(name, t(value));
    };
  }

  // src/ui.ts
  var bridge = window.iina;
  var $ = (id) => document.getElementById(id);
  var form = $("settings");
  var serverInput = $("server");
  var modeInput = $("connection-mode");
  var nodeInput = $("node-path");
  var deviceSelect = $("device");
  var languageInput = $("language");
  var translateDocument = bindDocumentLanguage(document);
  var language = "system";
  setLanguage(language, navigator.language);
  translateDocument();
  var socket = new DglabSocket({ url: OFFICIAL_SERVER, responseTimeout: RESPONSE_TIMEOUT_MS });
  var shownFailure = null;
  var targets = [];
  var socketState = "idle";
  var dirty = false;
  var hasSource = false;
  var supportsWindowTracking = false;
  var connecting = false;
  var disconnecting = false;
  var connectionGeneration = 0;
  var localResult;
  var samples = [];
  var transport = {
    sendPulse: (...args) => socket.sendPulse(...args),
    setTempIntensity: (...args) => socket.setTempIntensity(...args),
    clearOperate: (...args) => socket.clearOperate(...args),
    resetIntensity: (...args) => socket.resetIntensity(...args)
  };
  var controller = new AudioController(transport, render);
  function showError(error) {
    $("error").dataset.message = error instanceof Error ? error.message : String(error);
    $("error").textContent = t($("error").dataset.message);
    $("error").hidden = false;
  }
  function key(target) {
    return JSON.stringify([target.clientId, target.device.slotId]);
  }
  function updateDevices() {
    targets = socket.clients.flatMap((client) => client.devices.filter((device) => device.type === "COYOTE_030").map((device) => ({ clientId: client.clientId, device })));
    const previous = controller.target ? key(controller.target) : "";
    deviceSelect.replaceChildren();
    if (!targets.length) deviceSelect.add(new Option(t("\u7B49\u5F85 App \u4E2D\u7684\u90CA\u72FC 3.0 \u8BBE\u5907"), ""));
    else {
      deviceSelect.add(new Option(t("\u9009\u62E9\u8F93\u51FA\u8BBE\u5907"), ""));
      for (const target of targets) deviceSelect.add(new Option(`${target.device.name} \xB7 ${target.clientId.slice(0, 6)}${isConnected(target) ? "" : ` \xB7 ${t("\u79BB\u7EBF")}`}`, key(target)));
    }
    const selected = targets.find((target) => key(target) === previous) || (targets.length === 1 ? targets[0] : null);
    controller.setTarget(selected);
    deviceSelect.value = selected ? key(selected) : "";
    if (selected) $("pairing").open = false;
    render();
  }
  function validateServer(raw) {
    const url = new URL(raw.trim());
    if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.hash || url.searchParams.has("tid") || url.searchParams.has("targetId")) {
      throw new Error("\u8BF7\u8F93\u5165 V4 \u63A7\u5236\u7AEF ws:// \u6216 wss:// \u5730\u5740\uFF0C\u4E0D\u8981\u5E26\u914D\u5BF9 ID\u3001\u7528\u6237\u540D\u6216\u7247\u6BB5\u3002");
    }
    return url.toString();
  }
  async function disconnect(reason) {
    connectionGeneration++;
    disconnecting = true;
    localResult?.({ error: reason });
    render();
    try {
      await controller.stop(reason);
    } finally {
      socket.disconnect();
      bridge?.postMessage("local-stop", {});
      disconnecting = false;
      render();
    }
  }
  function startLocal() {
    if (window.location.protocol !== "file:") return Promise.reject(new Error("\u8BF7\u5728 IINA \u63D2\u4EF6\u7A97\u53E3\u4E2D\u542F\u52A8\u672C\u673A\u4E2D\u7EE7\u3002"));
    const scriptPath = decodeURIComponent(new URL("relay.cjs", window.location.href).pathname);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        localResult = void 0;
        bridge?.postMessage("local-stop", {});
        reject(new Error("\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5 Node.js \u8DEF\u5F84\u3002"));
      }, 1e4);
      localResult = (data) => {
        clearTimeout(timeout);
        localResult = void 0;
        if (data.url) resolve(data.url);
        else reject(new Error(data.error || "\u672C\u5730\u4E2D\u7EE7\u542F\u52A8\u5931\u8D25\u3002"));
      };
      bridge?.postMessage("local-start", { nodePath: nodeInput.value.trim(), scriptPath });
    });
  }
  async function connect() {
    if (connecting || disconnecting) return;
    if (socketState === "paired" || socketState === "waiting_for_peer") {
      await disconnect("\u5DF2\u65AD\u5F00\u8FDE\u63A5");
      return;
    }
    const generation = ++connectionGeneration;
    const local = modeInput.value === "local";
    connecting = true;
    $("error").hidden = true;
    render();
    socket.disconnect();
    try {
      const url = local ? await startLocal() : validateServer(serverInput.value);
      if (generation !== connectionGeneration) return;
      const current = new DglabSocket({ url, connectTimeout: 8e3, responseTimeout: RESPONSE_TIMEOUT_MS });
      socket = current;
      current.on("state", (state) => {
        if (current !== socket) return;
        socketState = state;
        if (state === "disconnected" || state === "idle") {
          if (local) bridge?.postMessage("local-stop", {});
          void controller.stop("\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u5E76\u5F00\u59CB\u8054\u52A8");
          controller.setTarget(null);
          targets = [];
          $("pairing").hidden = true;
          deviceSelect.replaceChildren(new Option(t("\u7B49\u5F85 App \u8FDE\u63A5"), ""));
        }
        render();
      });
      current.on("devices", () => {
        if (current === socket) updateDevices();
      });
      current.on("client-disconnected", () => {
        if (current === socket) updateDevices();
      });
      current.on("error", (error) => {
        if (current !== socket) return;
        void controller.stop("\u8FDE\u63A5\u53D1\u751F\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5 App");
        showError(error);
      });
      const { targetId } = await current.connect();
      if (current !== socket || generation !== connectionGeneration) return;
      const appUrl = new URL(url);
      appUrl.searchParams.set("tid", targetId);
      $("pair-url").value = appUrl.toString();
      $("qr").hidden = local;
      $("pair-grid").classList.toggle("local", local);
      $("pairing-title").textContent = t(local ? "\u672C\u673A\u8FDE\u63A5\u5730\u5740" : "\u914D\u5BF9\u4E8C\u7EF4\u7801\u4E0E\u8FDE\u63A5\u5730\u5740");
      $("pairing-hint").textContent = t(local ? "\u590D\u5236\u4E0B\u65B9\u5730\u5740\u5230\u540C\u4E00\u53F0 Mac \u7684 App\u3002\u91CD\u65B0\u8FDE\u63A5\u540E\u9700\u4F7F\u7528\u65B0\u5730\u5740\u3002" : "\u624B\u673A\u53EF\u626B\u7801\uFF1B\u684C\u9762 App \u53EF\u590D\u5236\u4E0B\u65B9\u5730\u5740\u3002");
      if (!local) {
        const pairing = `https://dungeon-lab.cn/s/?v=1&action=socket&url=${encodeURIComponent(appUrl.toString())}`;
        await import_qrcode.default.toCanvas($("qr"), pairing, { width: 172, margin: 3, errorCorrectionLevel: "M" });
      }
      if (generation !== connectionGeneration) return;
      $("pairing").hidden = false;
      $("pairing").open = true;
      save();
    } catch (error) {
      if (generation === connectionGeneration) {
        socket.disconnect();
        if (local) bridge?.postMessage("local-stop", {});
        throw error;
      }
    } finally {
      connecting = false;
      render();
    }
  }
  function populate(settings) {
    for (const [key2, value] of Object.entries(settings)) {
      const field = form.elements.namedItem(key2);
      if (!field) continue;
      if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = value;
      else field.value = String(value);
    }
    dirty = false;
  }
  function readSettings() {
    const result = {};
    for (const key2 of Object.keys(DEFAULT_SETTINGS)) {
      const field = form.elements.namedItem(key2);
      result[key2] = field.type === "checkbox" ? field.checked : key2 === "metric" ? field.value : Number(field.value);
    }
    return validateSettings(result);
  }
  function save() {
    bridge?.postMessage("save", { settings: controller.settings, server: serverInput.value.trim(), connectionMode: modeInput.value, nodePath: nodeInput.value.trim() });
  }
  function render() {
    const states = { idle: "\u672A\u8FDE\u63A5", connecting: "\u6B63\u5728\u8FDE\u63A5", waiting_for_peer: "\u7B49\u5F85 App \u914D\u5BF9", paired: "App \u5DF2\u8FDE\u63A5", disconnected: "\u8FDE\u63A5\u5DF2\u65AD\u5F00" };
    $("connection-state").textContent = t(states[socketState] || socketState);
    $("connection-state").classList.toggle("connected", socketState === "paired");
    $("connect").textContent = t(connecting ? "\u8FDE\u63A5\u4E2D\u2026" : ["paired", "waiting_for_peer"].includes(socketState) ? "\u65AD\u5F00\u8FDE\u63A5" : "\u8FDE\u63A5 App");
    $("connect").disabled = connecting || disconnecting;
    serverInput.disabled = modeInput.disabled = nodeInput.disabled = connecting || disconnecting || ["paired", "waiting_for_peer"].includes(socketState);
    const local = modeInput.value === "local";
    $("local-settings").hidden = !local;
    $("remote-settings").hidden = local;
    $("connection-hint").textContent = t(local ? "\u8FDE\u63A5\u540E\uFF0C\u5C06 Socket \u5730\u5740\u7C98\u8D34\u5230\u540C\u4E00\u53F0 Mac \u7684\u5B98\u65B9 App\u3002" : "\u8FDE\u63A5\u540E\uFF0C\u7528\u5B98\u65B9 App \u7684 Socket \u63A7\u5236\u626B\u7801\u6216\u7C98\u8D34\u5730\u5740\u914D\u5BF9\u3002");
    $("dirty").textContent = t(dirty ? "\u4FEE\u6539\u5C1A\u672A\u5E94\u7528" : "\u53C2\u6570\u5DF2\u5E94\u7528");
    $("status").textContent = t(controller.reason) + (dirty ? ` \xB7 ${t("\u53C2\u6570\u5C1A\u672A\u5E94\u7528\uFF0C\u8BF7\u5148\u70B9\u300C\u5E94\u7528\u53C2\u6570\u300D\u3002")}` : "");
    $("start").disabled = controller.armed || controller.starting || connecting || disconnecting || !controller.target || !hasSource || !supportsWindowTracking || dirty;
    $("start").textContent = t(controller.armed ? "\u8054\u52A8\u5DF2\u5F00\u542F" : controller.starting ? "\u6B63\u5728\u51C6\u5907\u2026" : dirty ? "\u8BF7\u5148\u5E94\u7528\u53C2\u6570" : "\u5F00\u59CB\u8054\u52A8");
    const sample = controller.sample?.preview;
    const number = (n, digits = 1) => typeof n === "number" && Number.isFinite(n) ? Math.max(-99, n).toFixed(digits) : "\u2014";
    $("rms").textContent = number(sample?.rmsDb);
    $("peak").textContent = number(sample?.peakDb);
    $("zcr").textContent = number(sample?.zcr, 3);
    $("amplitude").textContent = String(controller.previewWave?.intensity || 0);
    $("signal-state").textContent = t(sample?.running ? `\u95E8\u9650 ${number(controller.previewWave?.gateDb)} dBFS \xB7 ${controller.previewWave?.gated ? "\u5173\u95ED" : "\u901A\u8FC7"}` : sample?.reason || "\u7B49\u5F85\u97F3\u9891");
    if (controller.sample) $("source").textContent = controller.sample.title;
    for (const [channel, id] of [[0, "channel-a"], [1, "channel-b"]]) {
      $(id).textContent = t(controller.target ? `App \u5F53\u524D ${number(Number(controller.target.device.props?.[channel === 0 ? "intensityA" : "intensityB"]), 0)} / \u4E0A\u9650 ${channelLimit(controller.target, channel)}` : "\u7B49\u5F85 App \u56DE\u4F20\u4E0A\u9650");
    }
    if (shownFailure !== controller.failure) {
      if (controller.failure) showError(controller.failure);
      else if ($("error").dataset.message === shownFailure) {
        $("error").hidden = true;
        delete $("error").dataset.message;
      }
      shownFailure = controller.failure;
    }
    if ($("error").dataset.message) $("error").textContent = t($("error").dataset.message);
  }
  function drawScope() {
    const canvas = $("scope");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gate = controller.previewWave?.gateDb ?? controller.settings.gateDb;
    const y = (db) => height - Math.max(0, Math.min(1, (db + 75) / 75)) * (height - 8) - 4;
    ctx.strokeStyle = "#777777";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(0, y(gate));
    ctx.lineTo(width, y(gate));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim();
    ctx.lineWidth = 2;
    ctx.beginPath();
    let penDown = false;
    samples.forEach((db, i) => {
      if (db === null) {
        penDown = false;
        return;
      }
      const x = width * (120 - samples.length + i) / 119;
      if (penDown) ctx.lineTo(x, y(db));
      else ctx.moveTo(x, y(db));
      penDown = true;
    });
    ctx.stroke();
  }
  $("connect").addEventListener("click", () => {
    void connect().catch(showError);
  });
  languageInput.addEventListener("change", () => {
    language = languageInput.value;
    setLanguage(language, navigator.language);
    translateDocument();
    bridge?.postMessage("language", { language, locale: getLocale() });
    for (const option of Array.from(deviceSelect.options)) {
      const target = targets.find((item) => key(item) === option.value);
      if (target) option.text = `${target.device.name} \xB7 ${target.clientId.slice(0, 6)}${isConnected(target) ? "" : ` \xB7 ${t("\u79BB\u7EBF")}`}`;
      else option.text = t(targets.length ? "\u9009\u62E9\u8F93\u51FA\u8BBE\u5907" : "\u7B49\u5F85 App \u4E2D\u7684\u90CA\u72FC 3.0 \u8BBE\u5907");
    }
    $("pairing-title").textContent = t(modeInput.value === "local" ? "\u672C\u673A\u8FDE\u63A5\u5730\u5740" : "\u914D\u5BF9\u4E8C\u7EF4\u7801\u4E0E\u8FDE\u63A5\u5730\u5740");
    $("pairing-hint").textContent = t(modeInput.value === "local" ? "\u590D\u5236\u4E0B\u65B9\u5730\u5740\u5230\u540C\u4E00\u53F0 Mac \u7684 App\u3002\u91CD\u65B0\u8FDE\u63A5\u540E\u9700\u4F7F\u7528\u65B0\u5730\u5740\u3002" : "\u624B\u673A\u53EF\u626B\u7801\uFF1B\u684C\u9762 App \u53EF\u590D\u5236\u4E0B\u65B9\u5730\u5740\u3002");
    $("copy").textContent = t("\u590D\u5236");
    render();
  });
  modeInput.addEventListener("change", () => {
    render();
    save();
  });
  $("copy").addEventListener("click", async () => {
    const input = $("pair-url");
    try {
      await navigator.clipboard.writeText(input.value);
      $("copy").textContent = t("\u5DF2\u590D\u5236");
    } catch {
      input.focus();
      input.select();
      $("copy").textContent = t("\u8BF7\u6309 \u2318C");
    }
  });
  deviceSelect.addEventListener("change", () => controller.setTarget(targets.find((target) => key(target) === deviceSelect.value) || null));
  form.addEventListener("input", () => {
    dirty = true;
    render();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      controller.configure(readSettings());
      dirty = false;
      save();
      $("error").hidden = true;
      render();
    } catch (error) {
      showError(error);
    }
  });
  $("start").addEventListener("click", () => {
    $("error").hidden = true;
    void controller.start().catch(showError);
  });
  $("stop").addEventListener("click", () => {
    void controller.stop();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void controller.stop();
    }
  });
  window.addEventListener("pagehide", () => {
    void disconnect("\u63A7\u5236\u7A97\u53E3\u5DF2\u5173\u95ED");
  });
  setInterval(() => controller.watchdog(), 100);
  populate(DEFAULT_SETTINGS);
  if (bridge) {
    bridge.onMessage("init", (data) => {
      language = data.language || "system";
      languageInput.value = language;
      setLanguage(language, navigator.language);
      translateDocument();
      bridge.postMessage("language", { language, locale: getLocale() });
      if (!dirty && !controller.armed) {
        controller.configure(data.settings);
        populate(data.settings);
      }
      if (!connecting && !["paired", "waiting_for_peer"].includes(socketState)) {
        serverInput.value = data.server;
        modeInput.value = data.connectionMode === "local" ? "local" : "remote";
        nodeInput.value = data.nodePath || "";
      }
      hasSource = data.hasSource;
      supportsWindowTracking = data.supportsWindowTracking;
      if (!supportsWindowTracking) showError("\u5F53\u524D IINA \u7F3A\u5C11\u63A7\u5236\u7A97\u53E3\u72B6\u6001\u63A5\u53E3\uFF0C\u8BF7\u5347\u7EA7 IINA \u540E\u4F7F\u7528\u8054\u52A8\u3002");
      $("source").textContent = t(data.sourceTitle);
      render();
    });
    bridge.onMessage("audio", (sample) => {
      hasSource = true;
      controller.accept(sample);
      samples.push(sample.preview.running ? controller.previewWave?.db ?? null : null);
      if (samples.length > 120) samples.shift();
      drawScope();
    });
    bridge.onMessage("audio-stale", () => controller.watchdog());
    bridge.onMessage("stop", (data) => {
      void controller.stop(data.reason);
    });
    bridge.onMessage("local-result", (data) => localResult?.(data));
    bridge.onMessage("disconnect", (data) => {
      void disconnect(data.reason);
    });
    bridge.onMessage("error", (data) => showError(data.message));
    bridge.postMessage("ready");
  } else {
    showError("\u8BF7\u5728 IINA \u7684\u63D2\u4EF6\u63A7\u5236\u7A97\u53E3\u4E2D\u6253\u5F00\u6B64\u9875\u9762\u3002");
    $("connect").disabled = true;
  }
  render();
})();
