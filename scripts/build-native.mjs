import { mkdir, copyFile, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const app = 'dist/CoyoteBluetooth.app/Contents';
await mkdir(`${app}/MacOS`, { recursive: true });
await mkdir(`${app}/Resources`, { recursive: true });
await mkdir('build/native', { recursive: true });
const sources = ['native/CoyoteProtocol.swift', 'native/BluetoothController.swift', 'native/HTTPServer.swift', 'native/main.swift'];
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} 执行失败`);
  if (result.stderr) process.stderr.write(result.stderr);
}
for (const arch of ['arm64', 'x86_64']) {
  run('/usr/bin/xcrun', ['swiftc', '-O', '-swift-version', '5', '-target', `${arch}-apple-macos12.0`, ...sources,
    '-framework', 'AppKit', '-framework', 'CoreBluetooth', '-framework', 'Network', '-o', `build/native/CoyoteBluetooth-${arch}`]);
}
run('/usr/bin/lipo', ['-create', 'build/native/CoyoteBluetooth-arm64', 'build/native/CoyoteBluetooth-x86_64', '-output', `${app}/MacOS/CoyoteBluetooth`]);
await copyFile('native/Info.plist', `${app}/Info.plist`);
for (const language of ['en', 'zh-Hans']) await cp(`native/${language}.lproj`, `${app}/Resources/${language}.lproj`, { recursive: true });
run('/usr/bin/codesign', ['--force', '--sign', '-', '--timestamp=none', 'dist/CoyoteBluetooth.app']);
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', 'dist/CoyoteBluetooth.app']);
console.log('蓝牙助手已构建为 Intel / Apple Silicon 通用应用。');
