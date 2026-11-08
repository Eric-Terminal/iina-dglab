import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioMapper, makeWave, readFeatures, ZERO_WAVE } from '../src/audio';
import { DEFAULT_SETTINGS, validateSettings } from '../src/shared';

const settings = { ...DEFAULT_SETTINGS, adaptiveGate: false, metric: 'rms' as const, gamma: 0.8 };
const features = (rmsDb: number, peakDb = rmsDb + 3, zcr = 0.04) => ({ rmsDb, peakDb, zcr });

test('门限以下与无效读数立即产生零波形', () => {
  for (const db of [-Infinity, NaN, -90, -38]) assert.equal(makeWave(features(db), settings).hex, ZERO_WAVE);
});
test('幅度单调、有界，峰值不溢出协议的 0～100', () => {
  let previous = 0;
  for (let db = -90; db <= 6; db++) {
    const wave = makeWave(features(db), settings);
    assert.ok(wave.intensity >= previous && wave.intensity <= 100);
    assert.match(wave.hex, /^[0-9A-F]{16}$/);
    assert.ok([...Buffer.from(wave.hex, 'hex')].every(n => n <= 100));
    previous = wave.intensity;
  }
});
test('ZCR 从低到高映射为从稀疏到密集的频率编码', () => {
  assert.equal(makeWave(features(-5, -2, 0.02), settings).frequency, 100);
  assert.equal(makeWave(features(-5, -2, 0.22), settings).frequency, 10);
});
test('逐声道 ZCR 能量加权，不读取不存在的 Overall 字段', () => {
  const meta = {
    'lavfi.astats.Overall.RMS_level': '-20', 'lavfi.astats.Overall.Peak_level': '-10',
    'lavfi.astats.1.RMS_level': '-20', 'lavfi.astats.1.Zero_crossings_rate': '0.1',
    'lavfi.astats.2.RMS_level': '-inf', 'lavfi.astats.2.Zero_crossings_rate': '0',
  };
  assert.ok(Math.abs(readFeatures(meta, 48000)!.zcr - 0.1) < 0.000001);
  assert.equal(readFeatures({ 'lavfi.astats.Overall.Peak_level': '-5' }, 48000), null);
  assert.equal(readFeatures(meta, 0), null);
});
test('同一音调在 44.1/48/96 kHz 下具有一致的 ZCR 标度', () => {
  for (const sampleRate of [44100, 48000, 96000]) {
    const meta = { 'lavfi.astats.Overall.RMS_level': '-20', 'lavfi.astats.Overall.Peak_level': '-17', 'lavfi.astats.1.RMS_level': '-20', 'lavfi.astats.1.Zero_crossings_rate': String(2000 / sampleRate) };
    assert.ok(Math.abs(readFeatures(meta, sampleRate)!.zcr - 2000 / 48000) < 1e-9);
  }
});
test('全静音的 -inf 读数有效且归零', () => {
  const parsed = readFeatures({ 'lavfi.astats.Overall.RMS_level': '-inf', 'lavfi.astats.Overall.Peak_level': '-inf', 'lavfi.astats.1.RMS_level': '-inf', 'lavfi.astats.1.Zero_crossings_rate': '0' }, 48000);
  assert.ok(parsed);
  assert.equal(makeWave(parsed, settings).intensity, 0);
});
test('滞回避免临界电平反复开门，越过关闭门限时没有拖尾', () => {
  const mapper = new AudioMapper();
  assert.equal(mapper.next(features(-37), settings, 0).gated, true);
  assert.equal(mapper.next(features(-34), settings, 100).gated, false);
  assert.equal(mapper.next(features(-37), settings, 200).gated, false);
  assert.equal(mapper.next(features(-38), settings, 300).hex, ZERO_WAVE);
  assert.equal(mapper.next(features(-37), settings, 400).gated, true);
});
test('底噪估计有界且逐步抬升，响亮起音仍能开门', () => {
  const mapper = new AudioMapper();
  const adaptive = { ...settings, adaptiveGate: true };
  let wave;
  for (let at = 0; at < 10000; at += 100) wave = mapper.next(features(-32), adaptive, at);
  assert.ok(wave!.gateDb > -32 && wave!.gateDb <= -26);
  assert.equal(wave!.gated, true);
  assert.equal(mapper.next(features(-10), adaptive, 10000).gated, false);
});
test('动态混合在起音时给予峰值更高权重', () => {
  const mapper = new AudioMapper();
  const hybrid = { ...settings, metric: 'hybrid' as const };
  mapper.next(features(-50, -47), hybrid, 0);
  const onset = mapper.next(features(-20, -5), hybrid, 100);
  const sustained = mapper.next(features(-20, -5), hybrid, 200);
  assert.ok(onset.db > sustained.db);
});
test('ZCR 单帧毛刺不会突然把频率切到另一端', () => {
  const mapper = new AudioMapper();
  mapper.next(features(-10, -7, 0.02), settings, 0);
  mapper.next(features(-10, -7, 0.02), settings, 100);
  assert.equal(mapper.next(features(-10, -7, 0.9), settings, 200).frequency, 100);
});
test('参数边界与无效输入被拒绝', () => {
  assert.throws(() => validateSettings({ ...settings, gateDb: -3, ceilingDb: -5 }));
  assert.throws(() => validateSettings({ ...settings, capA: NaN }));
  assert.throws(() => validateSettings({ ...settings, capA: 201 }));
  assert.throws(() => validateSettings({ ...settings, zcrHigh: settings.zcrLow }));
});
