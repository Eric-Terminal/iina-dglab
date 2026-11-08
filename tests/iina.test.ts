import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { FILTER_LABEL } from '../src/shared';

test('IINA 入口按标签增删滤镜，并正确处理暂停、静音、跳转及媒体切换', () => {
  const code = buildSync({ entryPoints: ['src/main.ts'], bundle: true, write: false, format: 'iife' }).outputFiles[0].text;
  const handlers: Record<string, Function> = {}, events: Record<string, Function> = {};
  const messages: { name: string; data: any }[] = [];
  const filters = [{ label: 'user_equalizer' }];
  const flags: Record<string, boolean> = {};
  let tick!: Function;
  const status = { idle: false, paused: false, position: 1, title: '测试媒体' };
  let now = 1000;
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(code, { Date: Clock, setInterval: (fn: Function) => { tick = fn; }, iina: {
    core: { status }, menu: { item() {}, addItem() {} },
    global: { onMessage: (name: string, fn: Function) => { handlers[name] = fn; }, postMessage: (name: string, data: any) => { messages.push({ name, data }); } },
    event: { on: (name: string, fn: Function) => { events[name] = fn; } },
    mpv: {
      getNative: (name: string) => name === 'af' ? filters : name === 'audio-params' ? { samplerate: 48000 } : { 'lavfi.astats.Overall.RMS_level': '-20', 'lavfi.astats.Overall.Peak_level': '-10', 'lavfi.astats.1.RMS_level': '-20', 'lavfi.astats.1.Zero_crossings_rate': '0.1' },
      getFlag: (name: string) => flags[name] || false, getNumber: () => 50,
      command: (_: string, args: string[]) => { if (args[0] === 'add') filters.push({ label: FILTER_LABEL }); else filters.splice(filters.findIndex(f => `@${f.label}` === args[1]), 1); },
    },
  } });
  handlers.capture({ enabled: true });
  assert.equal(filters.length, 2); assert.equal(messages.at(-1)!.data.running, true);
  handlers.capture({ enabled: true }); assert.equal(filters.length, 2);
  status.paused = true; tick(); assert.equal(messages.at(-1)!.data.running, false);
  status.paused = false; flags.mute = true; tick(); assert.match(messages.at(-1)!.data.reason, /静音/);
  flags.mute = false; events['mpv.seek'](); assert.match(messages.at(-1)!.data.reason, /定位/);
  now += 300; status.position = 2; tick(); assert.equal(messages.at(-1)!.data.running, true);
  events['iina.file-loaded'](); assert.ok(messages.some(m => m.name === 'source-reset'));
  handlers.capture({ enabled: false }); assert.deepEqual(filters, [{ label: 'user_equalizer' }]);
});
