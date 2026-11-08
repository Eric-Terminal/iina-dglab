/** 扩大解码预读量，让长提前量有真实音频可取；音画仍使用 mpv 自己的播放时钟。 */
export class AudioBuffer {
  private original: number | undefined;
  private applied: number | undefined;

  constructor(private mpv: Pick<IINA.API.MPV, 'getNumber' | 'set'>) {}

  update(advanceMs: number): boolean {
    if (advanceMs === 0 && this.original === undefined) return false;
    const current = this.mpv.getNumber('audio-buffer');
    if (!Number.isFinite(current)) throw new Error('无法读取播放器的音频缓冲设置');
    // 用户在联动期间另行改动了缓冲配置时，以新配置作为恢复值。
    if (this.original === undefined || current !== this.applied) this.original = current;
    const desired = advanceMs > 0 ? Math.max(this.original, advanceMs / 1000 + 0.25) : this.original;
    if (desired !== current) {
      this.mpv.set('audio-buffer', desired);
      if (this.mpv.getNumber('audio-buffer') !== desired) throw new Error('无法调整音频预读缓冲');
    }
    this.applied = desired;
    if (advanceMs === 0) { this.original = undefined; this.applied = undefined; }
    return desired !== current;
  }

  restore(): void { this.update(0); }
}
