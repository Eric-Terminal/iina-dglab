import { DEFAULT_SETTINGS, OFFICIAL_SERVER, STALE_MS, validateSettings, type AudioSample, type Settings } from './shared';
import { LocalRelay } from './local-relay';
import { BluetoothHelper } from './bluetooth-helper';
import { setLanguage, t, type Language } from './i18n';

const { global: hub, standaloneWindow: window, menu, preferences, console: log } = iina;
const windowAPI = window as typeof window & { isOpen?: () => boolean };
const supportsWindowTracking = typeof windowAPI.isOpen === 'function';
let language: Language = ['zh-CN', 'en'].includes(preferences.get('language')) ? preferences.get('language') : 'system';
setLanguage(language);
let selectedPlayer: string | undefined;
let sourceTitle = '请从播放窗口的插件菜单选择音源';
let lastSample: AudioSample | undefined;
let uiReady = false;
let windowWasOpen = false;
let settings: Settings = { ...DEFAULT_SETTINGS };
try {
  const stored = preferences.get('settings');
  if (stored) settings = validateSettings({ ...DEFAULT_SETTINGS, ...stored });
} catch { log.warn('已忽略无效的已保存参数。'); }
const savedServer = preferences.get('server');
let server = typeof savedServer === 'string' ? savedServer : OFFICIAL_SERVER;
let connectionMode = ['local', 'bluetooth'].includes(preferences.get('connectionMode')) ? preferences.get('connectionMode') : 'remote';
let nodePath = String(preferences.get('nodePath') || '');
const relay = new LocalRelay(iina);
const bluetooth = new BluetoothHelper(iina);
let relayGeneration = 0;

window.loadFile('dist/ui.html');
window.setProperty({ title: t('音频联动'), resizable: true });
window.setFrame(820, 840);

function initializeUI(): void {
  window.postMessage('init', { language, settings, server, connectionMode, nodePath, sourceTitle, hasSource: !!selectedPlayer, supportsWindowTracking });
  if (lastSample && Date.now() - lastSample.at <= STALE_MS) window.postMessage('audio', lastSample);
}

function open(): void {
  window.open();
  if (selectedPlayer) hub.postMessage(selectedPlayer, 'capture', { enabled: true });
  if (uiReady) initializeUI();
}
function stop(reason: string): void { window.postMessage('stop', { reason }); }

function updateMenu(): void {
  menu.removeAllItems();
  menu.addItem(menu.item(t('打开音频联动控制台'), open));
  menu.addItem(menu.item(t('停止郊狼输出'), () => stop('已手动停止')));
}
updateMenu();
window.onMessage('language', (data: { language: Language; locale: string }) => {
  language = ['zh-CN', 'en'].includes(data.language) ? data.language : 'system';
  setLanguage(language, data.locale);
  preferences.set('language', language); preferences.sync();
  window.setProperty({ title: t('音频联动') }); updateMenu();
  if (selectedPlayer) hub.postMessage(selectedPlayer, 'language', { language, locale: data.locale });
});
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
    connectionMode = ['local', 'bluetooth'].includes(data.connectionMode) ? data.connectionMode : 'remote';
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
window.onMessage('bluetooth', async (data: { id: number; session: string; method: string; params: Record<string, unknown> }) => {
  try {
    let result: unknown;
    if (data.method === 'start') result = await bluetooth.start(String(data.params.appPath || ''));
    else if (data.method === 'stop') { await bluetooth.stop(); result = {}; }
    else result = await bluetooth.request(data.session, data.method, data.params);
    window.postMessage('bluetooth-result', { id: data.id, result });
  } catch (error) { window.postMessage('bluetooth-result', { id: data.id, error: error instanceof Error ? error.message : String(error) }); }
});
setInterval(() => {
  if (!windowAPI.isOpen?.()) return;
  void bluetooth.poll().then(result => { if (result) window.postMessage('bluetooth-status', result); }).catch(error => {
    window.postMessage('disconnect', { reason: String(error) }); void bluetooth.stop();
  });
}, 500);
setInterval(() => {
  const generation = relayGeneration;
  if (!windowAPI.isOpen?.()) return;
  void bluetooth.keepAlive().catch(error => {
    window.postMessage('disconnect', { reason: String(error) }); void bluetooth.stop();
  });
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
    if (selectedPlayer) hub.postMessage(selectedPlayer, 'capture', { enabled: false });
    lastSample = undefined;
    const generation = ++relayGeneration;
    // 先给 WebView 清理设备任务的机会；后台停止回调失效时，租约仍会关闭中继。
    setTimeout(() => { if (generation === relayGeneration) { void relay.stop(); void bluetooth.stop(); } }, 1500);
  }
  windowWasOpen = visible;
  if (lastSample && Date.now() - lastSample.at > STALE_MS) {
    lastSample = undefined;
    window.postMessage('audio-stale', {});
  }
}, 100);
