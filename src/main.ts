import { AUDIO_FILTER, FILTER_LABEL, SAMPLE_MS, STALE_MS, type AudioSample } from './shared';
import { readFeatures } from './audio';

const { mpv, event, core, menu, global: hub } = iina;
let capturing = false;
let seekUntil = 0;
let lastPosition = -1;
let lastProgressAt = 0;
let lastFilterAttempt = -Infinity;
let filterError = '';

function installFilter(): void {
  if (!capturing || core.status.idle) return;
  const filters = mpv.getNative<{ label?: string; enabled?: boolean }[]>('af') || [];
  const existing = filters.find(filter => filter.label === FILTER_LABEL);
  if (existing) { filterError = existing.enabled === false ? '音频统计滤镜被禁用，请在 IINA 中启用它' : ''; return; }
  if (Date.now() - lastFilterAttempt < 1000) return;
  lastFilterAttempt = Date.now();
  try {
    // 用标签操作自己的滤镜，保留均衡器、响度标准化等用户配置。
    mpv.command('af', ['add', AUDIO_FILTER]);
    // IINA 的 command 不返回 mpv 错误码，需回读确认挂载结果。
    const added = mpv.getNative<{ label?: string }[]>('af') || [];
    filterError = added.some(filter => filter.label === FILTER_LABEL) ? '' : '音频统计滤镜挂载失败，请查看插件开发者工具';
  } catch (error) { filterError = `音频统计滤镜挂载失败：${String(error)}`; }
}

function removeFilter(): void {
  const filters = mpv.getNative<{ label?: string }[]>('af') || [];
  if (filters.some(filter => filter.label === FILTER_LABEL)) mpv.command('af', ['remove', `@${FILTER_LABEL}`]);
}

function publish(reasonOverride?: string): void {
  if (!capturing) return;
  const at = Date.now();
  const position = mpv.getNative<number | null>('time-pos');
  if (typeof position === 'number' && position !== lastPosition) {
    lastPosition = position;
    lastProgressAt = at;
  }
  let reason = reasonOverride || '';
  if (!reason && core.status.idle) reason = '尚未播放媒体';
  if (!reason && mpv.getFlag('pause')) reason = '播放已暂停';
  if (!reason && (mpv.getFlag('mute') || mpv.getNumber('volume') <= 0)) reason = '播放器已静音';
  if (!reason && (mpv.getFlag('paused-for-cache') || mpv.getFlag('seeking') || at < seekUntil)) reason = '正在缓冲或定位';
  if (!reason && mpv.getFlag('eof-reached')) reason = '播放已结束';
  if (!reason && (typeof position !== 'number' || at - lastProgressAt > STALE_MS)) reason = '播放进度未更新';
  const sample: AudioSample = { at, title: core.status.title || 'IINA', running: false, reason, rmsDb: null, peakDb: null, zcr: null };
  if (!reason) {
    const params = mpv.getNative<{ samplerate?: number }>('audio-params');
    if (!params?.samplerate) sample.reason = '当前音轨未提供 PCM 音频，请检查音轨选择与音频直通设置';
    else {
      // 换音轨或播放器重建滤镜链后，恢复自己的统计滤镜。
      installFilter();
      const features = readFeatures(mpv.getNative(`af-metadata/${FILTER_LABEL}`), params.samplerate);
      if (!filterError && features) Object.assign(sample, features, { running: true });
      else sample.reason = filterError || '正在等待音频统计，请保持播放';
    }
  }
  hub.postMessage('audio', sample);
}

function capture(enabled: boolean): void {
  capturing = enabled;
  lastPosition = -1;
  lastProgressAt = Date.now();
  lastFilterAttempt = -Infinity;
  if (enabled) { installFilter(); publish(); }
  else removeFilter();
}
hub.onMessage('capture', ({ enabled }: { enabled: boolean }) => capture(enabled));

menu.addItem(menu.item('打开音频联动（使用当前窗口）', () => {
  hub.postMessage('select-source', { title: core.status.title || 'IINA' });
  // 从用户选中的播放窗口直接启用采样，避免依赖跨上下文回传后才挂载滤镜。
  capture(true);
}));
menu.addItem(menu.item('停止郊狼输出', () => hub.postMessage('emergency-stop', {}), { keyBinding: 'Ctrl+Alt+ESC' }));

event.on('iina.file-loaded', () => {
  if (!capturing) return;
  hub.postMessage('source-reset', { reason: '媒体已切换，请重新开始联动' });
  seekUntil = Date.now() + 250;
  lastFilterAttempt = -Infinity;
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
