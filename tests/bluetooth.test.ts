import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { BluetoothHelper, type BluetoothStatus } from '../src/bluetooth-helper';
import { BluetoothTransport } from '../src/bluetooth-transport';
import { DEFAULT_SETTINGS } from '../src/shared';

const state = (overrides: Partial<BluetoothStatus> = {}): BluetoothStatus => ({ state: 'idle', error: null, devices: [], deviceId: null, battery: null, intensityA: 0, intensityB: 0, capA: 0, capB: 0, ...overrides });

test('原生桥只接受自己的回环握手地址，租约和停止不泄露令牌到 WebView', async () => {
  const requests: { method: string; params: Record<string, unknown> }[] = [];
  const url = `http://127.0.0.1:12345/${'a'.repeat(64)}`;
  let launched = false, deleted = false;
  const api = {
    utils: { exec: async (command: string, args: string[]) => { assert.equal(command, '/usr/bin/open'); assert.ok(args.includes('--handshake')); launched = true; return { status: 0 }; }, resolvePath: (path: string) => path.replace('@tmp/', '/tmp/') },
    file: { exists: (path: string) => path.includes('Contents/MacOS') || launched && !deleted, read: () => JSON.stringify({ url }), delete: () => { deleted = true; } },
    http: { post: async (path: string, options: any) => { assert.equal(path, url); requests.push(options.data); return { statusCode: 200, text: JSON.stringify({ result: state() }) }; } },
  } as unknown as ConstructorParameters<typeof BluetoothHelper>[0];
  const helper = new BluetoothHelper(api);
  const result = await helper.start('/fixture/dist/CoyoteBluetooth.app');
  assert.ok(result.session); assert.equal(JSON.stringify(result).includes('aaaa'), false); assert.equal(deleted, true);
  await helper.keepAlive(); assert.ok(requests.some(request => request.method === 'lease'));
  await assert.rejects(helper.request('old-session', 'pulse', {}), /会话已结束/);
  await helper.request(result.session, 'scan', {});
  await helper.stop(); assert.equal(requests.at(-1)!.method, 'shutdown');
  assert.equal(await helper.poll(), null);
});

test('蓝牙 Transport 连接不发送波形，校验目标与旧会话，并保留短任务时限', async () => {
  const handlers: Record<string, Function> = {};
  const requests: any[] = [];
  let current = state();
  let hold = false;
  const transport = new BluetoothTransport({
    onMessage: (name, fn) => { handlers[name] = fn; },
    postMessage: (_, request: any) => {
      requests.push(request);
      if (hold && request.method === 'pulse') return;
      if (request.method === 'configure') current = { ...current, capA: request.params.capA, capB: request.params.capB };
      if (request.method === 'connect') current = state({ ...current, state: 'ready', deviceId: request.params.id });
      queueMicrotask(() => handlers['bluetooth-result']({ id: request.id, result: request.method === 'start' ? { session: 'session-1', status: current } : current }));
    },
  }, () => {});
  await transport.start('/fixture/dist/CoyoteBluetooth.app');
  await transport.connect('device-1', { ...DEFAULT_SETTINGS, capA: 12, capB: 8 });
  assert.deepEqual(requests.map(request => request.method), ['start', 'configure', 'connect']);
  await assert.rejects(transport.sendPulse('wrong', 'device-1', 0, 100, ['0A0A0A0A64646464']), /not-ready/);
  await transport.setTempIntensity('bluetooth-session-1', 'device-1', 0, 12, 250);
  await transport.sendPulse('bluetooth-session-1', 'device-1', 0, 100, ['0A0A0A0A64646464']);
  assert.equal(requests.at(-2).params.duration, 250); assert.equal(requests.at(-1).params.duration, 100);
  handlers['bluetooth-status']({ session: 'old', status: state({ state: 'error' }) });
  assert.equal(transport.status?.state, 'ready');
  hold = true;
  const pending = assert.rejects(transport.sendPulse('bluetooth-session-1', 'device-1', 0, 100, ['0A0A0A0A64646464']), /会话已结束/);
  await transport.stop(); await pending;
  assert.equal(transport.active, false); assert.equal(transport.status, null);
});

test('真实蓝牙助手的回环鉴权、配置验证和退出；不扫描、不连接硬件', { skip: process.platform !== 'darwin' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'coyote-helper-test-'));
  const handshake = join(dir, 'ready.json');
  const child = spawn(resolve('dist/CoyoteBluetooth.app/Contents/MacOS/CoyoteBluetooth'), ['--handshake', handshake], { stdio: 'pipe' });
  let errors = ''; child.stderr.on('data', data => { errors += data; });
  try {
    let url = '';
    for (let attempt = 0; attempt < 150; attempt++) {
      try { url = JSON.parse(await readFile(handshake, 'utf8')).url; if (url) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}$/, errors);
    const rpc = async (method: string, params = {}) => (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, params }) })).json() as Promise<any>;
    const initial = await rpc('status');
    assert.equal(initial.result.state, 'idle'); assert.deepEqual(initial.result.devices, []);
    assert.equal(initial.result.intensityA, 0); assert.equal(initial.result.intensityB, 0);
    const invalid = await fetch(new URL('/wrong', url), { method: 'POST', body: '{}' }); assert.equal(invalid.status, 403);
    const origin = await fetch(url, { method: 'POST', headers: { Origin: 'https://example.com' }, body: '{}' }); assert.equal(origin.status, 403);
    assert.equal((await rpc('configure', { capA: 999 })).error, 'invalid-settings');
    assert.equal((await rpc('pulse', { channel: 0, duration: 100, frame: '0A0A0A0A64646464' })).error, 'device-not-ready');
    const exit = once(child, 'exit');
    await rpc('shutdown'); await exit;
    assert.equal(child.exitCode, 0);
  } finally { if (child.exitCode === null) child.kill(); await rm(dir, { recursive: true, force: true }); }
});

test('真实蓝牙助手没有续租时自行退出；不访问蓝牙硬件', { skip: process.platform !== 'darwin', timeout: 15000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'coyote-lease-test-'));
  const handshake = join(dir, 'ready.json');
  const child = spawn(resolve('dist/CoyoteBluetooth.app/Contents/MacOS/CoyoteBluetooth'), ['--handshake', handshake], { stdio: 'ignore' });
  try {
    const started = Date.now();
    await once(child, 'exit');
    assert.equal(child.exitCode, 0);
    assert.ok(Date.now() - started >= 8000, '助手应等待租约到期');
    await assert.rejects(readFile(handshake), { code: 'ENOENT' });
  } finally { if (child.exitCode === null) child.kill(); await rm(dir, { recursive: true, force: true }); }
});

test('取消启动后迟到的状态不能重新激活蓝牙会话', async () => {
  const handlers: Record<string, Function> = {};
  const requests: any[] = [];
  const transport = new BluetoothTransport({
    onMessage: (name, fn) => { handlers[name] = fn; },
    postMessage: (_, request: any) => { requests.push(request); },
  }, () => {});
  const start = assert.rejects(transport.start('/fixture/dist/CoyoteBluetooth.app'), /取消|会话已结束/);
  const stop = transport.stop();
  const startRequest = requests.find(request => request.method === 'start');
  const stopRequest = requests.find(request => request.method === 'stop');
  handlers['bluetooth-result']({ id: startRequest.id, result: { session: 'late', status: state() } });
  handlers['bluetooth-result']({ id: stopRequest.id, result: {} });
  await Promise.all([start, stop]);
  assert.equal(transport.active, false); assert.equal(transport.session, null);
});
