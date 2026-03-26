import { ZhipuAiService } from './zhipu-ai.js';
import { modelConfig as defaultModelConfig } from '../model-config.js';

export class RoutedAiService {
  constructor(db, logger, options = {}) {
    this.db = db;
    this.logger = logger;
    this.modelConfig = options.modelConfig || defaultModelConfig;
    this.zhipuService = new ZhipuAiService(db, logger, {
      modelConfig: this.modelConfig,
      resolveImageForRead: options.resolveImageForRead,
    });
  }

  async analyzeImage(imageId) {
    return this.zhipuService.analyzeImage(imageId);
  }

  async refreshEmbedding(imageId) {
    return this.zhipuService.refreshEmbedding(imageId);
  }

  async embedText(text) {
    return this.zhipuService.embedText(text);
  }

  async previewTagOrganization() {
    return this.zhipuService.previewTagOrganization();
  }
}
