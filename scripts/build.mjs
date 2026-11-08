import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/main.ts', 'src/global.ts'], outdir: 'dist', bundle: true, format: 'iife', platform: 'neutral', target: 'safari15', legalComments: 'eof' }),
  build({ entryPoints: ['src/ui.ts'], outfile: 'dist/ui.js', bundle: true, format: 'iife', platform: 'browser', target: 'safari15', legalComments: 'eof' }),
  build({ entryPoints: ['src/relay-entry.ts'], outfile: 'dist/relay.cjs', bundle: true, format: 'cjs', platform: 'node', target: 'node22', external: ['bufferutil', 'utf-8-validate'], legalComments: 'eof' }),
  copyFile('src/ui.html', 'dist/ui.html'),
  copyFile('src/ui.css', 'dist/ui.css'),
]);
console.log('插件已构建到 dist/。');
