import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from '../core/config.js';

export function ensureDirectories(paths) {
  for (const dirPath of paths) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isSupportedImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
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

export function buildThumbnailPath(thumbnailRootPath, md5Hash) {
  const prefix = md5Hash.slice(0, 2);
  return path.join(thumbnailRootPath, prefix, `${md5Hash}.thumb`);
}

export function createThumbnailPlaceholder(sourcePath, thumbnailPath) {
  // 当前使用占位缩略图，后续可替换为真实图像缩放处理。
  copyFile(sourcePath, thumbnailPath);
}
