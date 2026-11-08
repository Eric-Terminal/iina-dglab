import { DglabSocket, DglabSocketDeviceType } from 'dglab-kit';
import QRCode from 'qrcode';
import { AudioController, channelLimit, isConnected, type Target, type Transport } from './controller';
import { DEFAULT_SETTINGS, OFFICIAL_SERVER, RESPONSE_TIMEOUT_MS, validateSettings, type AudioSample, type Settings } from './shared';
import { bindDocumentLanguage, setLanguage, getLocale, t, type Language } from './i18n';
import { BluetoothTransport } from './bluetooth-transport';
import type { BluetoothStatus } from './bluetooth-helper';

interface Bridge {
  postMessage(name: string, data?: unknown): void;
  onMessage(name: string, handler: (data: any) => void): void;
}
const bridge = (window as unknown as { iina?: Bridge }).iina;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('settings');
const serverInput = $<HTMLInputElement>('server');
const modeInput = $<HTMLSelectElement>('connection-mode');
const nodeInput = $<HTMLInputElement>('node-path');
const deviceSelect = $<HTMLSelectElement>('device');
const bluetoothSelect = $<HTMLSelectElement>('bluetooth-device');
const languageInput = $<HTMLSelectElement>('language');
const translateDocument = bindDocumentLanguage(document);
let language: Language = 'system';
setLanguage(language, navigator.language);
translateDocument();
let socket = new DglabSocket({ url: OFFICIAL_SERVER, responseTimeout: RESPONSE_TIMEOUT_MS });
let shownFailure: string | null = null;
let targets: Target[] = [];
let socketState: string = 'idle';
let dirty = false;
let hasSource = false;
let supportsWindowTracking = false;
let connecting = false;
let disconnecting = false;
let connectionGeneration = 0;
let localResult: ((data: { url?: string; error?: string }) => void) | undefined;
const samples: (number | null)[] = [];
const bluetooth = new BluetoothTransport(bridge, updateBluetooth);
let lastBluetoothError: string | null = null;
const activeTransport = (): Transport => modeInput.value === 'bluetooth' ? bluetooth : socket;
const transport: Transport = {
  sendPulse: (...args) => activeTransport().sendPulse(...args),
  setTempIntensity: (...args) => activeTransport().setTempIntensity(...args),
  clearOperate: (...args) => activeTransport().clearOperate(...args),
  resetIntensity: (...args) => activeTransport().resetIntensity(...args),
};
const controller = new AudioController(transport, render);

function showError(error: unknown): void {
  $('error').dataset.message = error instanceof Error ? error.message : String(error);
  $('error').textContent = t($('error').dataset.message!);
  $('error').hidden = false;
}

function key(target: Target): string { return JSON.stringify([target.clientId, target.device.slotId]); }

function updateBluetooth(status: BluetoothStatus | null): void {
  if (modeInput.value !== 'bluetooth') return;
  socketState = status?.state === 'ready' ? 'paired' : status?.state || 'idle';
  const previous = bluetoothSelect.value;
  bluetoothSelect.replaceChildren(new Option(t(status?.devices.length ? '选择附近设备' : '尚未发现设备'), ''));
  for (const device of status?.devices || []) bluetoothSelect.add(new Option(`${device.name} · ${device.id.slice(0, 8)}`, device.id));
  bluetoothSelect.value = status?.deviceId || (status?.devices.some(device => device.id === previous) ? previous : status?.devices.length === 1 ? status.devices[0].id : '');
  controller.setTarget(status?.state === 'ready' && status.deviceId ? {
    clientId: `bluetooth-${bluetooth.session}`,
    device: {
      type: DglabSocketDeviceType.COYOTE_030, name: 'Coyote 3.0', slotId: status.deviceId,
      props: { connectState: 'connected', intensityA: status.intensityA, intensityB: status.intensityB },
      slotState: { hasDevice: true, channelA: { intensityMax: status.capA }, channelB: { intensityMax: status.capB } },
    },
  } : null);
  if (status?.error && status.error !== lastBluetoothError) showError(`bluetooth:${status.error}`);
  lastBluetoothError = status?.error || null;
  render();
}

