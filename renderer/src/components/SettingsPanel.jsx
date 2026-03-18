import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';

const AI_PROVIDERS = [
  { id: 'zhipu', name: '智谱 AI', desc: '国内领先的 GLM 大模型' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4 Vision 模型' },
];

export function SettingsPanel({ isOpen, onClose, settings, onSave }) {
  const [formData, setFormData] = useState({
    provider: 'zhipu',
    apiKey: '',
    ...settings,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 当设置变化时更新表单
  useEffect(() => {
    if (settings) {
      setFormData({
        provider: settings.provider || 'zhipu',
        apiKey: settings.apiKey || '',
      });
    }
  }, [settings]);

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave?.({
        provider: formData.provider,
        apiKey: formData.apiKey.trim(),
      });
      onClose?.();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-clay/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">设置</h2>
            <p className="text-[12px] text-ink/50">配置 AI 服务</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 hover:bg-clay/10 hover:text-ink/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* AI 提供商选择 */}
          <div className="space-y-3">
            <label className="text-[13px] font-medium text-ink/70">
              AI 服务
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AI_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setFormData({ ...formData, provider: provider.id })}
                  className={cn(
                    'relative flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                    formData.provider === provider.id
                      ? 'border-moss bg-moss/5 ring-1 ring-moss'
                      : 'border-clay/20 hover:border-clay/40'
                  )}
                >
                  <span className="text-[13px] font-medium text-ink">
                    {provider.name}
                  </span>
                  <span className="text-[11px] text-ink/50 mt-0.5">
                    {provider.desc}
                  </span>
                  {formData.provider === provider.id && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-moss flex items-center justify-center">
                      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key 输入 */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-ink/70">
              API Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/30" />
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={`输入 ${AI_PROVIDERS.find(p => p.id === formData.provider)?.name} API Key`}
                className={cn(
                  'w-full h-10 pl-10 pr-10',
                  'rounded-lg border border-clay/20',
                  'text-[13px] text-ink placeholder:text-ink/30',
                  'focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss/30'
                )}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-ink/40">
              API Key 仅保存在本地，不会上传到任何服务器
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 border-t border-clay/10 px-6 py-4 bg-ink/[0.02]">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.apiKey.trim() || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}
