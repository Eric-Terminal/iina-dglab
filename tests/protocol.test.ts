import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { DglabSocket, DglabSocketDeviceType } from 'dglab-kit';
import { AudioController } from '../src/controller';
import { DEFAULT_SETTINGS } from '../src/shared';

test('官方 SDK 经真实 WebSocket 完成配对、快照、双通道波形、归零与断连', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const frames: any[] = [];
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const sdk = new DglabSocket({ url: `ws://127.0.0.1:${address.port}`, responseTimeout: 800 });
  let now = Date.now();
  const controller = new AudioController(sdk, () => {}, () => now);
  server.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'hello', clientId: 'test-controller' }));
    ws.send(JSON.stringify({ type: 'client_attached', clientId: 'test-app' }));
    ws.send(JSON.stringify({ type: 'message', clientId: 'test-app', data: {
      t: 'ev', ev: 'devices.snapshot', devices: [{ slotId: 'test-slot', name: '模拟郊狼', type: DglabSocketDeviceType.COYOTE_030, props: { connectState: 'connected' }, slotState: { hasDevice: true, channelA: { intensityMax: 10 }, channelB: { intensityMax: 8 } } }],
    } }));
    ws.on('message', raw => {
      const frame = JSON.parse(raw.toString());
      if (frame.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
      frames.push(frame);
      ws.send(JSON.stringify({ type: 'message', clientId: frame.clientId, data: { t: 'resp', reqId: frame.data.reqId, result: {} } }));
    });
  });
  try {
    const devices = new Promise<void>(resolve => sdk.on('devices', () => resolve()));
    const paired = await sdk.connect();
    assert.equal(paired.targetId, 'test-controller');
    await devices;
    controller.setTarget({ clientId: 'test-app', device: sdk.clients[0].devices[0] });
    controller.configure({ ...DEFAULT_SETTINGS, capA: 20, capB: 20 });
    const sample = { at: now, title: '合成音频', running: true, reason: '', rmsDb: -12, peakDb: -5, zcr: 0.04 };
    controller.accept(sample);
    await controller.start();
    now += 100; controller.accept({ ...sample, at: now });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(frames.filter(f => f.data.data.t === 0).length, 2);
    assert.deepEqual(frames.filter(f => f.data.data.t === 4).map(f => f.data.data.v), [10, 8]);
    for (const frame of frames) {
      assert.equal(frame.type, 'message'); assert.equal(frame.clientId, 'test-app');
      assert.equal(frame.data.t, 'req'); assert.equal(frame.data.m, 'device.op');
      assert.equal(frame.data.data.s, 'test-slot'); assert.equal(frame.data.data.im, true);
    }
    await controller.stop();
    assert.equal(frames.filter(f => f.data.m === 'device.op.clear').length, 2);
    assert.equal(frames.filter(f => f.data.data.t === 7 && f.data.data.v === 0).length, 2);
  } finally {
    sdk.disconnect();
    for (const client of server.clients) client.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
