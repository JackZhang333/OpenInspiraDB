// Default configuration values (non-sensitive)
// All values can be overridden via environment variables
const DEFAULT_ZHIPU_API_BASE = process.env.ZHIPU_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';
const DEFAULT_ZHIPU_VISION_MODEL = process.env.ZHIPU_VISION_MODEL || 'GLM-4V-Plus-0111';
const DEFAULT_ZHIPU_REASONING_MODEL = process.env.ZHIPU_REASONING_MODEL || 'GLM-4-Flash';
const DEFAULT_ZHIPU_EMBEDDING_MODEL = process.env.ZHIPU_EMBEDDING_MODEL || 'embedding-3';
const DEFAULT_ZHIPU_EMBEDDING_DIMENSIONS = parseInt(process.env.ZHIPU_EMBEDDING_DIMENSIONS, 10) || 256;

function toNonEmptyString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function toPositiveInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

/**
 * Validates that required configuration is present
 * @param {Object} config - The configuration object
 * @throws {Error} If ZHIPU_API_KEY is not configured
 */
function validateConfig(config) {
  if (!config?.zhipu?.apiKey) {
    throw new Error(
      'ZHIPU_API_KEY is not configured. ' +
      'Please set the ZHIPU_API_KEY environment variable or pass it via overrides. ' +
      'Get your API key from: https://open.bigmodel.cn/usercenter/apikeys'
    );
  }
}

export function createModelConfig(overrides = {}) {
  const zhipuOverrides = overrides.zhipu && typeof overrides.zhipu === 'object'
    ? overrides.zhipu
    : {};

  const config = Object.freeze({
    zhipu: Object.freeze({
      apiBase: toNonEmptyString(zhipuOverrides.apiBase, DEFAULT_ZHIPU_API_BASE),
      apiKey: toNonEmptyString(zhipuOverrides.apiKey, process.env.ZHIPU_API_KEY),
      visionModel: toNonEmptyString(zhipuOverrides.visionModel, DEFAULT_ZHIPU_VISION_MODEL),
      reasoningModel: toNonEmptyString(zhipuOverrides.reasoningModel, DEFAULT_ZHIPU_REASONING_MODEL),
      embeddingModel: toNonEmptyString(zhipuOverrides.embeddingModel, DEFAULT_ZHIPU_EMBEDDING_MODEL),
      embeddingDimensions: toPositiveInteger(
        zhipuOverrides.embeddingDimensions,
        DEFAULT_ZHIPU_EMBEDDING_DIMENSIONS,
      ),
    }),
  });

  // Validate configuration
  validateConfig(config);

  return config;
}

// Application model configuration
// Configure via environment variables or pass overrides when calling createModelConfig()
// Required: ZHIPU_API_KEY environment variable
export const modelConfig = createModelConfig();