function updateDevices(): void {
  targets = socket.clients.flatMap(client => client.devices
    .filter(device => device.type === 'COYOTE_030')
    .map(device => ({ clientId: client.clientId, device })));
  const previous = controller.target ? key(controller.target) : '';
  deviceSelect.replaceChildren();
  if (!targets.length) deviceSelect.add(new Option(t('等待 App 中的郊狼 3.0 设备'), ''));
  else {
    deviceSelect.add(new Option(t('选择输出设备'), ''));
    for (const target of targets) deviceSelect.add(new Option(`${target.device.name} · ${target.clientId.slice(0, 6)}${isConnected(target) ? '' : ` · ${t('离线')}`}`, key(target)));
  }
  const selected = targets.find(target => key(target) === previous) || (targets.length === 1 ? targets[0] : null);
  controller.setTarget(selected);
  deviceSelect.value = selected ? key(selected) : '';
  if (selected) $<HTMLDetailsElement>('pairing').open = false;
  render();
}

function validateServer(raw: string): string {
  const url = new URL(raw.trim());
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash || url.searchParams.has('tid') || url.searchParams.has('targetId')) {
    throw new Error('请输入 V4 控制端 ws:// 或 wss:// 地址，不要带配对 ID、用户名或片段。');
  }
  return url.toString();
}

async function disconnect(reason: string): Promise<void> {
  connectionGeneration++;
  disconnecting = true;
  localResult?.({ error: reason });
  render();
  try { await controller.stop(reason); }
  finally {
    socket.disconnect();
    try { await bluetooth.stop(); }
    finally {
      bridge?.postMessage('local-stop', {});
      disconnecting = false;
      render();
    }
  }
}

function startLocal(): Promise<string> {
  if (window.location.protocol !== 'file:') return Promise.reject(new Error('请在 IINA 插件窗口中启动本机中继。'));
  const scriptPath = decodeURIComponent(new URL('relay.cjs', window.location.href).pathname);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      localResult = undefined;
      bridge?.postMessage('local-stop', {});
      reject(new Error('本地中继启动超时，请检查 Node.js 路径。'));
    }, 10000);
    localResult = data => {
      clearTimeout(timeout);
      localResult = undefined;
      if (data.url) resolve(data.url);
      else reject(new Error(data.error || '本地中继启动失败。'));
    };
    bridge?.postMessage('local-start', { nodePath: nodeInput.value.trim(), scriptPath });
  });
}

async function connect(): Promise<void> {
  if (connecting || disconnecting) return;
  if (bluetooth.active || socketState === 'paired' || socketState === 'waiting_for_peer') {
    await disconnect('已断开连接');
    return;
  }
  const generation = ++connectionGeneration;
  const local = modeInput.value === 'local';
  connecting = true;
  $('error').hidden = true;
  render();
  socket.disconnect();
  try {
    if (modeInput.value === 'bluetooth') {
      if (window.location.protocol !== 'file:') throw new Error('请在 IINA 插件窗口中启动蓝牙直连。');
      await bluetooth.start(decodeURIComponent(new URL('CoyoteBluetooth.app', window.location.href).pathname));
      if (generation !== connectionGeneration) { await bluetooth.stop(); return; }
      await bluetooth.scan(); save(); return;
    }
    const url = local ? await startLocal() : validateServer(serverInput.value);
    if (generation !== connectionGeneration) return;
    const current = new DglabSocket({ url, connectTimeout: 8000, responseTimeout: RESPONSE_TIMEOUT_MS });
    socket = current;
    current.on('state', state => {
      if (current !== socket || modeInput.value === 'bluetooth') return;
      socketState = state;
      if (state === 'disconnected' || state === 'idle') {
        if (local) bridge?.postMessage('local-stop', {});
        void controller.stop('连接已断开，请重新连接并开始联动');
        controller.setTarget(null);
        targets = [];
        $('pairing').hidden = true;
        deviceSelect.replaceChildren(new Option(t('等待 App 连接'), ''));
      }
      render();
    });
    current.on('devices', () => { if (current === socket && modeInput.value !== 'bluetooth') updateDevices(); });
    current.on('client-disconnected', () => {
      if (current === socket && modeInput.value !== 'bluetooth') updateDevices();
    });
    // 使用 App 的完整 snapshot 与 patch；devices.get 只有设备描述，会丢失通道上限快照。
    current.on('error', error => {
      if (current !== socket || modeInput.value === 'bluetooth') return;
      void controller.stop('连接发生错误，请检查 App');
      showError(error);
    });
    const { targetId } = await current.connect();
    if (current !== socket || generation !== connectionGeneration) return;
    const appUrl = new URL(url);
    appUrl.searchParams.set('tid', targetId);
    $<HTMLInputElement>('pair-url').value = appUrl.toString();
    $('qr').hidden = local;
    $('pair-grid').classList.toggle('local', local);
    $('pairing-title').textContent = t(local ? '本机连接地址' : '配对二维码与连接地址');
    $('pairing-hint').textContent = t(local ? '复制下方地址到同一台 Mac 的 App。重新连接后需使用新地址。' : '手机可扫码；桌面 App 可复制下方地址。');
    if (!local) {
      const pairing = `https://dungeon-lab.cn/s/?v=1&action=socket&url=${encodeURIComponent(appUrl.toString())}`;
      await QRCode.toCanvas($<HTMLCanvasElement>('qr'), pairing, { width: 172, margin: 3, errorCorrectionLevel: 'M' });
    }
    if (generation !== connectionGeneration) return;
    $('pairing').hidden = false;
    $<HTMLDetailsElement>('pairing').open = true;
    save();
  } catch (error) {
    if (generation === connectionGeneration) {
      socket.disconnect();
      await bluetooth.stop();
      if (local) bridge?.postMessage('local-stop', {});
      throw error;
    }
  } finally { connecting = false; render(); }
}

