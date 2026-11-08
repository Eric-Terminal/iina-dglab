import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioTimeline } from '../src/audio-timing';
import { AudioBuffer } from '../src/audio-buffer';
import { DEFAULT_SETTINGS, validateSettings } from '../src/shared';
import { statsFrame } from './audio-fixture';

test('默认不提前，100 ms 选择未来音频，倍速按真实时间换算', () => {
  assert.equal(DEFAULT_SETTINGS.advanceMs, 0);
  const timeline = new AudioTimeline();
  const text = statsFrame(1, -40) + statsFrame(1.1, -30) + statsFrame(1.2, -20) + statsFrame(1.3, -10);
  // 文件句柄可能在任意行中间返回短读，不能丢失不完整的头或统计字段。
  for (let offset = 0; offset < text.length; offset += 7) timeline.append(text.slice(offset, offset + 7), 48000);
  assert.equal(timeline.at(1.01, 0, 1)?.rmsDb, -40);
  assert.equal(timeline.at(1.01, 100, 1)?.rmsDb, -30);
  assert.equal(timeline.at(1.01, 100, 2)?.rmsDb, -20);
  assert.equal(timeline.at(1.01, 1000, 1), null, '预读不足时不能借用旧帧假装提前');
});

test('时间线拒绝缺失字段、大跨度与过期帧，定位回退后不保留旧数据', () => {
  const timeline = new AudioTimeline();
  timeline.append(statsFrame(5) + statsFrame(5.1) + statsFrame(8), 48000);
  assert.equal(timeline.at(5.05, 0, 1)?.rmsDb, -20);
  assert.equal(timeline.at(6, 0, 1), null);
  timeline.append(statsFrame(1, -30) + statsFrame(1.1), 48000);
  assert.equal(timeline.at(1.05, 0, 1)?.rmsDb, -30);
  assert.equal(timeline.at(5.05, 0, 1), null);
  timeline.reset();
  timeline.append('frame:0 pts:0 pts_time:0\nlavfi.astats.Overall.RMS_level=-10\n' + statsFrame(0.1), 48000);
  assert.equal(timeline.at(0, 0, 1), null);
  assert.equal(timeline.at(20, 0, 1), null);
});

test('提前量限制为 0～1000 ms，拒绝负数、非数与超范围输入', () => {
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, advanceMs: 1000 }).advanceMs, 1000);
  for (const advanceMs of [-1, 1001, NaN, Infinity, '100']) {
    assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, advanceMs }));
  }
});

test('长提前量扩大音频缓冲，设回零或结束采样恢复用户配置', () => {
  let value = 0.2;
  const changes: number[] = [];
  const buffer = new AudioBuffer({ getNumber: () => value, set: (_, next) => { value = next; changes.push(next); } });
  assert.equal(buffer.update(0), false);
  assert.equal(changes.length, 0, '默认值不应改写播放器设置');
  assert.equal(buffer.update(1000), true); assert.equal(value, 1.25);
  assert.equal(buffer.update(1000), false);
  buffer.update(100); assert.equal(value, 0.35);
  buffer.update(0); assert.equal(value, 0.2);
  buffer.update(1000); buffer.restore(); assert.equal(value, 0.2);
  value = 2;
  assert.equal(buffer.update(1000), false, '用户已有的大缓冲应保持');
  buffer.restore(); assert.equal(value, 2);
});

test('恢复缓冲时保留用户在联动期间另行修改的值', () => {
  let value = 0.2;
  const buffer = new AudioBuffer({ getNumber: () => value, set: (_, next) => { value = next; } });
  buffer.update(1000);
  value = 0.6;
  buffer.restore();
  assert.equal(value, 0.6);
  buffer.update(1000); value = 0.8;
  buffer.update(1000); buffer.restore();
  assert.equal(value, 0.8);
});
