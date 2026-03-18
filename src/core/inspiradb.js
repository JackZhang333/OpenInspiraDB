import fs from 'node:fs';
import path from 'node:path';

import {
  defaultPaths,
  MAX_FILE_SIZE_BYTES,
  SEARCH_PAGE_SIZE,
  IMAGE_STATUS,
  JOB_STATUS,
} from './config.js';
import { InspiraDatabase, nowIso } from './database.js';
import {
  ensureDirectories,
  walkFilesRecursive,
  isSupportedImageFile,
  copyFile,
  createThumbnailPlaceholder,
  buildLibraryPath,
  buildThumbnailPath,
  removeFileIfExists,
} from '../utils/files.js';
import { md5File } from '../utils/hash.js';
import { cosineSimilarity } from '../utils/vector.js';
import { uniqueNonEmptyTags } from '../utils/text.js';
import {
  buildXmpSidecarPathForImage,
  readXmpMetadataForImage,
  writeXmpForImage,
} from '../utils/xmp.js';
import { createLogger } from '../utils/logger.js';
import { RoutedAiService } from '../services/ai-factory.js';
import { AnalysisQueue } from '../services/analysis-queue.js';

function resolveExistingFilePath(filePath) {
  if (!fs.existsSync(filePath)) {
    const error = new Error('FILE_NOT_FOUND');
    error.code = 'FILE_NOT_FOUND';
    throw error;
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    const error = new Error('NOT_A_FILE');
    error.code = 'NOT_A_FILE';
    throw error;
  }

  return { filePath: path.resolve(filePath), stat };
}

function resolveExistingFolderPath(folderPath) {
  if (!fs.existsSync(folderPath)) {
    const error = new Error('FOLDER_NOT_FOUND');
    error.code = 'FOLDER_NOT_FOUND';
    throw error;
  }

  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) {
    const error = new Error('NOT_A_FOLDER');
    error.code = 'NOT_A_FOLDER';
    throw error;
  }

  return path.resolve(folderPath);
}

