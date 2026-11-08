import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

type Frame = Record<string, unknown>;
interface Peer { id: string; socket: WebSocket; controller?: Peer; apps: Map<string, Peer>; alive: boolean }
export interface RelayInfo { url: string; leaseUrl: string; shutdownUrl: string }

/** 只绑定回环地址，每次启动使用新密钥；不接受局域网或未持有连接地址的请求。 */
export async function createLocalRelay(options: { leaseMs?: number; startupMs?: number; onClose?: () => void } = {}) {
  const secret = randomBytes(24).toString('hex');
  const peers = new Map<WebSocket, Peer>();
  let controller: Peer | undefined;
  let closing = false;
  let lastLease = Date.now();
  let hasController = false;
  const leaseMs = options.leaseMs ?? 8000;
  const startupMs = options.startupMs ?? 20000;
  let timer: ReturnType<typeof setInterval> | undefined;
  const wsServer = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false });

  function send(peer: Peer, frame: Frame): void {
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    // 慢连接不能囤积控制帧，超过有界缓冲直接断开，由接收端结束有限时任务。
    if (peer.socket.bufferedAmount > 256 * 1024) { peer.socket.terminate(); return; }
    peer.socket.send(JSON.stringify(frame));
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method !== 'POST' || url.searchParams.get('key') !== secret) {
      response.writeHead(403); response.end(); return;
    }
    if (url.pathname === '/lease') {
      lastLease = Date.now(); response.writeHead(204); response.end();
    } else if (url.pathname === '/shutdown') {
      response.writeHead(204); response.end(); close();
    } else { response.writeHead(404); response.end(); }
  });

  function close(): void {
    if (closing) return;
    closing = true;
    if (timer) clearInterval(timer);
    for (const peer of peers.values()) {
      if (peer.controller) send(peer, { type: 'controller_disconnected', clientId: peer.controller.id });
      peer.socket.close(4000, 'controller_disconnected');
      // 给关闭帧一个发送机会，但不能让失联客户端阻止辅助进程退出。
      const deadline = setTimeout(() => peer.socket.terminate(), 200);
      deadline.unref();
    }
    wsServer.close();
    server.close(() => options.onClose?.());
    server.closeIdleConnections();
  }

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/v4' || url.searchParams.get('key') !== secret || closing) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    const target = url.searchParams.get('tid');
    wsServer.handleUpgrade(request, socket, head, ws => {
      const peer: Peer = { id: randomBytes(8).toString('hex'), socket: ws, apps: new Map(), alive: true };
      peers.set(ws, peer);
      ws.on('pong', () => { peer.alive = true; });
      ws.on('error', () => ws.terminate());
      ws.on('close', () => {
        peers.delete(ws);
        if (peer === controller) { controller = undefined; close(); }
        else if (peer.controller) {
          peer.controller.apps.delete(peer.id);
          send(peer.controller, { type: 'client_disconnected', clientId: peer.id });
        }
      });
      send(peer, { type: 'hello', clientId: peer.id });
      if (target) {
        if (!controller || target !== controller.id) {
          send(peer, { type: 'error', code: 'controller_not_found' });
          ws.close(4001, 'controller_not_found'); return;
        }
        peer.controller = controller;
        controller.apps.set(peer.id, peer);
        send(peer, { type: 'controller_attached', clientId: controller.id });
        send(controller, { type: 'client_attached', clientId: peer.id });
      } else {
        if (controller) {
          send(peer, { type: 'error', code: 'controller_already_connected' });
          ws.close(4003, 'controller_already_connected'); return;
        }
        controller = peer;
        hasController = true;
        lastLease = Date.now();
      }
      ws.on('message', raw => {
        let frame: Frame;
        try { frame = JSON.parse(raw.toString()); } catch { return; }
        if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return;
        if (frame.type === 'ping') { send(peer, { type: 'pong', ts: Date.now() }); return; }
        if (frame.type !== 'message') return;
        if (peer === controller) {
          const app = typeof frame.clientId === 'string' ? peer.apps.get(frame.clientId) : undefined;
          if (app) send(app, { type: 'message', data: frame.data });
          else send(peer, { type: 'error', code: 'client_not_found', clientId: frame.clientId });
        } else if (peer.controller) {
          send(peer.controller, { type: 'message', clientId: peer.id, data: frame.data });
        }
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  server.on('error', close);
  let ticks = 0;
  timer = setInterval(() => {
    if (Date.now() - lastLease > (hasController ? leaseMs : startupMs)) { close(); return; }
    if (++ticks % 5 !== 0) return;
    for (const peer of peers.values()) {
      if (!peer.alive) { peer.socket.terminate(); continue; }
      peer.alive = false;
      peer.socket.ping();
      send(peer, { type: 'heartbeat' });
    }
  }, 1000);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法读取本地中继端口。');
  const host = `127.0.0.1:${address.port}`;
  const info: RelayInfo = {
    url: `ws://${host}/v4?key=${secret}`,
    leaseUrl: `http://${host}/lease?key=${secret}`,
    shutdownUrl: `http://${host}/shutdown?key=${secret}`,
  };
  return { info, close, server };
}
