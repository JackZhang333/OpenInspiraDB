import path from 'node:path';

export const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_COUNT = 50_000;

export const IMAGE_STATUS = {
  IMPORTED: 'imported',
  QUEUED: 'queued',
  ANALYZING: 'analyzing',
  READY: 'ready',
  FAILED: 'failed',
};

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  RETRYING: 'retrying',
};

export const RETRY_BACKOFF_MS = [30_000, 120_000];

export const QUEUE_CONCURRENCY = 3;
export const JOB_TIMEOUT_MS = 60_000;
export const SEARCH_PAGE_SIZE = 50;

export const DEFAULT_VECTOR_DIMENSION = 256;

export function defaultPaths(rootDir) {
  return {
    dbPath: path.join(rootDir, 'data', 'inspiradb.sqlite'),
    libraryRootPath: path.join(rootDir, 'data', 'library'),
    thumbnailRootPath: path.join(rootDir, 'data', 'thumbnails'),
    previewRootPath: path.join(rootDir, 'data', 'previews'),
  };
}
