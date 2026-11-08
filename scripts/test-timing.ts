import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { AudioTimeline, timingFilter } from '../src/audio-timing';
import { FILTER_LABEL } from '../src/shared';

const dir = await mkdtemp(join(tmpdir(), 'iina-dglab-timing-'));
const media = join(dir, 'timing.mkv');
// 音画共享时间轴；音频在 1.5～2.5 秒响起，整个验证使用空输出，不连接设备。
const generated = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=64x64:rate=30:duration=4',
  '-f', 'lavfi', '-i', "aevalsrc=exprs='if(between(t,1.5,2.5),0.4*sin(2*PI*440*t),0)':sample_rate=48000:duration=4",
  '-c:v', 'ffv1', '-c:a', 'pcm_s16le', media], { encoding: 'utf8' });
assert.equal(generated.status, 0, generated.stderr);

async function verify(advanceMs: number, speed: number): Promise<void> {
  const ipc = join(dir, `mpv-${advanceMs}-${speed}.sock`);
  // 特殊字符也必须能穿过 lavfi 两层解析，不能变成另一个滤镜或选项。
  const log = join(dir, `统计 '[:],;\\ ${advanceMs}-${speed}.txt`);
  const mpv = spawn('mpv', ['--no-config', '--no-terminal', '--vo=null', '--ao=null', '--pause', '--keep-open=yes',
    '--af=@existing:lavfi=[volume=0.9]', `--input-ipc-server=${ipc}`, media], { stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = '';
  mpv.stderr.on('data', data => { errors += data; });
  let socket: net.Socket | undefined;
  let sequence = 0;
  const pending = new Map<number, { resolve: (data: any) => void; reject: (error: Error) => void }>();
  const timeline = new AudioTimeline();
  let readOffset = 0;
  try {
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        socket = await new Promise<net.Socket>((resolve, reject) => {
          const client = net.createConnection(ipc); client.once('connect', () => resolve(client)); client.once('error', reject);
        });
        break;
      } catch { await new Promise(resolve => setTimeout(resolve, 25)); }
    }
    assert.ok(socket, `mpv IPC 未启动：${errors}`);
    let buffer = '';
    socket.on('data', data => {
      buffer += data;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const message = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
        const request = pending.get(message.request_id);
        if (request) {
          pending.delete(message.request_id);
          message.error === 'success' ? request.resolve(message.data) : request.reject(new Error(message.error));
        }
      }
    });
    const command = (...args: unknown[]) => new Promise<any>((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject });
      socket!.write(JSON.stringify({ command: args, request_id: id }) + '\n');
    });
    const originalBuffer = await command('get_property', 'audio-buffer');
    await command('set_property', 'speed', speed);
    await command('af', 'add', timingFilter(log));
    await command('set_property', 'pause', false);
    // 在播放期间应用提前量，覆盖实际控制台动态调整时发生的音频输出重建。
    let clockReady = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const pts = await command('get_property', 'audio-pts').catch(() => null);
      if (typeof pts === 'number' && Number.isFinite(pts)) { clockReady = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(clockReady, '等待有效音频时钟后才能调整缓冲');
    if (advanceMs > 0) await command('set_property', 'audio-buffer', Math.max(originalBuffer, advanceMs / 1000 + 0.25));
    const transitions: { active: boolean; pts: number }[] = [];
    let wasActive = false, valid = 0, missing = 0;
    const deadline = Date.now() + 6500;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
      const pts = await command('get_property', 'audio-pts').catch(() => null);
      if (pts === null) continue;
      const text = await readFile(log, 'utf8').catch(() => '');
      if (text.length < readOffset) { timeline.reset(); readOffset = 0; }
      timeline.append(text.slice(readOffset), 48000); readOffset = text.length;
      const features = timeline.at(pts, advanceMs, speed);
      if (!features) { missing++; continue; }
      valid++;
      const active = features.rmsDb > -50;
      if (active !== wasActive) { transitions.push({ active, pts }); wasActive = active; }
      if (transitions.length >= 2) break;
    }
    const diagnostics: Record<string, unknown> = {};
    if (transitions.length !== 2) {
      for (const name of ['time-pos', 'audio-pts', 'audio-params', 'pause', 'aid', 'idle-active', 'eof-reached', 'af', 'audio-buffer']) {
        diagnostics[name] = await command('get_property', name).catch(error => String(error));
      }
    }
    assert.equal(transitions.length, 2, JSON.stringify({ advanceMs, speed, transitions, valid, missing, diagnostics, errors }));
    for (const [index, boundary] of [1.5, 2.5].entries()) {
      const expected = boundary - advanceMs * speed / 1000;
      assert.ok(Math.abs(transitions[index].pts - expected) < 0.08 * speed,
        JSON.stringify({ advanceMs, speed, expected, actual: transitions[index].pts }));
    }
    assert.equal(await command('get_property', 'audio-delay'), 0, '提前量不应改写音画偏移');
    await command('set_property', 'pause', true);
    const pausedAt = await command('get_property', 'audio-pts');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.ok(Math.abs(await command('get_property', 'audio-pts') - pausedAt) < 0.02);
    if (advanceMs === 1000) {
      timeline.reset();
      await command('seek', 0, 'absolute+exact');
      await command('set_property', 'pause', false);
      let recovered = false;
      const seekDeadline = Date.now() + 3000;
      while (Date.now() < seekDeadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const pts = await command('get_property', 'audio-pts').catch(() => null);
        if (pts === null) continue;
        const text = await readFile(log, 'utf8');
        if (text.length < readOffset) { timeline.reset(); readOffset = 0; }
        timeline.append(text.slice(readOffset), 48000); readOffset = text.length;
        const features = timeline.at(pts, advanceMs, speed);
        if (pts > 0.55 && pts < 1 && features && features.rmsDb > -50) { recovered = true; break; }
      }
      assert.ok(recovered, '向后跳转后应读取新时间线，并继续提前 1 秒');
    }
    await command('af', 'remove', `@${FILTER_LABEL}`);
    const remaining = await command('get_property', 'af');
    assert.equal(remaining.length, 1); assert.equal(remaining[0].label, 'existing');
    await command('set_property', 'audio-buffer', originalBuffer);
    assert.equal(await command('get_property', 'audio-buffer'), originalBuffer);
    console.log(JSON.stringify({ advanceMs, speed, transitions, valid, missing }));
  } finally { socket?.destroy(); mpv.kill('SIGTERM'); }
}

try {
  for (const [advance, speed] of [[0, 1], [100, 1], [1000, 1], [100, 2]]) await verify(advance, speed);
  console.log('真实 mpv 提前量验证通过：0 / 100 / 1000 ms、倍速、暂停、滤镜与缓冲恢复。');
} finally { await rm(dir, { recursive: true, force: true }); }
