export interface BluetoothStatus {
  state: 'idle' | 'scanning' | 'scanned' | 'connecting' | 'ready' | 'disconnecting' | 'disconnected' | 'error';
  error: string | null;
  devices: { id: string; name: string; rssi: number }[];
  deviceId: string | null;
  battery: number | null;
  intensityA: number;
  intensityB: number;
  capA: number;
  capB: number;
}

/** 启动原生蓝牙助手，令牌只留在原生上下文；WebView 只能提交本次会话的请求。 */
export class BluetoothHelper {
  private url: string | null = null;
  private session: string | null = null;
  private generation = 0;
  private starting = false;
  private polling = false;
  constructor(private api: Pick<typeof iina, 'utils' | 'file' | 'http'>) {}

  async start(appPath: string): Promise<{ session: string; status: BluetoothStatus }> {
    if (this.starting || this.url) throw new Error('蓝牙助手已启动');
    if (!appPath.startsWith('/') || !appPath.endsWith('/dist/CoyoteBluetooth.app') || !this.api.file.exists(`${appPath}/Contents/MacOS/CoyoteBluetooth`)) {
      throw new Error('找不到蓝牙助手，请重新安装插件。');
    }
    const generation = ++this.generation;
    this.starting = true;
    const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const handshake = `@tmp/bluetooth-${session}.json`;
    try {
      const result = await this.api.utils.exec('/usr/bin/open', ['-n', '-g', appPath, '--args', '--handshake', this.api.utils.resolvePath(handshake)]);
      if (result.status !== 0) throw new Error('蓝牙助手无法启动，请检查 macOS 的隐私与安全性设置。');
      const deadline = Date.now() + 7000;
      while (!this.api.file.exists(handshake) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      if (!this.api.file.exists(handshake)) throw new Error('蓝牙助手启动超时，请检查 macOS 是否阻止了助手启动。');
      const info = JSON.parse(this.api.file.read(handshake) || '{}') as { url?: string; error?: string };
      if (!info.url || !/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}$/.test(info.url)) throw new Error('蓝牙助手未能启动本地连接。');
      if (generation !== this.generation) { await this.post(info.url, 'shutdown', {}); throw new Error('蓝牙连接已取消'); }
      this.url = info.url; this.session = session;
      const status = await this.post(info.url, 'status', {}) as BluetoothStatus;
      if (generation !== this.generation) throw new Error('蓝牙连接已取消');
      return { session, status };
    } catch (error) {
      if (generation === this.generation) await this.stop();
      throw error;
    } finally {
      this.starting = false;
      if (this.api.file.exists(handshake)) this.api.file.delete(handshake);
    }
  }

  async request(session: string, method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.url || session !== this.session) throw new Error('蓝牙会话已结束，请重新连接');
    if (!['scan', 'connect', 'configure', 'intensity', 'pulse', 'clear', 'status', 'disconnect'].includes(method)) throw new Error('无效的蓝牙请求');
    return this.post(this.url, method, params);
  }

  async poll(): Promise<{ session: string; status: BluetoothStatus } | null> {
    if (!this.url || !this.session || this.polling) return null;
    const session = this.session, url = this.url;
    this.polling = true;
    try {
      const status = await this.post(url, 'status', {}) as BluetoothStatus;
      return session === this.session ? { session, status } : null;
    } catch (error) {
      if (session !== this.session) return null;
      throw error;
    } finally { this.polling = false; }
  }

  async keepAlive(): Promise<void> {
    const url = this.url;
    if (!url) return;
    try { await this.post(url, 'lease', {}); }
    catch (error) { if (url === this.url) throw error; }
  }
  async stop(): Promise<void> {
    this.generation++;
    const url = this.url; this.url = null; this.session = null;
    if (url) { try { await this.post(url, 'shutdown', {}); } catch { /* 原生租约和波形时限独立生效。 */ } }
  }

  private async post(url: string, method: string, params: Record<string, unknown>): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        this.api.http.post(url, { headers: { 'Content-Type': 'application/json' }, params: {}, data: { method, params } }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('蓝牙助手响应超时')), 2500); }),
      ]);
      if (response.statusCode !== 200) throw new Error('蓝牙助手连接失败');
      const data = JSON.parse(response.text) as { error?: string; result?: unknown };
      if (data.error) throw new Error(`bluetooth:${data.error}`);
      return data.result;
    } finally { if (timer) clearTimeout(timer); }
  }
}
