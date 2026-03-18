import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const projectRoot = process.cwd();
const buildDir = path.join(projectRoot, 'build');
const sourcePngPath = path.join(buildDir, 'icon-1024.png');
const outputIcnsPath = path.join(buildDir, 'icon.icns');
const iconsetDir = path.join(os.tmpdir(), `inspiradb-icon-${Date.now()}.iconset`);

const variants = [
  { size: 16, file: 'icon_16x16.png' },
  { size: 32, file: 'icon_16x16@2x.png' },
  { size: 32, file: 'icon_32x32.png' },
  { size: 64, file: 'icon_32x32@2x.png' },
  { size: 128, file: 'icon_128x128.png' },
  { size: 256, file: 'icon_128x128@2x.png' },
  { size: 256, file: 'icon_256x256.png' },
  { size: 512, file: 'icon_256x256@2x.png' },
  { size: 512, file: 'icon_512x512.png' },
  { size: 1024, file: 'icon_512x512@2x.png' },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(sourcePngPath)) {
  fail(
    [
      'Missing build/icon-1024.png.',
      'Add a square 1024x1024 PNG app icon, then rerun `npm run icon:mac`.',
    ].join('\n'),
  );
}

if (!fs.statSync(sourcePngPath).isFile()) {
  fail('build/icon-1024.png exists but is not a file.');
}

fs.mkdirSync(iconsetDir, { recursive: true });

try {
  for (const variant of variants) {
    execFileSync(
      'sips',
      ['-z', String(variant.size), String(variant.size), sourcePngPath, '--out', path.join(iconsetDir, variant.file)],
      { stdio: 'pipe' },
    );
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcnsPath], {
    stdio: 'pipe',
  });

  console.log(`Created ${path.relative(projectRoot, outputIcnsPath)}`);
} catch (error) {
  const stderr = error?.stderr?.toString?.() || '';
  fail(`Failed to generate macOS icon.\n${stderr}`.trim());
} finally {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}
