interface RelayInfo { url: string; leaseUrl: string; shutdownUrl: string }

/** 管理本插件启动的中继；连接密钥仅在内存中保存，不写偏好或日志。 */
export class LocalRelay {
  private info: RelayInfo | null = null;
  private starting: Promise<string> | null = null;
  private generation = 0;
  private keepingAlive = false;
  constructor(private api: Pick<typeof iina, 'utils' | 'http'>) {}

  start(nodePath: string, scriptPath: string): Promise<string> {
    if (this.info) return Promise.resolve(this.info.url);
    if (this.starting) return this.starting;
    const generation = ++this.generation;
    const attempt = async () => {
      const candidates = nodePath.trim() ? [nodePath.trim()] : ['/opt/homebrew/bin/node', '/usr/local/bin/node'];
      const node = candidates.find(path => path.startsWith('/') && this.api.utils.fileInPath(path));
      if (!node) throw new Error('未找到 Node.js。请安装 Node.js 22+，或在连接设置中填写 node 的绝对路径。');
      // IINA 的 resolvePath 不支持相对插件路径；由同目录 WebView 提供文件 URL 的绝对路径。
      if (!scriptPath.startsWith('/') || !scriptPath.endsWith('/dist/relay.cjs') || !this.api.utils.fileInPath(scriptPath)) {
        throw new Error('找不到插件内的本地中继程序，请重新安装插件。');
      }
      const result = await this.api.utils.exec(node, [scriptPath, '--launch']);
      if (result.status !== 0) throw new Error(result.stderr.trim() || '本地中继启动失败。');
      const info = JSON.parse(result.stdout.trim()) as RelayInfo;
      if (!/^ws:\/\/127\.0\.0\.1:\d+\/v4\/[a-f0-9]+$/.test(info.url)) throw new Error('本地中继返回了无效的连接地址。');
      if (generation !== this.generation) {
        await this.post(info.shutdownUrl);
        throw new Error('本地中继启动已取消。');
      }
      this.info = info;
      return info.url;
    };
    this.starting = attempt().finally(() => { this.starting = null; });
    return this.starting;
  }

  async stop(): Promise<void> {
    this.generation++;
    const info = this.info;
    this.info = null;
    if (info) { try { await this.post(info.shutdownUrl); } catch { /* 租约到期后辅助进程自行退出。 */ } }
  }

  async keepAlive(): Promise<void> {
    if (!this.info || this.keepingAlive) return;
    this.keepingAlive = true;
    try { await this.post(this.info.leaseUrl); }
    finally { this.keepingAlive = false; }
  }

  private async post(url: string): Promise<void> {
    const response = await this.api.http.post(url, { headers: {}, params: {}, data: {} });
    if (response.statusCode !== 204) throw new Error('本地中继已失去响应，请重新连接。');
  }
}
