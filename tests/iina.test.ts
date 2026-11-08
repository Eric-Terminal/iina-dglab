import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { DEFAULT_SETTINGS, FILTER_LABEL } from '../src/shared';
import { statsFrame } from './audio-fixture';

test('IINA 入口按标签增删滤镜，并正确处理暂停、静音、跳转及媒体切换', () => {
  const code = buildSync({ entryPoints: ['src/main.ts'], bundle: true, write: false, format: 'iife' }).outputFiles[0].text;
  const handlers: Record<string, Function> = {}, events: Record<string, Function> = {};
  const messages: { name: string; data: any }[] = [];
  const menus: Record<string, Function> = {};
  const filters = [{ label: 'user_equalizer' }];
  const flags: Record<string, boolean> = {};
  let tick!: Function;
  const status = { idle: false, paused: false, position: 1, title: '测试媒体' };
  let now = 1000;
  let rejectFilter = false;
  const files = new Map<string, string>();
  let activePath = '';
  let closedReaders = 0;
  let oversized = false;
  const settings = { advanceMs: 0 };
  const numbers: Record<string, number> = { volume: 50, speed: 1, 'audio-buffer': 0.2 };
  let clockReady = true;
  const writeFrames = (position: number) => files.set(activePath,
    (files.get(activePath) || '') + statsFrame(position, -20) + statsFrame(position + 0.1, -10) + statsFrame(position + 0.2, -30) + statsFrame(position + 0.3));
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(code, { Date: Clock, setInterval: (fn: Function) => { tick = fn; }, iina: {
    core: { status }, menu: { item(name: string, fn: Function) { menus[name] = fn; }, addItem() {}, removeAllItems() {} },
    global: { onMessage: (name: string, fn: Function) => { handlers[name] = fn; }, postMessage: (name: string, data: any) => { messages.push({ name, data }); } },
    event: { on: (name: string, fn: Function) => { events[name] = fn; } },
    preferences: { get: (name: string) => name === 'language' ? 'zh-CN' : settings }, utils: { resolvePath: (path: string) => path },
    file: {
      exists: (path: string) => files.has(path),
      write: (path: string, text: string) => { activePath = path; files.set(path, text); oversized = false; },
      delete: (path: string) => files.delete(path),
      handle: (path: string) => {
        let offset = 0;
        return {
          offset: () => offset, seekTo: (value: number) => { offset = value; },
          seekToEnd: () => { offset = oversized ? 33 * 1024 * 1024 : Buffer.byteLength(files.get(path)!); },
          read: (size: number) => { const bytes = Buffer.from(files.get(path)!).subarray(offset, offset + size); offset += bytes.length; return bytes; },
          close: () => { closedReaders++; },
        };
      },
    },
    mpv: {
      getNative: (name: string) => name === 'audio-pts' && !clockReady ? undefined : ['time-pos', 'audio-pts'].includes(name) ? status.position : name === 'af' ? filters : name === 'audio-params' ? { samplerate: 48000 } : undefined,
      getFlag: (name: string) => flags[name] || false, getNumber: (name: string) => numbers[name],
      set: (name: string, value: number) => { numbers[name] = value; files.set(activePath, ''); writeFrames(status.position); },
      command: (_: string, args: string[]) => {
        if (args[0] === 'add') { if (!rejectFilter) { filters.push({ label: FILTER_LABEL }); writeFrames(status.position); } }
        else filters.splice(filters.findIndex(f => `@${f.label}` === args[1]), 1);
      },
    },
  } });
  // 全局入口不回传 capture 消息时，点击当前播放窗口的菜单仍须直接启用采样。
  menus['打开音频联动（使用当前窗口）']();
  assert.equal(filters.length, 2); assert.equal(messages.at(-1)!.data.running, true);
  assert.equal(messages.at(-1)!.data.rmsDb, -20);
  handlers.capture({ enabled: true }); assert.equal(filters.length, 2);
  settings.advanceMs = 100;
  clockReady = false; tick();
  assert.match(messages.at(-1)!.data.reason, /播放时钟/);
  assert.equal(numbers['audio-buffer'], 0.2, '不能在音频时钟就绪前调整缓冲');
  clockReady = true;
  tick(); assert.match(messages.at(-1)!.data.reason, /预读缓冲/);
  writeFrames(1); tick(); assert.equal(messages.at(-1)!.data.rmsDb, -10);
  assert.equal(messages.at(-1)!.data.preview.rmsDb, -20, '提前 100 ms 时，预览仍取当前播放时刻');
  settings.advanceMs = 0; tick(); writeFrames(1); tick();
  flags.pause = true; tick(); assert.equal(messages.at(-1)!.data.running, false);
  assert.match(messages.at(-1)!.data.reason, /暂停/);
  flags.pause = false; flags.mute = true; tick(); assert.match(messages.at(-1)!.data.reason, /静音/);
  flags.mute = false; events['mpv.seek'](); assert.match(messages.at(-1)!.data.reason, /定位/);
  now += 300; status.position = 2; writeFrames(2); tick(); assert.equal(messages.at(-1)!.data.running, true);
  events['mpv.seek'](); now += 300; status.position = 0.5;
  files.set(activePath, ''); writeFrames(0.5); tick(); assert.equal(messages.at(-1)!.data.rmsDb, -20);
  const oldPath = activePath;
  oversized = true; tick();
  assert.equal(files.has(oldPath), false); assert.equal(files.size, 1);
  tick(); assert.equal(messages.at(-1)!.data.running, true);
  events['iina.file-loaded'](); assert.ok(messages.some(m => m.name === 'source-reset'));
  filters.splice(1); now += 1100; status.position = 3; tick();
  assert.equal(filters.length, 2); assert.equal(messages.at(-1)!.data.running, true);
  filters.splice(1); rejectFilter = true; now += 1100; status.position = 4; tick();
  assert.equal(messages.at(-1)!.data.running, false);
  assert.match(messages.at(-1)!.data.reason, /挂载失败/);
  handlers.capture({ enabled: false }); assert.deepEqual(filters, [{ label: 'user_equalizer' }]);
  assert.equal(files.size, 0); assert.ok(closedReaders >= 3);
  assert.equal(numbers['audio-buffer'], 0.2);
});

