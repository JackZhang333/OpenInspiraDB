const DEFAULT_ZHIPU_API_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const DEFAULT_ZHIPU_VISION_MODEL = 'GLM-4V-Plus-0111';
const DEFAULT_ZHIPU_REASONING_MODEL = 'GLM-4-Flash';
const DEFAULT_ZHIPU_EMBEDDING_MODEL = 'embedding-3';
const DEFAULT_ZHIPU_EMBEDDING_DIMENSIONS = 256;

function toNonEmptyString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function toPositiveInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

export function createModelConfig(overrides = {}) {
  const zhipuOverrides = overrides.zhipu && typeof overrides.zhipu === 'object'
    ? overrides.zhipu
    : {};

  return Object.freeze({
    zhipu: Object.freeze({
      apiBase: toNonEmptyString(zhipuOverrides.apiBase, DEFAULT_ZHIPU_API_BASE),
      apiKey: toNonEmptyString(zhipuOverrides.apiKey, toNonEmptyString(process.env.ZHIPU_API_KEY)),
      visionModel: toNonEmptyString(zhipuOverrides.visionModel, DEFAULT_ZHIPU_VISION_MODEL),
      reasoningModel: toNonEmptyString(zhipuOverrides.reasoningModel, DEFAULT_ZHIPU_REASONING_MODEL),
      embeddingModel: toNonEmptyString(zhipuOverrides.embeddingModel, DEFAULT_ZHIPU_EMBEDDING_MODEL),
      embeddingDimensions: toPositiveInteger(
        zhipuOverrides.embeddingDimensions,
        DEFAULT_ZHIPU_EMBEDDING_DIMENSIONS,
      ),
    }),
  });
}

// Developer-facing model config.
// Adjust Zhipu model names and API key here instead of exposing them in the UI.
export const modelConfig = createModelConfig({
  zhipu: {
    apiKey: '779d8f44b3ec439aa4f97639647a1056.1GChEVBWJDc44ozI',
    visionModel: 'GLM-4V-Plus-0111',
    reasoningModel: 'GLM-4-Flash',
    embeddingModel: 'embedding-3',
    embeddingDimensions: 256,
  },
});
