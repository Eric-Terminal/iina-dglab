import { AUDIO_FILTER, FILTER_LABEL, SAMPLE_MS, STALE_MS, type AudioSample } from './shared';
import { readFeatures } from './audio';

const { mpv, event, core, menu, global: hub } = iina;
let capturing = false;
let seekUntil = 0;
let lastPosition = -1;
let lastProgressAt = 0;

function installFilter(): void {
  if (!capturing || core.status.idle) return;
  const filters = mpv.getNative<{ label?: string }[]>('af') || [];
  // 用标签操作自己的滤镜，保留均衡器、响度标准化等用户配置。
  if (!filters.some(filter => filter.label === FILTER_LABEL)) mpv.command('af', ['add', AUDIO_FILTER]);
}

function removeFilter(): void {
  const filters = mpv.getNative<{ label?: string }[]>('af') || [];
  if (filters.some(filter => filter.label === FILTER_LABEL)) mpv.command('af', ['remove', `@${FILTER_LABEL}`]);
}

function publish(reasonOverride?: string): void {
  if (!capturing) return;
  const at = Date.now();
  const position = core.status.position;
  if (position !== null && position !== lastPosition) {
    lastPosition = position;
    lastProgressAt = at;
  }
  let reason = reasonOverride || '';
  if (!reason && core.status.idle) reason = '尚未播放媒体';
  if (!reason && core.status.paused) reason = '播放已暂停';
  if (!reason && (mpv.getFlag('mute') || mpv.getNumber('volume') <= 0)) reason = '播放器已静音';
  if (!reason && (mpv.getFlag('paused-for-cache') || mpv.getFlag('seeking') || at < seekUntil)) reason = '正在缓冲或定位';
  if (!reason && mpv.getFlag('eof-reached')) reason = '播放已结束';
  if (!reason && (position === null || at - lastProgressAt > STALE_MS)) reason = '播放进度未更新';
  const sample: AudioSample = { at, title: core.status.title || 'IINA', running: false, reason, rmsDb: null, peakDb: null, zcr: null };
  if (!reason) {
    const params = mpv.getNative<{ samplerate?: number }>('audio-params');
    const features = readFeatures(mpv.getNative(`af-metadata/${FILTER_LABEL}`), params?.samplerate || 0);
    if (features) Object.assign(sample, features, { running: true });
    else sample.reason = '未取得音频统计，请确认媒体包含音轨并关闭音频直通';
  }
  hub.postMessage('audio', sample);
}

hub.onMessage('capture', ({ enabled }: { enabled: boolean }) => {
  capturing = enabled;
  lastPosition = -1;
  lastProgressAt = Date.now();
  if (enabled) { installFilter(); publish(); }
  else removeFilter();
});

menu.addItem(menu.item('打开音频联动（使用当前窗口）', () => {
  hub.postMessage('select-source', { title: core.status.title || 'IINA' });
}));
menu.addItem(menu.item('停止郊狼输出', () => hub.postMessage('emergency-stop', {}), { keyBinding: 'Ctrl+Alt+ESC' }));

event.on('iina.file-loaded', () => {
  if (!capturing) return;
  hub.postMessage('source-reset', { reason: '媒体已切换，请重新开始联动' });
  seekUntil = Date.now() + 250;
  installFilter();
  publish();
});
event.on('mpv.seek', () => { seekUntil = Date.now() + 250; publish('正在定位'); });
event.on('mpv.playback-restart', () => { seekUntil = Date.now() + 150; });
event.on('mpv.end-file', () => {
  if (!capturing) return;
  publish('播放已结束');
  hub.postMessage('source-reset', { reason: '播放已结束' });
});
event.on('mpv.shutdown', () => {
  if (capturing) hub.postMessage('source-reset', { reason: '播放窗口已关闭' });
  capturing = false;
});
setInterval(() => publish(), SAMPLE_MS);
