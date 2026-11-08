export function statsFrame(pts: number, db = -20): string {
  return `frame:0 pts:${Math.round(pts * 48000)} pts_time:${pts}\n`
    + `lavfi.astats.1.RMS_level=${db}\n`
    + 'lavfi.astats.1.Zero_crossings_rate=0.1\n'
    + `lavfi.astats.Overall.RMS_level=${db}\n`
    + `lavfi.astats.Overall.Peak_level=${db + 3}\n`;
}
