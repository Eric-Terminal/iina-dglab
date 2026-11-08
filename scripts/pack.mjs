import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const info = JSON.parse(await readFile('Info.json', 'utf8'));
const staging = resolve('build/package');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await mkdir('artifacts', { recursive: true });
// 一并提供可重建源码；不将 node_modules、开发配置或临时测试数据装入 IINA。
for (const path of ['Info.json', 'dist', 'src', 'scripts', 'tests', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses', 'package.json', 'package-lock.json', 'tsconfig.json']) {
  await cp(path, resolve(staging, path), { recursive: true });
}
const artifact = resolve(`artifacts/iina-dglab-${info.version}.iinaplgz`);
await rm(artifact, { force: true });
const zipped = spawnSync('/usr/bin/zip', ['-q', '-r', artifact, '.'], { cwd: staging, encoding: 'utf8' });
if (zipped.status !== 0) throw new Error(`插件打包失败：${zipped.stderr}`);
const verified = spawnSync('/usr/bin/unzip', ['-t', artifact], { encoding: 'utf8' });
if (verified.status !== 0) throw new Error(`安装包校验失败：${verified.stdout}`);
const checksum = createHash('sha256').update(await readFile(artifact)).digest('hex');
console.log(`安装包：${artifact}\nSHA-256：${checksum}`);
