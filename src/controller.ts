import type { V4DeviceInfo } from 'dglab-kit';
import { AudioMapper, type Wave } from './audio';
import { DEFAULT_SETTINGS, RESPONSE_TIMEOUT_MS, SAMPLE_MS, STALE_MS, validateSettings, type AudioSample, type Settings } from './shared';

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
  previewWave: Wave | null = null;
  reason = '尚未开始联动';
  failure: string | null = null;
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
  private previewMapper = new AudioMapper();

  constructor(transport: Transport, changed: () => void, now = Date.now) {
    this.transport = transport;
    this.changed = changed;
    this.now = now;
  }

  setTarget(target: Target | null): void {
    const same = target && this.target && target.clientId === this.target.clientId && target.device.slotId === this.target.device.slotId;
    if (!same) void this.stop('设备已切换，请重新开始联动');
    this.target = target;
    if (!same) { this.stopFailed = false; this.failure = null; }
    if (target && !isConnected(target)) void this.stop('设备已离线');
    this.changed();
  }

  configure(settings: Settings): void {
    const valid = validateSettings(settings);
    const mappingKeys: (keyof Settings)[] = ['metric', 'adaptiveGate', 'gateDb', 'ceilingDb', 'gamma', 'zcrLow', 'zcrHigh', 'frequencyLow', 'frequencyHigh', 'modulationMax'];
    if (mappingKeys.some(key => valid[key] !== this.settings[key])) {
      this.previewMapper.reset(); this.previewWave = null;
    }
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
      if (!this.channels().length) throw new Error('请设置至少一个通道的强度上限，并确认 App 已回传非零上限。');
      this.armed = true;
      this.failure = null;
      this.reason = this.isFresh() ? '联动已就绪' : '联动已开启，等待音频';
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
    const preview = sample.preview;
    const previewValid = preview.running && this.hasRecentSample() && [preview.rmsDb, preview.peakDb, preview.zcr].every(n => typeof n === 'number' && Number.isFinite(n));
    if (!previewValid) this.previewMapper.reset();
    // 预览有自己的历史与平滑器，设备提前量和输出开关不应改变校准参照。
    this.previewWave = previewValid ? this.previewMapper.next({ rmsDb: preview.rmsDb!, peakDb: preview.peakDb!, zcr: preview.zcr! }, this.settings, sample.at) : null;
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
      requests.push(this.command('设置临时强度', channel, this.transport.setTempIntensity(clientId, device.slotId, channel, cap, 250, { immediate: true, timeout: RESPONSE_TIMEOUT_MS })));
      requests.push(this.command('发送波形', channel, this.transport.sendPulse(clientId, device.slotId, channel, SAMPLE_MS, [this.wave.hex], { immediate: true, timeout: RESPONSE_TIMEOUT_MS })));
    }
    this.reason = '正在跟随音频';
    void Promise.all(requests).catch(error => {
      if (generation === this.generation) {
        this.failure = error instanceof Error ? error.message : String(error);
        void this.stop('设备指令失败，请查看下方详情');
      }
    }).finally(() => { if (generation === this.generation) this.busy = false; this.changed(); });
  }

  watchdog(): void {
    if (!this.sample || this.hasRecentSample()) return;
    // 超时只撤销当前输出，不撤销用户的联动开关；丢弃旧读数，等新采样再恢复。
    this.sample = null;
    this.wave = null;
    this.mapper.reset();
    this.previewWave = null;
    this.previewMapper.reset();
    if (this.armed) void this.silence('联动已开启，等待音频恢复', false);
    else this.changed();
  }

  stop(reason = '已停止联动'): Promise<void> {
    this.mapper.reset();
    return this.silence(reason, true);
  }

  private command(name: string, channel: 0 | 1, request: Promise<unknown>): Promise<unknown> {
    return request.catch(error => {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw new Error(`${channel === 0 ? 'A' : 'B'} 通道 · ${name}：${detail}`);
    });
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
      requests.push(this.command('清除任务', channel, this.transport.clearOperate(clientId, { slotId: device.slotId, channel })));
      requests.push(this.command('归零强度', channel, this.transport.resetIntensity(clientId, device.slotId, channel, { timeout: RESPONSE_TIMEOUT_MS })));
    }
    this.ownedChannels.clear();
    this.stopping = Promise.allSettled(requests).then(results => {
      const failed = results.some(result => result.status === 'rejected');
      if (this.target?.clientId === clientId && this.target.device.slotId === device.slotId) this.stopFailed = failed;
      if (generation !== this.generation) return;
      this.busy = false;
      if (failed) {
        this.armed = false;
        const details = results.filter(result => result.status === 'rejected').map(result => (result as PromiseRejectedResult).reason.message);
        this.failure = [this.failure || `触发原因：${reason}`, ...details].join('\n');
        this.reason = '停止指令未获确认，请断开并重新连接；详情见下方';
      }
      this.changed();
    });
    this.changed();
    return this.stopping;
  }
}
