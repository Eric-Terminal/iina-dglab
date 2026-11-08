import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { DEFAULT_SETTINGS } from '../src/shared';
import type { BluetoothStatus } from '../src/bluetooth-helper';

test('完整控制台支持英文直连流程、暂停时开启、独立预览与运行中应用参数', async () => {
  const dom = new JSDOM(readFileSync('src/ui.html', 'utf8'), { url: 'file:///fixture/dist/ui.html', runScripts: 'outside-only' });
  const { window } = dom;
  const handlers: Record<string, Function> = {};
  const requests: any[] = [];
  let status: BluetoothStatus = { state: 'idle', devices: [], deviceId: null, battery: null, capA: 0, capB: 0, intensityA: 0, intensityB: 0, error: null };
  window.HTMLCanvasElement.prototype.getContext = (() => null) as any;
  const $ = <T extends HTMLElement>(id: string) => window.document.getElementById(id) as T;
  const field = (name: string) => window.document.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
  const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
  (window as any).iina = {
    onMessage(name: string, callback: Function) { handlers[name] = callback; },
    postMessage(name: string, data: any) {
      if (name === 'ready') {
        handlers.init({ language: 'en', settings: { ...DEFAULT_SETTINGS, capA: 10, capB: 8, adaptiveGate: false, advanceMs: 1000 }, server: 'wss://example.com/v4', connectionMode: 'bluetooth', nodePath: '', sourceTitle: 'Synthetic audio', hasSource: true, supportsWindowTracking: true });
      }
      if (name !== 'bluetooth') return;
      requests.push(data);
      if (data.method === 'scan') status = { ...status, state: 'scanning', devices: [{ id: 'device-1', name: 'Coyote 3.0', rssi: -30 }] };
      if (data.method === 'configure') status = { ...status, capA: data.params.capA, capB: data.params.capB };
      if (data.method === 'connect') status = { ...status, state: 'ready', deviceId: data.params.id, battery: 80 };
      queueMicrotask(() => handlers['bluetooth-result']({ id: data.id, result: data.method === 'start' ? { session: 'ui-test', status } : status }));
    },
  };
  try {
    window.eval(buildSync({ entryPoints: ['src/ui.ts'], bundle: true, write: false, format: 'iife', platform: 'browser' }).outputFiles[0].text);
    assert.equal(window.document.documentElement.lang, 'en');
    assert.equal($('app-settings').hidden, true);
    assert.equal($<HTMLButtonElement>('start').disabled, true);
    $('connect').click(); await flush();
    assert.equal($<HTMLSelectElement>('bluetooth-device').value, 'device-1');
    $('bluetooth-pair').click(); await flush();
    assert.equal($('connection-state').textContent, 'Bluetooth connected');
    assert.equal(requests.some(request => ['pulse', 'intensity'].includes(request.method)), false, '连接不应输出');
    assert.equal($<HTMLButtonElement>('start').disabled, false, '暂停或无采样仍可开启');
    $('start').click(); await flush();
    assert.match($('status').textContent!, /waiting for audio/i);
    const reading = { running: true, reason: '', rmsDb: -10, peakDb: -3, zcr: 0.2 };
    handlers.audio({ at: Date.now(), title: 'Synthetic audio', ...reading, preview: { ...reading, rmsDb: -80, peakDb: -70 } });
    await flush();
    assert.equal($('rms').textContent, '-80.0'); assert.equal($('amplitude').textContent, '0');
    assert.ok(requests.some(request => request.method === 'pulse' && !request.params.frame.endsWith('00000000')), '未来波形输出不应改变当前预览');
    const beforeLanguage = requests.length;
    const language = $<HTMLSelectElement>('language');
    language.value = 'zh-CN'; language.dispatchEvent(new window.Event('change'));
    assert.equal(requests.length, beforeLanguage, '切换语言不发设备命令');
    assert.equal(field('advanceMs').value, '1000');
    field('gateDb').value = '-40'; field('gateDb').dispatchEvent(new window.Event('input', { bubbles: true }));
    $('settings').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await flush();
    assert.equal($('start').textContent, '联动已开启');
    assert.ok(requests.some(request => request.method === 'clear'), '应用参数先清理旧任务');
    $('stop').click(); await flush();
    assert.equal($('start').textContent, '开始联动');
    $('connect').click(); await flush();
    assert.equal($<HTMLSelectElement>('connection-mode').disabled, false);
    assert.equal($('connection-state').textContent, '未连接');
  } finally { window.close(); }
});
