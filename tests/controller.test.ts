import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioController, type Target, type Transport } from '../src/controller';
import { DglabSocketDeviceType } from 'dglab-kit';
import { DEFAULT_SETTINGS, type AudioSample } from '../src/shared';

const flush = () => new Promise(resolve => setImmediate(resolve));
export const target: Target = { clientId: 'app-1', device: { slotId: 'coyote-1', name: '测试郊狼', type: DglabSocketDeviceType.COYOTE_030, props: { connectState: 'connected', intensityA: 0, intensityB: 0 }, slotState: { hasDevice: true, channelA: { intensityMax: 15 }, channelB: { intensityMax: 12 } } } };
export const sample = (at: number, overrides: Partial<AudioSample> = {}): AudioSample => ({ at, title: '测试音频', running: true, reason: '', rmsDb: -10, peakDb: -5, zcr: 0.04, ...overrides });
function setup() {
  const calls: { name: string; args: unknown[] }[] = [];
  let now = 1000;
  const transport = Object.fromEntries(['sendPulse', 'setTempIntensity', 'clearOperate', 'resetIntensity'].map(name => [name, (...args: unknown[]) => { calls.push({ name, args }); return Promise.resolve(); }])) as unknown as Transport;
  const controller = new AudioController(transport, () => {}, () => now);
  controller.configure({ ...DEFAULT_SETTINGS, capA: 30, capB: 20, adaptiveGate: false });
  controller.setTarget(structuredClone(target));
  controller.accept(sample(now));
  return { controller, transport, calls, tick: (ms = 100) => { now += ms; controller.accept(sample(now)); }, now: () => now, advance: (ms: number) => { now += ms; } };
}

test('连接与预览不会输出，必须手动开始；每通道遵守 App 上限', async () => {
  const s = setup();
  assert.equal(s.calls.length, 0);
  await s.controller.start(); s.tick(); await flush();
  const strengths = s.calls.filter(c => c.name === 'setTempIntensity');
  assert.deepEqual(strengths.map(c => c.args[3]), [15, 12]);
  for (const call of s.calls.filter(c => c.name === 'sendPulse')) {
    assert.equal(call.args[3], 100);
    assert.equal((call.args[4] as string[]).length, 1);
    assert.equal((call.args[5] as { immediate: boolean }).immediate, true);
  }
});
test('暂停清队列并归零，恢复仅在仍处于联动状态时输出', async () => {
  const s = setup(); await s.controller.start(); s.tick(); await flush();
  s.controller.accept(sample(s.now(), { running: false, reason: '暂停' })); await flush();
  assert.equal(s.calls.filter(c => c.name === 'clearOperate').length, 2);
  assert.equal(s.calls.filter(c => c.name === 'resetIntensity').length, 2);
  assert.equal(s.controller.armed, true);
  s.tick(); await flush();
  assert.equal(s.calls.filter(c => c.name === 'sendPulse').length, 4);
  await s.controller.stop(); const count = s.calls.length; s.tick();
  assert.equal(s.calls.length, count);
});
test('门限关闭立即清除波形与强度，不发送低电平拖尾', async () => {
  const s = setup(); await s.controller.start(); s.tick(); await flush();
  s.advance(100); s.controller.accept(sample(s.now(), { rmsDb: -70, peakDb: -65 })); await flush();
  assert.equal(s.controller.wave?.intensity, 0);
  assert.equal(s.calls.filter(c => c.name === 'clearOperate').length, 2);
});
test('过期采样和失去音源自动解除联动', async () => {
  const s = setup(); await s.controller.start(); s.tick(); await flush();
  s.advance(400); s.controller.watchdog(); await flush();
  assert.equal(s.controller.armed, false);
  const count = s.calls.length; s.tick(); assert.equal(s.calls.length, count);
});
test('设备离线或切换不会自动恢复输出', async () => {
  const s = setup(); await s.controller.start(); s.tick(); await flush();
  s.controller.setTarget(null); await flush();
  assert.equal(s.controller.armed, false);
  s.controller.setTarget(target); const count = s.calls.length; s.tick();
  assert.equal(s.calls.length, count);
});
test('没有上限快照、强度全零或没有新鲜音频时拒绝开始', async () => {
  const s = setup(); s.controller.target!.device.slotState = { hasDevice: true };
  await assert.rejects(s.controller.start(), /强度上限/);
  s.controller.setTarget(target); s.controller.configure({ ...DEFAULT_SETTINGS });
  await assert.rejects(s.controller.start(), /强度上限/);
  s.controller.configure({ ...DEFAULT_SETTINGS, capA: 10 }); s.advance(500);
  await assert.rejects(s.controller.start(), /采样已中断/);
});
test('未取得音频时反馈实际原因，而不是误报媒体没有音轨', async () => {
  const s = setup();
  s.controller.sample = null;
  await assert.rejects(s.controller.start(), /尚未收到音源采样/);
  s.controller.accept(sample(s.now(), { running: false, reason: '播放已暂停' }));
  await assert.rejects(s.controller.start(), /播放已暂停/);
  s.controller.accept(sample(s.now(), { running: false, reason: '音频统计滤镜挂载失败' }));
  await assert.rejects(s.controller.start(), /滤镜挂载失败/);
  assert.equal(s.calls.length, 0);
});
test('App 响应慢时丢弃采样，不累计波形或补发历史帧', async () => {
  const s = setup(); let release!: () => void;
  s.transport.sendPulse = (...args) => { s.calls.push({ name: 'sendPulse', args }); return new Promise<void>(resolve => { release = resolve; }); };
  await s.controller.start(); s.tick(); for (let i = 0; i < 10; i++) s.tick();
  assert.equal(s.calls.filter(c => c.name === 'sendPulse').length, 2);
  await s.controller.stop(); release(); await flush();
  s.tick(); assert.equal(s.calls.filter(c => c.name === 'sendPulse').length, 2);
});
test('App 拒绝波形时解除联动并清理已发送的任务', async () => {
  const s = setup(); s.transport.sendPulse = () => Promise.reject(new Error('设备拒绝'));
  await s.controller.start(); s.tick(); await flush();
  assert.equal(s.controller.armed, false);
  assert.ok(s.calls.some(c => c.name === 'clearOperate'));
});
test('连续停止后可以重新开始，旧清理回调不会卡住发送', async () => {
  const s = setup(); await s.controller.start(); s.tick(); await flush();
  const stopped = s.controller.stop();
  const started = s.controller.start();
  await Promise.all([stopped, started]);
  s.tick(); await flush();
  assert.equal(s.calls.filter(c => c.name === 'sendPulse').length, 4);
});

test('停止未获确认时，不能利用连续点击开始跳过失败状态', async () => {
  const s = setup(); await s.controller.start(); s.tick(); await flush();
  s.transport.clearOperate = () => Promise.reject(new Error('清理超时'));
  const stopped = s.controller.stop();
  await assert.rejects(s.controller.start(), /停止操作未获确认/);
  await stopped;
  assert.equal(s.controller.armed, false);
});
