import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { AUDIO_FILTER, DEFAULT_SETTINGS, FILTER_LABEL } from '../src/shared';
import { readFeatures, makeWave } from '../src/audio';

const dir = await mkdtemp(join(tmpdir(), 'iina-dglab-mpv-'));
const file = join(dir, 'test.wav'), ipc = join(dir, 'mpv.sock');
const expression = 'if(lt(t,1),0,if(lt(t,3),0.4*sin(2*PI*180*t),if(lt(t,5),0.4*sin(2*PI*5000*t),0)))';
const generated = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc=exprs='${expression}':sample_rate=48000:duration=7`, '-y', file], { encoding: 'utf8' });
assert.equal(generated.status, 0, generated.stderr);
const mpv = spawn('mpv', ['--no-config', '--no-terminal', '--ao=null', '--vo=null', '--pause', '--af=@existing:lavfi=[volume=0.9]', `--input-ipc-server=${ipc}`, file], { stdio: ['ignore', 'ignore', 'pipe'] });
let errors = ''; mpv.stderr.on('data', data => { errors += data; });
let socket: net.Socket | undefined;
const pending = new Map<number, { resolve: (data: any) => void; reject: (error: Error) => void }>();
let sequence = 0;
try {
  for (let i = 0; i < 200; i++) {
    try {
      socket = await new Promise<net.Socket>((resolve, reject) => { const client = net.createConnection(ipc); client.once('connect', () => resolve(client)); client.once('error', reject); });
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 25)); }
  }
  assert.ok(socket, `mpv IPC 未启动：${errors}`);
  let buffer = '';
  socket.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      const message = JSON.parse(line);
      const request = pending.get(message.request_id);
      if (request) { pending.delete(message.request_id); message.error === 'success' ? request.resolve(message.data) : request.reject(new Error(message.error)); }
    }
  });
  const command = (...args: unknown[]) => new Promise<any>((resolve, reject) => {
    const request_id = ++sequence; pending.set(request_id, { resolve, reject });
    socket!.write(JSON.stringify({ command: args, request_id }) + '\n');
  });
  await command('af', 'add', AUDIO_FILTER);
  const filters = await command('get_property', 'af');
  assert.ok(filters.some((f: { label: string }) => f.label === 'existing'));
  assert.ok(filters.some((f: { label: string }) => f.label === FILTER_LABEL));
  await command('set_property', 'pause', false);
  const readings: { position: number; rms: number; zcr: number; frequency: number }[] = [];
  for (let i = 0; i < 58; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const position = await command('get_property', 'time-pos');
    const meta = await command('get_property', `af-metadata/${FILTER_LABEL}`);
    const params = await command('get_property', 'audio-params');
    const features = readFeatures(meta, params.samplerate);
    assert.ok(features, `音频元数据缺失：${JSON.stringify(meta)}`);
    assert.equal(meta['lavfi.astats.Overall.Zero_crossings_rate'], undefined);
    readings.push({ position, rms: features.rmsDb, zcr: features.zcr, frequency: makeWave(features, DEFAULT_SETTINGS).frequency });
  }
  const low = readings.find(r => r.position > 1.5 && r.position < 2.2)!;
  const high = readings.find(r => r.position > 3.5 && r.position < 4.2)!;
  assert.ok(low && high);
  assert.ok(low.zcr < 0.02, JSON.stringify(low));
  assert.ok(high.zcr > 0.18, JSON.stringify(high));
  assert.ok(low.frequency - high.frequency > 60);
  assert.ok(readings.some(r => r.rms < -90));
  await command('af', 'remove', `@${FILTER_LABEL}`);
  const remaining = await command('get_property', 'af');
  assert.equal(remaining.length, 1); assert.equal(remaining[0].label, 'existing');
  console.log('真实 mpv/FFmpeg 验证通过：静音、180 Hz / 5 kHz 的 RMS/ZCR、频率映射和滤镜保留。');
  console.log(JSON.stringify({ low, high }, null, 2));
} finally {
  socket?.destroy(); mpv.kill('SIGTERM'); await rm(dir, { recursive: true, force: true });
}