test('全局入口切换普通播放窗口时定向停用旧音源，不使用 null 广播', () => {
  const code = buildSync({ entryPoints: ['src/global.ts'], bundle: true, write: false, format: 'iife' }).outputFiles[0].text;
  const handlers: Record<string, Function> = {};
  const sent: unknown[][] = [];
  const windowHandlers: Record<string, Function> = {};
  const windowMessages: { name: string; data: any }[] = [];
  let now = 1000;
  let checkSamples!: Function;
  let visible = true;
  const menus: Record<string, Function> = {};
  const oldSettings: Partial<typeof DEFAULT_SETTINGS> = { ...DEFAULT_SETTINGS, capA: 12, gateDb: -36 };
  delete oldSettings.advanceMs;
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(code, { Date: Clock, setTimeout() {}, setInterval(fn: Function, ms: number) { if (ms === 100) checkSamples = fn; }, iina: {
    global: { onMessage: (name: string, fn: Function) => { handlers[name] = fn; }, postMessage: (...args: unknown[]) => sent.push(args) },
    standaloneWindow: { loadFile() {}, setProperty() {}, setFrame() {},
      onMessage: (name: string, fn: Function) => { windowHandlers[name] = fn; },
      postMessage: (name: string, data: any) => windowMessages.push({ name, data }), open() { visible = true; }, isOpen: () => visible },
    menu: { item(name: string, fn: Function) { menus[name] = fn; }, addItem() {}, removeAllItems() {} },
    preferences: { get: (name: string) => name === 'language' ? 'zh-CN' : name === 'settings' ? oldSettings : undefined }, console: { warn() {} },
  } });
  handlers['select-source']({ title: '第一个窗口' }, 'player-1');
  handlers['select-source']({ title: '第二个窗口' }, 'player-2');
  assert.equal(sent.length, 3);
  assert.equal(sent[1][0], 'player-1');
  assert.equal(sent[1][1], 'capture');
  assert.equal((sent[1][2] as any).enabled, false);
  windowHandlers.ready();
  assert.equal(windowMessages.find(message => message.name === 'init')!.data.connectionMode, 'remote');
  const migrated = windowMessages.find(message => message.name === 'init')!.data.settings;
  assert.equal(migrated.advanceMs, 0); assert.equal(migrated.capA, 12); assert.equal(migrated.gateDb, -36);
  handlers.audio({ at: now, title: '第二个窗口', running: false, reason: '播放已暂停' }, 'player-2');
  now += 400;
  checkSamples();
  assert.equal(windowMessages.at(-1)!.name, 'audio-stale');
  const count = windowMessages.length;
  checkSamples();
  assert.equal(windowMessages.length, count);
  handlers.audio({ at: now, title: '第二个窗口', running: true, reason: '' }, 'player-2');
  assert.equal(windowMessages.at(-1)!.name, 'audio');
  visible = false; checkSamples();
  assert.equal(sent.at(-1)![0], 'player-2'); assert.equal((sent.at(-1)![2] as any).enabled, false);
  menus['打开音频联动控制台']();
  assert.equal(sent.at(-1)![0], 'player-2'); assert.equal((sent.at(-1)![2] as any).enabled, true);
});
