import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { FILTER_LABEL } from '../src/shared';

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
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(code, { Date: Clock, setInterval: (fn: Function) => { tick = fn; }, iina: {
    core: { status }, menu: { item(name: string, fn: Function) { menus[name] = fn; }, addItem() {} },
    global: { onMessage: (name: string, fn: Function) => { handlers[name] = fn; }, postMessage: (name: string, data: any) => { messages.push({ name, data }); } },
    event: { on: (name: string, fn: Function) => { events[name] = fn; } },
    mpv: {
      getNative: (name: string) => name === 'time-pos' ? status.position : name === 'af' ? filters : name === 'audio-params' ? { samplerate: 48000 } : { 'lavfi.astats.Overall.RMS_level': '-20', 'lavfi.astats.Overall.Peak_level': '-10', 'lavfi.astats.1.RMS_level': '-20', 'lavfi.astats.1.Zero_crossings_rate': '0.1' },
      getFlag: (name: string) => flags[name] || false, getNumber: () => 50,
      command: (_: string, args: string[]) => { if (args[0] === 'add') { if (!rejectFilter) filters.push({ label: FILTER_LABEL }); } else filters.splice(filters.findIndex(f => `@${f.label}` === args[1]), 1); },
    },
  } });
  // 全局入口不回传 capture 消息时，点击当前播放窗口的菜单仍须直接启用采样。
  menus['打开音频联动（使用当前窗口）']();
  assert.equal(filters.length, 2); assert.equal(messages.at(-1)!.data.running, true);
  handlers.capture({ enabled: true }); assert.equal(filters.length, 2);
  flags.pause = true; tick(); assert.equal(messages.at(-1)!.data.running, false);
  assert.match(messages.at(-1)!.data.reason, /暂停/);
  flags.pause = false; flags.mute = true; tick(); assert.match(messages.at(-1)!.data.reason, /静音/);
  flags.mute = false; events['mpv.seek'](); assert.match(messages.at(-1)!.data.reason, /定位/);
  now += 300; status.position = 2; tick(); assert.equal(messages.at(-1)!.data.running, true);
  events['iina.file-loaded'](); assert.ok(messages.some(m => m.name === 'source-reset'));
  filters.splice(1); now += 1100; status.position = 3; tick();
  assert.equal(filters.length, 2); assert.equal(messages.at(-1)!.data.running, true);
  filters.splice(1); rejectFilter = true; now += 1100; status.position = 4; tick();
  assert.equal(messages.at(-1)!.data.running, false);
  assert.match(messages.at(-1)!.data.reason, /挂载失败/);
  handlers.capture({ enabled: false }); assert.deepEqual(filters, [{ label: 'user_equalizer' }]);
});

test('全局入口切换普通播放窗口时定向停用旧音源，不使用 null 广播', () => {
  const code = buildSync({ entryPoints: ['src/global.ts'], bundle: true, write: false, format: 'iife' }).outputFiles[0].text;
  const handlers: Record<string, Function> = {};
  const sent: unknown[][] = [];
  const windowHandlers: Record<string, Function> = {};
  const windowMessages: { name: string; data: any }[] = [];
  vm.runInNewContext(code, { setInterval() {}, iina: {
    global: { onMessage: (name: string, fn: Function) => { handlers[name] = fn; }, postMessage: (...args: unknown[]) => sent.push(args) },
    standaloneWindow: { loadFile() {}, setProperty() {}, setFrame() {},
      onMessage: (name: string, fn: Function) => { windowHandlers[name] = fn; },
      postMessage: (name: string, data: any) => windowMessages.push({ name, data }), open() {}, isOpen: () => true },
    menu: { item() {}, addItem() {} }, preferences: { get() {} }, console: { warn() {} },
  } });
  handlers['select-source']({ title: '第一个窗口' }, 'player-1');
  handlers['select-source']({ title: '第二个窗口' }, 'player-2');
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 'player-1');
  assert.equal(sent[0][1], 'capture');
  assert.equal((sent[0][2] as any).enabled, false);
  windowHandlers.ready();
  assert.equal(windowMessages.find(message => message.name === 'init')!.data.connectionMode, 'remote');
});
