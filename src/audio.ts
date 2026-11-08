import { clamp, type Settings } from './shared';

export interface AudioFeatures { rmsDb: number; peakDb: number; zcr: number }
export interface Wave { hex: string; intensity: number; frequency: number; db: number; gated: boolean; gateDb: number }
export const ZERO_WAVE = '0A0A0A0A00000000';

function level(value: unknown): number {
  if (value === '-inf' || value === '-Infinity') return -120;
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (value === '') return NaN;
  const n = Number(value);
  return n === -Infinity ? -120 : n;
}

export function readFeatures(meta: unknown, sampleRate: number): AudioFeatures | null {
  if (!meta || typeof meta !== 'object' || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
  const fields = meta as Record<string, unknown>;
  const rmsDb = level(fields['lavfi.astats.Overall.RMS_level']);
  const peakDb = level(fields['lavfi.astats.Overall.Peak_level']);
  if (!Number.isFinite(rmsDb) || !Number.isFinite(peakDb)) return null;
  let weightedZcr = 0;
  let energy = 0;
  for (const key of Object.keys(fields)) {
    const match = /^lavfi\.astats\.(\d+)\.Zero_crossings_rate$/.exec(key);
    if (!match) continue;
    const zcr = Number(fields[key]);
    const channelDb = level(fields[`lavfi.astats.${match[1]}.RMS_level`]);
    if (!Number.isFinite(zcr) || zcr < 0 || zcr > 1 || !Number.isFinite(channelDb)) return null;
    // 按能量加权，避免静音声道拉低 ZCR；统一到 48 kHz 标度，使相同音调跨采样率一致。
    const weight = Math.pow(10, channelDb / 10);
    weightedZcr += zcr * weight;
    energy += weight;
  }
  if (!energy) return null;
  return { rmsDb, peakDb, zcr: clamp(weightedZcr / energy * sampleRate / 48000, 0, 1) };
}

export function makeWave(features: AudioFeatures, settings: Settings): Wave {
  const db = settings.metric === 'peak' ? features.peakDb : features.rmsDb;
  if (!Number.isFinite(db) || !Number.isFinite(features.zcr) || db <= settings.gateDb) {
    return { hex: ZERO_WAVE, intensity: 0, frequency: 10, db, gated: true, gateDb: settings.gateDb };
  }
  const volume = clamp((db - settings.gateDb) / (settings.ceilingDb - settings.gateDb), 0, 1);
  const intensity = Math.floor(Math.pow(volume, settings.gamma) * settings.modulationMax);
  const zcr = clamp((features.zcr - settings.zcrLow) / (settings.zcrHigh - settings.zcrLow), 0, 1);
  const frequency = Math.round(settings.frequencyHigh - zcr * (settings.frequencyHigh - settings.frequencyLow));
  return {
    hex: encodeWave(frequency, intensity),
    intensity, frequency, db, gated: intensity === 0, gateDb: settings.gateDb,
  };
}

export function encodeWave(frequency: number, intensity: number): string {
  const hex = (n: number) => clamp(Math.round(n), 0, 100).toString(16).padStart(2, '0').toUpperCase();
  return hex(frequency).repeat(4) + [0.7, 0.85, 1, 0.9].map(gain => hex(intensity * gain)).join('');
}

/** 自适应只调整声学映射，不提高用户设置的通道强度或 App 上限。 */
export class AudioMapper {
  private history: { at: number; db: number }[] = [];
  private crossings: number[] = [];
  private gateOpen = false;
  private previousRms: number | null = null;
  private intensity = 0;
  private smoothedZcr: number | null = null;
  private effectiveGate: number | null = null;
  private lastAt: number | null = null;

  reset(): void {
    this.history = [];
    this.crossings = [];
    this.gateOpen = false;
    this.previousRms = null;
    this.intensity = 0;
    this.smoothedZcr = null;
    this.effectiveGate = null;
    this.lastAt = null;
  }

  next(features: AudioFeatures, settings: Settings, at: number): Wave {
    if (![features.rmsDb, features.peakDb, features.zcr, at].every(Number.isFinite)) {
      this.reset();
      return { hex: ZERO_WAVE, intensity: 0, frequency: 10, db: -120, gateDb: settings.gateDb, gated: true };
    }
    const dt = this.lastAt === null ? 100 : clamp(at - this.lastAt, 0, 350);
    this.lastAt = at;
    // 起音越明显，峰值占比越高；持续音仍主要由 RMS 决定，避免单个尖峰支配输出。
    const rise = this.previousRms === null ? 0 : Math.max(0, features.rmsDb - this.previousRms);
    const peakWeight = 0.15 + 0.3 * clamp(rise / 12, 0, 1);
    this.previousRms = features.rmsDb;
    const db = settings.metric === 'hybrid'
      ? features.rmsDb + Math.max(0, features.peakDb - features.rmsDb) * peakWeight
      : settings.metric === 'peak' ? features.peakDb : features.rmsDb;

    this.history.push({ at, db });
    this.history = this.history.filter(item => at - item.at <= 8000).slice(-100);
    let targetGate = settings.gateDb;
    if (settings.adaptiveGate && this.history.length >= 20) {
      const sorted = this.history.map(item => item.db).sort((a, b) => a - b);
      const floor = sorted[Math.floor((sorted.length - 1) * 0.2)];
      // 底部二十分位估计底噪，限制最大抬升，避免整段持续音把门限无限推高。
      targetGate = Math.min(settings.ceilingDb - 3, settings.gateDb + 12, Math.max(settings.gateDb, floor + 6));
      targetGate = Math.max(settings.gateDb, targetGate);
    }
    const priorGate = this.effectiveGate ?? settings.gateDb;
    this.effectiveGate = priorGate + clamp(targetGate - priorGate, -dt * 0.003, dt * 0.003);
    const gateDb = this.effectiveGate;
    const openThreshold = Math.min(settings.ceilingDb, gateDb + 2);
    this.gateOpen = this.gateOpen ? db > gateDb : db >= openThreshold;

    this.crossings.push(features.zcr);
    if (this.crossings.length > 3) this.crossings.shift();
    const sortedZcr = [...this.crossings].sort((a, b) => a - b);
    const median = sortedZcr[Math.floor(sortedZcr.length / 2)];
    this.smoothedZcr = this.smoothedZcr === null ? median : this.smoothedZcr + (median - this.smoothedZcr) * (1 - Math.exp(-dt / 120));
    const wave = makeWave({ rmsDb: db, peakDb: db, zcr: this.smoothedZcr }, { ...settings, metric: 'rms', gateDb });
    if (!this.gateOpen || wave.gated) {
      // 门限关闭立即清零；release 只用于门限以上的包络，不能形成静音拖尾。
      this.intensity = 0;
      return { ...wave, hex: ZERO_WAVE, intensity: 0, gated: true };
    }
    const timeConstant = wave.intensity > this.intensity ? 35 : 90;
    this.intensity += (wave.intensity - this.intensity) * (1 - Math.exp(-dt / timeConstant));
    const intensity = Math.min(settings.modulationMax, Math.round(this.intensity));
    return { ...wave, intensity, hex: encodeWave(wave.frequency, intensity), gated: intensity === 0 };
  }
}
