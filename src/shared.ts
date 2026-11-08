export const SAMPLE_MS = 100;
export const STALE_MS = 350;
export const OFFICIAL_SERVER = 'wss://trex.dungeon-lab.cn/v4';
export const FILTER_LABEL = 'iina_dglab';
// ZCR 没有 Overall 字段，必须启用逐通道统计；不重采样、不改变声道布局。
export const ASTATS_FILTER = 'astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level+Zero_crossings_rate:measure_overall=RMS_level+Peak_level';
export const AUDIO_FILTER = `@${FILTER_LABEL}:lavfi=[${ASTATS_FILTER}]`;

export interface Settings {
  advanceMs: number;
  metric: 'hybrid' | 'rms' | 'peak';
  adaptiveGate: boolean;
  gateDb: number;
  ceilingDb: number;
  gamma: number;
  zcrLow: number;
  zcrHigh: number;
  frequencyLow: number;
  frequencyHigh: number;
  modulationMax: number;
  capA: number;
  capB: number;
  channelA: boolean;
  channelB: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  advanceMs: 0,
  metric: 'hybrid', adaptiveGate: true, gateDb: -38, ceilingDb: -5, gamma: 1.1,
  zcrLow: 0.02, zcrHigh: 0.22, frequencyLow: 10, frequencyHigh: 100,
  modulationMax: 100, capA: 0, capB: 0, channelA: true, channelB: true,
};

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('参数格式无效。');
  const s = value as Settings;
  const ranges: [keyof Settings, number, number][] = [
    ['advanceMs', 0, 1000],
    ['gateDb', -90, -1], ['ceilingDb', -60, 0], ['gamma', 0.2, 3],
    ['zcrLow', 0, 1], ['zcrHigh', 0, 1], ['frequencyLow', 10, 100],
    ['frequencyHigh', 10, 100], ['modulationMax', 0, 100], ['capA', 0, 200], ['capB', 0, 200],
  ];
  for (const [key, min, max] of ranges) {
    const n = s[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
      throw new Error(`参数 ${key} 必须在 ${min}～${max} 之间。`);
    }
  }
  if (s.gateDb >= s.ceilingDb) throw new Error('噪声门限必须低于满幅电平。');
  if (s.zcrLow >= s.zcrHigh) throw new Error('过零率下界必须小于上界。');
  if (s.frequencyLow > s.frequencyHigh) throw new Error('频率编码下界不能大于上界。');
  if (!['hybrid', 'rms', 'peak'].includes(s.metric) || typeof s.adaptiveGate !== 'boolean' || typeof s.channelA !== 'boolean' || typeof s.channelB !== 'boolean') {
    throw new Error('电平模式或通道选项无效。');
  }
  return { ...s, capA: Math.floor(s.capA), capB: Math.floor(s.capB) };
}

export interface AudioSample {
  at: number;
  title: string;
  running: boolean;
  reason: string;
  rmsDb: number | null;
  peakDb: number | null;
  zcr: number | null;
}

export const clamp = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, n));