function populate(settings: Settings): void {
  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | null;
    if (!field) continue;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = value as boolean;
    else field.value = String(value);
  }
  dirty = false;
}

function readSettings(): Settings {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const field = form.elements.namedItem(key) as HTMLInputElement;
    result[key] = field.type === 'checkbox' ? field.checked : key === 'metric' ? field.value : Number(field.value);
  }
  return validateSettings(result);
}

function save(): void {
  bridge?.postMessage('save', { settings: controller.settings, server: serverInput.value.trim(), connectionMode: modeInput.value, nodePath: nodeInput.value.trim() });
}

function render(): void {
  const direct = modeInput.value === 'bluetooth';
  const states: Record<string, string> = { idle: '未连接', connecting: '正在连接', waiting_for_peer: '等待 App 配对', paired: 'App 已连接', disconnected: '连接已断开' };
  const directStates: Record<string, string> = { idle: '未连接', scanning: '正在扫描', scanned: '请选择设备', connecting: '正在连接', paired: '蓝牙已连接', disconnecting: '正在断开', disconnected: '设备已离线', error: '蓝牙连接异常' };
  $('connection-state').textContent = t((direct ? directStates : states)[socketState] || socketState);
  $('connection-state').classList.toggle('connected', socketState === 'paired');
  $<HTMLButtonElement>('connect').textContent = t(connecting ? '连接中…' : bluetooth.active || ['paired', 'waiting_for_peer'].includes(socketState) ? '断开连接' : direct ? '扫描设备' : '连接 App');
  $<HTMLButtonElement>('connect').disabled = connecting || disconnecting;
  serverInput.disabled = modeInput.disabled = nodeInput.disabled = connecting || disconnecting || bluetooth.active || ['paired', 'waiting_for_peer'].includes(socketState);
  const local = modeInput.value === 'local';
  $('local-settings').hidden = !local;
  $('remote-settings').hidden = local;
  $('connection-hint').textContent = t(direct ? '通过这台 Mac 的蓝牙连接郊狼 3.0，无需官方 App 或中继。' : local ? '连接后，将 Socket 地址粘贴到同一台 Mac 的官方 App。' : '连接后，用官方 App 的 Socket 控制扫码或粘贴地址配对。');
  $('bluetooth-controls').hidden = $('bluetooth-calibration').hidden = !direct;
  $('app-settings').hidden = $('app-device').hidden = direct;
  if (direct) $('pairing').hidden = true;
  const bluetoothBusy = connecting || disconnecting || ['connecting', 'ready', 'disconnecting'].includes(bluetooth.status?.state || '');
  bluetoothSelect.disabled = bluetoothBusy;
  $<HTMLButtonElement>('bluetooth-scan').disabled = !bluetooth.active || bluetoothBusy;
  $<HTMLButtonElement>('bluetooth-pair').disabled = !bluetooth.active || bluetoothBusy || !bluetoothSelect.value;
  $('bluetooth-detail').textContent = bluetooth.status?.battery == null ? '' : t(`电量 ${bluetooth.status.battery}%`);
  $('limit-hint').textContent = t(direct ? '直连使用插件设置的通道上限；首次连接保持零输出。' : '实际通道强度不会超过 App 回传的上限。');
  $('dirty').textContent = t(dirty ? '修改尚未应用' : '参数已应用');
  $('status').textContent = t(controller.reason) + (dirty ? ` · ${t('参数尚未应用，请先点「应用参数」。')}` : '');
  $<HTMLButtonElement>('start').disabled = controller.armed || controller.starting || connecting || disconnecting || !controller.target || !isConnected(controller.target) || !hasSource || !supportsWindowTracking || dirty;
  $('start').textContent = t(controller.armed ? '联动已开启' : controller.starting ? '正在准备…' : dirty ? '请先应用参数' : '开始联动');
  const sample = controller.sample?.preview;
  const number = (n: number | null | undefined, digits = 1) => typeof n === 'number' && Number.isFinite(n) ? Math.max(-99, n).toFixed(digits) : '—';
  $('rms').textContent = number(sample?.rmsDb);
  $('peak').textContent = number(sample?.peakDb);
  $('zcr').textContent = number(sample?.zcr, 3);
  $('amplitude').textContent = String(controller.previewWave?.intensity || 0);
  $('signal-state').textContent = t(sample?.running ? `门限 ${number(controller.previewWave?.gateDb)} dBFS · ${controller.previewWave?.gated ? '关闭' : '通过'}` : sample?.reason || '等待音频');
  if (controller.sample) $('source').textContent = controller.sample.title;
  for (const [channel, id] of [[0, 'channel-a'], [1, 'channel-b']] as const) {
    $(id).textContent = t(controller.target
      ? `${direct ? '设备当前' : 'App 当前'} ${number(Number(controller.target.device.props?.[channel === 0 ? 'intensityA' : 'intensityB']), 0)} / 上限 ${channelLimit(controller.target, channel)}`
      : direct ? '等待蓝牙设备连接' : '等待 App 回传上限');
  }
  if (shownFailure !== controller.failure) {
    if (controller.failure) showError(controller.failure);
    else if ($('error').dataset.message === shownFailure) { $('error').hidden = true; delete $('error').dataset.message; }
    shownFailure = controller.failure;
  }
  if ($('error').dataset.message) $('error').textContent = t($('error').dataset.message!);
}

