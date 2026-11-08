import { DglabSocket } from 'dglab-kit';
import QRCode from 'qrcode';
import { AudioController, channelLimit, isConnected, type Target, type Transport } from './controller';
import { DEFAULT_SETTINGS, OFFICIAL_SERVER, validateSettings, type AudioSample, type Settings } from './shared';

interface Bridge {
  postMessage(name: string, data?: unknown): void;
  onMessage(name: string, handler: (data: any) => void): void;
}
const bridge = (window as unknown as { iina?: Bridge }).iina;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('settings');
const serverInput = $<HTMLInputElement>('server');
const deviceSelect = $<HTMLSelectElement>('device');
let socket = new DglabSocket({ url: OFFICIAL_SERVER, responseTimeout: 800 });
let targets: Target[] = [];
let socketState: string = 'idle';
let dirty = false;
let hasSource = false;
let supportsWindowTracking = false;
let connecting = false;
const samples: (number | null)[] = [];
const transport: Transport = {
  sendPulse: (...args) => socket.sendPulse(...args),
  setTempIntensity: (...args) => socket.setTempIntensity(...args),
  clearOperate: (...args) => socket.clearOperate(...args),
  resetIntensity: (...args) => socket.resetIntensity(...args),
};
const controller = new AudioController(transport, render);

function showError(error: unknown): void {
  $('error').textContent = error instanceof Error ? error.message : String(error);
  $('error').hidden = false;
}

function key(target: Target): string { return JSON.stringify([target.clientId, target.device.slotId]); }

