import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('build/native', { recursive: true });
for (const [command, args] of [
  ['/usr/bin/xcrun', ['swiftc', '-swift-version', '5', 'native/CoyoteProtocol.swift', 'native/tests/ProtocolTests.swift', '-o', 'build/native/protocol-tests']],
  ['build/native/protocol-tests', []],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}
