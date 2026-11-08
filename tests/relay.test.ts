import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { WebSocket } from 'ws';
import { DglabSocket } from 'dglab-kit';
import { createLocalRelay, type RelayInfo } from '../src/relay';
import { LocalRelay } from '../src/local-relay';

// 从连接建立前开始收集，避免同一批网络数据中的 hello / attached 帧漏读。
function peer(url: string) {
  const socket = new WebSocket(url);
  const frames: any[] = [];
  socket.on('message', raw => frames.push(JSON.parse(raw.toString())));
  return { socket, frames, async next(type: string) {
    for (let i = 0; i < 100; i++) {
      const frame = frames.find(f => f.type === type);
      if (frame) { frames.splice(frames.indexOf(frame), 1); return frame; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`未收到协议帧：${type}`);
  } };
}

test('本机中继与官方 SDK 完成配对、设备快照和指令往返，断开控制端时退出', async () => {
  const relay = await createLocalRelay();
  const sdk = new DglabSocket({ url: relay.info.url, responseTimeout: 500 });
  let app: ReturnType<typeof peer> | undefined;
  try {
    assert.equal((relay.server.address() as any).address, '127.0.0.1');
    const { targetId } = await sdk.connect();
    // 模拟 App 规范化地址：添加尾斜杠，查询部分只保留官方约定的 tid。
    const appUrl = new URL(relay.info.url);
    appUrl.pathname += '/';
    appUrl.search = `?tid=${targetId}`;
    app = peer(appUrl.toString());
    const hello = await app.next('hello');
    assert.equal((await app.next('controller_attached')).clientId, targetId);
    const devices = new Promise<void>(resolve => sdk.on('devices', () => resolve()));
    app.socket.send(JSON.stringify({ type: 'message', data: { t: 'ev', ev: 'devices.snapshot', devices: [{
      slotId: 'slot', type: 'COYOTE_030', name: '模拟设备', props: { connectState: 'connected' },
      slotState: { hasDevice: true, channelA: { intensityMax: 10 }, channelB: { intensityMax: 8 } },
    }] } }));
    await devices;
    assert.equal(sdk.clients[0].clientId, hello.clientId);
    assert.equal((sdk.clients[0].devices[0].slotState?.channelA as { intensityMax: number }).intensityMax, 10);
    app.socket.on('message', raw => {
      const frame = JSON.parse(raw.toString());
      if (frame.type === 'message' && frame.data.t === 'req') app!.socket.send(JSON.stringify({
        type: 'message', clientId: '不得采用的伪造来源', data: { t: 'resp', reqId: frame.data.reqId, result: {} },
      }));
    });
    await sdk.sendPulse(hello.clientId, 'slot', 0, 100, ['0A0A0A0A01020304'], { immediate: true });
    const request = await app.next('message');
    assert.equal(request.data.m, 'device.op');
    assert.equal(request.data.data.s, 'slot');
    assert.equal(request.clientId, undefined);
    await sdk.clearOperate(hello.clientId, { slotId: 'slot', channel: 0 });
    const closed = once(relay.server, 'close');
    const appClosed = once(app.socket, 'close');
    sdk.disconnect();
    const [code] = await appClosed;
    assert.equal(code, 4000);
    await closed;
  } finally { sdk.disconnect(); app?.socket.terminate(); relay.close(); }
});

test('本机中继拒绝错误密钥、配对目标和第二个控制端，隔离 App 路由', async () => {
  const relay = await createLocalRelay();
  const clients: WebSocket[] = [];
  try {
    const bad = new WebSocket(relay.info.url.replace(/\/v4\/[^/]+$/, '/v4/wrong'));
    clients.push(bad);
    assert.match(String((await once(bad, 'error'))[0]), /403/);
    assert.equal((await fetch(relay.info.leaseUrl.replace(/key=.*/, 'key=wrong'), { method: 'POST' })).status, 403);
    const controller = peer(relay.info.url); clients.push(controller.socket);
    const { clientId } = await controller.next('hello');
    const wrong = peer(`${relay.info.url}?tid=missing`); clients.push(wrong.socket);
    assert.equal((await wrong.next('error')).code, 'controller_not_found');
    const second = peer(relay.info.url); clients.push(second.socket);
    assert.equal((await second.next('error')).code, 'controller_already_connected');
    const app = peer(`${relay.info.url}?tid=${clientId}`); clients.push(app.socket);
    await app.next('controller_attached');
    const appId = (await app.next('hello')).clientId;
    controller.socket.send(JSON.stringify({ type: 'message', clientId: 'missing', data: {} }));
    assert.equal((await controller.next('error')).code, 'client_not_found');
    // 即使 App 伪造 clientId，中继仍只报告真实连接身份。
    app.socket.send(JSON.stringify({ type: 'message', clientId: 'spoofed', data: { test: true } }));
    assert.equal((await controller.next('message')).clientId, appId);
    app.socket.close();
    assert.equal((await controller.next('client_disconnected')).clientId, appId);
  } finally { clients.forEach(client => client.terminate()); relay.close(); }
});

test('失去 IINA 租约或没有完成启动时自动退出', async () => {
  const relay = await createLocalRelay({ leaseMs: 30 });
  const controller = peer(relay.info.url);
  try {
    await controller.next('hello');
    assert.equal((await fetch(relay.info.leaseUrl, { method: 'POST' })).status, 204);
    await once(relay.server, 'close');
  } finally { controller.socket.terminate(); relay.close(); }
  const idle = await createLocalRelay({ startupMs: 30 });
  try { await once(idle.server, 'close'); } finally { idle.close(); }
});

test('打包启动器在最小环境中返回地址并退出，中继仍可连接且能关闭', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'iina-relay-test-'));
  const script = join(directory, 'relay.cjs');
  let info: RelayInfo | undefined;
  try {
    await build({ entryPoints: ['src/relay-entry.ts'], outfile: script, bundle: true, platform: 'node', format: 'cjs', external: ['bufferutil', 'utf-8-validate'] });
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [script, '--launch'], { timeout: 10000, env: { LC_ALL: 'en_US.UTF-8' } });
    assert.equal(stderr, '');
    info = JSON.parse(stdout);
    assert.equal((await fetch(info!.leaseUrl, { method: 'POST' })).status, 204);
    assert.equal((await fetch(info!.shutdownUrl, { method: 'POST' })).status, 204);
    info = undefined;
  } finally {
    if (info) await fetch(info.shutdownUrl, { method: 'POST' }).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});

