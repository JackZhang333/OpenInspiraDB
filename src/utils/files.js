import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SUPPORTED_EXTENSIONS } from '../core/config.js';

export function ensureDirectories(paths) {
  for (const dirPath of paths) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isSupportedImageFile(filePath, logger) {
  const ext = path.extname(filePath).toLowerCase();
  const isSupported = SUPPORTED_EXTENSIONS.has(ext);
  logger?.info?.('isSupportedImageFile', { filePath, ext, isSupported, supportedList: Array.from(SUPPORTED_EXTENSIONS) });
  return isSupported;
}

export function walkFilesRecursive(folderPath) {
  const queue = [folderPath];
  const files = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export function copyFile(sourcePath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
}

export function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function buildLibraryPath(libraryRootPath, md5Hash, originalFileName) {
  const ext = path.extname(originalFileName).toLowerCase();
  const prefix = md5Hash.slice(0, 2);
  return path.join(libraryRootPath, prefix, `${md5Hash}${ext}`);
}

export function buildThumbnailPath(thumbnailRootPath, md5Hash, ext = '.thumb') {
  const prefix = md5Hash.slice(0, 2);
  // HEIC 格式的缩略图转换为 JPEG，所以扩展名使用 .jpg
  const thumbnailExt = ext === '.heic' ? '.jpg' : ext;
  return path.join(thumbnailRootPath, prefix, `${md5Hash}${thumbnailExt}`);
}

export async function createThumbnailPlaceholder(sourcePath, thumbnailPath) {
  const ext = path.extname(sourcePath).toLowerCase();

  // HEIC 格式需要转换为 JPEG 才能被浏览器显示
  if (ext === '.heic') {
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Thumbnail conversion timeout'));
        }, 10000);

        const proc = spawn('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '400', sourcePath, '--out', thumbnailPath]);

        proc.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`sips exited with code ${code}`));
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      return;
    } catch (error) {
      console.error('HEIC thumbnail conversion failed:', error);
      // 失败时回退到复制原文件
    }
  }

  // 其他格式直接复制（或后续可以统一缩放）
  copyFile(sourcePath, thumbnailPath);
}
