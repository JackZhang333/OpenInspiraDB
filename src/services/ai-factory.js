import { MockAiService } from './mock-ai.js';
import { ZhipuAiService } from './zhipu-ai.js';

export class RoutedAiService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.mockService = new MockAiService(db, logger);
    this.zhipuService = new ZhipuAiService(db, logger);
  }

  getProvider() {
    const settings = this.db.get('SELECT api_provider FROM app_settings LIMIT 1');
    return String(settings?.api_provider || 'mock').trim() || 'mock';
  }

  getActiveService() {
    return this.getProvider() === 'zhipu' ? this.zhipuService : this.mockService;
  }

  async analyzeImage(imageId) {
    return this.getActiveService().analyzeImage(imageId);
  }

  async refreshEmbedding(imageId) {
    return this.getActiveService().refreshEmbedding(imageId);
  }

  async embedText(text) {
    return this.getActiveService().embedText(text);
  }
}
