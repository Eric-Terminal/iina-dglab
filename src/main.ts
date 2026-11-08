import { FILTER_LABEL, SAMPLE_MS, STALE_MS, type AudioSample } from './shared';
import { AudioTimeline, timingFilter } from './audio-timing';
import { AudioBuffer } from './audio-buffer';
import { setLanguage, t } from './i18n';

const { mpv, event, core, menu, file, utils, preferences, global: hub } = iina;
setLanguage(preferences.get('language'));
let capturing = false;
let seekUntil = 0;
let lastPosition = -1;
let lastProgressAt = 0;
let lastFilterAttempt = -Infinity;
let filterError = '';
let stats: IINA.API.FileHandle | undefined;
let statsPath: string | undefined;
const timeline = new AudioTimeline();
const audioBuffer = new AudioBuffer(mpv);

function closeStats(): void {
  stats?.close();
  stats = undefined;
  if (statsPath && file.exists(statsPath)) file.delete(statsPath);
  statsPath = undefined;
  timeline.reset();
}

function installFilter(): void {
  if (!capturing || core.status.idle) return;
  const filters = mpv.getNative<{ label?: string; enabled?: boolean }[]>('af') || [];
  const existing = filters.find(filter => filter.label === FILTER_LABEL);
  if (existing && stats) { filterError = existing.enabled === false ? '音频统计滤镜被禁用，请在 IINA 中启用它' : ''; return; }
  if (Date.now() - lastFilterAttempt < 1000) return;
  lastFilterAttempt = Date.now();
  try {
    if (existing) removeFilter();
    closeStats();
    // 每个播放窗口独占临时统计文件，只记录时间戳和数值，不保存原始音频。
    statsPath = `@tmp/audio-stats-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
    file.write(statsPath, '');
    stats = file.handle(statsPath, 'read');
    if (!stats) throw new Error('无法打开音频统计文件');
    // 用标签操作自己的滤镜，保留均衡器、响度标准化等用户配置。
    mpv.command('af', ['add', timingFilter(utils.resolvePath(statsPath))]);
    // IINA 的 command 不返回 mpv 错误码，需回读确认挂载结果。
    const added = mpv.getNative<{ label?: string }[]>('af') || [];
    filterError = added.some(filter => filter.label === FILTER_LABEL) ? '' : '音频统计滤镜挂载失败，请查看插件开发者工具';
  } catch (error) { filterError = `音频统计滤镜挂载失败：${String(error)}`; }
}

function removeFilter(): void {
  const filters = mpv.getNative<{ label?: string }[]>('af') || [];
  if (filters.some(filter => filter.label === FILTER_LABEL)) mpv.command('af', ['remove', `@${FILTER_LABEL}`]);
}

function readStats(sampleRate: number): void {
  if (!stats) return;
  const offset = stats.offset();
  stats.seekToEnd();
  const end = stats.offset();
  // 音轨切换可能原地重建滤镜并截断文件；不能继续沿用旧的读取位置。
  if (end < offset) { timeline.reset(); stats.seekTo(0); }
  else stats.seekTo(offset);
  // 限制每次读取量与磁盘占用。轮换时等待新统计，不重播旧波形。
  if (end > 32 * 1024 * 1024) {
    removeFilter(); closeStats(); lastFilterAttempt = -Infinity; installFilter();
    return;
  }
  for (let count = 0; count < 32; count++) {
    const bytes = stats.read(8192);
    if (!bytes?.length) break;
    timeline.append(String.fromCharCode(...bytes), sampleRate);
    if (bytes.length < 8192) break;
  }
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
  const empty = { running: false, reason, rmsDb: null, peakDb: null, zcr: null };
  const sample: AudioSample = { at, title: core.status.title || 'IINA', ...empty, preview: { ...empty } };
  if (!reason) {
    const params = mpv.getNative<{ samplerate?: number }>('audio-params');
    if (!params?.samplerate) sample.reason = '当前音轨未提供 PCM 音频，请检查音轨选择与音频直通设置';
    else {
      // 换音轨或播放器重建滤镜链后，恢复自己的统计滤镜。
      installFilter();
      try {
        const audioPosition = mpv.getNative<number | null>('audio-pts');
        // 音轨格式先于输出时钟就绪；此时重建 AO 会让部分 mpv 版本卡在首帧。
        if (typeof audioPosition !== 'number' || !Number.isFinite(audioPosition)) {
          sample.reason = '正在等待音频播放时钟';
          sample.preview.reason = sample.reason;
          hub.postMessage('audio', sample);
          return;
        }
        const saved = preferences.get('settings');
        const advance = typeof saved?.advanceMs === 'number' && Number.isFinite(saved.advanceMs)
          ? Math.max(0, Math.min(1000, saved.advanceMs)) : 0;
        if (audioBuffer.update(advance)) {
          timeline.reset(); stats?.seekToEnd();
          sample.reason = '正在调整音频预读缓冲';
          sample.preview.reason = sample.reason;
          hub.postMessage('audio', sample);
          return;
        }
        readStats(params.samplerate);
        // audio-pts 包含音频驱动延迟；用媒体时钟定位，再把真实毫秒换算为倍速下的媒体跨度。
        const speed = mpv.getNumber('speed');
        const current = speed > 0 ? timeline.at(audioPosition, 0, speed) : null;
        if (!filterError && current) Object.assign(sample.preview, current, { running: true });
        else sample.preview.reason = filterError || '正在等待音频统计，请保持播放';
        const features = speed > 0 ? timeline.at(audioPosition, advance, speed) : null;
        if (!filterError && features) Object.assign(sample, features, { running: true });
        else sample.reason = filterError || (advance > 0 ? '音频预读不足，请减小提前量或等待缓冲' : '正在等待音频统计，请保持播放');
      } catch (error) { sample.reason = `无法读取音频统计：${String(error)}`; }
    }
  }
  if (!sample.preview.running && !sample.preview.reason) sample.preview.reason = sample.reason;
  hub.postMessage('audio', sample);
}

function capture(enabled: boolean): void {
  if (capturing === enabled) { if (enabled) { installFilter(); publish(); } return; }
  capturing = enabled;
  lastPosition = -1;
  lastProgressAt = Date.now();
  lastFilterAttempt = -Infinity;
  if (enabled) { installFilter(); publish(); }
  else { removeFilter(); closeStats(); audioBuffer.restore(); }
}
hub.onMessage('capture', ({ enabled }: { enabled: boolean }) => capture(enabled));

function updateMenu(): void {
  menu.removeAllItems();
  menu.addItem(menu.item(t('打开音频联动（使用当前窗口）'), () => {
  hub.postMessage('select-source', { title: core.status.title || 'IINA' });
  // 从用户选中的播放窗口直接启用采样，避免依赖跨上下文回传后才挂载滤镜。
  capture(true);
  }));
  menu.addItem(menu.item(t('停止郊狼输出'), () => hub.postMessage('emergency-stop', {}), { keyBinding: 'Ctrl+Alt+ESC' }));
}
updateMenu();
hub.onMessage('language', (data: { language: string; locale: string }) => { setLanguage(data.language, data.locale); updateMenu(); });

event.on('iina.file-loaded', () => {
  if (!capturing) return;
  hub.postMessage('source-reset', { reason: '媒体已切换，请重新开始联动' });
  seekUntil = Date.now() + 250;
  removeFilter(); closeStats();
  lastFilterAttempt = -Infinity;
  installFilter();
  publish();
});
event.on('mpv.seek', () => {
  seekUntil = Date.now() + 250;
  timeline.reset();
  stats?.seekToEnd();
  publish('正在定位');
});
event.on('mpv.playback-restart', () => { seekUntil = Date.now() + 150; });
event.on('mpv.end-file', () => {
  if (!capturing) return;
  publish('播放已结束');
  hub.postMessage('source-reset', { reason: '播放已结束' });
  removeFilter(); closeStats();
  audioBuffer.restore();
});
event.on('mpv.shutdown', () => {
  if (capturing) hub.postMessage('source-reset', { reason: '播放窗口已关闭' });
  capturing = false;
  closeStats();
});
setInterval(() => publish(), SAMPLE_MS);