function toJsonVector(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function buildInClauseParams(prefix, values) {
  const placeholders = [];
  const params = {};

  values.forEach((value, index) => {
    const key = `${prefix}${index}`;
    placeholders.push(`:${key}`);
    params[key] = value;
  });

  return {
    clause: placeholders.join(', '),
    params,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImageIds(imageIds) {
  return Array.from(
    new Set(
      (imageIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

function sanitizeExportFileName(fileName, fallback = 'image.jpg') {
  const cleaned = String(fileName || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_');
  return cleaned || fallback;
}

function appendOriginalExtensionIfMissing(filePath, originalFileName) {
  if (path.extname(filePath)) {
    return filePath;
  }

  const originalExt = path.extname(String(originalFileName || '')).toLowerCase();
  if (!originalExt) {
    return filePath;
  }

  return `${filePath}${originalExt}`;
}

export class InspiraDBApp {
  constructor({ rootDir = process.cwd(), dbPath, libraryRootPath, thumbnailRootPath, autoStartQueue = true } = {}) {
    const defaults = defaultPaths(rootDir);

    this.paths = {
      dbPath: dbPath || defaults.dbPath,
      libraryRootPath: libraryRootPath || defaults.libraryRootPath,
      thumbnailRootPath: thumbnailRootPath || defaults.thumbnailRootPath,
    };

    ensureDirectories([path.dirname(this.paths.dbPath), this.paths.libraryRootPath, this.paths.thumbnailRootPath]);

    this.logger = createLogger('inspiradb');
    this.db = new InspiraDatabase(this.paths.dbPath);
    this.db.ensureSettings(this.paths.libraryRootPath);

    this.aiService = new RoutedAiService(this.db, this.logger);
    this.queue = new AnalysisQueue({
      db: this.db,
      aiService: this.aiService,
      logger: this.logger,
    });

    if (autoStartQueue) {
      this.queue.start();
    }
  }

  close() {
    this.queue.stop();
    this.db.close();
  }

  async importFolder(folderPath, options = {}) {
    const reportProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const emitProgress = (payload) => {
      if (!reportProgress) {
        return;
      }

      try {
        reportProgress(payload);
      } catch (error) {
        this.logger.error('import-progress-callback-failed', {
          error: String(error?.message || error),
        });
      }
    };

    const resolvedFolder = resolveExistingFolderPath(folderPath);
    const files = walkFilesRecursive(resolvedFolder);

    const summary = {
      totalScanned: files.length,
      importedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      imported: [],
      duplicates: [],
      skipped: [],
    };

    emitProgress({
      mode: 'folder',
      phase: 'importing',
      current: 0,
      total: files.length,
      importedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
    });

    for (let index = 0; index < files.length; index += 1) {
      const filePath = files[index];
      const result = await this.importFile(filePath, { sourceFolder: resolvedFolder, asStandalone: false });
      if (result.status === 'imported') {
        summary.importedCount += 1;
        summary.imported.push(result.image);
      } else if (result.status === 'duplicate') {
        summary.duplicateCount += 1;
        summary.duplicates.push(result);
      } else {
        summary.skippedCount += 1;
        summary.skipped.push(result);
      }

      emitProgress({
        mode: 'folder',
        phase: 'importing',
        current: index + 1,
        total: files.length,
        importedCount: summary.importedCount,
        duplicateCount: summary.duplicateCount,
        skippedCount: summary.skippedCount,
        lastStatus: result.status,
        filePath,
      });
    }

    const importedImageIds = summary.imported.map((item) => item.id).filter(Boolean);
    if (importedImageIds.length > 0) {
      await this.waitForImportedImagesSettled(importedImageIds, (analysisProgress) => {
        emitProgress({
          mode: 'folder',
          phase: 'analyzing',
          ...analysisProgress,
          importedCount: summary.importedCount,
          duplicateCount: summary.duplicateCount,
          skippedCount: summary.skippedCount,
        });
      });
    }

    emitProgress({
      mode: 'folder',
      phase: 'completed',
      current: summary.importedCount,
      total: summary.importedCount,
      importedCount: summary.importedCount,
      duplicateCount: summary.duplicateCount,
      skippedCount: summary.skippedCount,
    });

    return summary;
  }

  async waitForImportedImagesSettled(imageIds, onProgress) {
    const normalizedImageIds = normalizeImageIds(imageIds);
    if (!normalizedImageIds.length) {
      if (typeof onProgress === 'function') {
        onProgress({
          current: 0,
          total: 0,
          readyCount: 0,
          failedCount: 0,
          queuedCount: 0,
          analyzingCount: 0,
          importedCount: 0,
        });
      }
      return;
    }

    const { clause, params } = buildInClauseParams('image', normalizedImageIds);
    const query = `
      SELECT analysis_status
      FROM images
      WHERE id IN (${clause})
    `;

    while (true) {
      await this.queue.drain();

      const rows = this.db.all(query, params);
      let readyCount = 0;
      let failedCount = 0;
      let queuedCount = 0;
      let analyzingCount = 0;
      let importedCount = 0;

      for (const row of rows) {
        const status = String(row.analysis_status || '');
        if (status === IMAGE_STATUS.READY) {
          readyCount += 1;
        } else if (status === IMAGE_STATUS.FAILED) {
          failedCount += 1;
        } else if (status === IMAGE_STATUS.ANALYZING) {
          analyzingCount += 1;
        } else if (status === IMAGE_STATUS.QUEUED) {
          queuedCount += 1;
        } else if (status === IMAGE_STATUS.IMPORTED) {
          importedCount += 1;
        }
      }

      const settledCount = readyCount + failedCount;
      if (typeof onProgress === 'function') {
        onProgress({
          current: settledCount,
          total: normalizedImageIds.length,
          readyCount,
          failedCount,
          queuedCount,
          analyzingCount,
          importedCount,
        });
      }

      if (settledCount >= normalizedImageIds.length) {
        return;
      }

      await sleep(160);
    }
  }

  async importFile(filePath, options = {}) {
    let resolved;

    try {
      resolved = resolveExistingFilePath(filePath);
    } catch (error) {
      return {
        status: 'skipped',
        reason: error.code || 'FILE_ACCESS_FAILED',
        filePath,
      };
    }

    if (!isSupportedImageFile(resolved.filePath)) {
      return {
        status: 'skipped',
        reason: 'UNSUPPORTED_FORMAT',
        filePath: resolved.filePath,
      };
    }

    if (resolved.stat.size > MAX_FILE_SIZE_BYTES) {
      return {
        status: 'skipped',
        reason: 'FILE_TOO_LARGE',
        filePath: resolved.filePath,
      };
    }

    let md5Hash;
    try {
      md5Hash = md5File(resolved.filePath);
    } catch {
      return {
        status: 'skipped',
        reason: 'HASH_COMPUTE_FAILED',
        filePath: resolved.filePath,
      };
    }

    const existed = this.db.get('SELECT id, library_path FROM images WHERE md5_hash = :md5Hash', { md5Hash });
    if (existed) {
      return {
        status: 'duplicate',
        reason: 'STRICT_DUPLICATE',
        filePath: resolved.filePath,
        imageId: existed.id,
      };
    }

    const fileName = path.basename(resolved.filePath);
    const libraryPath = buildLibraryPath(this.paths.libraryRootPath, md5Hash, fileName);
    const thumbnailPath = buildThumbnailPath(this.paths.thumbnailRootPath, md5Hash);
    const now = nowIso();
    let importedXmpMetadata = null;

    try {
      const xmpMetadata = readXmpMetadataForImage(resolved.filePath);
      if (xmpMetadata.hasCaption && xmpMetadata.hasTags) {
        importedXmpMetadata = {
          caption: xmpMetadata.caption,
          tags: xmpMetadata.tags,
          source: xmpMetadata.source,
        };
      }
    } catch (error) {
      this.logger.error('xmp-read-failed', {
        filePath: resolved.filePath,
        error: String(error?.message || error),
      });
    }

    let imageId;

    try {
      copyFile(resolved.filePath, libraryPath);
      createThumbnailPlaceholder(libraryPath, thumbnailPath);

      this.db.transaction(() => {
        const result = this.db.run(
          `INSERT INTO images (
            original_file_name,
            source_path,
            library_path,
            thumbnail_path,
            md5_hash,
            file_size,
            width,
            height,
            import_status,
            analysis_status,
            active_tag_source,
            created_at,
            updated_at
          ) VALUES (
            :originalFileName,
            :sourcePath,
            :libraryPath,
            :thumbnailPath,
            :md5Hash,
            :fileSize,
            NULL,
            NULL,
            'imported',
            :analysisStatus,
            :activeTagSource,
            :createdAt,
            :updatedAt
          )`,
          {
            originalFileName: fileName,
            sourcePath: resolved.filePath,
            libraryPath,
            thumbnailPath,
            md5Hash,
            fileSize: resolved.stat.size,
            analysisStatus: importedXmpMetadata ? IMAGE_STATUS.IMPORTED : IMAGE_STATUS.QUEUED,
            activeTagSource: importedXmpMetadata ? 'user' : 'ai',
            createdAt: now,
            updatedAt: now,
          },
        );

        imageId = Number(result.lastInsertRowid);

        if (importedXmpMetadata) {
          const captionInsert = this.db.run(
            `INSERT INTO captions (
              image_id,
              content,
              source,
              is_active,
              model_provider,
              model_name,
              created_at,
              updated_at
            ) VALUES (
              :imageId,
              :content,
              'user',
              1,
              NULL,
              NULL,
              :createdAt,
              :updatedAt
            )`,
            {
              imageId,
              content: importedXmpMetadata.caption,
              createdAt: now,
              updatedAt: now,
            },
          );

          this.upsertImageTagsBySource(imageId, importedXmpMetadata.tags, 'user', now);

          this.db.run(
            `UPDATE images
             SET active_caption_id = :captionId,
                 updated_at = :updatedAt
             WHERE id = :imageId`,
            {
              imageId,
              captionId: Number(captionInsert.lastInsertRowid),
              updatedAt: now,
            },
          );
        } else {
          this.createAnalysisJob(imageId, { jobType: 'analyze_image', maxRetryCount: 2, asTransaction: true });
        }
      });
    } catch (error) {
      removeFileIfExists(libraryPath);
      removeFileIfExists(thumbnailPath);
      this.logger.error('import-file-failed', {
        filePath: resolved.filePath,
        error: String(error?.message || error),
      });

      return {
        status: 'skipped',
        reason: 'IMPORT_WRITE_FAILED',
        filePath: resolved.filePath,
      };
    }

    let embeddingStatus = null;
    if (importedXmpMetadata) {
      try {
        this.syncImageMetadataToXmp(imageId);
      } catch (error) {
        this.logger.error('xmp-write-library-failed', {
          imageId,
          libraryPath,
          error: String(error?.message || error),
        });
      }

      const embeddingResult = await this.refreshEmbeddingWithFallback(imageId);
      embeddingStatus = embeddingResult.embeddingStatus;

      const nextStatus = embeddingResult.analysisStatus
        || (embeddingResult.embeddingStatus === 'refreshed'
          ? IMAGE_STATUS.READY
          : embeddingResult.embeddingStatus === 'failed'
            ? IMAGE_STATUS.FAILED
            : IMAGE_STATUS.QUEUED);

      this.db.run(
        `UPDATE images
         SET analysis_status = :analysisStatus,
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          imageId,
          analysisStatus: nextStatus,
          updatedAt: nowIso(),
        },
      );
    } else {
      await this.queue.drain();
    }

    return {
      status: 'imported',
      image: {
        id: imageId,
        sourcePath: resolved.filePath,
        libraryPath,
        thumbnailPath,
        fileSize: resolved.stat.size,
      },
      metadataSource: importedXmpMetadata ? importedXmpMetadata.source : null,
      embeddingStatus,
      mode: options.asStandalone === false ? 'folder' : 'single',
    };
  }

  createAnalysisJob(imageId, { jobType = 'analyze_image', maxRetryCount = 2, asTransaction = false } = {}) {
    const action = () => {
      const existing = this.db.get(
        `SELECT id
         FROM analysis_jobs
         WHERE image_id = :imageId
           AND job_type = :jobType
           AND status IN (:pending, :processing, :retrying)
         LIMIT 1`,
        {
          imageId,
          jobType,
          pending: JOB_STATUS.PENDING,
          processing: JOB_STATUS.PROCESSING,
          retrying: JOB_STATUS.RETRYING,
        },
      );

      if (existing) {
        return existing.id;
      }

      const now = nowIso();
      const result = this.db.run(
        `INSERT INTO analysis_jobs (
          image_id,
          job_type,
          status,
          retry_count,
          max_retry_count,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          :jobType,
          :status,
          0,
          :maxRetryCount,
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          jobType,
          status: JOB_STATUS.PENDING,
          maxRetryCount,
          createdAt: now,
          updatedAt: now,
        },
      );

      if (jobType === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :queued,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            queued: IMAGE_STATUS.QUEUED,
            updatedAt: now,
            imageId,
          },
        );
      }

      return Number(result.lastInsertRowid);
    };

    if (asTransaction) {
      return action();
    }

    return this.db.transaction(action);
  }

  async enqueueAnalysis(imageId) {
    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const jobId = this.createAnalysisJob(imageId, { jobType: 'analyze_image' });
    await this.queue.drain();
    return { jobId, imageId };
  }

  async retryAnalysis(jobId) {
    const job = this.db.get('SELECT * FROM analysis_jobs WHERE id = :jobId', { jobId });
    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }

    const now = nowIso();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE analysis_jobs
         SET status = :pending,
             retry_count = 0,
             last_error_code = NULL,
             last_error_message = NULL,
             started_at = NULL,
             finished_at = NULL,
             updated_at = :updatedAt
         WHERE id = :jobId`,
        {
          pending: JOB_STATUS.PENDING,
          updatedAt: now,
          jobId,
        },
      );

      if (job.job_type === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :queued,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            queued: IMAGE_STATUS.QUEUED,
            updatedAt: now,
            imageId: job.image_id,
          },
        );
      }
    });

    const timer = this.queue.retryTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.queue.retryTimers.delete(jobId);
    }

    await this.queue.drain();
    return { jobId, status: JOB_STATUS.PENDING };
  }

  async searchImages(query = '', selectedTags = [], pagination = {}) {
    const cleanQuery = String(query || '').trim();
    const tags = uniqueNonEmptyTags(selectedTags || []);
    const page = Number(pagination.page || 1);
    const pageSize = Math.min(Number(pagination.pageSize || SEARCH_PAGE_SIZE), SEARCH_PAGE_SIZE);
    const offset = (Math.max(page, 1) - 1) * pageSize;

    const candidates = this.getReadyImagesByTags(tags);

    if (cleanQuery.length === 0) {
      const sorted = [...candidates].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const paged = sorted.slice(offset, offset + pageSize);
      return {
        total: sorted.length,
        page,
        pageSize,
        items: this.attachActiveDataForImages(paged),
      };
    }

    const queryVector = await this.aiService.embedText(cleanQuery);
    const scored = [];

    for (const image of candidates) {
      const embedding = this.db.get('SELECT vector FROM embeddings WHERE image_id = :imageId', { imageId: image.id });
      if (!embedding) {
        continue;
      }

      const vector = toJsonVector(embedding.vector);
      const score = cosineSimilarity(queryVector, vector);
      scored.push({ image, score });
    }

    scored.sort((a, b) => {
      if (Math.abs(b.score - a.score) < 1e-9) {
        return b.image.updated_at.localeCompare(a.image.updated_at);
      }
      return b.score - a.score;
    });

    const paged = scored.slice(offset, offset + pageSize).map((item) => ({
      ...item.image,
      score: Number(item.score.toFixed(6)),
    }));

    return {
      total: scored.length,
      page,
      pageSize,
      items: this.attachActiveDataForImages(paged),
    };
  }

  getReadyImagesByTags(selectedTags) {
    if (!selectedTags.length) {
      return this.db.all(
        `SELECT *
         FROM images
         WHERE analysis_status = :ready`,
        { ready: IMAGE_STATUS.READY },
      );
    }

    const { clause, params } = buildInClauseParams('tag', selectedTags);
    const query = `
      SELECT i.*
      FROM images i
      JOIN image_tags it ON it.image_id = i.id
      JOIN tags t ON t.id = it.tag_id
      WHERE i.analysis_status = :ready
        AND ((i.active_tag_source = 'user' AND it.source = 'user')
             OR (i.active_tag_source = 'ai' AND it.source = 'ai'))
        AND t.name IN (${clause})
      GROUP BY i.id
      HAVING COUNT(DISTINCT t.name) = :tagCount
    `;

    return this.db.all(query, {
      ready: IMAGE_STATUS.READY,
      tagCount: selectedTags.length,
      ...params,
    });
  }

  attachActiveDataForImages(images) {
    return images.map((image) => {
      const activeCaption = this.db.get(
        `SELECT id, content, source, created_at, updated_at
         FROM captions
         WHERE id = :captionId`,
        { captionId: image.active_caption_id },
      );

      const tags = this.getEffectiveTags(image.id);

      return {
        ...image,
        activeCaption,
        tags,
      };
    });
  }

  getEffectiveTags(imageId) {
    const image = this.db.get('SELECT id, active_tag_source FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      return [];
    }

    const rows = this.db.all(
      `SELECT t.name
       FROM image_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = :imageId
         AND it.source = :source
       ORDER BY t.name ASC`,
      {
        imageId,
        source: image.active_tag_source === 'user' ? 'user' : 'ai',
      },
    );

    return rows.map((row) => row.name);
  }

  getImageDetail(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const activeCaption = this.db.get('SELECT * FROM captions WHERE id = :captionId', {
      captionId: image.active_caption_id,
    });

    const captionHistory = this.db.all(
      `SELECT *
       FROM captions
       WHERE image_id = :imageId
       ORDER BY created_at DESC`,
      { imageId },
    );

    const effectiveTags = this.getEffectiveTags(imageId);
    const aiSuggestedTags = this.db.all(
      `SELECT t.name
       FROM image_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = :imageId
         AND it.source = 'ai'
       ORDER BY t.name ASC`,
      { imageId },
    ).map((row) => row.name);

    const latestJob = this.db.get(
      `SELECT *
       FROM analysis_jobs
       WHERE image_id = :imageId
       ORDER BY created_at DESC
       LIMIT 1`,
      { imageId },
    );

    return {
      image,
      activeCaption,
      effectiveTags,
      aiSuggestedTags,
      captionHistory,
      latestJob,
    };
  }

  upsertImageTagsBySource(imageId, tags, source, createdAt) {
    const normalizedTags = uniqueNonEmptyTags(tags || []);

    this.db.run(
      `DELETE FROM image_tags
       WHERE image_id = :imageId
         AND source = :source`,
      { imageId, source },
    );

    for (const tagName of normalizedTags) {
      this.db.run(
        `INSERT INTO tags (name, language, created_at)
         VALUES (:name, 'zh', :createdAt)
         ON CONFLICT(name, language) DO NOTHING`,
        {
          name: tagName,
          createdAt,
        },
      );

      const tag = this.db.get("SELECT id FROM tags WHERE name = :name AND language = 'zh'", {
        name: tagName,
      });

      if (!tag) {
        continue;
      }

      this.db.run(
        `INSERT INTO image_tags (image_id, tag_id, source, created_at)
         VALUES (:imageId, :tagId, :source, :createdAt)
         ON CONFLICT(image_id, tag_id, source) DO NOTHING`,
        {
          imageId,
          tagId: tag.id,
          source,
          createdAt,
        },
      );
    }

    return normalizedTags;
  }

  getImageWritebackMetadata(imageId) {
    const image = this.db.get('SELECT id, library_path, active_caption_id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const caption = image.active_caption_id
      ? this.db.get(
        `SELECT content
         FROM captions
         WHERE id = :captionId`,
        { captionId: image.active_caption_id },
      )?.content || ''
      : '';

    const tags = this.getEffectiveTags(imageId);
    return {
      image,
      caption: String(caption || '').trim(),
      tags,
    };
  }

  syncImageMetadataToXmp(imageId, targetImagePath = '') {
    const metadata = this.getImageWritebackMetadata(imageId);
    const outputPath = targetImagePath ? path.resolve(targetImagePath) : metadata.image.library_path;
    const writeResult = writeXmpForImage(outputPath, {
      caption: metadata.caption,
      tags: metadata.tags,
    });

    return {
      imageId,
      outputPath,
      sidecarPath: writeResult.sidecarPath || '',
      embedded: Boolean(writeResult.embedded),
      writeMode: writeResult.mode || (writeResult.sidecarPath ? 'sidecar' : 'embedded'),
      caption: metadata.caption,
      tags: metadata.tags,
    };
  }

  async refreshEmbeddingWithFallback(imageId) {
    try {
      await this.aiService.refreshEmbedding(imageId);
      return {
        embeddingStatus: 'refreshed',
        analysisStatus: IMAGE_STATUS.READY,
      };
    } catch (error) {
      this.db.transaction(() => {
        const now = nowIso();
        this.db.run(
          `UPDATE images
           SET needs_embedding_refresh = 1,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            imageId,
            updatedAt: now,
          },
        );

        this.createAnalysisJob(imageId, {
          jobType: 'refresh_embedding',
          maxRetryCount: 2,
          asTransaction: true,
        });
      });

      await this.queue.drain();

      return {
        embeddingStatus: 'queued_for_refresh',
        analysisStatus: IMAGE_STATUS.QUEUED,
        errorCode: error?.code || 'EMBEDDING_REFRESH_FAILED',
      };
    }
  }

  async updateImageCaption(imageId, content) {
    const cleanContent = String(content || '').trim();
    if (!cleanContent) {
      throw new Error('EMPTY_CAPTION');
    }

    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    let captionId;

    this.db.transaction(() => {
      const now = nowIso();

      this.db.run('UPDATE captions SET is_active = 0 WHERE image_id = :imageId', { imageId });
      const result = this.db.run(
        `INSERT INTO captions (
          image_id,
          content,
          source,
          is_active,
          model_provider,
          model_name,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          :content,
          'user',
          1,
          NULL,
          NULL,
          :now,
          :now
        )`,
        {
          imageId,
          content: cleanContent,
          now,
        },
      );

      captionId = Number(result.lastInsertRowid);

      this.db.run(
        `UPDATE images
         SET active_caption_id = :captionId,
             needs_embedding_refresh = 0,
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          captionId,
          updatedAt: now,
          imageId,
        },
      );
    });

    const embeddingResult = await this.refreshEmbeddingWithFallback(imageId);
    let xmpSidecarPath = '';
    try {
      xmpSidecarPath = this.syncImageMetadataToXmp(imageId).sidecarPath;
    } catch (error) {
      this.logger.error('xmp-write-library-failed', {
        imageId,
        error: String(error?.message || error),
      });
    }

    return { imageId, captionId, ...embeddingResult, xmpSidecarPath };
  }

  async updateImageTags(imageId, tags) {
    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    this.db.transaction(() => {
      const now = nowIso();
      this.upsertImageTagsBySource(imageId, tags, 'user', now);

      this.db.run(
        `UPDATE images
         SET active_tag_source = 'user',
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          imageId,
          updatedAt: now,
        },
      );
    });

    const embeddingResult = await this.refreshEmbeddingWithFallback(imageId);
    let xmpSidecarPath = '';
    try {
      xmpSidecarPath = this.syncImageMetadataToXmp(imageId).sidecarPath;
    } catch (error) {
      this.logger.error('xmp-write-library-failed', {
        imageId,
        error: String(error?.message || error),
      });
    }

    return {
      imageId,
      activeTagSource: 'user',
      tags: this.getEffectiveTags(imageId),
      ...embeddingResult,
      xmpSidecarPath,
    };
  }

  exportImage(imageId, destinationPath) {
    const image = this.db.get(
      `SELECT id, original_file_name, library_path
       FROM images
       WHERE id = :imageId`,
      { imageId },
    );

    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    if (!destinationPath) {
      throw new Error('EXPORT_PATH_REQUIRED');
    }

    const outputPath = appendOriginalExtensionIfMissing(path.resolve(destinationPath), image.original_file_name);
    copyFile(image.library_path, outputPath);
    const xmpSync = this.syncImageMetadataToXmp(imageId, outputPath);

    return {
      imageId,
      filePath: outputPath,
      sidecarPath: xmpSync.sidecarPath,
      embedded: xmpSync.embedded,
      writeMode: xmpSync.writeMode,
    };
  }

  exportImages(imageIds, destinationDir) {
    const resolvedDir = resolveExistingFolderPath(destinationDir);
    const normalizedImageIds = normalizeImageIds(imageIds);
    if (!normalizedImageIds.length) {
      throw new Error('EMPTY_EXPORT_SELECTION');
    }

    const usedPaths = new Set();
    const exported = [];
    const failed = [];

    for (const imageId of normalizedImageIds) {
      const image = this.db.get(
        `SELECT id, original_file_name, library_path
         FROM images
         WHERE id = :imageId`,
        { imageId },
      );

      if (!image) {
        failed.push({
          imageId,
          reason: 'IMAGE_NOT_FOUND',
        });
        continue;
      }

      const baseName = sanitizeExportFileName(image.original_file_name, `image-${image.id}.jpg`);
      const parsed = path.parse(baseName);
      const ext = parsed.ext || path.extname(image.original_file_name) || '.jpg';
      const stem = parsed.name || `image-${image.id}`;

      let index = 0;
      let outputPath = '';
      do {
        const suffix = index === 0 ? '' : `-${index + 1}`;
        outputPath = path.join(resolvedDir, `${stem}${suffix}${ext}`);
        index += 1;
      } while (usedPaths.has(outputPath.toLowerCase()) || fs.existsSync(outputPath));

      usedPaths.add(outputPath.toLowerCase());

      try {
        copyFile(image.library_path, outputPath);
        const xmpSync = this.syncImageMetadataToXmp(image.id, outputPath);
        exported.push({
          imageId: image.id,
          filePath: outputPath,
          sidecarPath: xmpSync.sidecarPath,
          embedded: xmpSync.embedded,
          writeMode: xmpSync.writeMode,
        });
      } catch (error) {
        failed.push({
          imageId: image.id,
          reason: error?.code || 'EXPORT_FAILED',
          message: String(error?.message || error),
        });
      }
    }

    return {
      destinationDir: resolvedDir,
      requestedCount: normalizedImageIds.length,
      exportedCount: exported.length,
      failedCount: failed.length,
      exported,
      failed,
    };
  }

  deleteImage(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    this.db.transaction(() => {
      this.db.run('DELETE FROM images WHERE id = :imageId', { imageId });
    });

    removeFileIfExists(image.library_path);
    removeFileIfExists(image.thumbnail_path);
    removeFileIfExists(buildXmpSidecarPathForImage(image.library_path));

    return {
      imageId,
      deleted: true,
    };
  }

  async rebuildImageAnalysis(imageId) {
    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const now = nowIso();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE images
         SET analysis_status = :queued,
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          queued: IMAGE_STATUS.QUEUED,
          updatedAt: now,
          imageId,
        },
      );

      this.db.run(
        `INSERT INTO analysis_jobs (
          image_id,
          job_type,
          status,
          retry_count,
          max_retry_count,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          'analyze_image',
          :status,
          0,
          2,
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          status: JOB_STATUS.PENDING,
          createdAt: now,
          updatedAt: now,
        },
      );
    });

    await this.queue.drain();

    return {
      imageId,
      status: IMAGE_STATUS.QUEUED,
    };
  }

  getFilterTags(query = '') {
    const cleanQuery = String(query || '').trim();
    const params = {};
    let whereClause = '';

    if (cleanQuery) {
      whereClause = 'WHERE t.name LIKE :query';
      params.query = `%${cleanQuery}%`;
    }

    return this.db.all(
      `SELECT t.name, COUNT(DISTINCT it.image_id) AS count
       FROM tags t
       LEFT JOIN image_tags it ON it.tag_id = t.id
       ${whereClause}
       GROUP BY t.id, t.name
       ORDER BY count DESC, t.name ASC
       LIMIT 50`,
      params,
    );
  }

  getAppSettings() {
    const settings = this.db.ensureSettings(this.paths.libraryRootPath);
    return {
      provider: settings.api_provider || 'zhipu',
      apiKey: settings.api_key_ref || '',
      cloudAnalysisEnabled: Boolean(settings.cloud_analysis_enabled),
      libraryRootPath: settings.library_root_path || this.paths.libraryRootPath,
    };
  }

  async updateAppSettings(payload = {}) {
    const current = this.db.ensureSettings(this.paths.libraryRootPath);
    const now = nowIso();
    const provider = String(payload.provider || current.api_provider || 'zhipu').trim() || 'zhipu';
    const apiKey = String(payload.apiKey ?? current.api_key_ref ?? '').trim();
    const cloudAnalysisEnabled = payload.cloudAnalysisEnabled == null
      ? Number(current.cloud_analysis_enabled || 0)
      : payload.cloudAnalysisEnabled
        ? 1
        : 0;

    this.db.run(
      `UPDATE app_settings
       SET api_provider = :provider,
           api_key_ref = :apiKey,
           cloud_analysis_enabled = :cloudAnalysisEnabled,
           updated_at = :updatedAt
       WHERE id = :id`,
      {
        id: current.id,
        provider,
        apiKey,
        cloudAnalysisEnabled,
        updatedAt: now,
      },
    );

    const providerChanged = String(current.api_provider || '') !== provider;
    const apiKeyChanged = String(current.api_key_ref || '') !== apiKey;
    if (providerChanged || apiKeyChanged) {
      await this.resyncAllImagesForProviderChange(provider);
    }

    return this.getAppSettings();
  }

  async resyncAllImagesForProviderChange(provider) {
    const rows = this.db.all(
      `SELECT i.id, c.source AS caption_source, c.model_provider
       FROM images i
       LEFT JOIN captions c ON c.id = i.active_caption_id
       WHERE i.active_caption_id IS NOT NULL`,
    );

    if (!rows.length) {
      return { reanalyzeCount: 0, refreshEmbeddingCount: 0 };
    }

    let reanalyzeCount = 0;
    let refreshEmbeddingCount = 0;

    this.db.transaction(() => {
      const now = nowIso();
      for (const row of rows) {
        const shouldReanalyze = row.caption_source === 'ai'
          && String(row.model_provider || '').trim()
          && String(row.model_provider || '').trim() !== provider;

        this.createAnalysisJob(row.id, {
          jobType: shouldReanalyze ? 'analyze_image' : 'refresh_embedding',
          maxRetryCount: 2,
          asTransaction: true,
        });

        this.db.run(
          `UPDATE images
           SET needs_embedding_refresh = 1,
               analysis_status = CASE
                 WHEN :shouldReanalyze = 1 THEN :queued
                 ELSE analysis_status
               END,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            imageId: row.id,
            shouldReanalyze: shouldReanalyze ? 1 : 0,
            queued: IMAGE_STATUS.QUEUED,
            updatedAt: now,
          },
        );

        if (shouldReanalyze) {
          reanalyzeCount += 1;
        } else {
          refreshEmbeddingCount += 1;
        }
      }
    });

    await this.queue.drain();
    return { reanalyzeCount, refreshEmbeddingCount };
  }
}
