import { DEFAULT_SETTINGS, OFFICIAL_SERVER, STALE_MS, validateSettings, type AudioSample, type Settings } from './shared';
import { LocalRelay } from './local-relay';

const { global: hub, standaloneWindow: window, menu, preferences, console: log } = iina;
const windowAPI = window as typeof window & { isOpen?: () => boolean };
const supportsWindowTracking = typeof windowAPI.isOpen === 'function';
let selectedPlayer: string | undefined;
let sourceTitle = '请从播放窗口的插件菜单选择音源';
let lastSample: AudioSample | undefined;
let uiReady = false;
let windowWasOpen = false;
let settings: Settings = { ...DEFAULT_SETTINGS };
try {
  const stored = preferences.get('settings');
  if (stored) settings = validateSettings(stored);
} catch { log.warn('已忽略无效的已保存参数。'); }
const savedServer = preferences.get('server');
let server = typeof savedServer === 'string' ? savedServer : OFFICIAL_SERVER;
let connectionMode = preferences.get('connectionMode') === 'remote' ? 'remote' : 'local';
let nodePath = String(preferences.get('nodePath') || '');
const relay = new LocalRelay(iina);
let relayGeneration = 0;

window.loadFile('dist/ui.html');
window.setProperty({ title: '音频联动', resizable: true });
window.setFrame(820, 840);

function initializeUI(): void {
  window.postMessage('init', { settings, server, connectionMode, nodePath, sourceTitle, hasSource: !!selectedPlayer, supportsWindowTracking });
  if (lastSample && Date.now() - lastSample.at <= STALE_MS) window.postMessage('audio', lastSample);
}

function open(): void { window.open(); if (uiReady) initializeUI(); }
function stop(reason: string): void { window.postMessage('stop', { reason }); }

menu.addItem(menu.item('打开音频联动控制台', open));
menu.addItem(menu.item('停止郊狼输出', () => stop('已手动停止')));
hub.onMessage('select-source', (data: { title: string }, player?: string) => {
  if (!player) return;
  stop('音源已切换，请重新开始联动');
  // IINA 的 null 广播仅覆盖插件创建的播放器；普通窗口必须按标签停用。
  if (selectedPlayer && selectedPlayer !== player) hub.postMessage(selectedPlayer, 'capture', { enabled: false });
  selectedPlayer = player;
  sourceTitle = data.title;
  lastSample = undefined;
  open();
});
hub.onMessage('audio', (sample: AudioSample, player?: string) => {
  if (player !== selectedPlayer) return;
  lastSample = sample;
  sourceTitle = sample.title;
  if (uiReady) window.postMessage('audio', sample);
});
hub.onMessage('source-reset', (data: { reason: string }, player?: string) => {
  if (player === selectedPlayer) { lastSample = undefined; stop(data.reason); }
});
hub.onMessage('emergency-stop', () => stop('已通过快捷键停止'));

window.onMessage('ready', () => { uiReady = true; initializeUI(); });
window.onMessage('save', (data: { settings: unknown; server: string; connectionMode: string; nodePath: string }) => {
  try {
    settings = validateSettings(data.settings);
    server = data.server;
    preferences.set('settings', settings);
    preferences.set('server', server);
    connectionMode = data.connectionMode === 'remote' ? 'remote' : 'local';
    nodePath = data.nodePath.trim();
    preferences.set('connectionMode', connectionMode);
    preferences.set('nodePath', nodePath);
    preferences.sync();
  } catch (error) { window.postMessage('error', { message: String(error) }); }
});
window.onMessage('local-start', async (data: { nodePath: string; scriptPath: string }) => {
  const generation = ++relayGeneration;
  try {
    const url = await relay.start(data.nodePath, data.scriptPath);
    if (generation === relayGeneration) window.postMessage('local-result', { url });
  } catch (error) {
    if (generation === relayGeneration) window.postMessage('local-result', { error: String(error) });
  }
});
window.onMessage('local-stop', () => { relayGeneration++; void relay.stop(); });
setInterval(() => {
  const generation = relayGeneration;
  if (!windowAPI.isOpen?.()) return;
  void relay.keepAlive().catch(() => {
    if (generation !== relayGeneration) return;
    relayGeneration++;
    window.postMessage('disconnect', { reason: '本地中继已失去响应，请重新连接' });
    void relay.stop();
  });
}, 2000);
// 原生计时器检查窗口关闭与采样中断，不依赖 WebView 后台定时器保持频率。
setInterval(() => {
  const visible = windowAPI.isOpen?.() ?? false;
  if (windowWasOpen && !visible) {
    window.postMessage('disconnect', { reason: '控制窗口已关闭' });
    const generation = ++relayGeneration;
    // 先给 WebView 清理设备任务的机会；后台停止回调失效时，租约仍会关闭中继。
    setTimeout(() => { if (generation === relayGeneration) void relay.stop(); }, 1500);
  }
  windowWasOpen = visible;
  if (lastSample && Date.now() - lastSample.at > STALE_MS) {
    lastSample = undefined;
    stop('音频采样已中断，请重新开始联动');
  }
}, 100);
