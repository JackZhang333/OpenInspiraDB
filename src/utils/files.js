import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { SUPPORTED_EXTENSIONS } from '../core/config.js';

export const HEIC_THUMBNAIL_MAX_DIMENSION = 400;
export const HEIC_THUMBNAIL_QUALITY = 80;
export const HEIC_PREVIEW_MAX_DIMENSION = 2048;
export const HEIC_PREVIEW_QUALITY = 85;

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

export function buildThumbnailPath(thumbnailRootPath, md5Hash, ext = '.thumb') {
  const prefix = md5Hash.slice(0, 2);
  // HEIC 格式的缩略图转换为 JPEG，所以扩展名使用 .jpg
  const thumbnailExt = ext === '.heic' ? '.jpg' : ext;
  return path.join(thumbnailRootPath, prefix, `${md5Hash}${thumbnailExt}`);
}

export function buildPreviewPath(previewRootPath, md5Hash) {
  const prefix = md5Hash.slice(0, 2);
  return path.join(previewRootPath, prefix, `${md5Hash}.jpg`);
}

export function buildHeicJpegConversionArgs(sourcePath, targetPath, options = {}) {
  const quality = String(options.quality ?? HEIC_PREVIEW_QUALITY);
  const maxDimension = String(options.maxDimension ?? HEIC_PREVIEW_MAX_DIMENSION);
  return ['-s', 'format', 'jpeg', '-s', 'formatOptions', quality, '-Z', maxDimension, sourcePath, '--out', targetPath];
}

function createHeicDerivedJpeg(sourcePath, targetPath, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${options.label || 'HEIC conversion'} timeout`));
    }, Number(options.timeoutMs || 10000));

    const proc = spawn('sips', buildHeicJpegConversionArgs(sourcePath, targetPath, options));

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`sips exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function createHeicDerivedJpegSync(sourcePath, targetPath, options = {}) {
  return spawnSync(
    'sips',
    buildHeicJpegConversionArgs(sourcePath, targetPath, options),
    { encoding: 'utf8' },
  );
}

export async function createThumbnailPlaceholder(sourcePath, thumbnailPath) {
  const ext = path.extname(sourcePath).toLowerCase();

  // 确保缩略图目录存在
  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });

  // HEIC 格式需要转换为 JPEG 才能被浏览器显示
  if (ext === '.heic') {
    try {
      await createHeicDerivedJpeg(sourcePath, thumbnailPath, {
        quality: HEIC_THUMBNAIL_QUALITY,
        maxDimension: HEIC_THUMBNAIL_MAX_DIMENSION,
        label: 'Thumbnail conversion',
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

export function createThumbnailPlaceholderSync(sourcePath, thumbnailPath) {
  const ext = path.extname(sourcePath).toLowerCase();

  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });

  if (ext === '.heic') {
    const result = createHeicDerivedJpegSync(sourcePath, thumbnailPath, {
      quality: HEIC_THUMBNAIL_QUALITY,
      maxDimension: HEIC_THUMBNAIL_MAX_DIMENSION,
    });

    if (result.status === 0) {
      return;
    }

    console.error('HEIC thumbnail conversion failed:', result.stderr || result.stdout || `exit ${result.status}`);
  }

  copyFile(sourcePath, thumbnailPath);
}

export async function createPreviewPlaceholder(sourcePath, previewPath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== '.heic') {
    return;
  }

  fs.mkdirSync(path.dirname(previewPath), { recursive: true });

  try {
    await createHeicDerivedJpeg(sourcePath, previewPath, {
      quality: HEIC_PREVIEW_QUALITY,
      maxDimension: HEIC_PREVIEW_MAX_DIMENSION,
      label: 'Preview conversion',
    });
  } catch (error) {
    removeFileIfExists(previewPath);
    throw error;
  }
}

export function createPreviewPlaceholderSync(sourcePath, previewPath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== '.heic') {
    return;
  }

  fs.mkdirSync(path.dirname(previewPath), { recursive: true });

  const result = createHeicDerivedJpegSync(sourcePath, previewPath, {
    quality: HEIC_PREVIEW_QUALITY,
    maxDimension: HEIC_PREVIEW_MAX_DIMENSION,
  });

  if (result.status === 0) {
    return;
  }

  removeFileIfExists(previewPath);
  throw new Error(result.stderr || result.stdout || `exit ${result.status}`);
}