function drawScope(): void {
  const canvas = $<HTMLCanvasElement>('scope');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const gate = controller.previewWave?.gateDb ?? controller.settings.gateDb;
  const y = (db: number) => height - Math.max(0, Math.min(1, (db + 75) / 75)) * (height - 8) - 4;
  ctx.strokeStyle = '#777777';
  ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(0, y(gate)); ctx.lineTo(width, y(gate)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
  ctx.lineWidth = 2;
  ctx.beginPath();
  let penDown = false;
  samples.forEach((db, i) => {
    if (db === null) { penDown = false; return; }
    const x = width * (120 - samples.length + i) / 119;
    if (penDown) ctx.lineTo(x, y(db)); else ctx.moveTo(x, y(db));
    penDown = true;
  });
  ctx.stroke();
}

$('connect').addEventListener('click', () => { void connect().catch(showError); });
$('bluetooth-scan').addEventListener('click', () => { void bluetooth.scan().catch(showError); });
$('bluetooth-pair').addEventListener('click', () => { void bluetooth.connect(bluetoothSelect.value, controller.settings).catch(showError); });
bluetoothSelect.addEventListener('change', render);
languageInput.addEventListener('change', () => {
  language = languageInput.value as Language;
  setLanguage(language, navigator.language); translateDocument();
  bridge?.postMessage('language', { language, locale: getLocale() });
  // 仅重绘设备标签；保留当前目标，语言变化不应发送设备指令。
  for (const option of Array.from(deviceSelect.options)) {
    const target = targets.find(item => key(item) === option.value);
    if (target) option.text = `${target.device.name} · ${target.clientId.slice(0, 6)}${isConnected(target) ? '' : ` · ${t('离线')}`}`;
    else option.text = t(targets.length ? '选择输出设备' : '等待 App 中的郊狼 3.0 设备');
  }
  $('pairing-title').textContent = t(modeInput.value === 'local' ? '本机连接地址' : '配对二维码与连接地址');
  $('pairing-hint').textContent = t(modeInput.value === 'local' ? '复制下方地址到同一台 Mac 的 App。重新连接后需使用新地址。' : '手机可扫码；桌面 App 可复制下方地址。');
  $('copy').textContent = t('复制');
  if (modeInput.value === 'bluetooth') {
    const first = bluetoothSelect.options[0];
    if (first) first.text = t(bluetooth.status?.devices.length ? '选择附近设备' : '尚未发现设备');
  }
  render();
});
modeInput.addEventListener('change', () => { socketState = 'idle'; controller.setTarget(null); render(); save(); });
$('copy').addEventListener('click', async () => {
  const input = $<HTMLInputElement>('pair-url');
  try { await navigator.clipboard.writeText(input.value); $('copy').textContent = t('已复制'); }
  catch { input.focus(); input.select(); $('copy').textContent = t('请按 ⌘C'); }
});
deviceSelect.addEventListener('change', () => controller.setTarget(targets.find(target => key(target) === deviceSelect.value) || null));
form.addEventListener('input', () => { dirty = true; render(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const settings = readSettings();
    if (modeInput.value === 'bluetooth' && bluetooth.active) await bluetooth.configure(settings);
    controller.configure(settings); dirty = false; save(); $('error').hidden = true; render();
  }
  catch (error) { showError(error); }
});
$('start').addEventListener('click', () => { $('error').hidden = true; void controller.start().catch(showError); });
$('stop').addEventListener('click', () => { void controller.stop(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); void controller.stop(); } });
window.addEventListener('pagehide', () => { void disconnect('控制窗口已关闭'); });
setInterval(() => controller.watchdog(), 100);

