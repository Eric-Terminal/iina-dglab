import type { V4DeviceInfo } from 'dglab-kit';
import { AudioMapper, type Wave } from './audio';
import { DEFAULT_SETTINGS, SAMPLE_MS, STALE_MS, validateSettings, type AudioSample, type Settings } from './shared';

export interface Target { clientId: string; device: V4DeviceInfo }
export interface Transport {
  sendPulse(client: string, slot: string, channel: 0 | 1, duration: number, frames: string[], options: { immediate: boolean; timeout: number }): Promise<unknown>;
  setTempIntensity(client: string, slot: string, channel: 0 | 1, value: number, duration: number, options: { immediate: boolean; timeout: number }): Promise<unknown>;
  clearOperate(client: string, options: { slotId: string; channel: 0 | 1 }): Promise<unknown>;
  resetIntensity(client: string, slot: string, channel: 0 | 1, options: { timeout: number }): Promise<unknown>;
}

export function channelLimit(target: Target, channel: 0 | 1): number {
  const state = target.device.slotState as Record<string, unknown> | undefined;
  const info = state?.[channel === 0 ? 'channelA' : 'channelB'] as { intensityMax?: unknown; isMuted?: boolean } | undefined;
  if (!info || info.isMuted || typeof info.intensityMax !== 'number' || !Number.isFinite(info.intensityMax)) return 0;
  return Math.max(0, Math.min(200, Math.floor(info.intensityMax)));
}

export function isConnected(target: Target): boolean {
  return target.device.type === 'COYOTE_030' && target.device.slotState?.hasDevice === true && target.device.props?.connectState !== 'disconnected';
}

export class AudioController {
  armed = false;
  starting = false;
  target: Target | null = null;
  settings: Settings = { ...DEFAULT_SETTINGS };
  sample: AudioSample | null = null;
  wave: Wave | null = null;
  reason = '尚未开始联动';
  private transport: Transport;
  private now: () => number;
  private changed: () => void;
  private generation = 0;
  private busy = false;
  private outputting = false;
  private lastSentAt = -Infinity;
  private ownedChannels = new Set<0 | 1>();
  private stopping: Promise<void> = Promise.resolve();
  private stopFailed = false;
  private mapper = new AudioMapper();

  constructor(transport: Transport, changed: () => void, now = Date.now) {
    this.transport = transport;
    this.changed = changed;
    this.now = now;
  }

  setTarget(target: Target | null): void {
    const same = target && this.target && target.clientId === this.target.clientId && target.device.slotId === this.target.device.slotId;
    if (!same) void this.stop('设备已切换，请重新开始联动');
    this.target = target;
    if (!same) this.stopFailed = false;
    if (target && !isConnected(target)) void this.stop('设备已离线');
    this.changed();
  }

  configure(settings: Settings): void {
    const valid = validateSettings(settings);
    const keepArmed = this.armed;
    this.settings = valid;
    this.mapper.reset();
    this.wave = null;
    // 保留用户的联动开关，先清理旧任务；清理完成前 busy 会阻止新参数输出。
    void this.silence(keepArmed ? '参数已应用，继续联动' : '参数已应用', !keepArmed);
    this.changed();
  }

  async start(): Promise<void> {
    if (this.starting || this.armed) return;
    this.starting = true;
    const generation = ++this.generation;
    this.changed();
    try {
      await this.stopping;
      if (generation !== this.generation) return;
      this.busy = false;
      if (this.stopFailed) throw new Error('上次停止操作未获确认，请检查 App 后断开并重新连接。');
      if (!this.target || !isConnected(this.target)) throw new Error('请先连接 App 并选择在线的郊狼 3.0。');
      if (!this.isFresh()) {
        if (!this.sample) throw new Error('尚未收到音源采样，请从播放窗口的插件菜单重新选择音源。');
        if (this.now() - this.sample.at > STALE_MS) throw new Error('音频采样已中断，请从播放窗口重新打开联动控制台。');
        throw new Error(this.sample.reason || '音频统计尚未就绪，请稍后重试。');
      }
      if (!this.channels().length) throw new Error('请设置至少一个通道的强度上限，并确认 App 已回传非零上限。');
      this.armed = true;
      this.reason = '联动已就绪';
    } finally { this.starting = false; this.changed(); }
  }