test('IINA 本地进程管理器复用连接、续租、停止并处理启动取消', async () => {
  const info = { url: 'ws://127.0.0.1:12345/v4/abcdef', leaseUrl: 'http://127.0.0.1:12345/lease?key=abcdef', shutdownUrl: 'http://127.0.0.1:12345/shutdown?key=abcdef' };
  const requests: string[] = [];
  let execs = 0;
  let finish: (() => void) | undefined;
  const api = {
    utils: { fileInPath: (path: string) => ['/opt/homebrew/bin/node', '/plugin/dist/relay.cjs'].includes(path),
      exec: async (node: string, args: string[]) => {
        assert.equal(node, '/opt/homebrew/bin/node'); assert.deepEqual(args, ['/plugin/dist/relay.cjs', '--launch']);
        execs++;
        if (execs > 1) await new Promise<void>(resolve => { finish = resolve; });
        return { status: 0, stdout: JSON.stringify(info), stderr: '' };
      } },
    http: { post: async (url: string) => { requests.push(url); return { statusCode: 204 }; } },
  } as unknown as Pick<typeof iina, 'utils' | 'http'>;
  const manager = new LocalRelay(api);
  assert.equal(await manager.start('', '/plugin/dist/relay.cjs'), info.url);
  assert.equal(await manager.start('', '/plugin/dist/relay.cjs'), info.url);
  assert.equal(execs, 1);
  await manager.keepAlive(); await manager.stop();
  assert.deepEqual(requests, [info.leaseUrl, info.shutdownUrl]);
  const starting = manager.start('', '/plugin/dist/relay.cjs');
  await manager.stop(); finish!();
  await assert.rejects(starting, /取消/);
  assert.equal(requests.at(-1), info.shutdownUrl);
  await assert.rejects(manager.start('/wrong/node', '/plugin/dist/relay.cjs'), /未找到 Node/);
  await assert.rejects(manager.start('', 'dist/relay.cjs'), /找不到插件/);
});
