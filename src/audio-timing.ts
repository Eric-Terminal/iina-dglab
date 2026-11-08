import { readFeatures, type AudioFeatures } from './audio';
import { ASTATS_FILTER, FILTER_LABEL } from './shared';

interface TimedFeatures { start: number; end: number; features: AudioFeatures }

/** 读取解码帧的媒体时间戳，避免把 mpv 已预读的末帧误当作当前听到的声音。 */
export class AudioTimeline {
  private text = '';
  private pending: { pts: number; metadata: Record<string, string> } | null = null;
  private frames: TimedFeatures[] = [];

  reset(): void { this.text = ''; this.pending = null; this.frames = []; }

  append(chunk: string, sampleRate: number): void {
    this.text += chunk;
    let newline: number;
    while ((newline = this.text.indexOf('\n')) !== -1) {
      const line = this.text.slice(0, newline).trim();
      this.text = this.text.slice(newline + 1);
      const header = /^frame:\s*\d+\s+pts:\s*\S+\s+pts_time:\s*([-\d.e+]+)/.exec(line);
      if (header) {
        const pts = Number(header[1]);
        if (!Number.isFinite(pts)) continue;
        if (this.pending) {
          const features = readFeatures(this.pending.metadata, sampleRate);
          // 定位或滤镜重建会使时间戳回退，旧时间线不能再参与匹配。
          if (pts <= this.pending.pts) this.frames = [];
          else if (features) this.frames.push({ start: this.pending.pts, end: pts, features });
        }
        this.pending = { pts, metadata: {} };
      } else if (this.pending) {
        const equals = line.indexOf('=');
        if (equals > 0) this.pending.metadata[line.slice(0, equals)] = line.slice(equals + 1);
      }
    }
    // 播放器预读量由外部配置决定；内存只保留最近的有限数量帧。
    if (this.frames.length > 2000) this.frames.splice(0, this.frames.length - 2000);
  }

  at(position: number, advanceMs: number, speed: number): AudioFeatures | null {
    const target = position + advanceMs * speed / 1000;
    while (this.frames.length && this.frames[0].end < position - 1) this.frames.shift();
    const frame = this.frames.find(frame => frame.start <= target && target < frame.end);
    // 异常时间戳间隙不能把一帧统计扩展成整段声音。
    return frame && frame.end - frame.start <= 0.25 ? frame.features : null;
  }
}

export function timingFilter(path: string): string {
  // 路径经过 lavfi 的图与选项两层解析，先转义选项值，再转义图分隔符。
  const option = path.replace(/[\\':]/g, '\\$&');
  const escaped = option.replace(/[\\'\[\],;]/g, '\\$&');
  return `@${FILTER_LABEL}:lavfi=[${ASTATS_FILTER},ametadata=mode=print:file=${escaped}:direct=1]`;
}