populate(DEFAULT_SETTINGS);
if (bridge) {
  bridge.onMessage('init', (data: { language?: Language; settings: Settings; server: string; connectionMode: string; nodePath: string; sourceTitle: string; hasSource: boolean; supportsWindowTracking: boolean }) => {
    language = data.language || 'system'; languageInput.value = language;
    setLanguage(language, navigator.language); translateDocument();
    bridge.postMessage('language', { language, locale: getLocale() });
    if (!dirty && !controller.armed) { controller.configure(data.settings); populate(data.settings); }
    if (!connecting && !bluetooth.active && !['paired', 'waiting_for_peer'].includes(socketState)) {
      serverInput.value = data.server;
      modeInput.value = ['local', 'bluetooth'].includes(data.connectionMode) ? data.connectionMode : 'remote';
      nodeInput.value = data.nodePath || '';
    }
    hasSource = data.hasSource;
    supportsWindowTracking = data.supportsWindowTracking;
    if (!supportsWindowTracking) showError('当前 IINA 缺少控制窗口状态接口，请升级 IINA 后使用联动。');
    $('source').textContent = t(data.sourceTitle);
    render();
  });
  bridge.onMessage('audio', (sample: AudioSample) => {
    hasSource = true;
    controller.accept(sample);
    samples.push(sample.preview.running ? controller.previewWave?.db ?? null : null);
    if (samples.length > 120) samples.shift();
    drawScope();
  });
  // 原生超时通知可能与新采样交错；按控制台当前持有的采样重新检查有效期。
  bridge.onMessage('audio-stale', () => controller.watchdog());
  bridge.onMessage('stop', (data: { reason: string }) => { void controller.stop(data.reason); });
  bridge.onMessage('local-result', (data: { url?: string; error?: string }) => localResult?.(data));
  bridge.onMessage('disconnect', (data: { reason: string }) => { void disconnect(data.reason); });
  bridge.onMessage('error', (data: { message: string }) => showError(data.message));
  bridge.postMessage('ready');
} else {
  showError('请在 IINA 的插件控制窗口中打开此页面。');
  $<HTMLButtonElement>('connect').disabled = true;
}
render();
