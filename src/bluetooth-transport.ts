import type { Transport } from './controller';
import type { Settings } from './shared';
import type { BluetoothStatus } from './bluetooth-helper';

interface Bridge {
  postMessage(name: string, data?: unknown): void;
  onMessage(name: string, handler: (data: any) => void): void;
}

export class BluetoothTransport implements Transport {
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  session: string | null = null;
  status: BluetoothStatus | null = null;
  private starting = false;
  private generation = 0;
  get active(): boolean { return this.session !== null || this.starting; }

  constructor(private bridge: Bridge | undefined, private changed: (status: BluetoothStatus | null) => void) {
    bridge?.onMessage('bluetooth-result', (data: { id: number; result?: unknown; error?: string }) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result);
    });
    bridge?.onMessage('bluetooth-status', (data: { session: string; status: BluetoothStatus }) => {
      if (data.session === this.session) this.update(data.status);
    });
  }

  private update(status: BluetoothStatus | null): void { this.status = status; this.changed(status); }
  private request(method: string, params: Record<string, unknown> = {}, timeout = 3000): Promise<any> {
    if (!this.bridge) return Promise.reject(new Error('请在 IINA 的插件控制窗口中打开此页面。'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('蓝牙助手响应超时')); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.bridge!.postMessage('bluetooth', { id, session: this.session, method, params });
    });
  }

  async start(appPath: string): Promise<void> {
    const generation = ++this.generation;
    this.starting = true;
    try {
      const result = await this.request('start', { appPath }, 10000) as { session: string; status: BluetoothStatus };
      if (generation !== this.generation) throw new Error('蓝牙连接已取消');
      this.session = result.session; this.update(result.status);
    } finally { this.starting = false; }
  }
  async scan(): Promise<void> {
    const generation = this.generation;
    const status = await this.request('scan');
    if (generation === this.generation) this.update(status);
  }
  async connect(id: string, settings: Settings): Promise<void> {
    const generation = this.generation;
    await this.configure(settings);
    if (generation !== this.generation) return;
    const status = await this.request('connect', { id });
    if (generation === this.generation) this.update(status);
  }
  async configure(settings: Settings): Promise<void> {
    const generation = this.generation;
    const status = await this.request('configure', { capA: settings.capA, capB: settings.capB, frequencyBalance: settings.frequencyBalance, pulseBalance: settings.pulseBalance });
    if (generation === this.generation) this.update(status);
  }
  async stop(): Promise<void> {
    if (!this.active) return;
    this.generation++;
    try { await this.request('stop'); }
    finally {
      this.session = null; this.update(null);
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('蓝牙会话已结束，请重新连接')); }
      this.pending.clear();
    }
  }
  private assertTarget(client: string, slot: string): void {
    if (client !== `bluetooth-${this.session}` || this.status?.state !== 'ready' || slot !== this.status.deviceId) throw new Error('bluetooth:device-not-ready');
  }
  async sendPulse(client: string, slot: string, channel: 0 | 1, duration: number, frames: string[]): Promise<unknown> {
    this.assertTarget(client, slot);
    if (frames.length !== 1) throw new Error('bluetooth:invalid-frame');
    return this.request('pulse', { channel, duration, frame: frames[0] });
  }
  async setTempIntensity(client: string, slot: string, channel: 0 | 1, value: number, duration: number): Promise<unknown> {
    this.assertTarget(client, slot);
    return this.request('intensity', { channel, value, duration });
  }
  async clearOperate(client: string, options: { slotId: string; channel: 0 | 1 }): Promise<unknown> {
    this.assertTarget(client, options.slotId);
    return this.request('clear', { channel: options.channel });
  }
  async resetIntensity(client: string, slot: string, channel: 0 | 1): Promise<unknown> {
    this.assertTarget(client, slot);
    return this.request('intensity', { channel, value: 0, duration: 250 });
  }
}