function updateDevices(): void {
  targets = socket.clients.flatMap(client => client.devices
    .filter(device => device.type === 'COYOTE_030')
    .map(device => ({ clientId: client.clientId, device })));
  const previous = controller.target ? key(controller.target) : '';
  deviceSelect.replaceChildren();
  if (!targets.length) deviceSelect.add(new Option('等待 App 中的郊狼 3.0 设备', ''));
  else {
    deviceSelect.add(new Option('选择输出设备', ''));
    for (const target of targets) deviceSelect.add(new Option(`${target.device.name} · ${target.clientId.slice(0, 6)}${isConnected(target) ? '' : ' · 离线'}`, key(target)));
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

async function connect(): Promise<void> {
  if (connecting) return;
  if (socketState === 'paired' || socketState === 'waiting_for_peer') {
    await controller.stop('已断开连接');
    socket.disconnect();
    return;
  }
  const url = validateServer(serverInput.value);
  connecting = true;
  $('error').hidden = true;
  render();
  socket.disconnect();
  const current = new DglabSocket({ url, connectTimeout: 8000, responseTimeout: 800 });
  socket = current;
  current.on('state', state => {
    if (current !== socket) return;
    socketState = state;
    if (state === 'disconnected' || state === 'idle') {
      void controller.stop('连接已断开，请重新连接并开始联动');
      controller.setTarget(null);
      targets = [];
      $('pairing').hidden = true;
      deviceSelect.replaceChildren(new Option('等待 App 连接', ''));
    }
    render();
  });
  current.on('devices', () => { if (current === socket) updateDevices(); });
  current.on('client-disconnected', () => {
    if (current === socket) updateDevices();
  });
  // 使用 App 的完整 snapshot 与 patch；devices.get 只有设备描述，会丢失通道上限快照。
  current.on('error', error => {
    if (current !== socket) return;
    void controller.stop('连接发生错误，请检查 App');
    showError(error);
  });
  try {
    const { targetId } = await current.connect();
    if (current !== socket) return;
    const appUrl = new URL(url);
    appUrl.searchParams.set('tid', targetId);
    const pairing = `https://dungeon-lab.cn/s/?v=1&action=socket&url=${encodeURIComponent(appUrl.toString())}`;
    $<HTMLInputElement>('pair-url').value = appUrl.toString();
    await QRCode.toCanvas($<HTMLCanvasElement>('qr'), pairing, { width: 172, margin: 3, errorCorrectionLevel: 'M' });
    $('pairing').hidden = false;
    $<HTMLDetailsElement>('pairing').open = true;
    save();
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
  bridge?.postMessage('save', { settings: controller.settings, server: serverInput.value.trim() });
}

function render(): void {
  const states: Record<string, string> = { idle: '未连接', connecting: '正在连接', waiting_for_peer: '等待 App 配对', paired: 'App 已连接', disconnected: '连接已断开' };
  $('connection-state').textContent = states[socketState] || socketState;
  $('connection-state').classList.toggle('connected', socketState === 'paired');
  $<HTMLButtonElement>('connect').textContent = connecting ? '连接中…' : ['paired', 'waiting_for_peer'].includes(socketState) ? '断开连接' : '连接 App';
  $<HTMLButtonElement>('connect').disabled = connecting;
  serverInput.disabled = connecting || ['paired', 'waiting_for_peer'].includes(socketState);
  $('dirty').textContent = dirty ? '修改尚未应用' : '参数已应用';
  $('status').textContent = controller.reason;
  $<HTMLButtonElement>('start').disabled = controller.armed || controller.starting || !controller.target || !hasSource || !supportsWindowTracking || dirty;
  $('start').textContent = controller.armed ? '联动已开启' : controller.starting ? '正在准备…' : '开始联动';
  const sample = controller.sample;
  const number = (n: number | null | undefined, digits = 1) => typeof n === 'number' && Number.isFinite(n) ? Math.max(-99, n).toFixed(digits) : '—';
  $('rms').textContent = number(sample?.rmsDb);
  $('peak').textContent = number(sample?.peakDb);
  $('zcr').textContent = number(sample?.zcr, 3);
  $('amplitude').textContent = String(controller.wave?.intensity || 0);
  $('signal-state').textContent = sample?.running ? `门限 ${number(controller.wave?.gateDb)} dBFS · ${controller.wave?.gated ? '关闭' : '通过'}` : '等待音频';
  if (sample) $('source').textContent = sample.title;
  for (const [channel, id] of [[0, 'channel-a'], [1, 'channel-b']] as const) {
    $(id).textContent = controller.target
      ? `App 当前 ${number(Number(controller.target.device.props?.[channel === 0 ? 'intensityA' : 'intensityB']), 0)} / 上限 ${channelLimit(controller.target, channel)}`
      : '等待 App 回传上限';
  }
}

function drawScope(): void {
  const canvas = $<HTMLCanvasElement>('scope');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const gate = controller.wave?.gateDb ?? controller.settings.gateDb;
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
$('copy').addEventListener('click', async () => {
  const input = $<HTMLInputElement>('pair-url');
  try { await navigator.clipboard.writeText(input.value); $('copy').textContent = '已复制'; }
  catch { input.focus(); input.select(); $('copy').textContent = '请按 ⌘C'; }
});
deviceSelect.addEventListener('change', () => controller.setTarget(targets.find(target => key(target) === deviceSelect.value) || null));
form.addEventListener('input', () => { dirty = true; render(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  try { controller.configure(readSettings()); dirty = false; save(); $('error').hidden = true; render(); }
  catch (error) { showError(error); }
});
$('start').addEventListener('click', () => { $('error').hidden = true; void controller.start().catch(showError); });
$('stop').addEventListener('click', () => { void controller.stop(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); void controller.stop(); } });
window.addEventListener('pagehide', () => { void controller.stop('控制窗口已关闭'); });
setInterval(() => controller.watchdog(), 100);

populate(DEFAULT_SETTINGS);
if (bridge) {
  bridge.onMessage('init', (data: { settings: Settings; server: string; sourceTitle: string; hasSource: boolean; supportsWindowTracking: boolean }) => {
    if (!dirty && !controller.armed) { controller.configure(data.settings); populate(data.settings); }
    if (!connecting && !['paired', 'waiting_for_peer'].includes(socketState)) serverInput.value = data.server;
    hasSource = data.hasSource;
    supportsWindowTracking = data.supportsWindowTracking;
    if (!supportsWindowTracking) showError('当前 IINA 缺少控制窗口状态接口，请升级 IINA 后使用联动。');
    $('source').textContent = data.sourceTitle;
    render();
  });
  bridge.onMessage('audio', (sample: AudioSample) => {
    hasSource = true;
    controller.accept(sample);
    samples.push(sample.running ? controller.wave?.db ?? null : null);
    if (samples.length > 120) samples.shift();
    drawScope();
  });
  bridge.onMessage('stop', (data: { reason: string }) => { void controller.stop(data.reason); });
  bridge.onMessage('error', (data: { message: string }) => showError(data.message));
  bridge.postMessage('ready');
} else {
  showError('请在 IINA 的插件控制窗口中打开此页面。');
  $<HTMLButtonElement>('connect').disabled = true;
}
render();
