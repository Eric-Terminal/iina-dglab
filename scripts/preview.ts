import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { DEFAULT_SETTINGS } from '../src/shared';

// 仅用于 UI 验证：只监听回环地址，提供合成音频及虚拟设备，不连接任何真实 App。
const commands: unknown[] = [];
const server = createServer(async (request, response) => {
  const paths: Record<string, string> = { '/': 'dist/ui.html', '/ui.css': 'dist/ui.css', '/ui.js': 'dist/ui.js' };
  if (request.url === '/testing-state') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(commands)); return; }
  const file = paths[request.url || '/'];
  if (!file) { response.writeHead(404); response.end(); return; }
  try {
    let body = await readFile(file, 'utf8');
    if (request.url === '/') {
      const script = `<script>
        const listeners = {}; let phase = 0;
        window.iina = {
          onMessage(name, fn) { listeners[name] = fn; },
          postMessage(name) {
            if (name !== 'ready') return;
            listeners.init({ settings: ${JSON.stringify({ ...DEFAULT_SETTINGS, capA: 8, capB: 6 })}, server: 'ws://' + location.host + '/v4', connectionMode: 'remote', nodePath: '', hasSource: true, supportsWindowTracking: true, sourceTitle: '合成音频 · UI 验证' });
            setInterval(() => { phase++; const quiet = phase % 60 < 12; listeners.audio({ at: Date.now(), title: '合成音频 · UI 验证', running: true, reason: '', rmsDb: quiet ? -65 : -21 + 10 * Math.sin(phase / 5), peakDb: quiet ? -60 : -8, zcr: .09, }); }, 100);
          }
        };
      </script>`;
      body = body.replace('<script src="ui.js">', script + '<script src="ui.js">');
    }
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html');
    response.end(body);
  } catch { response.writeHead(500); response.end('测试页面尚未构建'); }
});
const wsServer = new WebSocketServer({ server, path: '/v4' });
wsServer.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'hello', clientId: 'preview-controller' }));
  ws.send(JSON.stringify({ type: 'client_attached', clientId: 'preview-app' }));
  ws.send(JSON.stringify({ type: 'message', clientId: 'preview-app', data: { t: 'ev', ev: 'devices.snapshot', devices: [{ slotId: 'preview-slot', type: 'COYOTE_030', name: '模拟郊狼 · 无实体输出', props: { intensityA: 0, intensityB: 0, connectState: 'connected' }, slotState: { hasDevice: true, channelA: { intensityMax: 20 }, channelB: { intensityMax: 20 } } }] } }));
  ws.on('message', raw => {
    const frame = JSON.parse(raw.toString());
    if (frame.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
    if (frame.type !== 'message') return;
    commands.push(frame.data);
    if (commands.length > 1000) commands.shift();
    ws.send(JSON.stringify({ type: 'message', clientId: frame.clientId, data: { t: 'resp', reqId: frame.data.reqId, result: {} } }));
  });
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address === 'object') console.log(`本地验证页面：http://127.0.0.1:${address.port}`);
});
