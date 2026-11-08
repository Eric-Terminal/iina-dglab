import { fork } from 'node:child_process';
import { createLocalRelay } from './relay';

async function main(): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('本地中继需要 Node.js 22 或更新版本。');
  if (process.argv[2] === '--launch') {
    // IINA 的 exec 会等待子进程退出；短命启动器交接就绪信息后退出，避免阻塞插件队列。
    const child = fork(__filename, ['--serve', String(process.ppid)], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const deadline = setTimeout(() => { child.kill(); process.stderr.write('本地中继启动超时。\n'); process.exit(1); }, 8000);
    child.once('error', error => { clearTimeout(deadline); process.stderr.write(`本地中继启动失败：${error.message}\n`); process.exit(1); });
    child.once('exit', code => { clearTimeout(deadline); process.stderr.write(`本地中继提前退出（${code}）。\n`); process.exit(1); });
    child.once('message', message => {
      clearTimeout(deadline);
      child.removeAllListeners('exit');
      child.disconnect(); child.unref();
      process.stdout.write(JSON.stringify(message) + '\n');
    });
    return;
  }
  if (process.argv[2] !== '--serve' || !process.send) throw new Error('请由 IINA 插件启动本地中继。');
  const owner = Number(process.argv[3]);
  const relay = await createLocalRelay({ onClose: () => process.exit(0) });
  process.send(relay.info);
  const ownerTimer = setInterval(() => {
    try { process.kill(owner, 0); } catch { relay.close(); }
  }, 2000);
  ownerTimer.unref();
  process.on('SIGTERM', relay.close);
  process.on('SIGINT', relay.close);
}

void main().catch(error => { process.stderr.write(`${String(error)}\n`); process.exit(1); });