  private channels(): [0 | 1, number][] {
    if (!this.target) return [];
    const result: [0 | 1, number][] = [];
    for (const c of [0, 1] as const) {
      const enabled = c === 0 ? this.settings.channelA : this.settings.channelB;
      const cap = Math.min(c === 0 ? this.settings.capA : this.settings.capB, channelLimit(this.target, c));
      if (enabled && cap > 0) result.push([c, cap]);
    }
    return result;
  }

  private hasRecentSample(): boolean {
    return !!this.sample && this.now() - this.sample.at >= 0 && this.now() - this.sample.at <= STALE_MS;
  }

  private isFresh(): boolean {
    return !!this.sample?.running && this.hasRecentSample();
  }

  accept(sample: AudioSample): void {
    this.sample = sample;
    const valid = [sample.rmsDb, sample.peakDb, sample.zcr].every(n => typeof n === 'number' && Number.isFinite(n));
    if (!sample.running || !valid || !this.isFresh()) this.mapper.reset();
    this.wave = sample.running && valid && this.isFresh() ? this.mapper.next({ rmsDb: sample.rmsDb!, peakDb: sample.peakDb!, zcr: sample.zcr! }, this.settings, sample.at) : null;
    this.changed();
    if (!this.armed) return;
    if (!this.target || !isConnected(this.target)) { void this.stop('设备已离线'); return; }
    if (!this.isFresh() || !this.wave || this.wave.gated) {
      void this.silence(sample.reason || (this.wave?.gated ? '低于噪声门限' : '音频统计不可用'), false);
      return;
    }
    const channels = this.channels();
    if (!channels.length) { void this.stop('所选通道不可输出，请检查 App 上限和静音状态'); return; }
    // App 的通道上限/静音变化不能让上一批任务继续使用旧通道。
    if ([...this.ownedChannels].some(c => !channels.some(([active]) => c === active))) {
      void this.silence('通道状态已改变', false);
      return;
    }
    if (this.busy || this.now() - this.lastSentAt < SAMPLE_MS - 5) return;
    this.lastSentAt = this.now();
    this.busy = true;
    this.outputting = true;
    const generation = this.generation;
    const { clientId, device } = this.target;
    const requests: Promise<unknown>[] = [];
    for (const [channel, cap] of channels) {
      this.ownedChannels.add(channel);
      // 只发当前 100 ms 帧，并替换同类任务；延迟时丢帧，绝不追赶或排长队。
      requests.push(this.transport.setTempIntensity(clientId, device.slotId, channel, cap, 250, { immediate: true, timeout: 600 }));
      requests.push(this.transport.sendPulse(clientId, device.slotId, channel, SAMPLE_MS, [this.wave.hex], { immediate: true, timeout: 600 }));
    }
    this.reason = '正在跟随音频';
    void Promise.all(requests).catch(error => {
      if (generation === this.generation) void this.stop(`App 指令失败：${String(error)}`);
    }).finally(() => { if (generation === this.generation) this.busy = false; this.changed(); });
  }

  watchdog(): void {
    // 暂停、静音和跳转仍有采样心跳；只有消息本身过期才需要手动重新开始。
    if (this.armed && !this.hasRecentSample()) void this.stop('音频采样超时，请重新开始联动');
  }

  stop(reason = '已停止联动'): Promise<void> {
    this.mapper.reset();
    return this.silence(reason, true);
  }

  private silence(reason: string, disarm: boolean): Promise<void> {
    if (disarm) { this.armed = false; this.generation++; this.busy = false; }
    this.reason = reason;
    if (!this.outputting || !this.target) { this.changed(); return this.stopping; }
    this.outputting = false;
    this.generation++;
    this.busy = true;
    const generation = this.generation;
    const { clientId, device } = this.target;
    const requests: Promise<unknown>[] = [];
    for (const channel of this.ownedChannels) {
      requests.push(this.transport.clearOperate(clientId, { slotId: device.slotId, channel }));
      requests.push(this.transport.resetIntensity(clientId, device.slotId, channel, { timeout: 600 }));
    }
    this.ownedChannels.clear();
    this.stopping = Promise.allSettled(requests).then(results => {
      const failed = results.some(result => result.status === 'rejected');
      if (this.target?.clientId === clientId && this.target.device.slotId === device.slotId) this.stopFailed = failed;
      if (generation !== this.generation) return;
      this.busy = false;
      if (failed) {
        this.armed = false;
        this.reason = '停止指令未获确认，请检查 App；本次波形与临时强度任务有时限';
      }
      this.changed();
    });
    this.changed();
    return this.stopping;
  }
}
